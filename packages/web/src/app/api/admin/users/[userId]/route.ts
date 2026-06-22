import { NextResponse } from "next/server";
import {
  getHubStore,
  getSupabaseAdmin,
  requireOrgOrSuperAdminContext,
  resolveEffectiveTenantId,
  requireAuthContext,
} from "@/lib/server-auth";
import { updateUserAsAdmin } from "@hub/auth";
import type { RoleName } from "@hub/core";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await requireAuthContext();
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const tenantId = resolveEffectiveTenantId(auth, searchParams.get("tenantId"));
    await requireOrgOrSuperAdminContext(tenantId);

    const body = (await request.json()) as {
      roleId?: string;
      departmentId?: string | null;
      isActive?: boolean;
    };

    const store = getHubStore();
    const supabase = getSupabaseAdmin();

    let roleName: RoleName | undefined;
    if (body.roleId) {
      const roles = await store.listRoles(tenantId);
      const role = roles.find((r) => r.id === body.roleId);
      if (!role) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      roleName = role.name;
    }

    const user = await updateUserAsAdmin(store, supabase, userId, tenantId, {
      ...body,
      roleName,
    });

    return NextResponse.json(user);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update user";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Forbidden" || message === "Org admin access required"
          ? 403
          : message === "Tenant ID required"
            ? 400
            : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
