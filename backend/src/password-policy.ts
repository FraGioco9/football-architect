/** Limits shared by operator bootstrap and future Admin authentication. */
export const PASSWORD_MIN_CODE_POINTS = 15;
export const PASSWORD_MAX_CODE_POINTS = 128;
export const PASSWORD_MAX_UTF8_BYTES = 512;

export type PasswordPolicyError = 'invalid_type' | 'invalid_length' | 'invalid_encoding';

/** Never trim, normalize or truncate passwords: the bytes are credential material. */
export function validatePasswordShape(value: unknown): PasswordPolicyError | null {
  if (typeof value !== 'string') return 'invalid_type';
  const count = [...value].length;
  if (count < PASSWORD_MIN_CODE_POINTS || count > PASSWORD_MAX_CODE_POINTS) return 'invalid_length';
  // Reject lone surrogates: TextEncoder silently replaces them with U+FFFD.
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return 'invalid_encoding';
    } else if (code >= 0xdc00 && code <= 0xdfff) return 'invalid_encoding';
  }
  if (new TextEncoder().encode(value).byteLength > PASSWORD_MAX_UTF8_BYTES) return 'invalid_encoding';
  return null;
}
