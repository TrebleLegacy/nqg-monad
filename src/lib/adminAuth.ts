/**
 * Shared secret for API routes that submit admin-only contract calls.
 * Set ADMIN_SECRET in .env.local (same deployer wallet signs txs; this gates who may trigger them).
 */
export function assertAdminSecret(provided: string | undefined): void {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret.length < 8) {
    throw new Error("ADMIN_SECRET must be set in environment (min 8 chars)");
  }
  if (provided !== secret) {
    throw new Error("Unauthorized");
  }
}
