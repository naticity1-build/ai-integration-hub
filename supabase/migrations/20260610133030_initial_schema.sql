-- AI Integration Hub — core schema with RLS

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE role_name AS ENUM ('admin', 'manager', 'member', 'viewer');
CREATE TYPE connector_status AS ENUM ('active', 'inactive', 'error', 'pending_auth');
CREATE TYPE grant_target_type AS ENUM ('department', 'role', 'user');

-- Tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Departments (hierarchical)
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_departments_tenant ON departments(tenant_id);

-- Roles per tenant
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name role_name NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  UNIQUE (tenant_id, name)
);

CREATE INDEX idx_roles_tenant ON roles(tenant_id);

-- Users linked to Supabase Auth
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  role_id UUID NOT NULL REFERENCES roles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- External system connections
CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  status connector_status NOT NULL DEFAULT 'pending_auth',
  credentials_ref TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_connections_tenant ON connections(tenant_id);
CREATE INDEX idx_connections_tenant_status ON connections(tenant_id, status);

-- Encrypted connection credentials (Vault alternative)
CREATE TABLE connection_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL UNIQUE REFERENCES connections(id) ON DELETE CASCADE,
  encrypted_data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permission grants: department / role / user → connector tools
CREATE TABLE permission_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_type grant_target_type NOT NULL,
  target_id UUID NOT NULL,
  connector_type TEXT NOT NULL,
  allowed_tools TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_permission_grants_tenant ON permission_grants(tenant_id);

-- Append-only audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  connector_type TEXT,
  tool_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_tenant_created ON audit_log(tenant_id, created_at DESC);

-- MCP access tokens (per-user API keys for IDE clients)
CREATE TABLE mcp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'default',
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mcp_tokens_user ON mcp_tokens(user_id);
CREATE INDEX idx_mcp_tokens_hash ON mcp_tokens(token_hash);

-- OAuth state for connection setup
CREATE TABLE oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  state TEXT NOT NULL UNIQUE,
  redirect_uri TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- JWT claim helpers for RLS
CREATE OR REPLACE FUNCTION hub_jwt_claim(claim TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claims', true), '')::json -> 'app_metadata' ->> claim,
    nullif(current_setting('request.jwt.claims', true), '')::json ->> claim
  );
$$;

CREATE OR REPLACE FUNCTION hub_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT hub_jwt_claim('tenant_id')::UUID;
$$;

CREATE OR REPLACE FUNCTION hub_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT hub_jwt_claim('hub_user_id')::UUID;
$$;

CREATE OR REPLACE FUNCTION hub_role_name()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT hub_jwt_claim('role_name');
$$;

CREATE OR REPLACE FUNCTION hub_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT hub_role_name() = 'admin';
$$;

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Tenants: users see own tenant only
CREATE POLICY tenants_select ON tenants
  FOR SELECT USING (id = hub_tenant_id());

CREATE POLICY tenants_admin_all ON tenants
  FOR ALL USING (hub_is_admin() AND id = hub_tenant_id());

-- Departments
CREATE POLICY departments_select ON departments
  FOR SELECT USING (tenant_id = hub_tenant_id());

CREATE POLICY departments_admin ON departments
  FOR ALL USING (hub_is_admin() AND tenant_id = hub_tenant_id());

-- Roles
CREATE POLICY roles_select ON roles
  FOR SELECT USING (tenant_id = hub_tenant_id());

CREATE POLICY roles_admin ON roles
  FOR ALL USING (hub_is_admin() AND tenant_id = hub_tenant_id());

-- Users
CREATE POLICY users_select ON users
  FOR SELECT USING (tenant_id = hub_tenant_id());

CREATE POLICY users_self ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY users_admin ON users
  FOR ALL USING (hub_is_admin() AND tenant_id = hub_tenant_id());

-- Connections
CREATE POLICY connections_select ON connections
  FOR SELECT USING (tenant_id = hub_tenant_id());

CREATE POLICY connections_admin ON connections
  FOR ALL USING (hub_is_admin() AND tenant_id = hub_tenant_id());

-- Connection secrets: admin only, never exposed to regular users
CREATE POLICY connection_secrets_admin ON connection_secrets
  FOR ALL USING (
    hub_is_admin()
    AND EXISTS (
      SELECT 1 FROM connections c
      WHERE c.id = connection_secrets.connection_id
        AND c.tenant_id = hub_tenant_id()
    )
  );

-- Permission grants
CREATE POLICY permission_grants_select ON permission_grants
  FOR SELECT USING (tenant_id = hub_tenant_id());

CREATE POLICY permission_grants_admin ON permission_grants
  FOR ALL USING (hub_is_admin() AND tenant_id = hub_tenant_id());

-- Audit log: tenant members can read, inserts via service role
CREATE POLICY audit_log_select ON audit_log
  FOR SELECT USING (tenant_id = hub_tenant_id());

-- MCP tokens: users manage own tokens
CREATE POLICY mcp_tokens_select ON mcp_tokens
  FOR SELECT USING (user_id = auth.uid() OR (hub_is_admin() AND tenant_id = hub_tenant_id()));

CREATE POLICY mcp_tokens_insert ON mcp_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid() AND tenant_id = hub_tenant_id());

CREATE POLICY mcp_tokens_update ON mcp_tokens
  FOR UPDATE USING (user_id = auth.uid());

-- OAuth states: admin only
CREATE POLICY oauth_states_admin ON oauth_states
  FOR ALL USING (hub_is_admin() AND tenant_id = hub_tenant_id());

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER connections_updated_at BEFORE UPDATE ON connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER connection_secrets_updated_at BEFORE UPDATE ON connection_secrets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
