import { describe, expect, it, vi, afterEach } from 'vitest';
import { startServer } from '../src/startServer.js';

describe('startServer', () => {
  let server;

  afterEach(async () => {
    if (server?.close) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('pings the database before listening', async () => {
    const ping = vi.fn().mockResolvedValue();
    const dbPool = {};

    server = await startServer({ port: 0, dbPool, ping });

    expect(ping).toHaveBeenCalledTimes(1);
    expect(server.listening).toBe(true);
  });

  it('propagates a failed database ping without starting the server', async () => {
    const ping = vi.fn().mockRejectedValue(new Error('connection refused'));

    await expect(startServer({ port: 0, dbPool: {}, ping })).rejects.toThrow('connection refused');
  });
});
