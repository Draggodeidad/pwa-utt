let cachedClientId: string | null = null;

/** Installation UUID for the DEC-09 body; stable per browser tab, never the user identity. */
export function getInstallationId(): string {
  if (!cachedClientId) cachedClientId = crypto.randomUUID();
  return cachedClientId;
}