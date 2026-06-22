/** Database row types matching Supabase schema */

export interface DbTenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface DbDepartment {
  id: string;
  tenant_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface DbRole {
  id: string;
  tenant_id: string;
  name: "admin" | "manager" | "member" | "viewer";
  description: string;
}

export interface DbUser {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  department_id: string | null;
  role_id: string;
  is_active: boolean;
  created_at: string;
}

export interface DbConnection {
  id: string;
  tenant_id: string;
  type: string;
  name: string;
  status: "active" | "inactive" | "error" | "pending_auth";
  credentials_ref: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbPermissionGrant {
  id: string;
  tenant_id: string;
  target_type: "department" | "role" | "user";
  target_id: string;
  connector_type: string;
  allowed_tools: string[];
  created_at: string;
}

export interface DbAuditLog {
  id: string;
  tenant_id: string;
  user_id: string;
  action: string;
  connector_type: string | null;
  tool_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DbMcpToken {
  id: string;
  user_id: string;
  tenant_id: string;
  token_hash: string;
  name: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface DbOAuthState {
  id: string;
  connection_id: string;
  tenant_id: string;
  provider: string;
  state: string;
  redirect_uri: string;
  expires_at: string;
  created_at: string;
}

export interface DbConnectionSecret {
  id: string;
  connection_id: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

export interface DbTenantConnectorSetting {
  id: string;
  tenant_id: string;
  connector_type: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
