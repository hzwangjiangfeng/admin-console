import { act, screen, waitFor } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderApp } from '../../test/renderApp';
import { server } from '../../test/server';
import { makeArticle } from '../../test/fixtures';
import { createAppQueryClient } from '../../lib/queryClient';
import { articleKeys } from '../../hooks/articles/articleKeys';
it('shows article detail and renders HTML-looking body as plain text', async () => {
  server.use(
    http.get('*/api/admin/articles/1', () =>
      HttpResponse.json(
        makeArticle({ title: '详情标题', content: '<img src=x onerror=alert(1)>\n第二行' }),
      ),
    ),
  );
  const { container } = renderApp('/admin/articles/1');
  expect(await screen.findByRole('heading', { name: '详情标题' })).toBeVisible();
  expect(screen.getByText(/<img src=x/)).toBeVisible();
  expect(container.querySelector('img')).toBeNull();
});
it('shows the new article when only the route ID changes', async () => {
  server.use(
    http.get('*/api/admin/articles/:id', ({ params }) => {
      const id = Number(params.id);
      return HttpResponse.json(makeArticle({ id, title: `文章 ${id}`, content: `正文 ${id}` }));
    }),
  );
  const { router } = renderApp('/admin/articles/1');
  expect(await screen.findByRole('heading', { name: '文章 1' })).toBeVisible();
  await act(() => router.navigate('/admin/articles/2'));
  expect(await screen.findByRole('heading', { name: '文章 2' })).toBeVisible();
  expect(screen.getByText('正文 2')).toBeVisible();
  expect(screen.queryByText('正文 1')).not.toBeInTheDocument();
});
it('returns to the full originating list address', async () => {
  const from = '/admin/articles?page=2&pageSize=10&keyword=React&sortOrder=asc';
  const { user, router } = renderApp('/admin/articles/1', {
    entries: [{ pathname: '/admin/articles/1', state: { from } }],
  });
  await screen.findByRole('heading', { name: 'React 实践 01' });
  await user.click(screen.getByRole('button', { name: '返回列表' }));
  await waitFor(() =>
    expect(router.state.location.pathname + router.state.location.search).toBe(from),
  );
});
it.each([undefined, { from: 'https://evil.example/' }])(
  'uses the default list for missing or unsafe source %#',
  async (state) => {
    const { user, router } = renderApp('/admin/articles/1', {
      entries: [{ pathname: '/admin/articles/1', state }],
    });
    await screen.findByRole('heading', { name: 'React 实践 01' });
    await user.click(screen.getByRole('button', { name: '返回列表' }));
    await waitFor(() =>
      expect(router.state.location.pathname + router.state.location.search).toBe('/admin/articles'),
    );
  },
);
it('never queries invalid article IDs', async () => {
  const request = vi.fn();
  server.use(
    http.get('*/api/admin/articles/:id', () => {
      request();
      return HttpResponse.json(makeArticle());
    }),
  );
  renderApp('/admin/articles/not-a-number');
  expect(await screen.findByText('无效的文章地址')).toBeVisible();
  expect(request).not.toHaveBeenCalled();
});
it('shows a not-found page instead of usable data', async () => {
  renderApp('/admin/articles/999');
  expect(await screen.findByText('文章不存在')).toBeVisible();
  expect(screen.getByRole('button', { name: '返回列表' })).toBeVisible();
});
it('keeps old data with a retry action for background errors', async () => {
  const client = createAppQueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(articleKeys.detail(1), makeArticle({ title: '旧详情' }), {
    updatedAt: Date.now() - 61000,
  });
  server.use(
    http.get('*/api/admin/articles/1', () =>
      HttpResponse.json({ code: 'INTERNAL_ERROR', message: '详情刷新失败' }, { status: 500 }),
    ),
  );
  renderApp('/admin/articles/1', { client });
  expect(await screen.findByRole('heading', { name: '旧详情' })).toBeVisible();
  expect(await screen.findByText('详情刷新失败')).toBeVisible();
  expect(screen.getByRole('button', { name: '重试' })).toBeVisible();
});
