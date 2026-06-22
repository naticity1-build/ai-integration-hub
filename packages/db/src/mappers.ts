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
  ConnectorStatus,
  RoleName,
} from "@hub/core";
import type {
  DbConnection,
  DbDepartment,
  DbPermissionGrant,
  DbRole,
  DbTenant,
  DbUser,
  DbAuditLog,
  DbTenantConnectorSetting,
} from "./types.js";

export function mapTenant(row: DbTenant): Tenant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapDepartment(row: DbDepartment): Department {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    parentId: row.parent_id,
    createdAt: new Date(row.created_at),
  };
}

export function mapRole(row: DbRole): Role {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name as RoleName,
    description: row.description,
  };
}

export function mapUser(row: DbUser): User {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    displayName: row.display_name,
    departmentId: row.department_id,
    roleId: row.role_id,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
  };
}

export function mapConnection(row: DbConnection): Connection {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type as ConnectorType,
    name: row.name,
    status: row.status as ConnectorStatus,
    credentialsRef: row.credentials_ref ?? "",
    config: row.config ?? {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapGrant(row: DbPermissionGrant): PermissionGrant {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    targetType: row.target_type,
    targetId: row.target_id,
    connectorType: row.connector_type as ConnectorType,
    allowedTools: row.allowed_tools,
    createdAt: new Date(row.created_at),
  };
}

export function mapAuditLog(row: DbAuditLog): AuditLogEntry {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    action: row.action,
    connectorType: row.connector_type as ConnectorType | null,
    toolName: row.tool_name,
    metadata: row.metadata ?? {},
    createdAt: new Date(row.created_at),
  };
}

export function mapUserContext(user: DbUser, role: DbRole): UserContext {
  return {
    userId: user.id,
    tenantId: user.tenant_id,
    departmentId: user.department_id,
    roleId: user.role_id,
    roleName: role.name,
    email: user.email,
  };
}

export function mapTenantConnectorSetting(row: DbTenantConnectorSetting): {
  connectorType: ConnectorType;
  enabled: boolean;
} {
  return {
    connectorType: row.connector_type as ConnectorType,
    enabled: row.enabled,
  };
}
