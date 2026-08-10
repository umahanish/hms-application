import { describe, expect, it, vi, afterEach } from 'vitest';
import { startServer } from '../src/startServer.js';

describe('startServer', () => {
  let server;

  afterEach(async () => {
    if (server?.close) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('pings the database and applies migrations before listening', async () => {
    const ping = vi.fn().mockResolvedValue();
    const applyMigrations = vi.fn().mockResolvedValue();
    const dbPool = {};
    const callOrder = [];
    ping.mockImplementation(async () => {
      callOrder.push('ping');
    });
    applyMigrations.mockImplementation(async () => {
      callOrder.push('migrate');
    });

    server = await startServer({ port: 0, dbPool, ping, applyMigrations });

    expect(callOrder).toEqual(['ping', 'migrate']);
    expect(applyMigrations).toHaveBeenCalledWith(dbPool, expect.any(Array));
    expect(server.listening).toBe(true);
  });

  it('propagates a failed database ping without starting the server', async () => {
    const ping = vi.fn().mockRejectedValue(new Error('connection refused'));
    const applyMigrations = vi.fn();

    await expect(startServer({ port: 0, dbPool: {}, ping, applyMigrations })).rejects.toThrow(
      'connection refused',
    );
    expect(applyMigrations).not.toHaveBeenCalled();
  });
});
