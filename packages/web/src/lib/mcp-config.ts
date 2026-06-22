export function getMcpServerUrl(): string {
  return process.env.NEXT_PUBLIC_MCP_SERVER_URL ?? "https://hub-mcp-server.onrender.com/mcp";
}
