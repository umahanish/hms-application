import { describe, expect, it } from 'vitest';

// Real network round-trip to SingleStore -- only runs when DB_HOST is actually
// configured (a developer machine or a CI job with DB secrets wired up). CI does
// not currently set these, so this suite is skipped there; see TASKS.md.
const hasLiveDb = Boolean(process.env.DB_HOST);

describe.skipIf(!hasLiveDb)('pingDatabase (live SingleStore)', () => {
  it('resolves without throwing against a real SingleStore connection', async () => {
    const { pingDatabase } = await import('../src/db/pool.js');
    await expect(pingDatabase()).resolves.toBeUndefined();
  });
});
