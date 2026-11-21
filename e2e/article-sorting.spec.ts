import { test, expect, type Locator } from '@playwright/test';

async function clickSortArrow(header: Locator, direction: 'up' | 'down') {
  const target = header.locator('.ant-table-column-sorters');
  const icon = header.locator(`.ant-table-column-sorter-${direction}`);
  await icon.scrollIntoViewIfNeeded();
  const [area, arrow] = await Promise.all([target.boundingBox(), icon.boundingBox()]);
  if (!area || !arrow) throw new Error('排序箭头不可见');
  // Ant Design icons are decorative (pointer-events:none); click their physical position on the hit-tested parent.
  await target.click({
    position: { x: arrow.x - area.x + arrow.width / 2, y: arrow.y - area.y + arrow.height / 2 },
  });
}

test('existing creation-time header switches from descending to ascending', async ({ page }) => {
  await page.goto('/admin/articles');
  const firstRow = page.locator('tbody tr[data-row-key]').first();
  await expect(firstRow).toHaveAttribute('data-row-key', '35');
  const created = page.getByRole('columnheader', { name: /创建时间/ });
  await expect(created).toHaveAttribute('aria-sort', 'descending');
  await created.click();
  await expect(page).toHaveURL(/sortOrder=asc/);
  await expect(created).toHaveAttribute('aria-sort', 'ascending');
  await expect(firstRow).toHaveAttribute('data-row-key', '1');
  await clickSortArrow(created, 'down');
  await expect(page).toHaveURL(/sortOrder=desc/);
  await expect(firstRow).toHaveAttribute('data-row-key', '35');
  await clickSortArrow(created, 'up');
  await expect(page).toHaveURL(/sortOrder=asc/);
  await expect(firstRow).toHaveAttribute('data-row-key', '1');
});

test('updated-time sorting preserves filters, resets page and restores through browser history', async ({
  page,
}) => {
  const source = '/admin/articles?page=2&pageSize=5&keyword=React&channelId=1&sortOrder=desc';
  await page.goto(source);
  const firstRow = page.locator('tbody tr[data-row-key]').first();
  await expect(firstRow).toHaveAttribute('data-row-key', '1');
  const created = page.getByRole('columnheader', { name: /创建时间/ }),
    updated = page.getByRole('columnheader', { name: /更新时间/ });
  await page.getByRole('textbox', { name: '标题关键词' }).fill('尚未查询的草稿');
  await updated.click();
  await expect(page).toHaveURL(/sortBy=updatedAt/);
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject({
    page: '1',
    pageSize: '5',
    keyword: 'React',
    channelId: '1',
    sortBy: 'updatedAt',
    sortOrder: 'asc',
  });
  await expect(updated).toHaveAttribute('aria-sort', 'ascending');
  await expect(created).not.toHaveAttribute('aria-sort');
  await expect(firstRow).toHaveAttribute('data-row-key', '1');
  await clickSortArrow(updated, 'down');
  await expect(page).toHaveURL(/sortOrder=desc/);
  await expect(firstRow).toHaveAttribute('data-row-key', '31');
  await created.click();
  await expect(created).toHaveAttribute('aria-sort', 'ascending');
  await expect(page).toHaveURL(/sortBy=createdAt/);
  await expect(firstRow).toHaveAttribute('data-row-key', '1');
  await page.goBack();
  await expect(page).toHaveURL(/sortBy=updatedAt/);
  await expect(updated).toHaveAttribute('aria-sort', 'descending');
  await expect(firstRow).toHaveAttribute('data-row-key', '31');
  await page.goBack();
  await expect(updated).toHaveAttribute('aria-sort', 'ascending');
  await expect(firstRow).toHaveAttribute('data-row-key', '1');
  await page.goBack();
  await expect(page).toHaveURL(`http://127.0.0.1:5173${source}`);
  await expect(created).toHaveAttribute('aria-sort', 'descending');
  await expect(updated).not.toHaveAttribute('aria-sort');
});

test('going back immediately after reset restores the submitted keyword', async ({ page }) => {
  const source = '/admin/articles?keyword=React';
  await page.goto(source);
  const keyword = page.getByRole('textbox', { name: '标题关键词' });
  await expect(keyword).toHaveValue('React');
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5173/admin/articles');
  await page.goBack();
  await expect(page).toHaveURL(`http://127.0.0.1:5173${source}`);
  await expect(keyword).toHaveValue('React');
});

test('reset restores default URL, controls and rows even for unsubmitted drafts', async ({
  page,
}) => {
  await page.goto(
    '/admin/articles?page=2&pageSize=5&keyword=React&channelId=1&sortBy=updatedAt&sortOrder=asc',
  );
  await expect(page.locator('tbody tr[data-row-key]').first()).toHaveAttribute(
    'data-row-key',
    '31',
  );
  await page.getByRole('textbox', { name: '标题关键词' }).fill('未提交草稿');
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5173/admin/articles');
  await expect(page.getByRole('textbox', { name: '标题关键词' })).toHaveValue('');
  await expect(page.getByText('全部频道', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /创建时间/ })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  await expect(page.getByRole('columnheader', { name: /更新时间/ })).not.toHaveAttribute(
    'aria-sort',
  );
  await expect(page.locator('tbody tr[data-row-key]')).toHaveCount(10);
  await expect(page.locator('tbody tr[data-row-key]').first()).toHaveAttribute(
    'data-row-key',
    '35',
  );
  await page.getByRole('textbox', { name: '标题关键词' }).fill('默认地址下的草稿');
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '标题关键词' })).toHaveValue('');
  await expect(page).toHaveURL('http://127.0.0.1:5173/admin/articles');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: '.superpowers/sdd/2026-11-18-article-time-sorting-implementation/sorting-reset.png',
    fullPage: true,
    animations: 'disabled',
  });
});
