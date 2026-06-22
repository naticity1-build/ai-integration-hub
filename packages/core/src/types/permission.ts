import type { ConnectorType } from "./connector.js";

/** Grants a department or role access to specific connector capabilities */
export interface PermissionGrant {
  id: string;
  tenantId: string;
  /** Target: department or role */
  targetType: "department" | "role" | "user";
  targetId: string;
  connectorType: ConnectorType;
  /** Specific tool names, or "*" for all tools of this connector */
  allowedTools: string[];
  createdAt: Date;
}

export interface UserContext {
  userId: string;
  tenantId: string;
  departmentId: string | null;
  roleId: string;
  roleName: string;
  email: string;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  connectorType: ConnectorType | null;
  toolName: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
