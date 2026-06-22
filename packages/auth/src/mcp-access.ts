import { createHash, randomBytes } from "node:crypto";
import type { HubStore } from "@hub/db";
import type { PermissionGrant, User } from "@hub/core";
import { userHasAnyGrant } from "@hub/core";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateMcpToken(): string {
  return `hub_${randomBytes(32).toString("base64url")}`;
}

export function generateAccessKey(): string {
  return `ack_${randomBytes(24).toString("base64url")}`;
}

export function getMcpServerBaseUrl(): string {
  const fromEnv =
    process.env.MCP_SERVER_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_MCP_SERVER_URL ??
    "https://hub-mcp-server.onrender.com/mcp";
  return fromEnv.replace(/\/mcp\/?$/, "");
}

export function buildMcpConnectionUrl(accessKey: string): string {
  return `${getMcpServerBaseUrl()}/mcp/${accessKey}`;
}

export async function resolveUserFromAccessKey(
  accessKey: string,
  store: HubStore
): Promise<{ userId: string; tenantId: string } | null> {
  const record = await store.getMcpTokenByAccessKey(accessKey);
  if (!record) return null;
  if (record.revokedAt) return null;
  if (record.expiresAt && record.expiresAt < new Date()) return null;
  return { userId: record.userId, tenantId: record.tenantId };
}

export async function ensureMcpAccess(
  store: HubStore,
  userId: string
): Promise<{ accessKey: string; connectionUrl: string } | null> {
  const user = await store.getUserContext(userId);
  if (!user) return null;

  const grants = await store.getPermissionGrants(user.tenantId);
  if (!userHasAnyGrant(user, grants)) return null;

  const existing = await store.getActiveMcpAccessForUser(userId);
  if (existing) {
    return {
      accessKey: existing.accessKey,
      connectionUrl: buildMcpConnectionUrl(existing.accessKey),
    };
  }

  const token = generateMcpToken();
  const accessKey = generateAccessKey();
  await store.createMcpToken({
    userId,
    tenantId: user.tenantId,
    tokenHash: hashToken(token),
    accessKey,
    name: "claude",
  });

  return { accessKey, connectionUrl: buildMcpConnectionUrl(accessKey) };
}

export async function syncUserMcpAccess(store: HubStore, userId: string): Promise<void> {
  const user = await store.getUserContext(userId);
  if (!user) return;

  const grants = await store.getPermissionGrants(user.tenantId);
  if (!userHasAnyGrant(user, grants)) {
    await store.revokeActiveMcpTokensForUser(userId);
    return;
  }

  await ensureMcpAccess(store, userId);
}

export function usersAffectedByGrant(users: User[], grant: PermissionGrant): string[] {
  switch (grant.targetType) {
    case "user":
      return users.filter((u) => u.id === grant.targetId).map((u) => u.id);
    case "role":
      return users.filter((u) => u.roleId === grant.targetId).map((u) => u.id);
    case "department":
      return users.filter((u) => u.departmentId === grant.targetId).map((u) => u.id);
    default:
      return [];
  }
}

export async function syncMcpAccessForGrant(
  store: HubStore,
  tenantId: string,
  grant: PermissionGrant
): Promise<void> {
  const users = await store.listUsers(tenantId);
  const affected = usersAffectedByGrant(users, grant);
  await Promise.all(affected.map((userId) => syncUserMcpAccess(store, userId)));
}

export async function syncMcpAccessForAllTenantUsers(
  store: HubStore,
  tenantId: string
): Promise<void> {
  const users = await store.listUsers(tenantId);
  await Promise.all(users.map((u) => syncUserMcpAccess(store, u.id)));
}
