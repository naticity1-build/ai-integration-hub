import { NextResponse } from "next/server";
import {
  getHubStore,
  requireAuthContext,
  requireOrgOrSuperAdminContext,
  resolveEffectiveTenantId,
} from "@/lib/server-auth";

export async function GET(request: Request) {
  try {
    const auth = await requireAuthContext();
    const { searchParams } = new URL(request.url);
    const tenantId = resolveEffectiveTenantId(auth, searchParams.get("tenantId"));
    await requireOrgOrSuperAdminContext(tenantId);

    const store = getHubStore();
    const users = await store.listUsers(tenantId);
    const roles = await store.listRoles(tenantId);
    const departments = await store.listDepartments(tenantId);

    const enriched = users.map((u) => ({
      ...u,
      roleName: roles.find((r) => r.id === u.roleId)?.name ?? "unknown",
      departmentName: departments.find((d) => d.id === u.departmentId)?.name ?? null,
    }));

    return NextResponse.json({ users: enriched, roles, departments, tenantId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load users";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Forbidden" || message === "Org admin access required"
          ? 403
          : message === "Tenant ID required"
            ? 400
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
