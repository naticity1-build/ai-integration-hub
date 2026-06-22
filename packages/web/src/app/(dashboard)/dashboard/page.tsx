import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";
import { getAuthContext } from "@/lib/server-auth";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const auth = await getAuthContext();

  let stats = { connections: 0, users: 0, recentAudit: 0 };
  let tenantId = auth?.tenantId ?? "";

  if (token && tenantId) {
    try {
      const [connections, users, audit] = await Promise.all([
        apiFetch<unknown[]>(`/tenants/${tenantId}/connections`, { token }),
        apiFetch<unknown[]>(`/tenants/${tenantId}/users`, { token }),
        apiFetch<unknown[]>(`/tenants/${tenantId}/audit?limit=5`, { token }),
      ]);
      stats = {
        connections: connections.length,
        users: users.length,
        recentAudit: audit.length,
      };
    } catch {
      // Dev mode without API — show placeholder
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1.5rem" }}>לוח בקרה</h1>
      {auth?.isSuperAdmin && !tenantId && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <p style={{ marginBottom: "0.75rem" }}>
            אתה מחובר כסופר אדמין. בחר ארגון לניהול או צפה בכל הארגונים.
          </p>
          <Link href="/organizations">מעבר לארגונים →</Link>
        </div>
      )}
      {tenantId && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
          <div className="card">
            <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>חיבורים פעילים</p>
            <p style={{ fontSize: "2rem", fontWeight: 600 }}>{stats.connections}</p>
          </div>
          <div className="card">
            <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>משתמשים</p>
            <p style={{ fontSize: "2rem", fontWeight: 600 }}>{stats.users}</p>
          </div>
          <div className="card">
            <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>פעילות אחרונה</p>
            <p style={{ fontSize: "2rem", fontWeight: 600 }}>{stats.recentAudit}</p>
          </div>
        </div>
      )}
      <div className="card">
        <h2 style={{ marginBottom: "0.75rem" }}>ברוכים הבאים ל-AI Integration Hub</h2>
        <p style={{ color: "var(--muted)" }}>
          מערכת תיווך מאובטחת בין מקורות מידע ארגוניים למודלי AI דרך MCP.
          {tenantId && ` ארגון: ${tenantId}`}
        </p>
      </div>
    </div>
  );
}
