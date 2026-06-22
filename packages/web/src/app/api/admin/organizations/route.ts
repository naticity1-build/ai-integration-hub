import { NextResponse } from "next/server";
import {
  getHubStore,
  requireSuperAdminContext,
} from "@/lib/server-auth";

export async function GET() {
  try {
    await requireSuperAdminContext();
    const store = getHubStore();
    const tenants = await store.listTenants();
    return NextResponse.json({ tenants });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load organizations";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Super admin access required"
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperAdminContext();
    const body = (await request.json()) as { name: string; slug: string };
    const store = getHubStore();
    const tenant = await store.createTenant(body);
    return NextResponse.json(tenant, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create organization";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Super admin access required"
          ? 403
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
