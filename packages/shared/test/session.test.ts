import { describe, expect, it } from 'vitest';
import { SESSION_TIMEOUT_MS } from '../src/constants';
import { isSessionExpired, msUntilExpiry } from '../src/session';

describe('session timeout', () => {
  const start = 1_000_000;

  it('is not expired just before 30 minutes', () => {
    expect(isSessionExpired(start, start + SESSION_TIMEOUT_MS - 1)).toBe(false);
  });

  it('is expired at exactly 30 minutes', () => {
    expect(isSessionExpired(start, start + SESSION_TIMEOUT_MS)).toBe(true);
  });

  it('reports remaining time, never negative', () => {
    expect(msUntilExpiry(start, start + 60_000)).toBe(SESSION_TIMEOUT_MS - 60_000);
    expect(msUntilExpiry(start, start + SESSION_TIMEOUT_MS * 2)).toBe(0);
  });
});
