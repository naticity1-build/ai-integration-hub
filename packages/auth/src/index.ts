import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { HubStore } from "@hub/db";
import type { UserContext } from "@hub/core";

export interface AuthContext {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  tenantId: string | null;
  roleName: string | null;
}

export interface McpTokenResult {
  token: string;
  tokenId: string;
  expiresAt: Date | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateMcpToken(): string {
  return `hub_${randomBytes(32).toString("base64url")}`;
}

export function isOrgAdmin(auth: AuthContext): boolean {
  return auth.roleName === "admin" && !!auth.tenantId;
}

export function canManageTenant(auth: AuthContext, tenantId: string): boolean {
  return auth.isSuperAdmin || (isOrgAdmin(auth) && auth.tenantId === tenantId);
}

export function canAccessTenant(auth: AuthContext, tenantId: string): boolean {
  return auth.isSuperAdmin || auth.tenantId === tenantId;
}

export function requireSuperAdmin(auth: AuthContext): void {
  if (!auth.isSuperAdmin) {
    throw new Error("Super admin access required");
  }
}

export function requireOrgAdmin(auth: AuthContext): void {
  if (!isOrgAdmin(auth)) {
    throw new Error("Org admin access required");
  }
}

export function requireOrgOrSuperAdmin(auth: AuthContext, tenantId: string): void {
  if (!canManageTenant(auth, tenantId)) {
    throw new Error("Org admin access required");
  }
}

/** @deprecated Use requireOrgAdmin */
export function requireAdmin(auth: AuthContext): void {
  requireOrgAdmin(auth);
}

export async function issueMcpToken(
  store: HubStore,
  userId: string,
  options?: { name?: string; expiresInDays?: number }
): Promise<McpTokenResult> {
  const user = await store.getUserContext(userId);
  if (!user) throw new Error("User not found");

  const token = generateMcpToken();
  const tokenHash = hashToken(token);
  const expiresAt = options?.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const { id } = await store.createMcpToken({
    userId,
    tenantId: user.tenantId,
    tokenHash,
    name: options?.name,
    expiresAt,
  });

  return { token, tokenId: id, expiresAt };
}

export async function resolveUserFromMcpToken(
  token: string,
  store: HubStore
): Promise<{ userId: string; tenantId: string } | null> {
  const tokenHash = hashToken(token);
  const record = await store.getMcpTokenByHash(tokenHash);
  if (!record) return null;
  if (record.revokedAt) return null;
  if (record.expiresAt && record.expiresAt < new Date()) return null;
  return { userId: record.userId, tenantId: record.tenantId };
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(supabaseUrl: string) {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

export async function verifySupabaseJwt(
  token: string,
  supabaseUrl: string
): Promise<Record<string, unknown>> {
  const { payload } = await jwtVerify(token, getJwks(supabaseUrl), {
    issuer: `${supabaseUrl}/auth/v1`,
  });
  return payload as Record<string, unknown>;
}

export function extractAuthFromJwt(payload: Record<string, unknown>): AuthContext | null {
  const sub = payload.sub as string | undefined;
  const appMeta = (payload.app_metadata ?? {}) as Record<string, unknown>;
  const tenantId = (appMeta.tenant_id as string | undefined) ?? null;
  const roleName = (appMeta.role_name as string | undefined) ?? null;
  const email = (payload.email as string) ?? "";
  const isSuperAdmin = appMeta.is_super_admin === true;

  if (!sub) return null;
  if (!isSuperAdmin && !tenantId) return null;

  return {
    userId: (appMeta.hub_user_id as string) ?? sub,
    email,
    isSuperAdmin,
    tenantId,
    roleName: roleName ?? (tenantId ? "viewer" : null),
  };
}

export async function provisionUser(
  supabase: SupabaseClient,
  store: HubStore,
  data: {
    authUserId: string;
    tenantId: string;
    email: string;
    displayName: string;
    departmentId: string | null;
    roleId: string;
    roleName: string;
  }
): Promise<UserContext> {
  await store.createUser({
    id: data.authUserId,
    tenantId: data.tenantId,
    email: data.email,
    displayName: data.displayName,
    departmentId: data.departmentId,
    roleId: data.roleId,
  });

  const { data: existingAuth } = await supabase.auth.admin.getUserById(data.authUserId);
  const existingMeta = (existingAuth.user?.app_metadata ?? {}) as Record<string, unknown>;

  await supabase.auth.admin.updateUserById(data.authUserId, {
    app_metadata: {
      ...existingMeta,
      tenant_id: data.tenantId,
      hub_user_id: data.authUserId,
      role_id: data.roleId,
      department_id: data.departmentId,
      role_name: data.roleName,
    },
  });

  const ctx = await store.getUserContext(data.authUserId);
  if (!ctx) throw new Error("Failed to provision user");
  return ctx;
}

export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.includes("REPLACE_WITH")) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required. Set them in .env (root) or packages/web/.env.local"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticateRequest(
  authHeader: string | undefined,
  store: HubStore
): Promise<AuthContext | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  const mcpResolved = await resolveUserFromMcpToken(token, store);
  if (mcpResolved) {
    const user = await store.getUserContext(mcpResolved.userId);
    if (!user) return null;
    return {
      userId: user.userId,
      email: user.email,
      isSuperAdmin: false,
      tenantId: user.tenantId,
      roleName: user.roleName,
    };
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const payload = await verifySupabaseJwt(token, supabaseUrl);
    const auth = extractAuthFromJwt(payload);
    if (!auth) return null;

    if (!auth.isSuperAdmin) return auth;

    const isPlatformAdmin = await store.isPlatformAdmin(auth.userId);
    if (!isPlatformAdmin) {
      return { ...auth, isSuperAdmin: false };
    }
    return auth;
  } catch {
    return null;
  }
}

