"use client";

import { useState } from "react";
import { getApiUrl } from "@/lib/api";

export function McpSetupClient({ token }: { token: string }) {
  const [mcpToken, setMcpToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateToken() {
    setLoading(true);
    const res = await fetch(`${getApiUrl()}/api/v1/me/mcp-token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "cursor", expiresInDays: 90 }),
    });
    const data = await res.json();
    setMcpToken(data.token);
    setLoading(false);
  }

  const stdioConfig = {
    mcpServers: {
      "ai-integration-hub": {
        command: "node",
        args: ["packages/mcp-server/dist/index.js"],
        env: {
          HUB_STORE: "memory",
          HUB_MCP_TOKEN: mcpToken ?? "YOUR_TOKEN_HERE",
        },
      },
    },
  };

  const httpConfig = {
    mcpServers: {
      "ai-integration-hub": {
        url: "http://localhost:3100/mcp",
        headers: {
          Authorization: `Bearer ${mcpToken ?? "YOUR_TOKEN_HERE"}`,
        },
      },
    },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="card">
        <h2 style={{ marginBottom: "1rem" }}>1. צור Token אישי</h2>
        <button onClick={generateToken} disabled={loading || !token}>
          {loading ? "יוצר..." : "צור MCP Token"}
        </button>
        {mcpToken && (
          <pre
            style={{
              marginTop: "1rem",
              padding: "1rem",
              background: "var(--bg)",
              borderRadius: 6,
              overflow: "auto",
              fontSize: "0.75rem",
            }}
          >
            {mcpToken}
          </pre>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: "1rem" }}>2. הגדרת Cursor (stdio)</h2>
        <pre
          style={{
            padding: "1rem",
            background: "var(--bg)",
            borderRadius: 6,
            overflow: "auto",
            fontSize: "0.75rem",
          }}
        >
          {JSON.stringify(stdioConfig, null, 2)}
        </pre>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: "1rem" }}>3. הגדרת Cursor (HTTP)</h2>
        <pre
          style={{
            padding: "1rem",
            background: "var(--bg)",
            borderRadius: 6,
            overflow: "auto",
            fontSize: "0.75rem",
          }}
        >
          {JSON.stringify(httpConfig, null, 2)}
        </pre>
      </div>
    </div>
  );
}
