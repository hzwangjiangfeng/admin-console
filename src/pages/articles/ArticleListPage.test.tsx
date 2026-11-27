import { act, screen, waitFor, within } from '@testing-library/react';
import { it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderApp } from '../../test/renderApp';
import { server } from '../../test/server';
import { createAppQueryClient } from '../../lib/queryClient';
import { articleKeys } from '../../hooks/articles/articleKeys';
import { resetArticleStore } from '../../mocks/data/articles';
import { makeArticle } from '../../test/fixtures';
import { DEFAULT_ARTICLE_PARAMS } from '../../utils/articles/listParams';

it('applies status only on query, preserves it on navigation, and clears it on reset', async () => {
  resetArticleStore([
    makeArticle({ id: 1, title: '草稿文章' }),
    makeArticle({ id: 2, title: '发布文章', status: 'published' }),
    makeArticle({ id: 3, title: '下架文章', status: 'archived' }),
  ]);
  const { router, user } = renderApp('/admin/articles?page=2&pageSize=2');
  await screen.findByText('草稿文章');
  await user.click(screen.getByLabelText('状态'));
  await user.click(await screen.findByText('已发布'));
  const params = () => new URLSearchParams(router.state.location.search);
  expect(params().get('status')).toBeNull();
  expect(params().get('page')).toBe('2');

  await user.click(screen.getByLabelText('查询'));
  const row = (await screen.findByText('发布文章')).closest('tr')!;
  expect(params().get('status')).toBe('published');
  expect(params().get('page')).toBe('1');
  expect(params().get('pageSize')).toBe('2');
  expect(screen.queryByText('草稿文章')).not.toBeInTheDocument();
  await user.click(within(row).getByText('详情'));
  await screen.findByText('发布文章', { selector: 'h1' });
  await act(() => router.navigate(-1));
  const restored = (await screen.findByText('发布文章')).closest('tr')!;
  expect(within(restored).getByText('已发布')).toBeVisible();
  expect(params().get('status')).toBe('published');

  await user.click(screen.getByLabelText('重置'));
  expect(params().has('status')).toBe(false);
  expect(screen.getByText('全部状态')).toBeVisible();
});

it('moves back one page when archiving the last result in a published filter', async () => {
  resetArticleStore([
    makeArticle({ id: 1, title: '将下架的文章', status: 'published' }),
    makeArticle({ id: 2, title: '保留文章', status: 'published' }),
  ]);
  const { user, router } = renderApp('/admin/articles?status=published&page=2&pageSize=1');
  const row = (await screen.findByText('将下架的文章')).closest('tr')!;
  expect(within(row).getByText('已发布')).toBeVisible();
  await user.click(within(row).getByText('下架'));
  expect(await screen.findByText('保留文章')).toBeVisible();
  expect(Object.fromEntries(new URLSearchParams(router.state.location.search))).toMatchObject({
    status: 'published',
    page: '1',
    pageSize: '1',
  });
  expect(screen.queryByText('将下架的文章')).not.toBeInTheDocument();
});

it('shows only the current status action and keeps the original status on failure', async () => {
  resetArticleStore([makeArticle({ title: '待发布文章' })]);
  server.use(
    http.patch('*/api/admin/articles/1', () =>
      HttpResponse.json({ code: 'REQUEST_ERROR', message: '无法发布' }, { status: 500 }),
    ),
  );
  const { user } = renderApp('/admin/articles');
  const row = (await screen.findByText('待发布文章')).closest('tr')!;
  expect(within(row).queryByText(/^(下架|重新发布)$/)).not.toBeInTheDocument();
  const publish = within(row).getByText('发布').closest('button');
  await user.click(within(row).getByText('发布'));
  expect(await screen.findByText('无法发布')).toBeVisible();
  expect(within(row).getByText('草稿')).toBeVisible();
  expect(publish).toBeEnabled();
});

