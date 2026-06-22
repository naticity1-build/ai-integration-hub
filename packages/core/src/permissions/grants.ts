import type { PermissionGrant, UserContext } from "../types/permission.js";

export function grantAppliesToUser(grant: PermissionGrant, user: UserContext): boolean {
  switch (grant.targetType) {
    case "user":
      return grant.targetId === user.userId;
    case "department":
      return grant.targetId === user.departmentId;
    case "role":
      return grant.targetId === user.roleId;
    default:
      return false;
  }
}

export function userHasAnyGrant(user: UserContext, grants: PermissionGrant[]): boolean {
  return grants.some((grant) => grantAppliesToUser(grant, user));
}
