import { createClient } from "@/lib/supabase/server";
import { McpSetupClient } from "./mcp-setup-client";

export default async function McpSetupPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <div>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1.5rem" }}>הגדרת MCP</h1>
      <McpSetupClient token={session?.access_token ?? ""} />
    </div>
  );
}
