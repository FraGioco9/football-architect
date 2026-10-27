/**
 * Production approval is intentionally unavailable until a versioned catalogue and
 * rules manifest is explicitly approved and bundled with the server.
 *
 * Never accept a caller-provided approval flag, synthetic fixtures, or DEV data.
 */
export type ApprovedSnapshot = Readonly<{
  manifestVersion: number;
  participantsHash: string;
  rulesHash: string;
  participants: readonly string[];
}>;

export function loadApprovedSnapshot(): ApprovedSnapshot | null {
  return null;
}
