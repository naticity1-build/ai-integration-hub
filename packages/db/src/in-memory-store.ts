import type {
  Connection,
  PermissionGrant,
  UserContext,
  Tenant,
  Department,
  Role,
  User,
  AuditLogEntry,
  ConnectorType,
} from "@hub/core";
import type { HubStore } from "./store-types.js";
import { randomUUID } from "node:crypto";

/**
 * In-memory store for local development and testing.
 */
export class InMemoryHubStore implements HubStore {
  private users = new Map<string, UserContext & { displayName?: string; isActive?: boolean }>();
  private userRecords = new Map<string, User>();
  private tenants = new Map<string, Tenant>();
  private departments = new Map<string, Department[]>();
  private roles = new Map<string, Role[]>();
  private connections = new Map<string, Connection[]>();
  private grants = new Map<string, PermissionGrant[]>();
  private secrets = new Map<string, Record<string, unknown>>();
  private auditLog: AuditLogEntry[] = [];
  private mcpTokens = new Map<
    string,
    {
      id: string;
      userId: string;
      tenantId: string;
      tokenHash: string;
      name: string;
      createdAt: Date;
      revokedAt: Date | null;
      expiresAt: Date | null;
    }
  >();
  private oauthStates = new Map<
    string,
    {
      connectionId: string;
      tenantId: string;
      provider: string;
      redirectUri: string;
      expiresAt: Date;
    }
  >();
  private platformAdmins = new Map<string, { email: string; isActive: boolean; createdAt: Date }>();
  private tenantConnectorSettings = new Map<string, Map<string, boolean>>();

