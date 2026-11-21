import { test, expect } from '@playwright/test';
let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});
test('list, detail, explicit return and browser history preserve submitted filters', async ({
  page,
}) => {
  const source = '/admin/articles?page=2&pageSize=5&keyword=React&sortOrder=desc';
  await page.goto(source);
  await expect(page.getByRole('link', { name: 'React 实践 25', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '标题关键词' })).toHaveValue('React');
  await expect(page.locator('.ant-spin-blur')).toHaveCount(0);
  await page.screenshot({
    path: '.superpowers/sdd/2026-11-17-article-admin-implementation/screenshots/article-list.png',
    fullPage: true,
  });
  await page.getByRole('link', { name: '详情', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'React 实践 25' })).toBeVisible();
  await page.getByRole('button', { name: '返回列表', exact: true }).click();
  await expect(page).toHaveURL(`http://127.0.0.1:5173${source}`);
  await page.getByRole('textbox', { name: '标题关键词' }).fill('Vue');
  await page.getByRole('button', { name: '查询', exact: true }).click();
  await expect(page).toHaveURL(/keyword=Vue/);
  await page.goBack();
  await expect(page).toHaveURL(`http://127.0.0.1:5173${source}`);
  await expect(page.getByRole('textbox', { name: '标题关键词' })).toHaveValue('React');
});
test('create returns to default list then opens the created article', async ({ page }) => {
  await page.goto('/admin/articles');
  await page.getByRole('button', { name: '新增文章', exact: true }).click();
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('浏览器验收文章');
  await page.getByRole('combobox', { name: '所属频道' }).click();
  await page.getByRole('option', { name: '技术', exact: true }).click();
  await page.getByRole('textbox', { name: '正文', exact: true }).fill('第一行\n第二行');
  await page.getByRole('button', { name: '提交', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5173/admin/articles');
  await expect(page.getByText('新增成功', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看文章', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/articles\/36$/);
  await expect(page.getByRole('heading', { name: '浏览器验收文章' })).toBeVisible();
});
test('edit saves and returns to the original filtered list', async ({ page }) => {
  await page.goto('/admin/articles?keyword=React');
  await page.getByRole('link', { name: '编辑', exact: true }).first().click();
  const title = page.getByRole('textbox', { name: '标题', exact: true });
  await expect(title).toHaveValue('React 实践 35');
  await title.fill('React 更新后的文章');
  await page.getByRole('button', { name: '提交', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5173/admin/articles?keyword=React');
  await expect(page.getByRole('link', { name: 'React 更新后的文章', exact: true })).toBeVisible();
});
test('delete the final page and recover one page while preserving page size', async ({ page }) => {
  await page.goto('/admin/articles?page=35&pageSize=1&sortOrder=desc');
  await page.getByRole('button', { name: '删除《React 实践 01》', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page).toHaveURL(/page=34/);
  await expect(page).toHaveURL(/pageSize=1/);
  await expect(page.getByRole('link', { name: 'Vue 笔记 02', exact: true })).toBeVisible();
});
test('direct detail and editor links fall back to the default list', async ({ page }) => {
  await page.goto('/admin/articles/1');
  await page.getByRole('button', { name: '返回列表', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5173/admin/articles');
  await page.goto('/admin/articles/1/edit');
  await expect(page.getByRole('textbox', { name: '标题', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5173/admin/articles');
});
