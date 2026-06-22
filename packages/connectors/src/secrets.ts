export type SecretFetcher = (connectionId: string) => Promise<Record<string, unknown> | null>;

let secretFetcher: SecretFetcher | null = null;

export function setSecretFetcher(fetcher: SecretFetcher): void {
  secretFetcher = fetcher;
}

export async function fetchConnectionSecrets(
  connectionId: string
): Promise<Record<string, unknown> | null> {
  if (!secretFetcher) return null;
  return secretFetcher(connectionId);
}