it('shows the new status and action after republishing', async () => {
  resetArticleStore([makeArticle({ title: '恢复文章', status: 'archived' })]);
  const { user } = renderApp('/admin/articles');
  const row = (await screen.findByText('恢复文章')).closest('tr')!;
  expect(within(row).getByText('已下架')).toBeVisible();
  await user.click(within(row).getByText('重新发布'));
  expect(await within(row).findByText('已发布')).toBeVisible();
  expect(within(row).getByText('下架')).toBeVisible();
  expect(within(row).queryByText('重新发布')).not.toBeInTheDocument();
});
it('sorts by either time field in both directions and resets only the page', async () => {
  const { user, router } = renderApp(
    '/admin/articles?page=2&pageSize=5&keyword=React&channelId=1&sortOrder=desc',
  );
  await screen.findByText('React 实践 01');
  await user.type(screen.getByRole('textbox', { name: '标题关键词' }), '未提交');
  const updatedLabel = screen.getByRole('columnheader', { name: /^更新时间/ }),
    createdLabel = screen.getByRole('columnheader', { name: /^创建时间/ });
  await user.click(updatedLabel);
  let params = new URLSearchParams(router.state.location.search);
  expect(Object.fromEntries(params)).toMatchObject({
    page: '1',
    pageSize: '5',
    keyword: 'React',
    channelId: '1',
    sortBy: 'updatedAt',
    sortOrder: 'asc',
  });
  expect(updatedLabel.closest('th')).toHaveAttribute('aria-sort', 'ascending');
  expect(createdLabel.closest('th')).not.toHaveAttribute('aria-sort');
  await user.click(updatedLabel);
  params = new URLSearchParams(router.state.location.search);
  expect(params.get('sortOrder')).toBe('desc');
  await user.click(createdLabel);
  expect(new URLSearchParams(router.state.location.search).get('sortBy')).toBe('createdAt');
  expect(createdLabel.closest('th')).toHaveAttribute('aria-sort', 'ascending');
  await user.click(createdLabel);
  expect(createdLabel.closest('th')).toHaveAttribute('aria-sort', 'descending');
});
it('restores the updated-time sort marker from a direct URL', async () => {
  renderApp('/admin/articles?sortBy=updatedAt&sortOrder=desc');
  const updated = await screen.findByRole('columnheader', { name: /^更新时间/ });
  expect(updated.closest('th')).toHaveAttribute('aria-sort', 'descending');
  expect(screen.getByRole('columnheader', { name: /^创建时间/ }).closest('th')).not.toHaveAttribute(
    'aria-sort',
  );
});
it('resets all URL conditions and clears filter drafts', async () => {
  const { user, router, queryClient } = renderApp(
    '/admin/articles?page=2&pageSize=5&keyword=React&channelId=1&sortBy=updatedAt&sortOrder=asc',
  );
  await screen.findByText('React 实践 31');
  const input = screen.getByRole('textbox', { name: '标题关键词' });
  await user.clear(input);
  await user.type(input, '草稿');
  await user.click(screen.getByRole('button', { name: '重置' }));
  expect(router.state.location.pathname + router.state.location.search).toBe('/admin/articles');
  expect(input).toHaveValue('');
  expect(screen.getByText('全部频道')).toBeVisible();
  await waitFor(() =>
    expect(
      queryClient.getQueryData<{ items: unknown[] }>(articleKeys.list(DEFAULT_ARTICLE_PARAMS))
        ?.items,
    ).toHaveLength(10),
  );
  expect(screen.getByRole('columnheader', { name: /^创建时间/ }).closest('th')).toHaveAttribute(
    'aria-sort',
    'descending',
  );
});
it('clears drafts even at the default URL and reuses fresh default cache', async () => {
  let gets = 0;
  server.use(
    http.get('*/api/admin/articles', () => {
      gets++;
      return HttpResponse.json({ items: [], total: 0 });
    }),
  );
  const client = createAppQueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = articleKeys.list(DEFAULT_ARTICLE_PARAMS);
  client.setQueryData(key, {
    items: [
      {
        id: 1,
        title: '默认缓存',
        channelId: 1,
        status: 'draft',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ],
    total: 1,
  });
  const { user, router } = renderApp('/admin/articles', { client });
  await screen.findByText('默认缓存');
  const input = screen.getByRole('textbox', { name: '标题关键词' });
  await user.type(input, '未提交草稿');
  await user.click(screen.getByRole('button', { name: '重置' }));
  expect(input).toHaveValue('');
  expect(router.state.location.search).toBe('');
  expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  expect(gets).toBe(0);
  expect(screen.getByText('默认缓存')).toBeVisible();
});
it('restores the submitted filter when navigating backwards', async () => {
  const { user, router } = renderApp('/admin/articles?keyword=react');
  const input = await screen.findByRole('textbox', { name: '标题关键词' });
  expect(input).toHaveValue('react');
  await user.clear(input);
  await user.type(input, 'Vue');
  await user.click(screen.getByRole('button', { name: '查询' }));
  await waitFor(() => expect(router.state.location.search).toContain('keyword=Vue'));
  await act(() => router.navigate(-1));
  await waitFor(() => expect(input).toHaveValue('react'));
  await act(() => router.navigate('/admin/articles'));
  await waitFor(() => expect(input).toHaveValue(''));
});
it('does not submit input drafts until query and resets page on query', async () => {
  let gets = 0;
  server.events.on('request:start', ({ request }) => {
    if (new URL(request.url).pathname === '/api/admin/articles') gets++;
  });
  const { user, router } = renderApp('/admin/articles?page=2&pageSize=10&sortOrder=asc');
  await screen.findByText('Vue 笔记 12');
  const initial = gets;
  await user.type(screen.getByRole('textbox', { name: '标题关键词' }), 'React');
  expect(gets).toBe(initial);
  await user.click(screen.getByRole('button', { name: '查询' }));
  await waitFor(() =>
    expect(new URLSearchParams(router.state.location.search).get('page')).toBe('1'),
  );
  expect(new URLSearchParams(router.state.location.search).get('sortOrder')).toBe('asc');
  server.events.removeAllListeners('request:start');
});
it('carries the entire source list URL to article actions', async () => {
  const { user, router } = renderApp('/admin/articles?page=1&channelId=1&sortOrder=asc');
  const title = await screen.findByText('React 实践 01');
  await user.click(within(title.closest('tr')!).getByRole('link', { name: '详情' }));
  await waitFor(() =>
    expect(router.state.location.state).toEqual({
      from: '/admin/articles?page=1&channelId=1&sortOrder=asc',
    }),
  );
});
it('shows empty results separately from request failure', async () => {
  const { router } = renderApp('/admin/articles?keyword=不存在');
  expect(await screen.findByText('暂无文章')).toBeVisible();
  server.use(
    http.get('*/api/admin/articles', () =>
      HttpResponse.json({ code: 'INTERNAL_ERROR', message: '列表暂时不可用' }, { status: 500 }),
    ),
  );
  await act(() => router.navigate('/admin/articles?keyword=error'));
  expect(await screen.findByText('列表暂时不可用')).toBeVisible();
  expect(screen.getByRole('button', { name: '重试' })).toBeVisible();
});
it('retains cached rows when a background refresh fails', async () => {
  const client = createAppQueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(
    articleKeys.list(DEFAULT_ARTICLE_PARAMS),
    {
      items: [
        {
          id: 1,
          title: '缓存文章',
          channelId: 1,
          status: 'draft',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
      total: 1,
    },
    { updatedAt: Date.now() - 61000 },
  );
  server.use(
    http.get('*/api/admin/articles', () =>
      HttpResponse.json({ code: 'INTERNAL_ERROR', message: '后台刷新失败' }, { status: 500 }),
    ),
  );
  renderApp('/admin/articles', { client });
  expect(await screen.findByText('缓存文章')).toBeVisible();
  expect(await screen.findByText('后台刷新失败')).toBeVisible();
  expect(screen.getByText('缓存文章')).toBeVisible();
});
it('disables deletion for published articles until they are archived', async () => {
  resetArticleStore([makeArticle({ title: '已发布文章', status: 'published' })]);
  const { user } = renderApp('/admin/articles');
  const deleteButton = await screen.findByLabelText('删除《已发布文章》');
  expect(deleteButton).toBeDisabled();
  await user.click(deleteButton);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  await user.click(screen.getByText('下架'));
  expect(await screen.findByText('已下架')).toBeVisible();
  expect(screen.getByLabelText('删除《已发布文章》')).toBeEnabled();
});

it('enables each batch action only when all selected articles are eligible', async () => {
  resetArticleStore([
    makeArticle({ id: 1, title: '草稿文章' }),
    makeArticle({ id: 2, title: '发布文章', status: 'published' }),
    makeArticle({ id: 3, title: '下架文章', status: 'archived' }),
  ]);
  const { user } = renderApp('/admin/articles');
  await screen.findByText('草稿文章');
  const draft = screen.queryByRole('checkbox', { name: '选择《草稿文章》' });
  expect(draft).toBeInTheDocument();
  const published = screen.getByRole('checkbox', { name: '选择《发布文章》' });
  const archived = screen.getByRole('checkbox', { name: '选择《下架文章》' });
  const all = screen.getByRole('checkbox', { name: '全选当前页' });

  await user.click(draft!);
  const publishButton = screen.getByText('批量发布').closest('button')!;
  const archiveButton = screen.getByText('批量下架').closest('button')!;
  const deleteButton = screen.getByText('批量删除').closest('button')!;
  const disabledActions = () => ({
    publish: publishButton.hasAttribute('disabled'),
    archive: archiveButton.hasAttribute('disabled'),
    delete: deleteButton.hasAttribute('disabled'),
  });
  const publishHint = '仅支持草稿和已下架文章';
  const archiveHint = '仅支持已发布文章';
  expect(disabledActions()).toEqual({ publish: false, archive: true, delete: false });

  await user.click(archived);
  expect(disabledActions()).toEqual({ publish: false, archive: true, delete: false });
  expect(screen.queryByText(publishHint)).not.toBeInTheDocument();
  expect(screen.queryByText(archiveHint)).not.toBeInTheDocument();
  expect(archiveButton).toHaveAccessibleDescription(archiveHint);
  expect(all).toBePartiallyChecked();

  await user.click(draft!);
  expect(disabledActions()).toEqual({ publish: false, archive: true, delete: false });

  await user.click(draft!);
  await user.click(published);
  expect(all).toBeChecked();
  expect(disabledActions()).toEqual({ publish: true, archive: true, delete: true });
  expect(deleteButton).toHaveAccessibleDescription('已发布文章请先下架');

  await user.click(draft!);
  await user.click(archived);
  expect(disabledActions()).toEqual({ publish: true, archive: false, delete: true });
  expect(screen.queryByText(publishHint)).not.toBeInTheDocument();
  expect(publishButton).toHaveAccessibleDescription(publishHint);
  expect(screen.queryByText(archiveHint)).not.toBeInTheDocument();
});

it('selects the current page and clears selection on cancellation or navigation', async () => {
  resetArticleStore([
    makeArticle({ id: 1, title: '另一页文章' }),
    makeArticle({ id: 2, title: '当前页文章甲' }),
    makeArticle({ id: 3, title: '当前页文章乙' }),
  ]);
  const { user, router } = renderApp('/admin/articles?page=1&pageSize=2');
  await screen.findByText('当前页文章甲');
  const all = screen.queryByRole('checkbox', { name: '全选当前页' });
  expect(all).toBeInTheDocument();

  await user.click(all!);
  expect(all).toBeChecked();
  expect(screen.getByText('已选择 2 项')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '取消选择' }));
  expect(all).not.toBeChecked();
  expect(screen.queryByRole('button', { name: '批量删除' })).not.toBeInTheDocument();

  await user.click(all!);
  await act(() => router.navigate('/admin/articles?page=2&pageSize=2'));
  expect(await screen.findByRole('checkbox', { name: '选择《另一页文章》' })).not.toBeChecked();
  await act(() => router.navigate(-1));
  expect(await screen.findByRole('checkbox', { name: '选择《当前页文章甲》' })).not.toBeChecked();
  expect(screen.queryByRole('button', { name: '批量删除' })).not.toBeInTheDocument();
});

it.each([
  { action: '删除', change: 'becomes published' },
  { action: '删除', change: 'leaves the current page' },
  { action: '发布', change: 'becomes published' },
])(
  'blocks the batch $action confirmation if a selected article $change while the dialog is open',
  async ({ action, change }) => {
    const draft = makeArticle({ title: '草稿文章' });
    const archived = makeArticle({ id: 2, title: '下架文章', status: 'archived' });
    resetArticleStore([draft, archived]);
    const { user, queryClient } = renderApp('/admin/articles');
    await screen.findByText('草稿文章');
    await user.click(screen.getByRole('checkbox', { name: '全选当前页' }));
    await user.click(screen.getByRole('button', { name: `批量${action}` }));
    const confirm = screen.getByLabelText(`确认${action}`);
    expect(confirm).toBeEnabled();

    const items =
      change === 'becomes published' ? [{ ...draft, status: 'published' }, archived] : [archived];
    act(() => {
      queryClient.setQueryData(articleKeys.list(DEFAULT_ARTICLE_PARAMS), {
        items,
        total: items.length,
      });
    });
    await screen.findByText(`待${action}文章已变更，请关闭弹窗后重新选择。`);
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('dialog')).toHaveTextContent(`确定${action}选中的 2 篇文章`);
  },
);

