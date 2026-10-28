import { ApiError } from './errors.ts';

export type PrepareRequest = Readonly<{
  expectedGeneration: string;
  expectedRevision: number;
}>;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;

export function parseIdempotencyKey(value: string | null): string {
  if (value === null || !KEY.test(value)) throw new ApiError(422, 'invalid_idempotency_key');
  return value;
}

/** Parse only concurrency metadata. Participants/rules approval is always server-owned. */
export function parsePrepareRequest(input: unknown): PrepareRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new ApiError(422, 'invalid_command');
  const data = input as Record<string, unknown>;
  const keys = Object.keys(data);
  if (keys.length !== 2 || !keys.includes('expectedGeneration') || !keys.includes('expectedRevision') ||
      typeof data.expectedGeneration !== 'string' || !UUID_V4.test(data.expectedGeneration) ||
      typeof data.expectedRevision !== 'number' || !Number.isSafeInteger(data.expectedRevision) ||
      data.expectedRevision < 0)
    throw new ApiError(422, 'invalid_command');
  return {expectedGeneration:data.expectedGeneration,expectedRevision:data.expectedRevision};
}
