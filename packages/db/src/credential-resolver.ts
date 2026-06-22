import type { Connection } from "@hub/core";
import type { HubStore } from "./store-types.js";
import { setCredentialResolver, setSecretFetcher } from "@hub/connectors";
import type { OAuthTokens } from "@hub/connectors";

export function wireCredentialResolver(store: HubStore): void {
  setCredentialResolver(async (connection: Connection) => {
    const secret = await store.getConnectionSecret(connection.id);
    if (!secret) return null;
    return secret as unknown as OAuthTokens;
  });

  setSecretFetcher(async (connectionId: string) => {
    return store.getConnectionSecret(connectionId);
  });
}
