# AI Integration Hub + MCP Platform

Secure multi-tenant bridge between enterprise data sources and AI models via MCP.

## Architecture

```
AI Client → MCP Server → Permission Engine → Connector Plugins → External APIs
                ↓
           Hub Data Store (Supabase / In-Memory)
```

## Packages

| Package | Description |
|---------|-------------|
| `@hub/core` | Domain types + PermissionEngine |
| `@hub/db` | SupabaseHubStore, InMemoryHubStore, migrations |
| `@hub/auth` | JWT/MCP token auth |
| `@hub/connectors` | Plugin registry + Google/Gmail/Calendar/REST |
| `@hub/mcp-server` | MCP server (stdio + HTTP) |
| `@hub/api` | Admin REST API |
| `@hub/web` | Next.js admin UI |

## Quick Start (In-Memory Dev)

```bash
npm install
npm run build
npm run dev
```

Connect Cursor using `.cursor/mcp.json` (default demo user: Sales dept).

## Supabase Setup

```bash
npm run db:start
npm run db:reset
```

Set environment variables from `.env.example`:

```
HUB_STORE=supabase
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=...
```

## Run Services

```bash
# MCP server (stdio)
npm run dev

# MCP server (HTTP)
MCP_TRANSPORT=http npm run dev -w @hub/mcp-server

# Admin API
npm run dev:api

# Admin Web UI
npm run dev:web
```

## MCP Auth

Issue a personal token via API (`POST /api/v1/me/mcp-token`) or the Admin UI MCP Setup page.
Use `HUB_MCP_TOKEN` env var for stdio mode, or `Authorization: Bearer` header for HTTP mode.

## OAuth Connections

Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then use the Connections page to OAuth-connect Google Drive, Gmail, or Calendar.

## Docker

```bash
docker build -t ai-integration-hub .
docker run -p 3100:3100 -e MCP_TRANSPORT=http ai-integration-hub
```

## Role Hierarchy

| Role | Scope | Capabilities |
|------|-------|--------------|
| **Super Admin** (`platform_admins`) | Entire platform | View/manage all organizations, users, connections, permissions |
| **Org Admin** (`role_name = admin` in tenant) | Single organization | Add users, edit roles and permissions within their org |
| **manager / member / viewer** | Single organization | Standard access per role |

- Self-registration `join` → always **viewer**
- Self-registration `create` → creator becomes **org admin** (not super admin)
- Super admins are created manually (see below)

## Super Admin Bootstrap (Manual)

1. Create a user in **Supabase Dashboard → Authentication → Users**
2. Run SQL (replace UUID and email):

```sql
INSERT INTO platform_admins (id, email)
VALUES ('<auth-user-uuid>', 'admin@example.com');
```

3. Set `app_metadata` on that auth user (Dashboard or Admin API):

```json
{
  "is_super_admin": true
}
```

4. Sign out and sign in again so the JWT picks up the new claims.

Super admins do not need a row in `users` unless they also belong to an organization. Manage all orgs via **ארגונים** (`/organizations`) in the Admin UI.

