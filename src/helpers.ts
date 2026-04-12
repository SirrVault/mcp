/**
 * Pure helper functions extracted for testability.
 */

// ── Path helpers ──────────────────────────────────────────────────────────────

/** Path for creating or listing secrets. */
export function secretsPath(): string {
  return '/secrets';
}

/** Path for a specific secret by hash. */
export function secretPath(hash?: string): string {
  return hash ? `/secret/${hash}` : '/secret';
}

/** Path for secret audit trail. */
export function auditPath(hash: string): string {
  return `/secret/${hash}/audit`;
}

/**
 * Format a Unix timestamp (seconds) as a human-readable TTL string
 * relative to now. Returns "no expiry" for null, "expired" for past timestamps.
 */
export function formatTtl(expiresAt: number | null): string {
  if (expiresAt === null) return "no expiry";
  const now = Math.floor(Date.now() / 1000);
  const secs = expiresAt - now;
  if (secs <= 0) return "expired";
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}
