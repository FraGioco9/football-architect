/** Stable API error without leaking SQL statements or storage internals. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details: Readonly<Record<string, string>> = {},
  ) {
    super(code);
    this.name = 'ApiError';
  }
}
