import { expect, test } from '@playwright/test';

test('publish, reload, edit, switch residents and delete without Supabase', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const backendRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/supabase\.co|127\.0\.0\.1:1\//.test(request.url())) backendRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByText('Demo mode · Data stays in this browser')).toBeVisible();
  await page.getByRole('button', { name: 'Continue as Yining', exact: true }).click();
  await page.getByRole('button', { name: 'Open community feed', exact: true }).click();
  await page.getByRole('button', { name: 'Create post', exact: true }).click();
  const body = `My browser test post ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Your post', exact: true }).fill(body);
  await page.getByRole('button', { name: 'Publish post', exact: true }).click();
  await expect(page.getByTestId('post-detail-body')).toHaveText(body);
  const postPath = new URL(page.url()).pathname;
  await page.reload();
  await expect(page.getByTestId('post-detail-body')).toHaveText(body);
  await page.getByRole('button', { name: 'Edit post', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Your post', exact: true })).toHaveValue(body);
  const edited = `${body} — edited`;
  await page.getByRole('textbox', { name: 'Your post', exact: true }).fill(edited);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByTestId('post-detail-body')).toHaveText(edited);
  await page.screenshot({ path: testInfo.outputPath('working-post.png') });

  await page.getByRole('button', { name: 'Switch demo resident', exact: true }).click();
  await page.getByRole('button', { name: 'Continue as Auntie Mei', exact: true }).click();
  await page.getByRole('button', { name: 'Open community feed', exact: true }).click();
  await page.getByText(edited, { exact: true }).click();
  await expect(page.getByTestId('post-detail-body')).toHaveText(edited);
  await expect(page.getByRole('button', { name: 'Edit post', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete post', exact: true })).toHaveCount(0);
  await page.goto(`${postPath}/edit`);
  await expect(page.getByText('You can only edit your own posts.')).toBeVisible();

  await page.getByRole('button', { name: 'Switch demo resident', exact: true }).click();
  await page.getByRole('button', { name: 'Continue as Yining', exact: true }).click();
  await page.goto(postPath);
  await page.getByRole('button', { name: 'Delete post', exact: true }).click();
  await page.getByRole('button', { name: 'Keep post', exact: true }).click();
  await expect(page.getByTestId('post-detail-body')).toHaveText(edited);
  await page.getByRole('button', { name: 'Delete post', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(page.getByText('Latest neighbourhood posts')).toBeVisible();
  await page.goto(postPath);
  await expect(
    page.getByText('This post is unavailable. It may have been deleted or removed.'),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(backendRequests).toEqual([]);
});

test('switch neighbourhoods, load older posts and validate a draft', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue as Yining', exact: true }).click();
  await page.getByRole('button', { name: 'Open community feed', exact: true }).click();
  await page.getByRole('button', { name: 'Bedok neighbourhood', exact: true }).click();
  await expect(
    page.getByText('No posts in this neighbourhood yet. Be the first to share something.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Bishan neighbourhood', exact: true }).click();
  await page.getByRole('button', { name: 'Load older posts', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Load older posts', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create post', exact: true }).click();
  await page.getByRole('button', { name: 'Publish post', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Write something before publishing');
  await page
    .getByRole('textbox', { name: 'Your post', exact: true })
    .fill('Trying image validation');
  await page
    .getByRole('textbox', { name: 'Image URL (optional)', exact: true })
    .fill('file:///private.jpg');
  await page.getByRole('button', { name: 'Publish post', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Use an HTTPS image URL');
});

test('comments and likes persist and belong to the selected resident', async ({ page }) => {
  const backendRequests: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/supabase\.co|127\.0\.0\.1:1\//.test(request.url())) backendRequests.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue as Yining', exact: true }).click();
  await page.getByRole('button', { name: 'Open community feed', exact: true }).click();
  await page.getByRole('button', { name: 'Create post', exact: true }).click();
  const postBody = `Comment and like browser check ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Your post', exact: true }).fill(postBody);
  await page.getByRole('button', { name: 'Publish post', exact: true }).click();
  await expect(page.getByTestId('post-like-count')).toHaveText('0 likes');
  await page.getByRole('button', { name: 'Like post', exact: true }).click();
  await expect(page.getByTestId('post-like-count')).toHaveText('1 like');
  await expect(page.getByRole('button', { name: 'Unlike post', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Write a comment before sending.');
  await page.getByRole('textbox', { name: 'Your comment', exact: true }).fill('x'.repeat(1001));
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('1000 characters or fewer');
  await page.getByRole('textbox', { name: 'Your comment', exact: true }).fill('Yining says hello');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  let own = page.getByTestId('comment-row');
  await expect(own.getByTestId('comment-body')).toHaveText('Yining says hello');
  await own.getByRole('button', { name: 'Edit comment', exact: true }).click();
  await own
    .getByRole('textbox', { name: 'Edit your comment', exact: true })
    .fill('Yining edited this comment');
  await own.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.reload();
  await expect(page.getByTestId('post-like-count')).toHaveText('1 like');
  await expect(page.getByTestId('comment-body')).toHaveText('Yining edited this comment');

  await page.getByRole('button', { name: 'Switch demo resident', exact: true }).click();
  await page.getByRole('button', { name: 'Continue as Auntie Mei', exact: true }).click();
  await page.getByRole('button', { name: 'Open community feed', exact: true }).click();
  await page.getByText(postBody, { exact: true }).click();
  own = page.getByTestId('comment-row').filter({ hasText: 'Yining edited this comment' });
  await expect(own.getByRole('button', { name: 'Edit comment', exact: true })).toHaveCount(0);
  await expect(own.getByRole('button', { name: 'Delete comment', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Like post', exact: true }).click();
  await expect(page.getByTestId('post-like-count')).toHaveText('2 likes');
  await page
    .getByRole('textbox', { name: 'Your comment', exact: true })
    .fill('Mei joins the conversation');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.getByTestId('comment-body')).toHaveText([
    'Yining edited this comment',
    'Mei joins the conversation',
  ]);

  await page.getByRole('button', { name: 'Switch demo resident', exact: true }).click();
  await page.getByRole('button', { name: 'Continue as Yining', exact: true }).click();
  await page.getByRole('button', { name: 'Open community feed', exact: true }).click();
  await page.getByText(postBody, { exact: true }).click();
  await page.getByRole('button', { name: 'Unlike post', exact: true }).click();
  await expect(page.getByTestId('post-like-count')).toHaveText('1 like');
  own = page.getByTestId('comment-row').filter({ hasText: 'Yining edited this comment' });
  await own.getByRole('button', { name: 'Delete comment', exact: true }).click();
  await own.getByRole('button', { name: 'Keep comment', exact: true }).click();
  await own.getByRole('button', { name: 'Delete comment', exact: true }).click();
  await own.getByRole('button', { name: 'Delete comment permanently', exact: true }).click();
  await expect(own).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('comment-body')).toHaveText('Mei joins the conversation');
  await expect(page.getByTestId('post-like-count')).toHaveText('1 like');
  expect(errors).toEqual([]);
  expect(backendRequests).toEqual([]);
});
