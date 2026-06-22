import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAuthContext, getHubStore } from "@/lib/server-auth";

const orgNav = [
  { href: "", label: "סקירה" },
  { href: "/connector-settings", label: "סוגי חיבורים" },
  { href: "/users", label: "משתמשים" },
  { href: "/connections", label: "חיבורים" },
  { href: "/permissions", label: "הרשאות" },
  { href: "/audit", label: "לוגים" },
];

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const auth = await getAuthContext();
  if (!auth?.isSuperAdmin) redirect("/dashboard");

  const { tenantId } = await params;
  const store = getHubStore();
  const tenant = await store.getTenant(tenantId);
  if (!tenant) notFound();

  const base = `/organizations/${tenantId}`;

  return (
    <div>
      <p style={{ marginBottom: "0.5rem" }}>
        <Link href="/organizations" style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
          ← כל הארגונים
        </Link>
      </p>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>{tenant.name}</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.25rem" }}>slug: {tenant.slug}</p>
      <nav
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        {orgNav.map((item) => (
          <Link
            key={item.href}
            href={`${base}${item.href}`}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: 6,
              border: "1px solid var(--border)",
              textDecoration: "none",
              color: "var(--text)",
              fontSize: "0.875rem",
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
