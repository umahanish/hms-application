import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockConnection = {
  ping: vi.fn(),
  release: vi.fn(),
};
const mockPool = {
  getConnection: vi.fn().mockResolvedValue(mockConnection),
};

vi.mock('mysql2/promise', () => ({
  default: { createPool: vi.fn(() => mockPool) },
}));

describe('pingDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.getConnection.mockResolvedValue(mockConnection);
  });

  it('pings a connection from the pool and releases it', async () => {
    const { pingDatabase } = await import('../src/db/pool.js');
    mockConnection.ping.mockResolvedValue();

    await pingDatabase();

    expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
    expect(mockConnection.ping).toHaveBeenCalledTimes(1);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });

  it('still releases the connection when the ping fails, and rethrows', async () => {
    const { pingDatabase } = await import('../src/db/pool.js');
    mockConnection.ping.mockRejectedValue(new Error('ping timeout'));

    await expect(pingDatabase()).rejects.toThrow('ping timeout');
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });
});