  seedDemoData(): void {
    const tenantId = "11111111-1111-1111-1111-111111111111";
    const userId = "66666666-6666-6666-6666-666666666601";
    const deptSales = "22222222-2222-2222-2222-222222222201";
    const roleMember = "33333333-3333-3333-3333-333333333303";

    const now = new Date();
    this.tenants.set(tenantId, {
      id: tenantId,
      name: "ABC Corp",
      slug: "abc",
      createdAt: now,
      updatedAt: now,
    });

    this.departments.set(tenantId, [
      { id: deptSales, tenantId, name: "Sales", parentId: null, createdAt: now },
      {
        id: "22222222-2222-2222-2222-222222222202",
        tenantId,
        name: "Finance",
        parentId: null,
        createdAt: now,
      },
    ]);

    this.roles.set(tenantId, [
      {
        id: "33333333-3333-3333-3333-333333333301",
        tenantId,
        name: "admin",
        description: "Admin",
      },
      {
        id: roleMember,
        tenantId,
        name: "member",
        description: "Member",
      },
    ]);

    this.users.set(userId, {
      userId,
      tenantId,
      departmentId: deptSales,
      roleId: roleMember,
      roleName: "member",
      email: "sales@abc.com",
      displayName: "Sales User",
      isActive: true,
    });

    this.userRecords.set(userId, {
      id: userId,
      tenantId,
      email: "sales@abc.com",
      displayName: "Sales User",
      departmentId: deptSales,
      roleId: roleMember,
      isActive: true,
      createdAt: now,
    });

    this.connections.set(tenantId, [
      {
        id: "44444444-4444-4444-4444-444444444401",
        tenantId,
        type: "google_drive",
        name: "ABC Google Drive",
        status: "active",
        credentialsRef: "secret:gdrive-abc",
        config: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "44444444-4444-4444-4444-444444444402",
        tenantId,
        type: "gmail",
        name: "ABC Gmail",
        status: "active",
        credentialsRef: "secret:gmail-abc",
        config: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);

    this.grants.set(tenantId, [
      {
        id: "55555555-5555-5555-5555-555555555501",
        tenantId,
        targetType: "department",
        targetId: deptSales,
        connectorType: "google_drive",
        allowedTools: ["search_documents", "read_document", "summarize_document"],
        createdAt: now,
      },
      {
        id: "55555555-5555-5555-5555-555555555502",
        tenantId,
        targetType: "department",
        targetId: deptSales,
        connectorType: "gmail",
        allowedTools: ["search_emails", "summarize_thread"],
        createdAt: now,
      },
    ]);
  }

  async getUserContext(userId: string): Promise<UserContext | null> {
    const u = this.users.get(userId);
    if (!u || u.isActive === false) return null;
    return {
      userId: u.userId,
      tenantId: u.tenantId,
      departmentId: u.departmentId,
      roleId: u.roleId,
      roleName: u.roleName,
      email: u.email,
    };
  }

  async getActiveConnections(tenantId: string): Promise<Connection[]> {
    return (this.connections.get(tenantId) ?? []).filter((c) => c.status === "active");
  }

  async getPermissionGrants(tenantId: string): Promise<PermissionGrant[]> {
    return this.grants.get(tenantId) ?? [];
  }

  async logAudit(entry: {
    tenantId: string;
    userId: string;
    action: string;
    connectorType?: string;
    toolName?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    this.auditLog.push({
      id: randomUUID(),
      tenantId: entry.tenantId,
      userId: entry.userId,
      action: entry.action,
      connectorType: (entry.connectorType as ConnectorType) ?? null,
      toolName: entry.toolName ?? null,
      metadata: entry.metadata ?? {},
      createdAt: new Date(),
    });
  }

  async listTenants() {
    return [...this.tenants.values()];
  }

  async getTenant(id: string) {
    return this.tenants.get(id) ?? null;
  }

  async getTenantBySlug(slug: string) {
    return [...this.tenants.values()].find((t) => t.slug === slug) ?? null;
  }

  async createTenant(data: { name: string; slug: string }) {
    const now = new Date();
    const tenant: Tenant = {
      id: randomUUID(),
      name: data.name,
      slug: data.slug,
      createdAt: now,
      updatedAt: now,
    };
    this.tenants.set(tenant.id, tenant);
    this.roles.set(tenant.id, [
      { id: randomUUID(), tenantId: tenant.id, name: "admin", description: "Admin" },
      { id: randomUUID(), tenantId: tenant.id, name: "member", description: "Member" },
    ]);
    this.departments.set(tenant.id, []);
    this.connections.set(tenant.id, []);
    this.grants.set(tenant.id, []);
    this.tenantConnectorSettings.set(tenant.id, new Map());
    return tenant;
  }

  async listUsers(tenantId: string) {
    return [...this.userRecords.values()].filter((u) => u.tenantId === tenantId);
  }

  async getUser(id: string) {
    return this.userRecords.get(id) ?? null;
  }

  async createUser(data: {
    id: string;
    tenantId: string;
    email: string;
    displayName: string;
    departmentId: string | null;
    roleId: string;
  }) {
    const role = (this.roles.get(data.tenantId) ?? []).find((r) => r.id === data.roleId);
    const user: User = {
      id: data.id,
      tenantId: data.tenantId,
      email: data.email,
      displayName: data.displayName,
      departmentId: data.departmentId,
      roleId: data.roleId,
      isActive: true,
      createdAt: new Date(),
    };
    this.userRecords.set(data.id, user);
    this.users.set(data.id, {
      userId: data.id,
      tenantId: data.tenantId,
      departmentId: data.departmentId,
      roleId: data.roleId,
      roleName: role?.name ?? "member",
      email: data.email,
      displayName: data.displayName,
      isActive: true,
    });
    return user;
  }

  async updateUser(
    id: string,
    data: Partial<{ departmentId: string | null; roleId: string; isActive: boolean; displayName: string }>
  ) {
    const user = this.userRecords.get(id);
    if (!user) throw new Error("User not found");
    if (data.departmentId !== undefined) user.departmentId = data.departmentId;
    if (data.roleId !== undefined) user.roleId = data.roleId;
    if (data.isActive !== undefined) user.isActive = data.isActive;
    if (data.displayName !== undefined) user.displayName = data.displayName;
    const ctx = this.users.get(id);
    if (ctx) {
      if (data.departmentId !== undefined) ctx.departmentId = data.departmentId;
      if (data.roleId !== undefined) {
        ctx.roleId = data.roleId;
        const role = (this.roles.get(user.tenantId) ?? []).find((r) => r.id === data.roleId);
        ctx.roleName = role?.name ?? ctx.roleName;
      }
      if (data.isActive !== undefined) ctx.isActive = data.isActive;
    }
    return user;
  }

  async listDepartments(tenantId: string) {
    return this.departments.get(tenantId) ?? [];
  }

  async createDepartment(data: { tenantId: string; name: string; parentId?: string | null }) {
    const dept: Department = {
      id: randomUUID(),
      tenantId: data.tenantId,
      name: data.name,
      parentId: data.parentId ?? null,
      createdAt: new Date(),
    };
    const list = this.departments.get(data.tenantId) ?? [];
    list.push(dept);
    this.departments.set(data.tenantId, list);
    return dept;
  }

  async listRoles(tenantId: string) {
    return this.roles.get(tenantId) ?? [];
  }

  async listConnections(tenantId: string) {
    return this.connections.get(tenantId) ?? [];
  }

  async getConnection(id: string) {
    for (const list of this.connections.values()) {
      const found = list.find((c) => c.id === id);
      if (found) return found;
    }
    return null;
  }

  async createConnection(data: {
    tenantId: string;
    type: ConnectorType;
    name: string;
    config?: Record<string, unknown>;
  }) {
    const conn: Connection = {
      id: randomUUID(),
      tenantId: data.tenantId,
      type: data.type,
      name: data.name,
      status: "pending_auth",
      credentialsRef: "",
      config: data.config ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const list = this.connections.get(data.tenantId) ?? [];
    list.push(conn);
    this.connections.set(data.tenantId, list);
    return conn;
  }

  async updateConnectionStatus(id: string, status: Connection["status"]) {
    const conn = await this.getConnection(id);
    if (!conn) throw new Error("Connection not found");
    conn.status = status;
    conn.updatedAt = new Date();
    return conn;
  }

  async updateConnectionConfig(id: string, config: Record<string, unknown>) {
    const conn = await this.getConnection(id);
    if (!conn) throw new Error("Connection not found");
    conn.config = config;
    conn.updatedAt = new Date();
    return conn;
  }

  async setConnectionCredentialsRef(id: string, credentialsRef: string) {
    const conn = await this.getConnection(id);
    if (!conn) throw new Error("Connection not found");
    conn.credentialsRef = credentialsRef;
  }

  async listGrants(tenantId: string) {
    return this.getPermissionGrants(tenantId);
  }

  async createGrant(data: Omit<PermissionGrant, "id" | "createdAt">) {
    const grant: PermissionGrant = { ...data, id: randomUUID(), createdAt: new Date() };
    const list = this.grants.get(data.tenantId) ?? [];
    list.push(grant);
    this.grants.set(data.tenantId, list);
    return grant;
  }

  async deleteGrant(id: string) {
    for (const [tenantId, list] of this.grants) {
      this.grants.set(
        tenantId,
        list.filter((g) => g.id !== id)
      );
    }
  }

  async listAuditLog(tenantId: string, options?: { limit?: number; offset?: number }) {
    const filtered = this.auditLog.filter((e) => e.tenantId === tenantId);
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    return filtered.slice(offset, offset + limit);
  }

  async storeConnectionSecret(connectionId: string, secretData: Record<string, unknown>) {
    const id = randomUUID();
    this.secrets.set(connectionId, secretData);
    await this.setConnectionCredentialsRef(connectionId, `secret:${id}`);
    return id;
  }

  async getConnectionSecret(connectionId: string) {
    return this.secrets.get(connectionId) ?? null;
  }

  async createMcpToken(data: {
    userId: string;
    tenantId: string;
    tokenHash: string;
    name?: string;
    expiresAt?: Date | null;
  }) {
    const id = randomUUID();
    this.mcpTokens.set(data.tokenHash, {
      id,
      userId: data.userId,
      tenantId: data.tenantId,
      tokenHash: data.tokenHash,
      name: data.name ?? "default",
      createdAt: new Date(),
      revokedAt: null,
      expiresAt: data.expiresAt ?? null,
    });
    return { id };
  }

  async listMcpTokens(tenantId: string, userId?: string) {
    return [...this.mcpTokens.values()]
      .filter((t) => t.tenantId === tenantId && (!userId || t.userId === userId))
      .map((t) => ({
        id: t.id,
        userId: t.userId,
        tenantId: t.tenantId,
        name: t.name,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
        revokedAt: t.revokedAt,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getMcpTokenByHash(tokenHash: string) {
    return this.mcpTokens.get(tokenHash) ?? null;
  }

  async getMcpToken(id: string) {
    for (const token of this.mcpTokens.values()) {
      if (token.id === id) {
        return {
          id: token.id,
          userId: token.userId,
          tenantId: token.tenantId,
          revokedAt: token.revokedAt,
        };
      }
    }
    return null;
  }

  async revokeMcpToken(id: string) {
    for (const token of this.mcpTokens.values()) {
      if (token.id === id) token.revokedAt = new Date();
    }
  }

  async createOAuthState(data: {
    connectionId: string;
    tenantId: string;
    provider: string;
    state: string;
    redirectUri: string;
    expiresAt: Date;
  }) {
    this.oauthStates.set(data.state, {
      connectionId: data.connectionId,
      tenantId: data.tenantId,
      provider: data.provider,
      redirectUri: data.redirectUri,
      expiresAt: data.expiresAt,
    });
  }

  async getOAuthState(state: string) {
    return this.oauthStates.get(state) ?? null;
  }

  async deleteOAuthState(state: string) {
    this.oauthStates.delete(state);
  }

  async listTenantConnectorOverrides(tenantId: string) {
    const settings = this.tenantConnectorSettings.get(tenantId);
    if (!settings) return [];
    return [...settings.entries()].map(([connectorType, enabled]) => ({
      connectorType: connectorType as ConnectorType,
      enabled,
    }));
  }

  async setTenantConnectorEnabled(
    tenantId: string,
    connectorType: ConnectorType,
    enabled: boolean
  ) {
    if (!this.tenantConnectorSettings.has(tenantId)) {
      this.tenantConnectorSettings.set(tenantId, new Map());
    }
    this.tenantConnectorSettings.get(tenantId)!.set(connectorType, enabled);
    return { connectorType, enabled };
  }

  async isConnectorEnabledForTenant(tenantId: string, connectorType: ConnectorType) {
    const settings = this.tenantConnectorSettings.get(tenantId);
    if (!settings || !settings.has(connectorType)) return true;
    return settings.get(connectorType)!;
  }

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const admin = this.platformAdmins.get(userId);
    return !!admin?.isActive;
  }

  async listPlatformAdmins() {
    return [...this.platformAdmins.entries()].map(([id, admin]) => ({
      id,
      email: admin.email,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
    }));
  }

  addPlatformAdmin(id: string, email: string) {
    this.platformAdmins.set(id, { email, isActive: true, createdAt: new Date() });
  }
}
