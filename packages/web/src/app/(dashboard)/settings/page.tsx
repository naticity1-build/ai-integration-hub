import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, getHubStore } from "@/lib/server-auth";
import { getMcpServerUrl } from "@/lib/mcp-config";
import { SuperAdminMcpTokenClient } from "@/components/super-admin-mcp-token-client";

export default async function SettingsPage() {
  const auth = await getAuthContext();
  if (!auth?.isSuperAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const store = getHubStore();
  const hubUser = await store.getUserContext(auth.userId);

  const mcpServerUrl = getMcpServerUrl();

  return (
    <div>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1.5rem" }}>הגדרות מערכת</h1>

      <SuperAdminMcpTokenClient
        token={session?.access_token ?? ""}
        userId={auth.userId}
        hasHubUser={!!hubUser}
      />

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>שרת MCP ציבורי</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
          כתובת זו מוצגת למנהלי ארגון בעת יצירת טוקני MCP למשתמשים.
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
          {mcpServerUrl}
        </code>
        <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.75rem" }}>
          ניתן לשנות באמצעות משתנה הסביבה{" "}
          <code>NEXT_PUBLIC_MCP_SERVER_URL</code> ב-Vercel.
        </p>
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>הגדרות נוספות</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
          הגדרות מערכת נוספות יתווספו בעתיד.
        </p>
      </div>
    </div>
  );
}
