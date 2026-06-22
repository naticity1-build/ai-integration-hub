import { ConnectorSettingsClient } from "./connector-settings-client";

export default async function ConnectorSettingsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  return (
    <div>
      <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>סוגי חיבורים</h2>
      <ConnectorSettingsClient tenantId={tenantId} />
    </div>
  );
}
