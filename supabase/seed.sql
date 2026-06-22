-- Demo seed data for AI Integration Hub (mirrors InMemoryHubStore demo)
-- Super admin: create manually via platform_admins + app_metadata.is_super_admin (see README)

-- Fixed UUIDs for reproducible local dev
-- Tenant ABC
INSERT INTO tenants (id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111', 'ABC Corp', 'abc');

INSERT INTO departments (id, tenant_id, name, parent_id) VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', 'Sales', NULL),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', 'Finance', NULL),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111111', 'Management', NULL);

INSERT INTO roles (id, tenant_id, name, description) VALUES
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111111', 'admin', 'Full tenant administration'),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111111', 'manager', 'Department manager'),
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111111', 'member', 'Standard member'),
  ('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111111', 'viewer', 'Read-only access');

-- Demo user (no auth.users link in seed — created via auth signup or service role)
-- user-sales-1 maps to UUID below for MCP dev without auth
INSERT INTO connections (id, tenant_id, type, name, status, credentials_ref, config) VALUES
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111111', 'google_drive', 'ABC Google Drive', 'active', 'secret:gdrive-abc', '{}'),
  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111111', 'gmail', 'ABC Gmail', 'active', 'secret:gmail-abc', '{}');

INSERT INTO permission_grants (id, tenant_id, target_type, target_id, connector_type, allowed_tools) VALUES
  ('55555555-5555-5555-5555-555555555501', '11111111-1111-1111-1111-111111111111', 'department', '22222222-2222-2222-2222-222222222201', 'google_drive', ARRAY['search_documents', 'read_document', 'summarize_document']),
  ('55555555-5555-5555-5555-555555555502', '11111111-1111-1111-1111-111111111111', 'department', '22222222-2222-2222-2222-222222222201', 'gmail', ARRAY['search_emails', 'summarize_thread']),
  ('55555555-5555-5555-5555-555555555503', '11111111-1111-1111-1111-111111111111', 'department', '22222222-2222-2222-2222-222222222202', 'google_drive', ARRAY['search_documents', 'read_document']);
