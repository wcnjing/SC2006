import { describe, expect, it, vi } from 'vitest';
import { createAccountStatusCheck } from '../src/lib/accountStatusCheck';

describe('existing session suspension checks', () => {
  it('keeps active and offline sessions, then removes a confirmed suspended session', async () => {
    const isActive = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(false);
    const logout = vi.fn().mockResolvedValue(undefined);
    const monitor = createAccountStatusCheck(isActive, logout);
    await monitor.check();
    await monitor.check();
    expect(logout).not.toHaveBeenCalled();
    await monitor.check();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('deduplicates foreground and timer checks and ignores a result after changing sessions', async () => {
    let resolve!: (active: boolean) => void;
    const isActive = vi.fn(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const logout = vi.fn().mockResolvedValue(undefined);
    const monitor = createAccountStatusCheck(isActive, logout);
    const pending = monitor.check();
    await monitor.check();
    expect(isActive).toHaveBeenCalledTimes(1);
    monitor.dispose();
    resolve(false);
    await pending;
    await monitor.check();
    expect(logout).not.toHaveBeenCalled();
    expect(isActive).toHaveBeenCalledTimes(1);
  });
});
