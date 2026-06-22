import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/server-auth";
import { OrganizationsClient } from "./organizations-client";

export default async function OrganizationsPage() {
  const auth = await getAuthContext();
  if (!auth?.isSuperAdmin) redirect("/dashboard");

  return (
    <div>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1.5rem" }}>ארגונים</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        סופר אדמין — צפייה וניהול של כל הארגונים במערכת.
      </p>
      <OrganizationsClient />
    </div>
  );
}
