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
  TenantConnectorSetting,
} from "@hub/core";

/** Abstraction over data persistence — implemented by Supabase or in-memory for dev */
export interface HubDataStore {
  getUserContext(userId: string): Promise<UserContext | null>;
  getActiveConnections(tenantId: string): Promise<Connection[]>;
  getPermissionGrants(tenantId: string): Promise<PermissionGrant[]>;
  logAudit(entry: {
    tenantId: string;
    userId: string;
    action: string;
    connectorType?: string;
    toolName?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

/** Admin CRUD operations for tenant management */
export interface HubAdminStore {
  // Tenants
  listTenants(): Promise<Tenant[]>;
  getTenant(id: string): Promise<Tenant | null>;
  getTenantBySlug(slug: string): Promise<Tenant | null>;
  createTenant(data: { name: string; slug: string }): Promise<Tenant>;

  // Users
  listUsers(tenantId: string): Promise<User[]>;
  getUser(id: string): Promise<User | null>;
  createUser(data: {
    id: string;
    tenantId: string;
    email: string;
    displayName: string;
    departmentId: string | null;
    roleId: string;
  }): Promise<User>;
  updateUser(
    id: string,
    data: Partial<Pick<User, "departmentId" | "roleId" | "isActive" | "displayName">>
  ): Promise<User>;

  // Departments
  listDepartments(tenantId: string): Promise<Department[]>;
  createDepartment(data: {
    tenantId: string;
    name: string;
    parentId?: string | null;
  }): Promise<Department>;

  // Roles
  listRoles(tenantId: string): Promise<Role[]>;

  // Connections
  listConnections(tenantId: string): Promise<Connection[]>;
  getConnection(id: string): Promise<Connection | null>;
  createConnection(data: {
    tenantId: string;
    type: ConnectorType;
    name: string;
    config?: Record<string, unknown>;
  }): Promise<Connection>;
  updateConnectionStatus(id: string, status: Connection["status"]): Promise<Connection>;
  updateConnectionConfig(id: string, config: Record<string, unknown>): Promise<Connection>;
  setConnectionCredentialsRef(id: string, credentialsRef: string): Promise<void>;

  // Permission grants
  listGrants(tenantId: string): Promise<PermissionGrant[]>;
  createGrant(data: Omit<PermissionGrant, "id" | "createdAt">): Promise<PermissionGrant>;
  deleteGrant(id: string): Promise<void>;

  // Audit
  listAuditLog(
    tenantId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<AuditLogEntry[]>;

  // Connection secrets
  storeConnectionSecret(connectionId: string, secretData: Record<string, unknown>): Promise<string>;
  getConnectionSecret(connectionId: string): Promise<Record<string, unknown> | null>;

  // MCP tokens
  createMcpToken(data: {
    userId: string;
    tenantId: string;
    tokenHash: string;
    name?: string;
    expiresAt?: Date | null;
  }): Promise<{ id: string }>;
  listMcpTokens(
    tenantId: string,
    userId?: string
  ): Promise<
    {
      id: string;
      userId: string;
      tenantId: string;
      name: string;
      createdAt: Date;
      expiresAt: Date | null;
      revokedAt: Date | null;
    }[]
  >;
  getMcpTokenByHash(tokenHash: string): Promise<{
    id: string;
    userId: string;
    tenantId: string;
    revokedAt: Date | null;
    expiresAt: Date | null;
  } | null>;
  getMcpToken(id: string): Promise<{
    id: string;
    userId: string;
    tenantId: string;
    revokedAt: Date | null;
  } | null>;
  revokeMcpToken(id: string): Promise<void>;

  // OAuth state
  createOAuthState(data: {
    connectionId: string;
    tenantId: string;
    provider: string;
    state: string;
    redirectUri: string;
    expiresAt: Date;
  }): Promise<void>;
  getOAuthState(state: string): Promise<{
    connectionId: string;
    tenantId: string;
    provider: string;
    redirectUri: string;
    expiresAt: Date;
  } | null>;
  deleteOAuthState(state: string): Promise<void>;

  // Tenant connector settings (super-admin)
  listTenantConnectorOverrides(tenantId: string): Promise<TenantConnectorSetting[]>;
  setTenantConnectorEnabled(
    tenantId: string,
    connectorType: ConnectorType,
    enabled: boolean
  ): Promise<TenantConnectorSetting>;
  isConnectorEnabledForTenant(tenantId: string, connectorType: ConnectorType): Promise<boolean>;

  // Platform super-admins
  isPlatformAdmin(userId: string): Promise<boolean>;
  listPlatformAdmins(): Promise<{ id: string; email: string; isActive: boolean; createdAt: Date }[]>;
}

export interface HubStore extends HubDataStore, HubAdminStore {}

export interface CreateStoreOptions {
  supabaseUrl: string;
  supabaseServiceKey: string;
}
