"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api";

export function ClaudeConnectCard({ token }: { token: string }) {
  const [connectionUrl, setConnectionUrl] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${getApiUrl()}/api/v1/me/mcp-connection`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setHasAccess(!!data.hasAccess);
        setConnectionUrl(data.connectionUrl ?? null);
      } catch {
        setHasAccess(false);
        setConnectionUrl(null);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token]);

  async function copyUrl() {
    if (!connectionUrl) return;
    await navigator.clipboard.writeText(connectionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p style={{ color: "var(--muted)" }}>טוען...</p>
      </div>
    );
  }

  if (!hasAccess || !connectionUrl) {
    return (
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Claude.ai</h2>
        <p style={{ color: "var(--muted)" }}>
          אין עדיין הרשאה. המנהל יגדיר הרשאות — ואז יופיע כאן קישור MCP להדבקה ב-Claude.ai.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1.1rem", marginBottom: "0.35rem" }}>Claude.ai — קישור MCP</h2>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>
        העתק את הקישור והדבק ב-
        <a href="https://claude.ai/settings/connectors" target="_blank" rel="noreferrer">
          claude.ai → Settings → Connectors
        </a>
        {" "}→ Add custom connector → שדה URL בלבד. אין צורך ב-OAuth או בהגדרות מתקדמות.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch", flexWrap: "wrap" }}>
        <code
          style={{
            flex: "1 1 280px",
            padding: "0.85rem 1rem",
            background: "var(--bg)",
            borderRadius: 6,
            fontSize: "0.8rem",
            wordBreak: "break-all",
            lineHeight: 1.5,
          }}
        >
          {connectionUrl}
        </code>
        <button type="button" onClick={copyUrl} style={{ alignSelf: "center" }}>
          {copied ? "הועתק!" : "העתק קישור MCP"}
        </button>
      </div>
    </div>
  );
}
