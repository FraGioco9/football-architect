import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

export default defineConfig({
  plugins: [cloudflareTest(async () => ({
    wrangler: { configPath: './wrangler.toml' },
    miniflare: {
      // Disposable D1 binding exists only in the local test runner.
      d1Databases: ['DB'],
      bindings: { TEST_MIGRATIONS: await readD1Migrations(path.resolve('migrations')) },
    },
  }))],
  test: { include: ['tests/worker-runtime.test.ts','tests/password-runtime.test.ts','tests/d1-integration.test.ts'] },
});
