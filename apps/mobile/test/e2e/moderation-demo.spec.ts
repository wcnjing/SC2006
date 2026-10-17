import { expect, test } from '@playwright/test';

test('admin removes posts/comments, dismisses reports and records each decision for residents', async ({
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
  await expect(page.getByRole('button', { name: 'Admin moderation', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create post', exact: true }).click();
  const body = `Admin flow ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Your post', exact: true }).fill(body);
  await page.getByRole('button', { name: 'Publish post', exact: true }).click();
  await expect(page.getByTestId('post-detail-body')).toHaveText(body);
  const postPath = new URL(page.url()).pathname;
  for (const comment of ['Comment to remove', 'Comment to keep']) {
    await page.getByRole('textbox', { name: 'Your comment', exact: true }).fill(comment);
    await page.getByRole('button', { name: 'Post comment', exact: true }).click();
    await expect(page.getByTestId('comment-body').filter({ hasText: comment })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Switch demo resident', exact: true }).click();
  await page.getByRole('button', { name: 'Continue as Auntie Mei', exact: true }).click();
  await page.getByRole('button', { name: 'Open community feed', exact: true }).click();
  await page.getByText(body, { exact: true }).click();
  await page.getByRole('button', { name: 'Report post', exact: true }).click();
  await page.getByRole('textbox', { name: 'Report reason', exact: true }).fill('Post spam report');
  await page.getByRole('button', { name: 'Submit report', exact: true }).click();
  await expect(page.getByText('Report submitted. You can track it in My reports.')).toBeVisible();
  for (const [comment, reason] of [
    ['Comment to remove', 'Comment abuse report'],
    ['Comment to keep', 'Unfounded comment report'],
  ]) {
    const row = page.getByTestId('comment-row').filter({ hasText: comment });
    await row.getByRole('button', { name: 'Report comment', exact: true }).click();
    await row.getByRole('textbox', { name: 'Report reason', exact: true }).fill(reason);
    await row.getByRole('button', { name: 'Submit report', exact: true }).click();
    await expect(row.getByText('Report submitted. You can track it in My reports.')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Switch demo resident', exact: true }).click();
  await page.getByRole('button', { name: 'Continue as Demo Admin', exact: true }).click();
  await page.getByRole('button', { name: 'Admin moderation', exact: true }).click();
  const queue = page.getByTestId('moderation-report-row');
  await expect(queue).toHaveCount(3);
  await queue
    .filter({ hasText: 'Comment abuse report' })
    .getByRole('button', { name: 'Review report', exact: true })
    .click();
  const reviewPath = new URL(page.url()).pathname;
  await expect(page.getByTestId('moderation-content-body')).toHaveText('Comment to remove');
  await page.getByRole('button', { name: 'Remove content', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Enter a reason');
  await page
    .getByRole('textbox', { name: 'Moderation reason', exact: true })
    .fill('x'.repeat(1001));
  await page.getByRole('button', { name: 'Remove content', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('1000 characters or fewer');
  await page
    .getByRole('textbox', { name: 'Moderation reason', exact: true })
    .fill('Comment violates conduct rules');
  await page.getByRole('button', { name: 'Remove content', exact: true }).click();
  await page.getByRole('button', { name: 'Keep reviewing', exact: true }).click();
  await expect(page.getByTestId('moderation-content-body')).toHaveText('Comment to remove');
  await page.getByRole('button', { name: 'Remove content', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  await expect(queue).toHaveCount(2);
  await page.goto(postPath);
  await expect(page.getByTestId('comment-body')).toHaveText('Comment to keep');

  await page.goto('/admin/moderation');
  await queue
    .filter({ hasText: 'Unfounded comment report' })
    .getByRole('button', { name: 'Review report', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Moderation reason', exact: true })
    .fill('No policy violation found');
  await page.getByRole('button', { name: 'Dismiss report', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm dismissal', exact: true }).click();
  await expect(queue).toHaveCount(1);
  await queue
    .filter({ hasText: 'Post spam report' })
    .getByRole('button', { name: 'Review report', exact: true })
    .click();
  await expect(page.getByTestId('moderation-content-body')).toHaveText(body);
  await page
    .getByRole('textbox', { name: 'Moderation reason', exact: true })
    .fill('Post is promotional spam');
  await page.getByRole('button', { name: 'Remove content', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  await expect(page.getByText('No reports match this status.')).toBeVisible();
  await page.getByRole('button', { name: 'Action taken', exact: true }).click();
  await expect(queue).toHaveCount(2);
  await page.getByRole('button', { name: 'Dismissed', exact: true }).click();
  await expect(queue).toHaveCount(1);
  await page.getByRole('button', { name: 'All reports', exact: true }).click();
  await expect(queue).toHaveCount(3);
  await queue
    .filter({ hasText: 'Post spam report' })
    .getByRole('button', { name: 'Review report', exact: true })
    .click();
  await expect(page.getByTestId('moderation-content-body')).toHaveText(body);
  await expect(
    page.getByText('This content was already removed. Post is promotional spam'),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Moderation reason', exact: true })).toHaveCount(
    0,
  );
  await page.goto('/admin/audit');
  await expect(page.getByTestId('moderation-audit-row')).toHaveCount(3);
  await expect(
    page.getByTestId('moderation-audit-row').filter({ hasText: 'Content removal' }),
  ).toHaveCount(2);
  await expect(
    page.getByTestId('moderation-audit-row').filter({ hasText: 'Report dismissal' }),
  ).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId('moderation-audit-row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Switch demo resident', exact: true }).click();
  await page.getByRole('button', { name: 'Continue as Auntie Mei', exact: true }).click();
  await page.getByRole('button', { name: 'Open community feed', exact: true }).click();
  await page.getByRole('button', { name: 'My reports', exact: true }).click();
  await expect(page.getByTestId('report-row')).toHaveCount(3);
  await expect(
    page.getByTestId('report-row').filter({ hasText: 'Status: Action taken' }),
  ).toHaveCount(2);
  await expect(
    page.getByTestId('report-row').filter({ hasText: 'Status: Dismissed' }),
  ).toContainText('No policy violation found');
  await page.goto(postPath);
  await expect(
    page.getByText('This post is unavailable. It may have been deleted or removed.'),
  ).toBeVisible();
  for (const path of ['/admin/moderation', '/admin/audit', reviewPath]) {
    await page.goto(path);
    await expect(page.getByRole('alert')).toHaveText('Only active admins can access moderation.');
    await expect(page.getByTestId('moderation-report-row')).toHaveCount(0);
    await expect(page.getByTestId('moderation-audit-row')).toHaveCount(0);
    await expect(page.getByTestId('moderation-content-body')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  expect(backendRequests).toEqual([]);
});

test('admin can dismiss a report after the author deletes its target', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue as Yining', exact: true }).click();
  await page.getByRole('button', { name: 'Open community feed', exact: true }).click();
  await page.getByRole('button', { name: 'Create post', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Your post', exact: true })
    .fill('Deleted moderation target');
  await page.getByRole('button', { name: 'Publish post', exact: true }).click();
  await page.getByRole('button', { name: 'Report post', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Report reason', exact: true })
    .fill('Report before deletion');
  await page.getByRole('button', { name: 'Submit report', exact: true }).click();
  await expect(page.getByText('Report submitted. You can track it in My reports.')).toBeVisible();
  await page.getByRole('button', { name: 'Delete post', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(page.getByText('Latest neighbourhood posts')).toBeVisible();
  await page.getByRole('button', { name: 'Switch demo resident', exact: true }).click();
  await page.getByRole('button', { name: 'Continue as Demo Admin', exact: true }).click();
  await page.getByRole('button', { name: 'Admin moderation', exact: true }).click();
  await page.getByRole('button', { name: 'Review report', exact: true }).click();
  await expect(
    page.getByText('This content was deleted. You can dismiss the report with a reason.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove content', exact: true })).toHaveCount(0);
  await page
    .getByRole('textbox', { name: 'Moderation reason', exact: true })
    .fill('Author already deleted it');
  await page.getByRole('button', { name: 'Dismiss report', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm dismissal', exact: true }).click();
  await expect(page.getByText('No reports match this status.')).toBeVisible();
  await page.getByRole('button', { name: 'Moderation audit log', exact: true }).click();
  await expect(page.getByTestId('moderation-audit-row')).toHaveCount(1);
  await expect(page.getByTestId('moderation-audit-row')).toContainText('Author already deleted it');
});
