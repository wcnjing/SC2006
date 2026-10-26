import { expect, test } from '@playwright/test';

test('report posts/comments, validate reasons and keep each resident’s report history private', async ({
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
  await page.getByRole('button', { name: 'Open community feed', exact: true }).click();
  await page.getByRole('button', { name: 'My reports', exact: true }).click();
  await expect(page.getByText('You have not submitted any reports yet.')).toBeVisible();
  await page.getByRole('link', { name: 'Community feed', exact: true }).click();
  await page.getByRole('button', { name: 'Create post', exact: true }).click();
  const body = `Reporting demo ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Your post', exact: true }).fill(body);
  await page.getByRole('button', { name: 'Publish post', exact: true }).click();
  await expect(page.getByTestId('post-detail-body')).toHaveText(body);
  const postPath = new URL(page.url()).pathname;
  await page
    .getByRole('textbox', { name: 'Your comment', exact: true })
    .fill('A comment to review');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.getByTestId('comment-body')).toHaveText('A comment to review');
  await page.getByRole('button', { name: 'Switch demo resident', exact: true }).click();
  await page.getByRole('button', { name: 'Continue as Auntie Mei', exact: true }).click();
  await page.getByRole('button', { name: 'Open community feed', exact: true }).click();
  await page.getByText(body, { exact: true }).click();
  await page.getByRole('button', { name: 'Report post', exact: true }).click();
  await page.getByRole('button', { name: 'Submit report', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Enter a reason');
  await page.getByRole('textbox', { name: 'Report reason', exact: true }).fill('x'.repeat(101));
  await page.getByRole('button', { name: 'Submit report', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('100 characters or fewer');
  await page.getByRole('textbox', { name: 'Report reason', exact: true }).fill('Spam advertising');
  await page
    .getByRole('textbox', { name: 'Additional details (optional)', exact: true })
    .fill('x'.repeat(1001));
  await page.getByRole('button', { name: 'Submit report', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('1000 characters or fewer');
  await page
    .getByRole('textbox', { name: 'Additional details (optional)', exact: true })
    .fill('Repeated promotional links');
  await page.getByRole('button', { name: 'Cancel report', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Submit report', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Report post', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Report reason', exact: true })).toHaveValue(
    'Spam advertising',
  );
  await page.getByRole('button', { name: 'Submit report', exact: true }).click();
  await expect(page.getByText('Report submitted. You can track it in My reports.')).toBeVisible();
  // Filing a report does not remove the reported post.
  await expect(page.getByTestId('post-detail-body')).toHaveText(body);
  await page.getByRole('button', { name: 'My reports', exact: true }).click();
  let rows = page.getByTestId('report-row');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Post report');
  await expect(rows).toContainText('Status: Open');
  await expect(rows).toContainText('Repeated promotional links');
  await page.reload();
  await expect(page.getByTestId('report-reason')).toHaveText('Spam advertising');
  await page.goto(postPath);
  await page
    .getByTestId('comment-row')
    .getByRole('button', { name: 'Report comment', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Report reason', exact: true }).fill('Harassment');
  await page.getByRole('button', { name: 'Submit report', exact: true }).click();
  await page.getByRole('button', { name: 'My reports', exact: true }).click();
  rows = page.getByTestId('report-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: 'Comment report' })).toContainText('Harassment');
  await page.getByRole('button', { name: 'Refresh reports', exact: true }).click();
  await expect(rows).toHaveCount(2);

  await page.getByRole('button', { name: 'Switch demo resident', exact: true }).click();
  await page.getByRole('button', { name: 'Continue as Yining', exact: true }).click();
  await page.getByRole('button', { name: 'Open community feed', exact: true }).click();
  await page.getByRole('button', { name: 'My reports', exact: true }).click();
  await expect(page.getByText('You have not submitted any reports yet.')).toBeVisible();
  await expect(page.getByTestId('report-row')).toHaveCount(0);
  await page.goto(postPath);
  await page.getByRole('button', { name: 'Delete post', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(page.getByText('Latest neighbourhood posts')).toBeVisible();
  await page.getByRole('button', { name: 'Switch demo resident', exact: true }).click();
  await page.getByRole('button', { name: 'Continue as Auntie Mei', exact: true }).click();
  await page.getByRole('button', { name: 'Open community feed', exact: true }).click();
  await page.getByRole('button', { name: 'My reports', exact: true }).click();
  await expect(page.getByTestId('report-row')).toHaveCount(2);
  expect(errors).toEqual([]);
  expect(backendRequests).toEqual([]);
});
