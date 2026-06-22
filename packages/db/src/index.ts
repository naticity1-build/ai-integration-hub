import type { HubStore } from "./store-types.js";
import { InMemoryHubStore } from "./in-memory-store.js";
import { createSupabaseStore } from "./supabase-store.js";

export type { HubDataStore, HubAdminStore, HubStore, CreateStoreOptions } from "./store-types.js";
export { InMemoryHubStore } from "./in-memory-store.js";
export { SupabaseHubStore, createSupabaseStore } from "./supabase-store.js";
export { encryptSecret, decryptSecret } from "./crypto.js";
export * from "./types.js";
export * from "./mappers.js";

export interface CreateHubStoreOptions {
  mode?: "memory" | "supabase";
  supabaseUrl?: string;
  supabaseServiceKey?: string;
}

export { wireCredentialResolver } from "./credential-resolver.js";

export function createHubStore(options: CreateHubStoreOptions = {}): HubStore {
  const mode = options.mode ?? process.env.HUB_STORE ?? "memory";

  if (mode === "supabase") {
    const url =
      options.supabaseUrl ??
      process.env.SUPABASE_URL ??
      process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = options.supabaseServiceKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || key.includes("REPLACE_WITH")) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for supabase store. Set them in .env (root) or packages/web/.env.local"
      );
    }
    return createSupabaseStore({ supabaseUrl: url, supabaseServiceKey: key });
  }

  const store = new InMemoryHubStore();
  store.seedDemoData();
  return store;
}

/** Demo user ID for local in-memory development */
export const DEMO_USER_ID = "66666666-6666-6666-6666-666666666601";