export { updateUserAsAdmin } from "./admin-users.js";

export interface RegisterUserInput {
  email: string;
  password: string;
  displayName: string;
  mode: "join" | "create";
  tenantSlug?: string;
  tenantName?: string;
  orgSlug?: string;
}

export interface RegisterUserResult {
  userId: string;
  tenantId: string;
  email: string;
  roleName: string;
}

const SLUG_RE = /^[a-z0-9-]+$/;

export async function registerUser(
  store: HubStore,
  supabase: SupabaseClient,
  input: RegisterUserInput
): Promise<RegisterUserResult> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const password = input.password;

  if (!email || !password || password.length < 6) {
    throw new Error("Email and password (min 6 chars) are required");
  }
  if (!displayName) {
    throw new Error("Display name is required");
  }

  let tenantId: string;
  let roleId: string;
  let roleName: string;
  const departmentId: string | null = null;

  if (input.mode === "create") {
    const name = input.tenantName?.trim();
    const slug = input.orgSlug?.trim().toLowerCase();
    if (!name || !slug) throw new Error("Organization name and slug are required");
    if (!SLUG_RE.test(slug)) throw new Error("Slug must be lowercase letters, numbers, and hyphens only");

    const existing = await store.getTenantBySlug(slug);
    if (existing) throw new Error("Organization slug already taken");

    const tenant = await store.createTenant({ name, slug });
    tenantId = tenant.id;
  } else {
    const slug = (input.tenantSlug ?? "abc").trim().toLowerCase();
    const tenant = await store.getTenantBySlug(slug);
    if (!tenant) throw new Error(`Organization "${slug}" not found`);
    tenantId = tenant.id;
  }

  const roles = await store.listRoles(tenantId);

  if (input.mode === "create") {
    const adminRole = roles.find((r) => r.name === "admin");
    if (!adminRole) throw new Error("Organization has no admin role configured");
    roleId = adminRole.id;
    roleName = adminRole.name;
  } else {
    const viewerRole = roles.find((r) => r.name === "viewer");
    if (!viewerRole) throw new Error("Organization has no viewer role configured");
    roleId = viewerRole.id;
    roleName = viewerRole.name;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to create auth user");
  }

  await provisionUser(supabase, store, {
    authUserId: data.user.id,
    tenantId,
    email,
    displayName,
    departmentId,
    roleId,
    roleName,
  });

  await store.logAudit({
    tenantId,
    userId: data.user.id,
    action: "user_registered",
    metadata: { email, mode: input.mode, roleName },
  });

  return {
    userId: data.user.id,
    tenantId,
    email,
    roleName,
  };
}
