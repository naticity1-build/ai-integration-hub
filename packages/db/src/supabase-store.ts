import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Connection, PermissionGrant, UserContext, ConnectorType } from "@hub/core";
import type { HubStore, CreateStoreOptions } from "./store-types.js";
import type {
  DbConnection,
  DbPermissionGrant,
  DbUser,
  DbRole,
  DbTenant,
  DbDepartment,
  DbAuditLog,
  DbConnectionSecret,
  DbTenantConnectorSetting,
} from "./types.js";
import {
  mapConnection,
  mapGrant,
  mapUserContext,
  mapTenant,
  mapDepartment,
  mapRole,
  mapUser,
  mapAuditLog,
  mapTenantConnectorSetting,
} from "./mappers.js";
import { encryptSecret, decryptSecret } from "./crypto.js";

export class SupabaseHubStore implements HubStore {
  private client: SupabaseClient;

  constructor(options: CreateStoreOptions) {
    this.client = createClient(options.supabaseUrl, options.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async getUserContext(userId: string): Promise<UserContext | null> {
    const { data: user, error } = await this.client
      .from("users")
      .select("*")
      .eq("id", userId)
      .eq("is_active", true)
      .single<DbUser>();

    if (error || !user) return null;

    const { data: role } = await this.client
      .from("roles")
      .select("*")
      .eq("id", user.role_id)
      .single<DbRole>();

    if (!role) return null;

    return mapUserContext(user, role);
  }

  async getActiveConnections(tenantId: string): Promise<Connection[]> {
    const { data, error } = await this.client
      .from("connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (error || !data) return [];
    return (data as DbConnection[]).map(mapConnection);
  }

  async getPermissionGrants(tenantId: string): Promise<PermissionGrant[]> {
    const { data, error } = await this.client
      .from("permission_grants")
      .select("*")
      .eq("tenant_id", tenantId);

    if (error || !data) return [];
    return (data as DbPermissionGrant[]).map(mapGrant);
  }

  async logAudit(entry: {
    tenantId: string;
    userId: string;
    action: string;
    connectorType?: string;
    toolName?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.client.from("audit_log").insert({
      tenant_id: entry.tenantId,
      user_id: entry.userId,
      action: entry.action,
      connector_type: entry.connectorType ?? null,
      tool_name: entry.toolName ?? null,
      metadata: entry.metadata ?? {},
    });
  }

  async listTenants(): Promise<ReturnType<typeof mapTenant>[]> {
    const { data } = await this.client.from("tenants").select("*");
    return ((data ?? []) as DbTenant[]).map(mapTenant);
  }

  async getTenant(id: string) {
    const { data } = await this.client.from("tenants").select("*").eq("id", id).single();
    return data ? mapTenant(data as DbTenant) : null;
  }

  async getTenantBySlug(slug: string) {
    const { data } = await this.client.from("tenants").select("*").eq("slug", slug).single();
    return data ? mapTenant(data as DbTenant) : null;
  }

  async createTenant(data: { name: string; slug: string }) {
    const { data: tenant, error } = await this.client
      .from("tenants")
      .insert({ name: data.name, slug: data.slug })
      .select("*")
      .single();

    if (error || !tenant) throw new Error(error?.message ?? "Failed to create tenant");

    const tenantId = (tenant as DbTenant).id;
    const defaultRoles = [
      { tenant_id: tenantId, name: "admin", description: "Full tenant administration" },
      { tenant_id: tenantId, name: "manager", description: "Department manager" },
      { tenant_id: tenantId, name: "member", description: "Standard member" },
      { tenant_id: tenantId, name: "viewer", description: "Read-only access" },
    ];
    await this.client.from("roles").insert(defaultRoles);

    return mapTenant(tenant as DbTenant);
  }

  async listUsers(tenantId: string) {
    const { data } = await this.client.from("users").select("*").eq("tenant_id", tenantId);
    return ((data ?? []) as DbUser[]).map(mapUser);
  }

  async getUser(id: string) {
    const { data } = await this.client.from("users").select("*").eq("id", id).single();
    return data ? mapUser(data as DbUser) : null;
  }

  async createUser(data: {
    id: string;
    tenantId: string;
    email: string;
    displayName: string;
    departmentId: string | null;
    roleId: string;
  }) {
    const { data: user, error } = await this.client
      .from("users")
      .insert({
        id: data.id,
        tenant_id: data.tenantId,
        email: data.email,
        display_name: data.displayName,
        department_id: data.departmentId,
        role_id: data.roleId,
      })
      .select("*")
      .single();

    if (error || !user) throw new Error(error?.message ?? "Failed to create user");
    return mapUser(user as DbUser);
  }

  async updateUser(
    id: string,
    data: Partial<{ departmentId: string | null; roleId: string; isActive: boolean; displayName: string }>
  ) {
    const patch: Record<string, unknown> = {};
    if (data.departmentId !== undefined) patch.department_id = data.departmentId;
    if (data.roleId !== undefined) patch.role_id = data.roleId;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    if (data.displayName !== undefined) patch.display_name = data.displayName;

    const { data: user, error } = await this.client
      .from("users")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !user) throw new Error(error?.message ?? "Failed to update user");
    return mapUser(user as DbUser);
  }

  async listDepartments(tenantId: string) {
    const { data } = await this.client.from("departments").select("*").eq("tenant_id", tenantId);
    return ((data ?? []) as DbDepartment[]).map(mapDepartment);
  }

  async createDepartment(data: { tenantId: string; name: string; parentId?: string | null }) {
    const { data: dept, error } = await this.client
      .from("departments")
      .insert({
        tenant_id: data.tenantId,
        name: data.name,
        parent_id: data.parentId ?? null,
      })
      .select("*")
      .single();

    if (error || !dept) throw new Error(error?.message ?? "Failed to create department");
    return mapDepartment(dept as DbDepartment);
  }

  async listRoles(tenantId: string) {
    const { data } = await this.client.from("roles").select("*").eq("tenant_id", tenantId);
    return ((data ?? []) as DbRole[]).map(mapRole);
  }

  async listConnections(tenantId: string) {
    const { data } = await this.client.from("connections").select("*").eq("tenant_id", tenantId);
    return ((data ?? []) as DbConnection[]).map(mapConnection);
  }

  async getConnection(id: string) {
    const { data } = await this.client.from("connections").select("*").eq("id", id).single();
    return data ? mapConnection(data as DbConnection) : null;
  }

  async createConnection(data: {
    tenantId: string;
    type: Connection["type"];
    name: string;
    config?: Record<string, unknown>;
  }) {
    const { data: conn, error } = await this.client
      .from("connections")
      .insert({
        tenant_id: data.tenantId,
        type: data.type,
        name: data.name,
        status: "pending_auth",
        config: data.config ?? {},
      })
      .select("*")
      .single();

    if (error || !conn) throw new Error(error?.message ?? "Failed to create connection");
    return mapConnection(conn as DbConnection);
  }

  async updateConnectionStatus(id: string, status: Connection["status"]) {
    const { data: conn, error } = await this.client
      .from("connections")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !conn) throw new Error(error?.message ?? "Failed to update connection");
    return mapConnection(conn as DbConnection);
  }

  async updateConnectionConfig(id: string, config: Record<string, unknown>) {
    const { data: conn, error } = await this.client
      .from("connections")
      .update({ config })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !conn) throw new Error(error?.message ?? "Failed to update connection");
    return mapConnection(conn as DbConnection);
  }

  async setConnectionCredentialsRef(id: string, credentialsRef: string) {
    const { error } = await this.client
      .from("connections")
      .update({ credentials_ref: credentialsRef })
      .eq("id", id);

    if (error) throw new Error(error.message);
  }

  async listGrants(tenantId: string) {
    return this.getPermissionGrants(tenantId);
  }

  async createGrant(data: Omit<PermissionGrant, "id" | "createdAt">) {
    const { data: grant, error } = await this.client
      .from("permission_grants")
      .insert({
        tenant_id: data.tenantId,
        target_type: data.targetType,
        target_id: data.targetId,
        connector_type: data.connectorType,
        allowed_tools: data.allowedTools,
      })
      .select("*")
      .single();

    if (error || !grant) throw new Error(error?.message ?? "Failed to create grant");
    return mapGrant(grant as DbPermissionGrant);
  }

  async deleteGrant(id: string) {
    const { error } = await this.client.from("permission_grants").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listAuditLog(tenantId: string, options?: { limit?: number; offset?: number }) {
    let query = this.client
      .from("audit_log")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1);

    const { data } = await query;
    return ((data ?? []) as DbAuditLog[]).map(mapAuditLog);
  }

  async storeConnectionSecret(connectionId: string, secretData: Record<string, unknown>) {
    const encrypted = encryptSecret(JSON.stringify(secretData));
    const { data, error } = await this.client
      .from("connection_secrets")
      .upsert(
        { connection_id: connectionId, encrypted_data: encrypted },
        { onConflict: "connection_id" }
      )
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Failed to store secret");
    const secretId = (data as DbConnectionSecret).id;
    await this.setConnectionCredentialsRef(connectionId, `secret:${secretId}`);
    return secretId;
  }

  async getConnectionSecret(connectionId: string) {
    const { data } = await this.client
      .from("connection_secrets")
      .select("*")
      .eq("connection_id", connectionId)
      .single();

    if (!data) return null;
    try {
      return JSON.parse(decryptSecret((data as DbConnectionSecret).encrypted_data)) as Record<
        string,
        unknown
      >;
    } catch {
      return null;
    }
  }

  async createMcpToken(data: {
    userId: string;
    tenantId: string;
    tokenHash: string;
    name?: string;
    expiresAt?: Date | null;
  }) {
    const { data: token, error } = await this.client
      .from("mcp_tokens")
      .insert({
        user_id: data.userId,
        tenant_id: data.tenantId,
        token_hash: data.tokenHash,
        name: data.name ?? "default",
        expires_at: data.expiresAt?.toISOString() ?? null,
      })
      .select("id")
      .single();

    if (error || !token) throw new Error(error?.message ?? "Failed to create MCP token");
    return { id: (token as { id: string }).id };
  }

  async listMcpTokens(tenantId: string, userId?: string) {
    let query = this.client
      .from("mcp_tokens")
      .select("id, user_id, tenant_id, name, created_at, expires_at, revoked_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return (data as {
      id: string;
      user_id: string;
      tenant_id: string;
      name: string;
      created_at: string;
      expires_at: string | null;
      revoked_at: string | null;
    }[]).map((row) => ({
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      name: row.name,
      createdAt: new Date(row.created_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    }));
  }

  async getMcpTokenByHash(tokenHash: string) {
    const { data } = await this.client
      .from("mcp_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .single();

    if (!data) return null;
    const row = data as {
      id: string;
      user_id: string;
      tenant_id: string;
      revoked_at: string | null;
      expires_at: string | null;
    };
    return {
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    };
  }

  async getMcpToken(id: string) {
    const { data } = await this.client
      .from("mcp_tokens")
      .select("id, user_id, tenant_id, revoked_at")
      .eq("id", id)
      .single();

    if (!data) return null;
    const row = data as {
      id: string;
      user_id: string;
      tenant_id: string;
      revoked_at: string | null;
    };
    return {
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    };
  }

  async revokeMcpToken(id: string) {
    await this.client
      .from("mcp_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
  }

  async createOAuthState(data: {
    connectionId: string;
    tenantId: string;
    provider: string;
    state: string;
    redirectUri: string;
    expiresAt: Date;
  }) {
    const { error } = await this.client.from("oauth_states").insert({
      connection_id: data.connectionId,
      tenant_id: data.tenantId,
      provider: data.provider,
      state: data.state,
      redirect_uri: data.redirectUri,
      expires_at: data.expiresAt.toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  async getOAuthState(state: string) {
    const { data } = await this.client
      .from("oauth_states")
      .select("*")
      .eq("state", state)
      .single();

    if (!data) return null;
    const row = data as {
      connection_id: string;
      tenant_id: string;
      provider: string;
      redirect_uri: string;
      expires_at: string;
    };
    return {
      connectionId: row.connection_id,
      tenantId: row.tenant_id,
      provider: row.provider,
      redirectUri: row.redirect_uri,
      expiresAt: new Date(row.expires_at),
    };
  }

  async deleteOAuthState(state: string) {
    await this.client.from("oauth_states").delete().eq("state", state);
  }

  async listTenantConnectorOverrides(tenantId: string) {
    const { data } = await this.client
      .from("tenant_connector_settings")
      .select("*")
      .eq("tenant_id", tenantId);
    return ((data ?? []) as DbTenantConnectorSetting[]).map(mapTenantConnectorSetting);
  }

  async setTenantConnectorEnabled(
    tenantId: string,
    connectorType: ConnectorType,
    enabled: boolean
  ) {
    const { data, error } = await this.client
      .from("tenant_connector_settings")
      .upsert(
        {
          tenant_id: tenantId,
          connector_type: connectorType,
          enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,connector_type" }
      )
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Failed to update connector setting");
    return mapTenantConnectorSetting(data as DbTenantConnectorSetting);
  }

  async isConnectorEnabledForTenant(tenantId: string, connectorType: ConnectorType) {
    const { data } = await this.client
      .from("tenant_connector_settings")
      .select("enabled")
      .eq("tenant_id", tenantId)
      .eq("connector_type", connectorType)
      .maybeSingle();

    if (!data) return true;
    return (data as { enabled: boolean }).enabled;
  }

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const { data } = await this.client
      .from("platform_admins")
      .select("id")
      .eq("id", userId)
      .eq("is_active", true)
      .maybeSingle();
    return !!data;
  }

  async listPlatformAdmins() {
    const { data } = await this.client
      .from("platform_admins")
      .select("*")
      .order("created_at", { ascending: false });

    return (data ?? []).map((row: { id: string; email: string; is_active: boolean; created_at: string }) => ({
      id: row.id,
      email: row.email,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
    }));
  }
}

export function createSupabaseStore(options: CreateStoreOptions): SupabaseHubStore {
  return new SupabaseHubStore(options);
}
