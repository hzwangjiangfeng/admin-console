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
