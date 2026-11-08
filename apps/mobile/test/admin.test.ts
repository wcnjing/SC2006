import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityLinkClient } from '@communitylink/shared';
import { getMyProfile, setUserStatus } from '@communitylink/shared';

import { createSupabaseAdmin } from '../src/services/supabase/admin';

vi.mock('@communitylink/shared', async (original) => ({
  ...(await original<typeof import('@communitylink/shared')>()),
  getMyProfile: vi.fn(),
  setUserStatus: vi.fn(),
}));

const actor = (role = 'admin', status = 'active') =>
  ({ role, status }) as Awaited<ReturnType<typeof getMyProfile>>;

describe('account administration', () => {
  beforeEach(() => vi.resetAllMocks());

  it('rejects residents and suspended administrators before reading the directory', async () => {
    const from = vi.fn();
    const service = createSupabaseAdmin({ from } as unknown as CommunityLinkClient);
    for (const user of [actor('resident'), actor('admin', 'suspended')]) {
      vi.mocked(getMyProfile).mockResolvedValue(user);
      await expect(service.listUsers()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
    expect(from).not.toHaveBeenCalled();
  });

  it('loads accounts beyond the first page and keeps suspension reasons', async () => {
    vi.mocked(getMyProfile).mockResolvedValue(actor());
    const row = {
      id: 'user',
      display_name: 'Resident',
      avatar_url: null,
      role: 'resident',
      status: 'suspended',
      suspended_reason: 'Spam',
    };
    const range = vi
      .fn()
      .mockResolvedValueOnce({ data: Array(200).fill(row), error: null })
      .mockResolvedValueOnce({ data: [{ ...row, id: 'last' }], error: null });
    const client = { from: () => ({ select: () => ({ order: () => ({ range }) }) }) };
    const users = await createSupabaseAdmin(client as unknown as CommunityLinkClient).listUsers();
    expect(users).toHaveLength(201);
    expect(users[200]).toMatchObject({ id: 'last', reason: 'Spam', status: 'suspended' });
    expect(range).toHaveBeenLastCalledWith(200, 399);
  });

  it('uses the audited status RPC for suspension and reinstatement', async () => {
    const client = {} as CommunityLinkClient;
    const service = createSupabaseAdmin(client);
    await service.setStatus('user', 'suspended', ' Spam ');
    expect(setUserStatus).toHaveBeenLastCalledWith(client, 'user', 'suspended', 'Spam');
    await service.setStatus('user', 'active');
    expect(setUserStatus).toHaveBeenLastCalledWith(client, 'user', 'active', undefined);
  });
});
