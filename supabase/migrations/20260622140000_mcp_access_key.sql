-- Personal MCP connection URLs: /mcp/ack_xxx (no Bearer header needed for Claude)
ALTER TABLE mcp_tokens ADD COLUMN IF NOT EXISTS access_key TEXT UNIQUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_tokens_access_key_active
  ON mcp_tokens(access_key)
  WHERE access_key IS NOT NULL AND revoked_at IS NULL;