it('keeps writes locked without showing a target change warning during a batch publish', async () => {
  const draft = makeArticle({ title: '草稿文章' });
  resetArticleStore([draft]);
  let finishPublish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finishPublish = resolve;
  });
  server.use(
    http.patch('*/api/admin/articles/1', async () => {
      await pending;
      return HttpResponse.json({ code: 'INTERNAL_ERROR', message: '无法发布' }, { status: 500 });
    }),
  );
  const { user, queryClient } = renderApp('/admin/articles');
  const row = (await screen.findByText('草稿文章')).closest('tr')!;
  const checkbox = within(row).getByLabelText('选择《草稿文章》');
  const singlePublish = within(row).getByText('发布', { exact: true }).closest('button');
  const singleDelete = within(row).getByLabelText('删除《草稿文章》');
  await user.click(checkbox);
  await user.click(screen.getByText('批量发布').closest('button')!);
  const confirm = screen.getByLabelText('确认发布');

  try {
    await user.click(confirm);
    expect(confirm).toBeDisabled();
    expect(singlePublish).toBeDisabled();
    expect(singleDelete).toBeDisabled();
    act(() => {
      queryClient.setQueryData(articleKeys.list(DEFAULT_ARTICLE_PARAMS), {
        items: [{ ...draft, status: 'published' }],
        total: 1,
      });
    });
    await within(row).findByText('已发布');
    expect(screen.queryByText('待发布文章已变更，请关闭弹窗后重新选择。')).not.toBeInTheDocument();
  } finally {
    finishPublish();
  }

  expect(await screen.findByText('批量发布失败，请重试')).toBeVisible();
  await within(row).findByText('草稿');
  expect(checkbox).toBeChecked();
});

