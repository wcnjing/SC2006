import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  createPost,
  getPost,
  listNeighbourhoods,
  updatePost,
  type CommunityPost,
  type Neighbourhood,
} from '@communitylink/shared';
import { router } from 'expo-router';
import { PostEditorScreen } from '../src/community/PostEditorScreen';

vi.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  router: { replace: vi.fn(), dismissTo: vi.fn() },
}));
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('expo-crypto', () => ({ randomUUID: () => '33333333-3333-4333-8333-333333333333' }));
vi.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'me', status: 'active', neighbourhood_id: 1 } }),
}));
vi.mock('@communitylink/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createPost: vi.fn(),
  getPost: vi.fn(),
  listNeighbourhoods: vi.fn(),
  updatePost: vi.fn(),
}));
// Exercise editor hooks/actions using DOM controls; Expo export checks platform bundling.
vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  ScrollView: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Image: () => null,
  ActivityIndicator: () => <span>Loading</span>,
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
    onChangeText: (text: string) => void;
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
const saved = { id: 'saved-post' } as CommunityPost;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listNeighbourhoods).mockResolvedValue([{ id: 1, name: 'Bishan' } as Neighbourhood]);
  vi.mocked(getPost).mockResolvedValue(null);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

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
function button(label: string) {
  const result = [...container.querySelectorAll('button')].find(
    (node) => node.textContent === label,
  );
  if (!result) throw new Error(`Missing ${label}`);
  return result;
}

it('validates an empty draft without sending a request', async () => {
  await act(async () => root.render(<PostEditorScreen />));
  await act(async () => button('Publish post').click());
  expect(container.textContent).toContain('Write something');
  expect(createPost).not.toHaveBeenCalled();
});

it('prevents duplicate submissions, retains a failed draft and allows retry', async () => {
  let reject!: (error: Error) => void;
  vi.mocked(createPost).mockImplementationOnce(
    () =>
      new Promise((_, no) => {
        reject = no;
      }),
  );
  await act(async () => root.render(<PostEditorScreen />));
  await fill('Your post', 'Hello Bishan');
  await act(async () => {
    const publish = button('Publish post');
    publish.click();
    publish.click();
  });
  expect(createPost).toHaveBeenCalledTimes(1);
  expect(createPost).toHaveBeenCalledWith(
    {},
    {
      body: 'Hello Bishan',
      neighbourhoodId: 1,
      imageUrl: '',
      requestId: '33333333-3333-4333-8333-333333333333',
    },
  );
  await act(async () => reject(new Error('offline')));
  expect(
    container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Your post"]')?.value,
  ).toBe('Hello Bishan');
  expect(container.textContent).toContain('Your draft is still here');
  vi.mocked(createPost).mockResolvedValueOnce(saved);
  await act(async () => button('Publish post').click());
  expect(vi.mocked(createPost).mock.calls[1][1].requestId).toBe(
    vi.mocked(createPost).mock.calls[0][1].requestId,
  );
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/post/[id]', params: { id: saved.id } });
});

it('loads and saves an own post through the edit API', async () => {
  vi.mocked(getPost).mockResolvedValue({
    ...saved,
    author_id: 'me',
    neighbourhood_id: 1,
    body: 'Original',
    image_url: null,
  });
  vi.mocked(updatePost).mockResolvedValue(saved);
  await act(async () => root.render(<PostEditorScreen id={saved.id} />));
  await fill('Your post', 'Edited');
  await act(async () => button('Save changes').click());
  expect(updatePost).toHaveBeenCalledWith({}, saved.id, {
    body: 'Edited',
    neighbourhoodId: 1,
    imageUrl: '',
  });
  expect(router.dismissTo).toHaveBeenCalledWith({
    pathname: '/post/[id]',
    params: { id: saved.id },
  });
});

it('does not offer an editor for another author’s post', async () => {
  vi.mocked(getPost).mockResolvedValue({ ...saved, author_id: 'someone-else' });
  await act(async () => root.render(<PostEditorScreen id={saved.id} />));
  expect(container.textContent).toContain('You can only edit your own posts');
  expect(container.querySelector('textarea')).toBeNull();
});
