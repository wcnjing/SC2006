import { expect, test, type Page } from '@playwright/test';

const yiningId = '11111111-1111-4111-8111-111111111111';
const meiId = '22222222-2222-4222-8222-222222222222';
async function switchTo(page: Page, name: string, section = 'Messages') {
  await page.getByRole('button', { name: 'Switch demo resident', exact: true }).click();
  await page.getByRole('button', { name: `Continue as ${name}`, exact: true }).click();
  await page.getByRole('button', { name: section, exact: true }).click();
}
async function acceptAsMei(page: Page) {
  await switchTo(page, 'Auntie Mei', 'Connections');
  await page.getByRole('button', { name: 'Incoming requests', exact: true }).click();
  const request = page.getByTestId('connection-person-row').filter({ hasText: 'Yining' });
  await request.getByRole('button', { name: 'Accept request', exact: true }).click();
  await expect(request).toHaveCount(0);
  await page.getByRole('button', { name: 'Friends', exact: true }).click();
  await page
    .getByTestId('connection-person-row')
    .getByRole('button', { name: 'Message', exact: true })
    .click();
}

test('message accepted friends, block/unblock privately and reconnect before viewing retained history', async ({
  page,
}) => {
  const errors: string[] = [];
  const backendRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/supabase\.co|127\.0\.0\.1:1\//.test(request.url())) backendRequests.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue as Yining', exact: true }).click();
  await page.getByRole('button', { name: 'Connections', exact: true }).click();
  await page
    .getByTestId('connection-person-row')
    .filter({ hasText: 'Auntie Mei' })
    .getByRole('button', { name: 'Send request', exact: true })
    .click();
  await acceptAsMei(page);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Write a message before sending');
  await page.getByRole('textbox', { name: 'Your message', exact: true }).fill('x'.repeat(2001));
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('2000 characters or fewer');
  await page
    .getByRole('textbox', { name: 'Your message', exact: true })
    .fill('Hello Yining from Mei');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByTestId('direct-message-body')).toHaveText('Hello Yining from Mei');

  await switchTo(page, 'Yining');
  await page
    .getByTestId('message-contact-row')
    .filter({ hasText: 'Auntie Mei' })
    .getByRole('button', { name: 'Open conversation', exact: true })
    .click();
  await expect(page.getByTestId('direct-message-body')).toHaveText('Hello Yining from Mei');
  await page
    .getByRole('textbox', { name: 'Your message', exact: true })
    .fill('Hello Mei from Yining');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByTestId('direct-message-body')).toHaveText([
    'Hello Yining from Mei',
    'Hello Mei from Yining',
  ]);
  await page.reload();
  await expect(page.getByTestId('direct-message-body')).toHaveCount(2);
  await page.getByRole('button', { name: 'Block user', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByTestId('direct-message-body')).toHaveCount(2);
  await page.getByRole('button', { name: 'Block user', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm block', exact: true }).click();
  await expect(page.getByText('You have blocked this user.')).toBeVisible();
  await expect(page.getByTestId('direct-message-body')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Your message', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('You have blocked this user.')).toBeVisible();

  await switchTo(page, 'Demo Admin');
  await expect(page.getByTestId('message-contact-row')).toHaveCount(0);
  await page.goto(`/messages/${meiId}`);
  await expect(page.getByTestId('direct-message-body')).toHaveCount(0);
  await expect(
    page.getByText('An accepted, unblocked connection is required to view or send messages.'),
  ).toBeVisible();
  await page.goto('/blocked-users');
  await expect(page.getByText('You have not blocked anyone.')).toBeVisible();
  await switchTo(page, 'Auntie Mei');
  await expect(page.getByTestId('message-contact-row')).toHaveCount(0);
  await page.goto(`/messages/${yiningId}`);
  await expect(
    page.getByText('An accepted, unblocked connection is required to view or send messages.'),
  ).toBeVisible();
  await expect(page.getByTestId('direct-message-body')).toHaveCount(0);
  await expect(page.getByText('You have blocked this user.')).toHaveCount(0);
  await page.goto('/connections');
  await expect(page.getByTestId('connection-person-row').filter({ hasText: 'Yining' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Friends', exact: true }).click();
  await expect(page.getByTestId('connection-person-row')).toHaveCount(0);

  await switchTo(page, 'Yining');
  await page.getByRole('button', { name: 'Blocked users', exact: true }).click();
  const blocked = page.getByTestId('blocked-user-row');
  await expect(blocked).toContainText('Auntie Mei');
  await blocked.getByRole('button', { name: 'Unblock user', exact: true }).click();
  await blocked.getByRole('button', { name: 'Confirm unblock', exact: true }).click();
  await expect(blocked).toHaveCount(0);
  await page.goto(`/messages/${meiId}`);
  await expect(
    page.getByText('An accepted, unblocked connection is required to view or send messages.'),
  ).toBeVisible();
  await expect(page.getByTestId('direct-message-body')).toHaveCount(0);
  await page.goto('/connections');
  await page
    .getByTestId('connection-person-row')
    .filter({ hasText: 'Auntie Mei' })
    .getByRole('button', { name: 'Send request', exact: true })
    .click();
  await acceptAsMei(page);
  await expect(page.getByTestId('direct-message-body')).toHaveText([
    'Hello Yining from Mei',
    'Hello Mei from Yining',
  ]);
  await page
    .getByRole('textbox', { name: 'Your message', exact: true })
    .fill('We are connected again');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByTestId('direct-message-body')).toHaveCount(3);
  expect(errors).toEqual([]);
  expect(backendRequests).toEqual([]);
});

test('block a pending requester from Connections and unblock without restoring the request', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue as Yining', exact: true }).click();
  await page.getByRole('button', { name: 'Connections', exact: true }).click();
  await page
    .getByTestId('connection-person-row')
    .filter({ hasText: 'Auntie Mei' })
    .getByRole('button', { name: 'Send request', exact: true })
    .click();
  await switchTo(page, 'Auntie Mei', 'Connections');
  await page.getByRole('button', { name: 'Incoming requests', exact: true }).click();
  const row = page.getByTestId('connection-person-row');
  await row.getByRole('button', { name: 'Block user', exact: true }).click();
  await row.getByRole('button', { name: 'Confirm block', exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole('button', { name: 'Blocked users', exact: true }).click();
  const blocked = page.getByTestId('blocked-user-row');
  await expect(blocked).toContainText('Yining');
  await blocked.getByRole('button', { name: 'Unblock user', exact: true }).click();
  await blocked.getByRole('button', { name: 'Confirm unblock', exact: true }).click();
  await expect(blocked).toHaveCount(0);
  await page.goto('/connections');
  await page.getByRole('button', { name: 'Incoming requests', exact: true }).click();
  await expect(page.getByTestId('connection-person-row')).toHaveCount(0);
});
