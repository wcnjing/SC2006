import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { submitReport, type SubmittedReport } from '@communitylink/shared';
import { ReportForm } from '../src/community/ReportForm';

vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => '33333333-3333-4333-8333-333333333333' }));
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'me', status: 'active' } }),
}));
vi.mock('@communitylink/shared', async (original) => ({
  ...(await original<object>()),
  submitReport: vi.fn(),
}));
vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Pressable: ({
    children,
    onPress,
    disabled,
  }: {
    children: ReactNode;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onPress} disabled={disabled}>
      {children}
    </button>
  ),
  TextInput: ({
    accessibilityLabel,
    value,
    onChangeText,
    editable,
  }: {
    accessibilityLabel: string;
    value: string;
    onChangeText: (value: string) => void;
    editable: boolean;
  }) => (
    <textarea
      aria-label={accessibilityLabel}
      value={value}
      disabled={!editable}
      onChange={(e) => onChangeText(e.target.value)}
    />
  ),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.mocked(submitReport).mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
function button(label: string) {
  const result = [...container.querySelectorAll('button')].find(
    (node) => node.textContent === label,
  );
  if (!result) throw new Error(`Missing ${label}`);
  return result;
}
async function fill(label: string, value: string) {
  const field = container.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
      field,
      value,
    );
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

it('retains the reason and request UUID across failure/cancel/retry and prevents duplicate taps', async () => {
  let reject!: (error: Error) => void;
  vi.mocked(submitReport).mockReturnValueOnce(
    new Promise((_, no) => {
      reject = no;
    }),
  );
  await act(async () => root.render(<ReportForm targetType="post" targetId="post-id" />));
  await act(async () => button('Report post').click());
  await act(async () => button('Submit report').click());
  expect(container.textContent).toContain('Enter a reason');
  expect(submitReport).not.toHaveBeenCalled();
  await fill('Report reason', 'Spam');
  await fill('Additional details (optional)', 'Repeated links');
  await act(async () => {
    button('Submit report').click();
    button('Submit report').click();
  });
  expect(submitReport).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error('connection lost')));
  expect(
    container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Report reason"]')?.value,
  ).toBe('Spam');
  expect(container.textContent).toContain('Your reason and details are still here');
  await act(async () => button('Cancel report').click());
  await act(async () => button('Report post').click());
  vi.mocked(submitReport).mockResolvedValueOnce({ id: 'saved' } as SubmittedReport);
  await act(async () => button('Submit report').click());
  expect(vi.mocked(submitReport).mock.calls[1][1]).toEqual(
    vi.mocked(submitReport).mock.calls[0][1],
  );
  expect(container.textContent).toContain('Report submitted');
  expect(container.querySelector('textarea')).toBeNull();
});

it('disables reporting while the parent content is being changed', async () => {
  await act(async () =>
    root.render(<ReportForm targetType="comment" targetId="comment-id" disabled />),
  );
  expect(button('Report comment').disabled).toBe(true);
  await act(async () => button('Report comment').click());
  expect(container.querySelector('textarea')).toBeNull();
  expect(submitReport).not.toHaveBeenCalled();
});
