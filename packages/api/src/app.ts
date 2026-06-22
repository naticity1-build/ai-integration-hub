import { Hono } from "hono";
import { cors } from "hono/cors";
import { createHubStore, wireCredentialResolver } from "@hub/db";
import {
  authenticateRequest,
  issueMcpToken,
  provisionUser,
  createSupabaseAdminClient,
  requireSuperAdmin,
  requireOrgOrSuperAdmin,
  canAccessTenant,
  canManageTenant,
  registerUser,
  updateUserAsAdmin,
  type AuthContext,
} from "@hub/auth";
import {
  globalRegistry,
  registerBuiltInConnectors,
  buildOAuthUrl,
  exchangeOAuthCode,
  getOAuthProvider,
  getConnectorMetadata,
  isAuthTypeSupported,
  resolveConnectionAuthType,
  AUTH_TYPE_DEFINITIONS,
  CONNECTOR_METADATA,
  buildTenantConnectorSettings,
} from "@hub/connectors";
import type { ConnectionAuthType } from "@hub/connectors";
import { randomBytes } from "node:crypto";
import type { ConnectorType } from "@hub/core";

registerBuiltInConnectors();

const store = createHubStore();
wireCredentialResolver(store);
const app = new Hono();

function webOrigin(): string {
  if (process.env.WEB_ORIGIN) return process.env.WEB_ORIGIN;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

app.use("*", cors({ origin: webOrigin(), credentials: true }));

app.post("/api/v1/auth/register", async (c) => {
  try {
    const body = await c.req.json<{
      email: string;
      password: string;
      displayName: string;
      mode: "join" | "create";
      tenantSlug?: string;
      tenantName?: string;
      orgSlug?: string;
    }>();

    const supabase = createSupabaseAdminClient();
    const result = await registerUser(store, supabase, body);
    return c.json(result, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return c.json({ error: message }, 400);
  }
});

type Variables = {
  auth: Awaited<ReturnType<typeof authenticateRequest>>;
};

const api = new Hono<{ Variables: Variables }>();

api.use("*", async (c, next) => {
  const auth = await authenticateRequest(c.req.header("Authorization"), store);
  c.set("auth", auth);
  await next();
});

function requireAuth(c: { get: (k: "auth") => Variables["auth"] }) {
  const auth = c.get("auth");
  if (!auth) throw new Error("Unauthorized");
  return auth;
}

function assertTenantAccess(auth: AuthContext, tenantId: string) {
  if (!canAccessTenant(auth, tenantId)) {
    throw new Error("Forbidden");
  }
}

function assertTenantManage(auth: AuthContext, tenantId: string) {
  requireOrgOrSuperAdmin(auth, tenantId);
}

// Health
api.get("/health", (c) => c.json({ status: "ok" }));

// Current user MCP token
api.post("/me/mcp-token", async (c) => {
  const auth = requireAuth(c);
  const body = await c.req.json<{ name?: string; expiresInDays?: number }>().catch(() => ({}));
  const result = await issueMcpToken(store, auth.userId, body);
  return c.json(result);
});

api.get("/me", async (c) => {
  const auth = requireAuth(c);
  const user = await store.getUserContext(auth.userId);
  return c.json({ auth, user });
});

// Tenants (super-admin only)
api.get("/tenants", async (c) => {
  const auth = requireAuth(c);
  requireSuperAdmin(auth);
  const tenants = await store.listTenants();
  return c.json(tenants);
});

api.post("/tenants", async (c) => {
  const auth = requireAuth(c);
  requireSuperAdmin(auth);
  const body = await c.req.json<{ name: string; slug: string }>();
  const tenant = await store.createTenant(body);
  return c.json(tenant, 201);
});

api.get("/tenants/:tenantId", async (c) => {
  const auth = requireAuth(c);
  const tenantId = c.req.param("tenantId");
  assertTenantAccess(auth, tenantId);
  const tenant = await store.getTenant(tenantId);
  if (!tenant) return c.json({ error: "Not found" }, 404);
  return c.json(tenant);
});

// Users
api.get("/tenants/:tenantId/users", async (c) => {
  const auth = requireAuth(c);
  const tenantId = c.req.param("tenantId");
  assertTenantAccess(auth, tenantId);
  const users = await store.listUsers(tenantId);
  return c.json(users);
});

api.post("/tenants/:tenantId/users/invite", async (c) => {
  const auth = requireAuth(c);
  const tenantId = c.req.param("tenantId");
  assertTenantManage(auth, tenantId);
  const body = await c.req.json<{
    email: string;
    displayName: string;
    departmentId: string | null;
    roleId: string;
    password: string;
  }>();

  const roles = await store.listRoles(tenantId);
  const role = roles.find((r) => r.id === body.roleId);
  if (!role) return c.json({ error: "Invalid role" }, 400);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
  });

  if (error || !data.user) return c.json({ error: error?.message ?? "Failed to create auth user" }, 400);

  const user = await provisionUser(supabase, store, {
    authUserId: data.user.id,
    tenantId,
    email: body.email,
    displayName: body.displayName,
    departmentId: body.departmentId,
    roleId: body.roleId,
    roleName: role.name,
  });

  return c.json(user, 201);
});

