"use client";

import { getMcpServerUrl } from "@/lib/mcp-config";

export function McpConnectionGuide({ sampleToken }: { sampleToken?: string }) {
  const mcpUrl = getMcpServerUrl();
  const tokenPlaceholder = sampleToken ?? "hub_YOUR_TOKEN_HERE";

  const cursorConfig = {
    mcpServers: {
      "ai-integration-hub": {
        url: mcpUrl,
        headers: {
          Authorization: `Bearer ${tokenPlaceholder}`,
        },
      },
    },
  };

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="card" style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>הוראות חיבור MCP</h2>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>
        צור טוקן MCP למשתמש, העתק אותו, והשתמש בו בהגדרות הלקוח (Cursor / Claude Desktop).
      </p>

      <div style={{ marginBottom: "1rem" }}>
        <p style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>
          כתובת שרת MCP
        </p>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <code
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              background: "var(--bg)",
              borderRadius: 6,
              fontSize: "0.8rem",
              wordBreak: "break-all",
            }}
          >
            {mcpUrl}
          </code>
          <button type="button" className="secondary" onClick={() => copyText(mcpUrl)}>
            העתק
          </button>
        </div>
      </div>

      <div>
        <p style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>
          הגדרת Cursor (HTTP)
        </p>
        <pre
          style={{
            padding: "1rem",
            background: "var(--bg)",
            borderRadius: 6,
            overflow: "auto",
            fontSize: "0.75rem",
            marginBottom: "0.5rem",
          }}
        >
          {JSON.stringify(cursorConfig, null, 2)}
        </pre>
        <button
          type="button"
          className="secondary"
          onClick={() => copyText(JSON.stringify(cursorConfig, null, 2))}
        >
          העתק JSON
        </button>
      </div>

      <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "1rem" }}>
        הערה: Claude.ai בדפדפן (Custom Connector) דורש OAuth ואינו תומך ב-Bearer Token.
        השתמש ב-Claude Desktop או Cursor לחיבור עם טוקן.
      </p>
    </div>
  );
}
