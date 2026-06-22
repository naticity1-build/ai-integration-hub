import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/server-auth";
import { getMcpServerUrl } from "@/lib/mcp-config";

export default async function SettingsPage() {
  const auth = await getAuthContext();
  if (!auth?.isSuperAdmin) redirect("/dashboard");

  const mcpServerUrl = getMcpServerUrl();

  return (
    <div>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1.5rem" }}>הגדרות מערכת</h1>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>שרת MCP</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
          משתמשים עם הרשאה מקבלים קישור MCP אישי ל-Claude.ai (דפדפן). אין צורך ב-Desktop או ב-Cursor.
        </p>
        <code
          style={{
            display: "block",
            padding: "0.75rem 1rem",
            background: "var(--bg)",
            borderRadius: 6,
            fontSize: "0.875rem",
            wordBreak: "break-all",
          }}
        >
          {mcpServerUrl.replace(/\/mcp\/?$/, "")}/mcp/ack_...
        </code>
        <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.75rem" }}>
          בסיס הכתובת נקבע ב-<code>NEXT_PUBLIC_MCP_SERVER_URL</code> ב-Vercel.
        </p>
      </div>
    </div>
  );
}