api.patch("/tenants/:tenantId/users/:userId", async (c) => {
  const auth = requireAuth(c);
  const tenantId = c.req.param("tenantId");
  assertTenantManage(auth, tenantId);
  const body = await c.req.json<{
    departmentId?: string | null;
    roleId?: string;
    isActive?: boolean;
    displayName?: string;
  }>();

  let roleName: import("@hub/core").RoleName | undefined;
  if (body.roleId) {
    const roles = await store.listRoles(tenantId);
    roleName = roles.find((r) => r.id === body.roleId)?.name;
  }

  const supabase = createSupabaseAdminClient();
  const user = await updateUserAsAdmin(
    store,
    supabase,
    c.req.param("userId"),
    tenantId,
    { ...body, roleName }
  );
  return c.json(user);
});

// Departments
api.get("/tenants/:tenantId/departments", async (c) => {
  const auth = requireAuth(c);
  const tenantId = c.req.param("tenantId");
  assertTenantAccess(auth, tenantId);
  return c.json(await store.listDepartments(tenantId));
});

api.post("/tenants/:tenantId/departments", async (c) => {
  const auth = requireAuth(c);
  const tenantId = c.req.param("tenantId");
  assertTenantManage(auth, tenantId);
  const body = await c.req.json<{ name: string; parentId?: string | null }>();
  const dept = await store.createDepartment({
    tenantId,
    ...body,
  });
  return c.json(dept, 201);
});

// Roles
api.get("/tenants/:tenantId/roles", async (c) => {
  const auth = requireAuth(c);
  const tenantId = c.req.param("tenantId");
  assertTenantAccess(auth, tenantId);
  return c.json(await store.listRoles(tenantId));
});

// Connections
api.get("/tenants/:tenantId/connections", async (c) => {
  const auth = requireAuth(c);
  const tenantId = c.req.param("tenantId");
  assertTenantAccess(auth, tenantId);
  return c.json(await store.listConnections(tenantId));
});

api.post("/tenants/:tenantId/connections", async (c) => {
  const auth = requireAuth(c);
  const tenantId = c.req.param("tenantId");
  assertTenantManage(auth, tenantId);
  const body = await c.req.json<{ type: ConnectorType; name: string; config?: Record<string, unknown> }>();

  const enabled = await store.isConnectorEnabledForTenant(tenantId, body.type);
  if (!enabled) {
    return c.json({ error: "Connector type is disabled for this organization" }, 403);
  }

  const conn = await store.createConnection({
    tenantId,
    ...body,
  });

  if (!getConnectorMetadata(body.type)?.oauthSupported && body.config) {
    const plugin = globalRegistry.get(body.type);
    if (plugin?.validateConnection && (await plugin.validateConnection(conn))) {
      await store.updateConnectionStatus(conn.id, "active");
      conn.status = "active";
    }
  }

  await store.logAudit({
    tenantId,
    userId: auth.userId,
    action: "connection_created",
    connectorType: body.type,
    metadata: { connectionId: conn.id },
  });
  return c.json(conn, 201);
});

api.post("/connections/:connectionId/oauth/start", async (c) => {
  const auth = requireAuth(c);
  const connectionId = c.req.param("connectionId");
  const conn = await store.getConnection(connectionId);
  if (!conn || !canManageTenant(auth, conn.tenantId)) return c.json({ error: "Not found" }, 404);

  const provider = getOAuthProvider(conn.type);
  if (!provider) return c.json({ error: "OAuth not supported for this connector" }, 400);

  const state = randomBytes(24).toString("hex");
  const redirectUri = process.env.OAUTH_REDIRECT_URI ?? "http://localhost:54321/functions/v1/oauth-callback";
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await store.createOAuthState({
    connectionId,
    tenantId: conn.tenantId,
    provider: provider.name,
    state,
    redirectUri,
    expiresAt,
  });

  const url = buildOAuthUrl(provider, state, redirectUri);
  return c.json({ url, state });
});

