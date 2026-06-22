-- Platform super-admin hierarchy: platform_admins + updated RLS

CREATE TABLE platform_admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
-- No policies: access only via service role

CREATE OR REPLACE FUNCTION hub_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(hub_jwt_claim('is_super_admin')::boolean, false) = true;
$$;

CREATE OR REPLACE FUNCTION hub_is_org_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT hub_role_name() = 'admin';
$$;

CREATE OR REPLACE FUNCTION hub_can_access_tenant(tid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT hub_is_super_admin() OR hub_tenant_id() = tid;
$$;

CREATE OR REPLACE FUNCTION hub_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT hub_is_org_admin();
$$;

CREATE OR REPLACE FUNCTION hub_can_manage_tenant(tid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT hub_is_super_admin() OR (hub_is_org_admin() AND hub_tenant_id() = tid);
$$;

-- Drop existing policies
DROP POLICY IF EXISTS tenants_select ON tenants;
DROP POLICY IF EXISTS tenants_admin_all ON tenants;
DROP POLICY IF EXISTS departments_select ON departments;
DROP POLICY IF EXISTS departments_admin ON departments;
DROP POLICY IF EXISTS roles_select ON roles;
DROP POLICY IF EXISTS roles_admin ON roles;
DROP POLICY IF EXISTS users_select ON users;
DROP POLICY IF EXISTS users_self ON users;
DROP POLICY IF EXISTS users_admin ON users;
DROP POLICY IF EXISTS connections_select ON connections;
DROP POLICY IF EXISTS connections_admin ON connections;
DROP POLICY IF EXISTS connection_secrets_admin ON connection_secrets;
DROP POLICY IF EXISTS permission_grants_select ON permission_grants;
DROP POLICY IF EXISTS permission_grants_admin ON permission_grants;
DROP POLICY IF EXISTS audit_log_select ON audit_log;
DROP POLICY IF EXISTS mcp_tokens_select ON mcp_tokens;
DROP POLICY IF EXISTS mcp_tokens_insert ON mcp_tokens;
DROP POLICY IF EXISTS mcp_tokens_update ON mcp_tokens;
DROP POLICY IF EXISTS oauth_states_admin ON oauth_states;

-- Tenants
CREATE POLICY tenants_select ON tenants
  FOR SELECT USING (hub_is_super_admin() OR id = hub_tenant_id());

CREATE POLICY tenants_super_admin_all ON tenants
  FOR ALL USING (hub_is_super_admin());

CREATE POLICY tenants_org_admin_all ON tenants
  FOR ALL USING (hub_is_org_admin() AND id = hub_tenant_id());

-- Departments
CREATE POLICY departments_select ON departments
  FOR SELECT USING (hub_can_access_tenant(tenant_id));

CREATE POLICY departments_admin ON departments
  FOR ALL USING (hub_can_manage_tenant(tenant_id));

-- Roles
CREATE POLICY roles_select ON roles
  FOR SELECT USING (hub_can_access_tenant(tenant_id));

CREATE POLICY roles_admin ON roles
  FOR ALL USING (hub_can_manage_tenant(tenant_id));

-- Users
CREATE POLICY users_select ON users
  FOR SELECT USING (hub_can_access_tenant(tenant_id));

CREATE POLICY users_self ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY users_admin ON users
  FOR ALL USING (hub_can_manage_tenant(tenant_id));

-- Connections
CREATE POLICY connections_select ON connections
  FOR SELECT USING (hub_can_access_tenant(tenant_id));

CREATE POLICY connections_admin ON connections
  FOR ALL USING (hub_can_manage_tenant(tenant_id));

-- Connection secrets
CREATE POLICY connection_secrets_admin ON connection_secrets
  FOR ALL USING (
    hub_can_manage_tenant((
      SELECT c.tenant_id FROM connections c
      WHERE c.id = connection_secrets.connection_id
    ))
  );

-- Permission grants
CREATE POLICY permission_grants_select ON permission_grants
  FOR SELECT USING (hub_can_access_tenant(tenant_id));

CREATE POLICY permission_grants_admin ON permission_grants
  FOR ALL USING (hub_can_manage_tenant(tenant_id));

-- Audit log
CREATE POLICY audit_log_select ON audit_log
  FOR SELECT USING (hub_can_access_tenant(tenant_id));

-- MCP tokens
CREATE POLICY mcp_tokens_select ON mcp_tokens
  FOR SELECT USING (
    user_id = auth.uid()
    OR hub_can_manage_tenant(tenant_id)
  );

CREATE POLICY mcp_tokens_insert ON mcp_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid() AND hub_tenant_id() = tenant_id);

CREATE POLICY mcp_tokens_update ON mcp_tokens
  FOR UPDATE USING (user_id = auth.uid());

-- OAuth states
CREATE POLICY oauth_states_admin ON oauth_states
  FOR ALL USING (hub_can_manage_tenant(tenant_id));
