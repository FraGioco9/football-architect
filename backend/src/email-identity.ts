import { ApiError } from './errors.ts';

/**
 * Email is an operator identifier, not a delivery or recovery mechanism.
 * Match the approved contract: trim and lowercase the identifier only.
 */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function parseOperatorEmail(input: unknown): string {
  if (typeof input !== 'string') throw new ApiError(422, 'invalid_credentials');
  const normalized = normalizeEmail(input);
  if (normalized.length < 3 || normalized.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized) ||
      /[\u0000-\u001f\u007f]/u.test(normalized))
    throw new ApiError(422, 'invalid_credentials');
  return normalized;
}
