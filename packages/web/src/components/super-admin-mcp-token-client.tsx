"use client";

import { useState } from "react";
import { getApiUrl } from "@/lib/api";
import { McpConnectionGuide } from "@/components/mcp-connection-guide";

export function SuperAdminMcpTokenClient({
  token,
  userId,
  hasHubUser,
}: {
  token: string;
  userId: string;
  hasHubUser: boolean;
}) {
  const [name, setName] = useState("cursor");
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function createToken() {
    setLoading(true);
    setError("");
    setIssuedToken(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/v1/me/mcp-token`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, expiresInDays }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create token");
      setIssuedToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירת טוקן");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }

  if (!hasHubUser) {
    return (
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>טוקן MCP אישי</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
          כדי ליצור טוקן MCP, חשבון הסופר אדמין חייב להיות גם משתמש רשום בארגון.
          הירשם לארגון או בקש ממנהל להוסיף אותך כמשתמש.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>טוקן MCP אישי (סופר אדמין)</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
          User ID: <code>{userId}</code>
          <button
            type="button"
            className="secondary"
            style={{ marginRight: "0.5rem", padding: "0.15rem 0.4rem", fontSize: "0.75rem" }}
            onClick={() => copyText(userId)}
          >
            העתק
          </button>
        </p>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "0.75rem" }}>
          <label>
            <span style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.25rem" }}>שם טוקן</span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: 140 }} />
          </label>
          <label>
            <span style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.25rem" }}>תוקף (ימים)</span>
            <input
              type="number"
              min={1}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              style={{ width: 100 }}
            />
          </label>
          <button type="button" onClick={createToken} disabled={loading}>
            {loading ? "יוצר..." : "צור טוקן MCP"}
          </button>
        </div>

        {error && <p style={{ color: "var(--danger)", fontSize: "0.875rem" }}>{error}</p>}

        {issuedToken && (
          <div style={{ padding: "0.75rem", background: "var(--bg)", borderRadius: 6 }}>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.875rem" }}>
              הטוקן נוצר — העתק עכשיו (לא יוצג שוב):
            </p>
            <code style={{ display: "block", wordBreak: "break-all", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
              {issuedToken}
            </code>
            <button type="button" onClick={() => copyText(issuedToken)}>
              העתק טוקן
            </button>
          </div>
        )}
      </div>

      <McpConnectionGuide sampleToken={issuedToken ?? undefined} />
    </div>
  );
}
