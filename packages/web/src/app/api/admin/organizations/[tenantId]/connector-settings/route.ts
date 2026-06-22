import { NextResponse } from "next/server";
import { buildTenantConnectorSettings } from "@hub/connectors";
import {
  getHubStore,
  requireSuperAdminContext,
} from "@/lib/server-auth";
import type { ConnectorType } from "@hub/core";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    await requireSuperAdminContext();
    const { tenantId } = await params;
    const store = getHubStore();
    const tenant = await store.getTenant(tenantId);
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const overrides = await store.listTenantConnectorOverrides(tenantId);
    return NextResponse.json({ settings: buildTenantConnectorSettings(overrides) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load connector settings";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Super admin access required"
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    await requireSuperAdminContext();
    const { tenantId } = await params;
    const body = (await request.json()) as { connectorType: ConnectorType; enabled: boolean };
    const store = getHubStore();
    const tenant = await store.getTenant(tenantId);
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await store.setTenantConnectorEnabled(tenantId, body.connectorType, body.enabled);
    const overrides = await store.listTenantConnectorOverrides(tenantId);
    return NextResponse.json({ settings: buildTenantConnectorSettings(overrides) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update connector setting";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Super admin access required"
          ? 403
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