it('keeps a failed batch publish selected for retry while updating successful articles', async () => {
  resetArticleStore([
    makeArticle({ id: 1, title: '草稿文章' }),
    makeArticle({ id: 2, title: '下架文章', status: 'archived' }),
  ]);
  server.use(
    http.patch(
      '*/api/admin/articles/2',
      () => HttpResponse.json({ code: 'INTERNAL_ERROR', message: '无法发布' }, { status: 500 }),
      { once: true },
    ),
  );
  const { user } = renderApp('/admin/articles');
  const draftRow = (await screen.findByText('草稿文章')).closest('tr')!;
  const archivedRow = screen.getByText('下架文章').closest('tr')!;
  await user.click(screen.getByRole('checkbox', { name: '全选当前页' }));
  await user.click(screen.getByRole('button', { name: '批量发布' }));
  await user.click(screen.getByLabelText('确认发布'));

  expect(await screen.findByText('已发布 1 篇，1 篇失败')).toBeVisible();
  expect(await within(draftRow).findByText('已发布')).toBeVisible();
  expect(within(archivedRow).getByText('已下架')).toBeVisible();
  expect(within(draftRow).getByRole('checkbox')).not.toBeChecked();
  expect(within(archivedRow).getByRole('checkbox')).toBeChecked();

  await user.click(screen.getByRole('button', { name: '批量发布' }));
  await user.click(screen.getByLabelText('确认发布'));
  expect(await within(archivedRow).findByText('已发布')).toBeVisible();
  expect(within(archivedRow).getByRole('checkbox')).not.toBeChecked();
});

