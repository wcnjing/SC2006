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
