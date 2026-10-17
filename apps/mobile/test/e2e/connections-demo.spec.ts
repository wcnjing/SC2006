import { expect, test, type Page } from '@playwright/test';

async function switchTo(page: Page, name: string) {
  await page.getByRole('button', { name: 'Switch demo resident', exact: true }).click();
  await page.getByRole('button', { name: `Continue as ${name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Connections', exact: true }).click();
}

test('send, cancel, reject and accept friend requests with private persistent lists', async ({
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
  const people = page.getByTestId('connection-person-row');
  let mei = people.filter({ hasText: 'Auntie Mei' });
  await expect(people).toHaveCount(2);
  await mei.getByRole('button', { name: 'Send request', exact: true }).click();
  await expect(mei.getByText('Request sent', { exact: true })).toBeVisible();
  await expect(mei.getByRole('button', { name: 'Send request', exact: true })).toHaveCount(0);
  await expect(mei.getByRole('button', { name: 'Accept request', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sent requests', exact: true }).click();
  await expect(people).toHaveCount(1);
  await mei.getByRole('button', { name: 'Cancel request', exact: true }).click();
  await mei.getByRole('button', { name: 'Keep request', exact: true }).click();
  await expect(people).toHaveCount(1);
  await mei.getByRole('button', { name: 'Cancel request', exact: true }).click();
  await mei.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(people).toHaveCount(0);
  await page.getByRole('button', { name: 'Find people', exact: true }).click();
  await mei.getByRole('button', { name: 'Send request', exact: true }).click();
  await expect(mei.getByText('Request sent', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    people.filter({ hasText: 'Auntie Mei' }).getByText('Request sent', { exact: true }),
  ).toBeVisible();

  await switchTo(page, 'Auntie Mei');
  await page.getByRole('button', { name: 'Incoming requests', exact: true }).click();
  let yining = people.filter({ hasText: 'Yining' });
  await expect(people).toHaveCount(1);
  await expect(yining.getByRole('button', { name: 'Cancel request', exact: true })).toHaveCount(0);
  await yining.getByRole('button', { name: 'Reject request', exact: true }).click();
  await yining.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(people).toHaveCount(0);

  await switchTo(page, 'Yining');
  await page.getByRole('button', { name: 'Sent requests', exact: true }).click();
  await expect(people).toHaveCount(0);
  await page.getByRole('button', { name: 'Find people', exact: true }).click();
  mei = people.filter({ hasText: 'Auntie Mei' });
  await mei.getByRole('button', { name: 'Send request', exact: true }).click();
  await expect(mei.getByText('Request sent', { exact: true })).toBeVisible();
  await switchTo(page, 'Auntie Mei');
  await page.getByRole('button', { name: 'Incoming requests', exact: true }).click();
  yining = people.filter({ hasText: 'Yining' });
  await yining.getByRole('button', { name: 'Accept request', exact: true }).click();
  await expect(people).toHaveCount(0);
  await page.getByRole('button', { name: 'Friends', exact: true }).click();
  await expect(people).toHaveCount(1);
  await expect(yining.getByText('You are friends', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Friends', exact: true }).click();
  await expect(people).toHaveCount(1);

  await switchTo(page, 'Yining');
  await page.getByRole('button', { name: 'Friends', exact: true }).click();
  await expect(people).toHaveCount(1);
  await expect(
    people.filter({ hasText: 'Auntie Mei' }).getByText('You are friends', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Find people', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search by name', exact: true }).fill('mei');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(people).toHaveCount(1);
  await expect(people).toContainText('Auntie Mei');
  await page.getByRole('textbox', { name: 'Search by name', exact: true }).fill('No such person');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('No people match this search.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Search by name', exact: true }).fill('x'.repeat(51));
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('50 characters or fewer');

  await switchTo(page, 'Demo Admin');
  await page.getByRole('button', { name: 'Friends', exact: true }).click();
  await expect(people).toHaveCount(0);
  await page.getByRole('button', { name: 'Incoming requests', exact: true }).click();
  await expect(people).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(backendRequests).toEqual([]);
});
