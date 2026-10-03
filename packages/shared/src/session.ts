import { SESSION_TIMEOUT_MS } from './constants';

export function isSessionExpired(
  lastActiveAt: number,
  now: number = Date.now(),
  timeoutMs: number = SESSION_TIMEOUT_MS,
): boolean {
  return now - lastActiveAt >= timeoutMs;
}

export function msUntilExpiry(
  lastActiveAt: number,
  now: number = Date.now(),
  timeoutMs: number = SESSION_TIMEOUT_MS,
): number {
  return Math.max(0, lastActiveAt + timeoutMs - now);
}
