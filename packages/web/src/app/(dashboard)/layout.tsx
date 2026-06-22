import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/server-auth";

const adminNavItems = [
  { href: "/users", label: "משתמשים" },
  { href: "/connections", label: "חיבורים" },
  { href: "/permissions", label: "הרשאות" },
  { href: "/audit", label: "לוגים" },
];

const baseNavItems = [
  { href: "/dashboard", label: "לוח בקרה" },
  { href: "/mcp-setup", label: "הגדרת MCP" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const auth = await getAuthContext();
  const isSuperAdmin = auth?.isSuperAdmin ?? false;
  const isOrgAdmin = auth?.roleName === "admin" && !!auth?.tenantId;

  const navItems = [
    ...baseNavItems,
    ...(isSuperAdmin ? [{ href: "/organizations", label: "ארגונים" }] : []),
    ...(isOrgAdmin ? adminNavItems : []),
  ];

  let roleLabel = `תפקיד: ${auth?.roleName ?? "—"}`;
  if (isSuperAdmin && isOrgAdmin) roleLabel = "סופר אדמין · מנהל ארגון";
  else if (isSuperAdmin) roleLabel = "סופר אדמין";
  else if (isOrgAdmin) roleLabel = "מנהל ארגון";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 220,
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          padding: "1.5rem 1rem",
        }}
      >
        <h2 style={{ fontSize: "1rem", marginBottom: "0.25rem" }}>Integration Hub</h2>
        {auth && (
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
            {auth.email}
            <br />
            {roleLabel}
          </p>
        )}
        <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: 6,
                color: "var(--text)",
                textDecoration: "none",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action="/auth/signout" method="post" style={{ marginTop: "2rem" }}>
          <button type="submit" className="secondary" style={{ width: "100%" }}>
            התנתקות
          </button>
        </form>
      </aside>
      <main style={{ flex: 1, padding: "2rem" }}>{children}</main>
    </div>
  );
}
