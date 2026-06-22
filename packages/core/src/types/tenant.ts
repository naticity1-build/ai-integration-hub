/** Organization — isolated tenant with its own users, departments, and connections */
import type { ConnectorType } from "./connector.js";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Department {
  id: string;
  tenantId: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
}

export type RoleName = "admin" | "manager" | "member" | "viewer";

export interface Role {
  id: string;
  tenantId: string;
  name: RoleName;
  description: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  departmentId: string | null;
  roleId: string;
  isActive: boolean;
  createdAt: Date;
}

/** Super-admin controlled enable/disable per connector type for a tenant */
export interface TenantConnectorSetting {
  connectorType: ConnectorType;
  enabled: boolean;
}
