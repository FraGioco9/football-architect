/** Stable API error without leaking SQL statements or storage internals. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Readonly<Record<string, string>>;

  constructor(status: number, code: string, details: Readonly<Record<string, string>> = {}) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