it('returns to the first page when batch archiving empties a published page', async () => {
  resetArticleStore([
    makeArticle({ id: 1, title: '保留文章', status: 'published' }),
    makeArticle({ id: 2, title: '待下架文章', status: 'published' }),
  ]);
  const { user, router } = renderApp(
    '/admin/articles?page=2&pageSize=1&status=published&sortOrder=asc',
  );
  await screen.findByText('待下架文章');
  await user.click(screen.getByRole('checkbox', { name: '选择《待下架文章》' }));
  await user.click(screen.getByRole('button', { name: '批量下架' }));
  await user.click(screen.getByLabelText('确认下架'));

  expect(await screen.findByText('保留文章')).toBeVisible();
  expect(Object.fromEntries(new URLSearchParams(router.state.location.search))).toMatchObject({
    page: '1',
    pageSize: '1',
    status: 'published',
  });
});

it('keeps only failed articles selected for a batch deletion retry', async () => {
  resetArticleStore([
    makeArticle({ id: 1, title: '草稿文章' }),
    makeArticle({ id: 2, title: '下架文章', status: 'archived' }),
  ]);
  server.use(
    http.delete(
      '*/api/admin/articles/2',
      () => HttpResponse.json({ code: 'INTERNAL_ERROR', message: '无法删除' }, { status: 500 }),
      { once: true },
    ),
  );
  const { user } = renderApp('/admin/articles');
  await screen.findByText('草稿文章');
  const all = screen.queryByRole('checkbox', { name: '全选当前页' });
  expect(all).toBeInTheDocument();
  await user.click(all!);
  await user.click(screen.getByRole('button', { name: '批量删除' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('确定删除选中的 2 篇文章吗？');
  await user.click(screen.getByRole('button', { name: '确认删除' }));

  expect(await screen.findByText('已删除 1 篇，1 篇失败')).toBeVisible();
  await waitFor(() => expect(screen.queryByText('草稿文章')).not.toBeInTheDocument());
  expect(screen.getByText('已选择 1 项')).toBeVisible();
  expect(screen.getByRole('checkbox', { name: '选择《下架文章》' })).toBeChecked();

  await user.click(screen.getByRole('button', { name: '批量删除' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('确定删除选中的 1 篇文章吗？');
  await user.click(screen.getByRole('button', { name: '确认删除' }));
  expect(await screen.findByText('已删除 1 篇文章')).toBeVisible();
  await waitFor(() => expect(screen.queryByText('下架文章')).not.toBeInTheDocument());
  expect(screen.queryByRole('button', { name: '批量删除' })).not.toBeInTheDocument();
});

it('returns to the first page after batch deleting the entire second page', async () => {
  resetArticleStore([
    makeArticle({ id: 1, title: '保留文章甲' }),
    makeArticle({ id: 2, title: '保留文章乙' }),
    makeArticle({ id: 3, title: '待删除文章甲' }),
    makeArticle({ id: 4, title: '待删除文章乙' }),
  ]);
  const { user, router } = renderApp(
    '/admin/articles?page=2&pageSize=2&keyword=文章&channelId=1&status=draft&sortOrder=asc',
  );
  await screen.findByText('待删除文章甲');
  expect(screen.getByText('待删除文章乙')).toBeVisible();
  await user.click(screen.getByRole('checkbox', { name: '全选当前页' }));
  await user.click(screen.getByRole('button', { name: '批量删除' }));
  await user.click(screen.getByLabelText('确认删除'));

  expect(await screen.findByText('保留文章甲')).toBeVisible();
  expect(screen.getByText('保留文章乙')).toBeVisible();
  expect(Object.fromEntries(new URLSearchParams(router.state.location.search))).toMatchObject({
    page: '1',
    pageSize: '2',
    keyword: '文章',
    channelId: '1',
    status: 'draft',
    sortOrder: 'asc',
  });
  expect(screen.queryByRole('button', { name: '批量删除' })).not.toBeInTheDocument();
});

it.each(['single', 'batch'])(
  'returns directly to the last available page after %s deletion',
  async (mode) => {
    const remaining = makeArticle({ id: 3, title: '保留文章' });
    resetArticleStore([
      makeArticle({ id: 1, title: '待删除文章' }),
      makeArticle({ id: 2, title: '并发移除的文章' }),
      remaining,
    ]);
    server.use(
      http.delete('*/api/admin/articles/1', () => {
        resetArticleStore([remaining]);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user, router } = renderApp('/admin/articles?page=3&pageSize=1&status=draft');
    await screen.findByText('待删除文章');
    const requestedPages: Array<string | null> = [];
    server.use(
      http.get('*/api/admin/articles', ({ request }) => {
        requestedPages.push(new URL(request.url).searchParams.get('page'));
      }),
    );
    if (mode === 'batch') {
      await user.click(screen.getByLabelText('选择《待删除文章》'));
      await user.click(screen.getByRole('button', { name: '批量删除' }));
    } else {
      await user.click(screen.getByLabelText('删除《待删除文章》'));
    }
    await user.click(screen.getByLabelText('确认删除'));

    await waitFor(() =>
      expect(Object.fromEntries(new URLSearchParams(router.state.location.search))).toMatchObject({
        page: '1',
        pageSize: '1',
        status: 'draft',
      }),
    );
    expect(await screen.findByText('保留文章')).toBeVisible();
    expect(requestedPages).not.toContain('2');
  },
);

it.each(['single', 'batch'])(
  'does not change pagination after browser back during %s deletion',
  async (mode) => {
    resetArticleStore([makeArticle({ title: '草稿文章' })]);
    let finishDeletion!: () => void;
    const pending = new Promise<void>((resolve) => {
      finishDeletion = resolve;
    });
    server.use(
      http.delete('*/api/admin/articles/1', async () => {
        await pending;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const previousSearch = '?page=2&pageSize=1&keyword=无匹配';
    const { user, router, queryClient } = renderApp('/admin/articles', {
      entries: [`/admin/articles${previousSearch}`, '/admin/articles'],
      initialIndex: 1,
    });
    await screen.findByText('草稿文章');
    if (mode === 'batch') {
      await user.click(screen.getByLabelText('选择《草稿文章》'));
      await user.click(screen.getByRole('button', { name: '批量删除' }));
    } else {
      await user.click(screen.getByLabelText('删除《草稿文章》'));
    }

    try {
      const confirm = screen.getByLabelText('确认删除');
      await user.click(confirm);
      expect(confirm).toBeDisabled();
      await act(() => router.navigate(-1));
      await screen.findByText('暂无文章');
    } finally {
      finishDeletion();
    }

    expect(
      await screen.findByText(mode === 'batch' ? '已删除 1 篇文章' : '删除成功'),
    ).toBeVisible();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(decodeURI(router.state.location.search)).toBe(previousSearch);
  },
);

it('keeps pagination when browser back leaves a list still refreshing after batch deletion', async () => {
  resetArticleStore([
    makeArticle({ id: 1, title: '待删除文章' }),
    makeArticle({ id: 2, title: '保留文章' }),
  ]);
  const previousSearch = '?page=2&pageSize=1&keyword=无匹配';
  const source = '/admin/articles?page=2&pageSize=1';
  const { user, router, queryClient } = renderApp(source, {
    entries: [`/admin/articles${previousSearch}`, source],
    initialIndex: 1,
  });
  await screen.findByText('待删除文章');
  await user.click(screen.getByLabelText('选择《待删除文章》'));
  await user.click(screen.getByRole('button', { name: '批量删除' }));

  let finishRefresh!: () => void;
  const pendingRefresh = new Promise<void>((resolve) => {
    finishRefresh = resolve;
  });
  server.use(
    http.get('*/api/admin/articles', async ({ request }) => {
      const search = new URL(request.url).searchParams;
      if (search.has('keyword') || search.get('page') !== '2') return;
      await pendingRefresh;
    }),
  );

  try {
    await user.click(screen.getByLabelText('确认删除'));
    expect(await screen.findByText('已删除 1 篇文章')).toBeVisible();
    expect(screen.getByText('正在后台更新…')).toBeVisible();
    await act(() => router.navigate(-1));
    await screen.findByText('暂无文章');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(decodeURI(router.state.location.search)).toBe(previousSearch);
  } finally {
    finishRefresh();
  }
});

it('does not restore failed selections after browser history clears them', async () => {
  resetArticleStore([makeArticle({ title: '草稿文章' })]);
  let finishDeletion!: () => void;
  const pending = new Promise<void>((resolve) => {
    finishDeletion = resolve;
  });
  server.use(
    http.delete('*/api/admin/articles/1', async () => {
      await pending;
      return HttpResponse.json({ code: 'INTERNAL_ERROR', message: '无法删除' }, { status: 500 });
    }),
  );
  const { user, router } = renderApp('/admin/articles', {
    entries: ['/admin/articles?sortOrder=asc', '/admin/articles'],
    initialIndex: 1,
  });
  await screen.findByText('草稿文章');
  await user.click(screen.getByLabelText('选择《草稿文章》'));
  await user.click(screen.getByRole('button', { name: '批量删除' }));
  await user.click(screen.getByLabelText('确认删除'));
  expect(screen.getByLabelText('确认删除')).toBeDisabled();

  await act(() => router.navigate(-1));
  expect(await screen.findByLabelText('选择《草稿文章》')).not.toBeChecked();
  finishDeletion();

  expect(await screen.findByText('批量删除失败，请重试')).toBeVisible();
  expect(screen.getByLabelText('选择《草稿文章》')).not.toBeChecked();
});

it('reports an unexpected batch mutation rejection and keeps the confirmation open', async () => {
  resetArticleStore([makeArticle({ title: '草稿文章' })]);
  const client = createAppQueryClient({
    defaultOptions: {
      mutations: {
        onMutate: () => {
          throw new Error('Unexpected batch mutation error');
        },
      },
    },
  });
  const { user } = renderApp('/admin/articles', { client });
  await screen.findByText('草稿文章');
  await user.click(screen.getByLabelText('选择《草稿文章》'));
  await user.click(screen.getByRole('button', { name: '批量删除' }));
  await user.click(screen.getByLabelText('确认删除'));

  expect(await screen.findByText('批量删除请求异常，请刷新列表后确认结果')).toBeVisible();
  expect(screen.getByRole('dialog')).toHaveTextContent('批量删除文章');
  expect(screen.getByLabelText('确认删除')).toBeEnabled();
});

it('cancels deletion without sending DELETE', async () => {
  let deletes = 0;
  server.use(
    http.delete('*/api/admin/articles/:id', () => {
      deletes++;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const { user } = renderApp('/admin/articles');
  await user.click(await screen.findByLabelText('删除《React 实践 35》'));
  await user.click(screen.getByLabelText('取消删除'));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(deletes).toBe(0);
});
it('returns one page after deleting the last visible item and preserves all other conditions', async () => {
  resetArticleStore([
    makeArticle({ id: 1, title: '最后文章' }),
    makeArticle({ id: 2, title: '保留文章' }),
  ]);
  const { user, router } = renderApp(
    '/admin/articles?page=2&pageSize=1&keyword=文章&channelId=1&sortOrder=desc',
  );
  await user.click(await screen.findByLabelText('删除《最后文章》'));
  await user.click(screen.getByLabelText('确认删除'));
  await waitFor(() =>
    expect(new URLSearchParams(router.state.location.search).get('page')).toBe('1'),
  );
  expect(new URLSearchParams(router.state.location.search).get('pageSize')).toBe('1');
  expect(new URLSearchParams(router.state.location.search).get('keyword')).toBe('文章');
  expect(new URLSearchParams(router.state.location.search).get('channelId')).toBe('1');
  expect(await screen.findByText('保留文章')).toBeVisible();
});
it('keeps confirmation open after DELETE fails', async () => {
  server.use(
    http.delete('*/api/admin/articles/:id', () =>
      HttpResponse.json({ code: 'INTERNAL_ERROR', message: '无法删除' }, { status: 500 }),
    ),
  );
  const { user } = renderApp('/admin/articles');
  await user.click(await screen.findByLabelText('删除《React 实践 35》'));
  await user.click(screen.getByLabelText('确认删除'));
  expect(await screen.findByText('无法删除')).toBeVisible();
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByText('React 实践 35')).toBeVisible();
});
it('closes confirmation after successful DELETE even when list refresh fails', async () => {
  let deletes = 0;
  server.use(
    http.delete('*/api/admin/articles/:id', () => {
      deletes++;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const { user } = renderApp('/admin/articles');
  await user.click(await screen.findByLabelText('删除《React 实践 35》'));
  server.use(
    http.get('*/api/admin/articles', () =>
      HttpResponse.json({ code: 'INTERNAL_ERROR', message: '删除后刷新失败' }, { status: 500 }),
    ),
  );
  await user.click(screen.getByLabelText('确认删除'));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByText('删除成功')).toBeVisible());
  expect(await screen.findByText('删除后刷新失败')).toBeVisible();
  await user.click(screen.getByLabelText('重试'));
  expect(deletes).toBe(1);
});
it('disables duplicate confirmation while DELETE is pending', async () => {
  let release!: () => void,
    deletes = 0;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.delete('*/api/admin/articles/:id', async () => {
      deletes++;
      await pending;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const { user } = renderApp('/admin/articles');
  await user.click(await screen.findByLabelText('删除《React 实践 35》'));
  const confirm = screen.getByLabelText('确认删除');
  await user.click(confirm);
  expect(confirm).toBeDisabled();
  await user.click(confirm);
  expect(deletes).toBe(1);
  await act(async () => {
    release();
    await pending;
  });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