api.get("/oauth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) return c.json({ error: "Missing code or state" }, 400);

  const oauthState = await store.getOAuthState(state);
  if (!oauthState || oauthState.expiresAt < new Date()) {
    return c.json({ error: "Invalid or expired state" }, 400);
  }

  const conn = await store.getConnection(oauthState.connectionId);
  if (!conn) return c.json({ error: "Connection not found" }, 404);

  const provider = getOAuthProvider(conn.type);
  if (!provider) return c.json({ error: "Provider not found" }, 400);

  const tokens = await exchangeOAuthCode(provider, code, oauthState.redirectUri);
  await store.storeConnectionSecret(conn.id, tokens as unknown as Record<string, unknown>);
  await store.updateConnectionStatus(conn.id, "active");
  await store.deleteOAuthState(state);

  await store.logAudit({
    tenantId: oauthState.tenantId,
    userId: "00000000-0000-0000-0000-000000000000",
    action: "connection_oauth_completed",
    connectorType: conn.type,
    metadata: { connectionId: conn.id },
  });

  return c.redirect(`${webOrigin()}/connections?success=1&connectionId=${conn.id}`);
});

api.post("/connections/:connectionId/test", async (c) => {
  const auth = requireAuth(c);
  const conn = await store.getConnection(c.req.param("connectionId"));
  if (!conn || !canManageTenant(auth, conn.tenantId)) return c.json({ error: "Not found" }, 404);

  const plugin = globalRegistry.get(conn.type);
  if (!plugin?.validateConnection) {
    return c.json({ valid: conn.status === "active" });
  }

  const valid = await plugin.validateConnection(conn);
  if (!valid) await store.updateConnectionStatus(conn.id, "error");
  return c.json({ valid });
});

api.patch("/connections/:connectionId/config", async (c) => {
  const auth = requireAuth(c);
  const connectionId = c.req.param("connectionId");
  const conn = await store.getConnection(connectionId);
  if (!conn || !canManageTenant(auth, conn.tenantId)) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json<{
    authType: ConnectionAuthType;
    config: Record<string, unknown>;
    credentials?: Record<string, string>;
  }>();

  const authType = resolveConnectionAuthType(conn.type, body.authType);
  if (!isAuthTypeSupported(conn.type, authType)) {
    return c.json({ error: "סוג האימות אינו נתמך לחיבור זה" }, 400);
  }

  if (authType === "oauth") {
    const config = { ...body.config, authType };
    const updated = await store.updateConnectionConfig(connectionId, config);
    return c.json(updated);
  }

  const authDef = AUTH_TYPE_DEFINITIONS[authType];
  for (const field of authDef.credentialFields) {
    if (field.required && !body.credentials?.[field.key]?.trim()) {
      return c.json({ error: `שדה חובה: ${field.label}` }, 400);
    }
  }

  const meta = getConnectorMetadata(conn.type);
  const schema = meta?.configSchema as {
    required?: string[];
    properties?: Record<string, { description?: string }>;
  };
  const configValues = { ...body.config };
  for (const key of schema?.required ?? []) {
    const value = configValues[key];
    if (typeof value !== "string" || !value.trim()) {
      const label = schema?.properties?.[key]?.description ?? key;
      return c.json({ error: `שדה חובה: ${label}` }, 400);
    }
  }

  const config = { ...configValues, authType };
  let updated = await store.updateConnectionConfig(connectionId, config);

  if (body.credentials && Object.keys(body.credentials).length > 0) {
    const credentials: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body.credentials)) {
      if (value.trim()) credentials[key] = value.trim();
    }
    if (Object.keys(credentials).length > 0) {
      await store.storeConnectionSecret(connectionId, credentials);
    }
  }

  const plugin = globalRegistry.get(conn.type);
  const valid = plugin?.validateConnection
    ? await plugin.validateConnection(updated)
    : true;

  if (valid) {
    updated = await store.updateConnectionStatus(connectionId, "active");
    await store.logAudit({
      tenantId: conn.tenantId,
      userId: auth.userId,
      action: "connection_configured",
      connectorType: conn.type,
      metadata: { connectionId, authType },
    });
  }

  return c.json(updated);
});

