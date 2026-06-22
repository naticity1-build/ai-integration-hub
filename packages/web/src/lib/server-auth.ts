import { createClient } from "@/lib/supabase/server";
import { createHubStore } from "@hub/db";
import {
  createSupabaseAdminClient,
  extractAuthFromJwt,
  requireOrgAdmin,
  requireSuperAdmin,
  requireOrgOrSuperAdmin,
  isOrgAdmin,
  canManageTenant,
  type AuthContext,
} from "@hub/auth";

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const payload = JSON.parse(
    Buffer.from(session.access_token.split(".")[1]!, "base64url").toString()
  ) as Record<string, unknown>;

  const auth = extractAuthFromJwt(payload);
  if (!auth) return null;

  if (auth.isSuperAdmin) {
    const store = createHubStore();
    const isPlatformAdmin = await store.isPlatformAdmin(auth.userId);
    if (!isPlatformAdmin) {
      return { ...auth, isSuperAdmin: false };
    }
  }

  return auth;
}

export async function requireAuthContext(): Promise<AuthContext> {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Unauthorized");
  return auth;
}

export async function requireSuperAdminContext(): Promise<AuthContext> {
  const auth = await requireAuthContext();
  requireSuperAdmin(auth);
  return auth;
}

export async function requireOrgAdminContext(): Promise<AuthContext> {
  const auth = await requireAuthContext();
  requireOrgAdmin(auth);
  return auth;
}

export async function requireOrgOrSuperAdminContext(tenantId: string): Promise<AuthContext> {
  const auth = await requireAuthContext();
  requireOrgOrSuperAdmin(auth, tenantId);
  return auth;
}

/** @deprecated Use requireOrgAdminContext or requireOrgOrSuperAdminContext */
export async function requireAdminContext(tenantId?: string): Promise<AuthContext> {
  if (tenantId) {
    return requireOrgOrSuperAdminContext(tenantId);
  }
  return requireOrgAdminContext();
}

export function resolveEffectiveTenantId(auth: AuthContext, requestedTenantId?: string | null): string {
  if (auth.isSuperAdmin) {
    if (!requestedTenantId) throw new Error("Tenant ID required");
    return requestedTenantId;
  }
  if (!auth.tenantId) throw new Error("Unauthorized");
  if (requestedTenantId && requestedTenantId !== auth.tenantId) {
    throw new Error("Forbidden");
  }
  return auth.tenantId;
}

export function canManageUsers(auth: AuthContext | null, tenantId?: string): boolean {
  if (!auth) return false;
  if (tenantId) return canManageTenant(auth, tenantId);
  return isOrgAdmin(auth);
}

export function getHubStore() {
  return createHubStore();
}

export function getSupabaseAdmin() {
  return createSupabaseAdminClient();
}
