-- Per-tenant connector type enable/disable (managed by super admin)

CREATE TABLE tenant_connector_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connector_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connector_type)
);

CREATE INDEX idx_tenant_connector_settings_tenant ON tenant_connector_settings(tenant_id);

ALTER TABLE tenant_connector_settings ENABLE ROW LEVEL SECURITY;
