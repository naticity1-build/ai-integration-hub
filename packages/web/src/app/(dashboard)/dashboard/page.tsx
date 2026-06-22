import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";
import { getAuthContext, getHubStore } from "@/lib/server-auth";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const auth = await getAuthContext();

  const isSuperAdmin = auth?.isSuperAdmin ?? false;
  const isOrgAdmin = auth?.roleName === "admin" && !!auth?.tenantId;
  const tenantId = auth?.tenantId ?? "";

  let orgStats = { organizations: 0, totalUsers: 0 };
  let tenantStats = { connections: 0, users: 0, recentAudit: 0 };

  if (isSuperAdmin) {
    const store = getHubStore();
    const tenants = await store.listTenants();
    let totalUsers = 0;
    for (const tenant of tenants) {
      const users = await store.listUsers(tenant.id);
      totalUsers += users.length;
    }
    orgStats = { organizations: tenants.length, totalUsers };
  }

  if (token && tenantId && isOrgAdmin) {
    try {
      const [connections, users, audit] = await Promise.all([
        apiFetch<unknown[]>(`/tenants/${tenantId}/connections`, { token }),
        apiFetch<unknown[]>(`/tenants/${tenantId}/users`, { token }),
        apiFetch<unknown[]>(`/tenants/${tenantId}/audit?limit=5`, { token }),
      ]);
      tenantStats = {
        connections: connections.length,
        users: users.length,
        recentAudit: audit.length,
      };
    } catch {
      // API unavailable in dev
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1.5rem" }}>לוח בקרה</h1>

      {isSuperAdmin && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "1rem",
              marginBottom: "2rem",
              maxWidth: 480,
            }}
          >
            <div className="card">
              <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>ארגונים</p>
              <p style={{ fontSize: "2rem", fontWeight: 600 }}>{orgStats.organizations}</p>
            </div>
            <div className="card">
              <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>סה״כ משתמשים</p>
              <p style={{ fontSize: "2rem", fontWeight: 600 }}>{orgStats.totalUsers}</p>
            </div>
          </div>
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <p style={{ marginBottom: "0.75rem" }}>
              נהל ארגונים, משתמשים, חיבורים והרשאות מהעמוד ארגונים.
            </p>
            <Link href="/organizations">מעבר לארגונים →</Link>
          </div>
        </>
      )}

      {isOrgAdmin && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="card">
            <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>חיבורים</p>
            <p style={{ fontSize: "2rem", fontWeight: 600 }}>{tenantStats.connections}</p>
          </div>
          <div className="card">
            <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>משתמשים</p>
            <p style={{ fontSize: "2rem", fontWeight: 600 }}>{tenantStats.users}</p>
          </div>
          <div className="card">
            <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>פעילות אחרונה</p>
            <p style={{ fontSize: "2rem", fontWeight: 600 }}>{tenantStats.recentAudit}</p>
          </div>
        </div>
      )}

      {!isSuperAdmin && !isOrgAdmin && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>ברוכים הבאים</h2>
          <p style={{ color: "var(--muted)" }}>
            לקבלת גישה ל-MCP (Cursor / Claude Desktop), פנה למנהל הארגון שלך ליצירת טוקן אישי.
          </p>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginBottom: "0.75rem" }}>AI Integration Hub</h2>
        <p style={{ color: "var(--muted)" }}>
          מערכת תיווך מאובטחת בין מקורות מידע ארגוניים למודלי AI דרך MCP.
        </p>
        {isOrgAdmin && (
          <p style={{ color: "var(--muted)", marginTop: "0.5rem", fontSize: "0.875rem" }}>
            <Link href="/users">ניהול משתמשים וטוקני MCP</Link>
            {" · "}
            <Link href="/connections">חיבורים</Link>
            {" · "}
            <Link href="/permissions">הרשאות</Link>
          </p>
        )}
      </div>
    </div>
  );
}