api.patch("/connections/:connectionId/status", async (c) => {
  const auth = requireAuth(c);
  const body = await c.req.json<{ status: "active" | "inactive" }>();
  const conn = await store.getConnection(c.req.param("connectionId"));
  if (!conn || !canManageTenant(auth, conn.tenantId)) return c.json({ error: "Not found" }, 404);
  const updated = await store.updateConnectionStatus(conn.id, body.status);
  return c.json(updated);
});

// Connector metadata
api.get("/connectors/metadata", async (c) => {
  const tenantId = c.req.query("tenantId");
  if (!tenantId) return c.json(CONNECTOR_METADATA);

  const overrides = await store.listTenantConnectorOverrides(tenantId);
  return c.json(buildTenantConnectorSettings(overrides));
});

// Tenant connector settings (super-admin)
api.get("/tenants/:tenantId/connector-settings", async (c) => {
  const auth = requireAuth(c);
  const tenantId = c.req.param("tenantId");
  requireSuperAdmin(auth);
  const tenant = await store.getTenant(tenantId);
  if (!tenant) return c.json({ error: "Not found" }, 404);
  const overrides = await store.listTenantConnectorOverrides(tenantId);
  return c.json(buildTenantConnectorSettings(overrides));
});

api.patch("/tenants/:tenantId/connector-settings/:connectorType", async (c) => {
  const auth = requireAuth(c);
  const tenantId = c.req.param("tenantId");
  requireSuperAdmin(auth);
  const connectorType = c.req.param("connectorType") as ConnectorType;
  const body = await c.req.json<{ enabled: boolean }>();

  const tenant = await store.getTenant(tenantId);
  if (!tenant) return c.json({ error: "Not found" }, 404);

  if (!CONNECTOR_METADATA.some((m) => m.type === connectorType)) {
    return c.json({ error: "Unknown connector type" }, 400);
  }

  await store.setTenantConnectorEnabled(tenantId, connectorType, body.enabled);
  const overrides = await store.listTenantConnectorOverrides(tenantId);
  return c.json(buildTenantConnectorSettings(overrides));
});

api.get("/connectors", (c) => {
  const connectors = globalRegistry.getAll().map((p) => ({
    type: p.type,
    displayName: p.displayName,
    capabilities: p.getCapabilities(),
  }));
  return c.json(connectors);
});

// Permission grants
api.get("/tenants/:tenantId/grants", async (c) => {
  const auth = requireAuth(c);
  const tenantId = c.req.param("tenantId");
  assertTenantAccess(auth, tenantId);
  return c.json(await store.listGrants(tenantId));
});

api.post("/tenants/:tenantId/grants", async (c) => {
  const auth = requireAuth(c);
  const tenantId = c.req.param("tenantId");
  assertTenantManage(auth, tenantId);
  const body = await c.req.json<Omit<import("@hub/core").PermissionGrant, "id" | "createdAt">>();
  const grant = await store.createGrant({ ...body, tenantId });
  await store.logAudit({
    tenantId,
    userId: auth.userId,
    action: "grant_created",
    connectorType: body.connectorType,
    metadata: { grantId: grant.id },
  });
  return c.json(grant, 201);
});

api.delete("/tenants/:tenantId/grants/:grantId", async (c) => {
  const auth = requireAuth(c);
  const tenantId = c.req.param("tenantId");
  assertTenantManage(auth, tenantId);
  await store.deleteGrant(c.req.param("grantId"));
  await store.logAudit({
    tenantId,
    userId: auth.userId,
    action: "grant_deleted",
    metadata: { grantId: c.req.param("grantId") },
  });
  return c.json({ ok: true });
});

// Audit log
api.get("/tenants/:tenantId/audit", async (c) => {
  const auth = requireAuth(c);
  const tenantId = c.req.param("tenantId");
  assertTenantAccess(auth, tenantId);
  const limit = Number(c.req.query("limit") ?? 50);
  const offset = Number(c.req.query("offset") ?? 0);
  const logs = await store.listAuditLog(tenantId, { limit, offset });
  return c.json(logs);
});

app.route("/api/v1", api);

app.onError((err, c) => {
  const message = err instanceof Error ? err.message : "Internal error";
  const status =
    message === "Unauthorized"
      ? 401
      : message === "Forbidden" || message === "Org admin access required" || message === "Super admin access required"
        ? 403
        : 500;
  return c.json({ error: message }, status);
});

export { app };
