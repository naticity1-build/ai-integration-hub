import { UsersAdminClient } from "../../../users/users-admin-client";

export default async function OrgUsersPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  return (
    <div>
      <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>משתמשי הארגון</h2>
      <UsersAdminClient canManage tenantId={tenantId} />
    </div>
  );
}
