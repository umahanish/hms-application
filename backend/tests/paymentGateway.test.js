import { describe, expect, it } from 'vitest';
import { chargeGateway, GatewayError } from '../src/services/paymentGateway.js';

describe('chargeGateway', () => {
  it('returns a succeeded result with a gateway reference by default', async () => {
    const result = await chargeGateway({ amount: 100, method: 'card' });
    expect(result.status).toBe('succeeded');
    expect(result.gatewayReference).toMatch(/^gw_/);
  });

  it('returns a pending result when simulating an async gateway', async () => {
    const result = await chargeGateway({ amount: 100, method: 'upi', simulate: 'pending' });
    expect(result.status).toBe('pending');
    expect(result.gatewayReference).toMatch(/^gw_/);
  });

  it('throws a non-retryable GatewayError on decline', async () => {
    await expect(chargeGateway({ amount: 100, method: 'card', simulate: 'decline' })).rejects.toMatchObject({
      retryable: false,
    });
    await expect(chargeGateway({ amount: 100, method: 'card', simulate: 'decline' })).rejects.toBeInstanceOf(
      GatewayError,
    );
  });

  it('throws a retryable GatewayError on timeout', async () => {
    await expect(chargeGateway({ amount: 100, method: 'card', simulate: 'timeout' })).rejects.toMatchObject({
      retryable: true,
    });
  });

  it('generates unique gateway references across calls', async () => {
    const first = await chargeGateway({ amount: 100, method: 'card' });
    const second = await chargeGateway({ amount: 100, method: 'card' });
    expect(first.gatewayReference).not.toBe(second.gatewayReference);
  });
});
