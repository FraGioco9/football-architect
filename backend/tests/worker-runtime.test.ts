import { describe, expect, it } from 'vitest';
import worker from '../src/index.ts';

// Real workerd execution via @cloudflare/vitest-plugin, not a Node-only mock.
describe('Worker local runtime', () => {
  it('fails closed when the D1 binding is not configured', async () => {
    const response = await worker.fetch(new Request('https://local.invalid/api/world'), {});
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: 'world_unavailable' } });
  });
  it('never exposes an unprotected Admin route', async () => {
    const response = await worker.fetch(new Request('https://local.invalid/api/admin/prepare', {method:'POST'}), {});
    expect(response.status).toBe(404);
  });
});
