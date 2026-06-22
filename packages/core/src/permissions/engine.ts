import type { ConnectorCapability, ConnectorType, Connection } from "../types/connector.js";
import type { PermissionGrant, UserContext } from "../types/permission.js";

export interface PermissionEngineInput {
  user: UserContext;
  grants: PermissionGrant[];
  activeConnections: Connection[];
  capabilities: ConnectorCapability[];
}

export interface ResolvedTool {
  toolName: string;
  connectorType: ConnectorType;
  connectionId: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Resolves which MCP tools a user is allowed to see and invoke,
 * based on their role, department, and active tenant connections.
 */
export class PermissionEngine {
  resolveTools(input: PermissionEngineInput): ResolvedTool[] {
    const { user, grants, activeConnections, capabilities } = input;
    const activeTypes = new Set(
      activeConnections.filter((c) => c.status === "active").map((c) => c.type)
    );

    const allowedTools = this.collectAllowedTools(user, grants, activeTypes);
    const connectionByType = new Map(
      activeConnections
        .filter((c) => c.status === "active")
        .map((c) => [c.type, c])
    );

    const tools: ResolvedTool[] = [];

    for (const cap of capabilities) {
      if (!activeTypes.has(cap.connectorType)) continue;
      if (!this.isToolAllowed(cap.toolName, cap.connectorType, allowedTools)) continue;

      const connection = connectionByType.get(cap.connectorType);
      if (!connection) continue;

      tools.push({
        toolName: cap.toolName,
        connectorType: cap.connectorType,
        connectionId: connection.id,
        description: cap.description,
        inputSchema: cap.inputSchema,
      });
    }

    return tools;
  }

  canInvokeTool(
    user: UserContext,
    grants: PermissionGrant[],
    activeConnections: Connection[],
    toolName: string,
    connectorType: ConnectorType
  ): boolean {
    const activeTypes = new Set(
      activeConnections.filter((c) => c.status === "active").map((c) => c.type)
    );
    if (!activeTypes.has(connectorType)) return false;

    const allowedTools = this.collectAllowedTools(user, grants, activeTypes);
    return this.isToolAllowed(toolName, connectorType, allowedTools);
  }

  private collectAllowedTools(
    user: UserContext,
    grants: PermissionGrant[],
    activeTypes: Set<ConnectorType>
  ): Map<ConnectorType, Set<string>> {
    const result = new Map<ConnectorType, Set<string>>();

    for (const grant of grants) {
      if (!activeTypes.has(grant.connectorType)) continue;
      if (!this.grantAppliesToUser(grant, user)) continue;

      let tools = result.get(grant.connectorType);
      if (!tools) {
        tools = new Set();
        result.set(grant.connectorType, tools);
      }

      for (const tool of grant.allowedTools) {
        tools.add(tool);
      }
    }

    return result;
  }

  private grantAppliesToUser(grant: PermissionGrant, user: UserContext): boolean {
    switch (grant.targetType) {
      case "user":
        return grant.targetId === user.userId;
      case "department":
        return grant.targetId === user.departmentId;
      case "role":
        return grant.targetId === user.roleId;
      default:
        return false;
    }
  }

  private isToolAllowed(
    toolName: string,
    connectorType: ConnectorType,
    allowedTools: Map<ConnectorType, Set<string>>
  ): boolean {
    const tools = allowedTools.get(connectorType);
    if (!tools) return false;
    return tools.has("*") || tools.has(toolName);
  }
}
