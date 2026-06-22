import type { HubStore } from "@hub/db";
import type { User, RoleName } from "@hub/core";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function updateUserAsAdmin(
  store: HubStore,
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  data: {
    departmentId?: string | null;
    roleId?: string;
    roleName?: RoleName;
    isActive?: boolean;
    displayName?: string;
  }
): Promise<User> {
  const existing = await store.getUser(userId);
  if (!existing || existing.tenantId !== tenantId) {
    throw new Error("User not found");
  }

  let roleName = data.roleName;
  if (data.roleId && !roleName) {
    const roles = await store.listRoles(tenantId);
    roleName = roles.find((r) => r.id === data.roleId)?.name;
  }

  const user = await store.updateUser(userId, data);

  const appMetadata: Record<string, unknown> = {
    tenant_id: tenantId,
    hub_user_id: userId,
    role_id: user.roleId,
    department_id: user.departmentId,
    role_name: roleName ?? user.roleId,
  };

  if (roleName) appMetadata.role_name = roleName;

  if (data.isActive === false) {
    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: appMetadata,
      ban_duration: "876000h",
    });
  } else if (data.isActive === true) {
    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: appMetadata,
      ban_duration: "none",
    });
  } else if (data.roleId || data.departmentId !== undefined) {
    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: appMetadata,
    });
  }

  await store.logAudit({
    tenantId,
    userId,
    action: "user_updated",
    metadata: { targetUserId: userId, changes: data },
  });

  return user;
}
