// Test-only ambient declarations for the pinned Cloudflare plugin; runtime resolution
// still occurs inside workerd and is independently verified by the integration suite.
declare module 'cloudflare:workers' {
  export const env: unknown;
}
declare module 'cloudflare:test' {
  export function applyD1Migrations(
    db: {prepare(sql:string): unknown},
    migrations: readonly unknown[],
  ): Promise<void>;
}
