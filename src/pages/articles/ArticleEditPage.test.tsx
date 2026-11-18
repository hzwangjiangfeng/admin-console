import { act, screen, waitFor } from '@testing-library/react';
import { it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderApp } from '../../test/renderApp';
import { server } from '../../test/server';
import { makeArticle } from '../../test/fixtures';
import { createAppQueryClient } from '../../lib/queryClient';
import { articleKeys } from '../../hooks/articles/articleKeys';
it('waits for a stale refresh then protects the draft from later query updates', async () => {
  let release!: (a: ReturnType<typeof makeArticle>) => void;
  const pending = new Promise<ReturnType<typeof makeArticle>>((resolve) => {
    release = resolve;
  });
  server.use(http.get('*/api/admin/articles/1', async () => HttpResponse.json(await pending)));
  const client = createAppQueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(articleKeys.detail(1), makeArticle({ title: '旧标题' }), {
    updatedAt: Date.now() - 61000,
  });
  const { user } = renderApp('/admin/articles/1/edit', { client });
  expect(screen.queryByRole('textbox', { name: '标题' })).not.toBeInTheDocument();
  await act(async () => {
    release(makeArticle({ title: '最新标题' }));
    await pending;
  });
  const title = await screen.findByRole('textbox', { name: '标题' });
  expect(title).toHaveValue('最新标题');
  await user.clear(title);
  await user.type(title, '尚未保存的草稿');
  server.use(
    http.get('*/api/admin/articles/1', () => HttpResponse.json(makeArticle({ title: '后台修改' }))),
  );
  await act(() => client.invalidateQueries({ queryKey: articleKeys.detail(1), exact: true }));
  expect(title).toHaveValue('尚未保存的草稿');
});
it('does not offer stale editing after refresh failure and allows initialization retry', async () => {
  const client = createAppQueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(articleKeys.detail(1), makeArticle({ title: '旧标题' }), {
    updatedAt: Date.now() - 61000,
  });
  server.use(
    http.get('*/api/admin/articles/1', () =>
      HttpResponse.json({ code: 'INTERNAL_ERROR', message: '初始化失败' }, { status: 500 }),
    ),
  );
  const { user } = renderApp('/admin/articles/1/edit', { client });
  expect(await screen.findByText('初始化失败')).toBeVisible();
  expect(screen.queryByRole('textbox', { name: '标题' })).not.toBeInTheDocument();
  server.use(
    http.get('*/api/admin/articles/1', () =>
      HttpResponse.json(makeArticle({ title: '重试后的标题' })),
    ),
  );
  await user.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByRole('textbox', { name: '标题' })).toHaveValue('重试后的标题');
});
it('uses a fresh cache without another detail request', async () => {
  let gets = 0;
  server.use(
    http.get('*/api/admin/articles/1', () => {
      gets++;
      return HttpResponse.json(makeArticle());
    }),
  );
  const client = createAppQueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(articleKeys.detail(1), makeArticle({ title: '新鲜标题' }));
  renderApp('/admin/articles/1/edit', { client });
  expect(await screen.findByRole('textbox', { name: '标题' })).toHaveValue('新鲜标题');
  expect(gets).toBe(0);
});
it('keeps save successful if the returned list fails and retries only GET', async () => {
  let patches = 0;
  server.use(
    http.patch('*/api/admin/articles/1', () => {
      patches++;
      return HttpResponse.json(makeArticle({ title: '新标题' }));
    }),
    http.get('*/api/admin/articles', () =>
      HttpResponse.json({ code: 'INTERNAL_ERROR', message: '列表刷新失败' }, { status: 500 }),
    ),
  );
  const { user, router } = renderApp('/admin/articles/1/edit');
  await screen.findByRole('textbox', { name: '标题' });
  await user.click(screen.getByRole('button', { name: '提交' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/admin/articles'));
  await waitFor(() => expect(screen.getByText('保存成功')).toBeVisible());
  expect(await screen.findByText('列表刷新失败')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '重试' }));
  expect(patches).toBe(1);
});
it('preserves draft after PATCH validation failure and supports cancel to the original list', async () => {
  server.use(
    http.patch('*/api/admin/articles/1', () =>
      HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: '保存校验失败',
          fieldErrors: { title: ['该标题不可用'] },
        },
        { status: 422 },
      ),
    ),
  );
  const { user, router } = renderApp('/admin/articles/1/edit', {
    entries: [{ pathname: '/admin/articles/1/edit', state: { from: '/admin/articles?page=2' } }],
  });
  const title = await screen.findByRole('textbox', { name: '标题' });
  await user.clear(title);
  await user.type(title, '保留草稿');
  await user.click(screen.getByRole('button', { name: '提交' }));
  expect(await screen.findByText('保存校验失败')).toBeVisible();
  expect(title).toHaveValue('保留草稿');
  await user.click(screen.getByRole('button', { name: '取消' }));
  expect(router.state.location.pathname + router.state.location.search).toBe(
    '/admin/articles?page=2',
  );
});
it('ignores navigation from a late save after moving to another article draft', async () => {
  let started = false,
    release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.patch('*/api/admin/articles/1', async () => {
      started = true;
      await pending;
      return HttpResponse.json(makeArticle({ id: 1, title: 'A 已保存' }));
    }),
  );
  const client = createAppQueryClient({ defaultOptions: { queries: { retry: false } } });
  const listKey = [
    'articles',
    'list',
    { page: 1, pageSize: 10, keyword: '', channelId: null, sortBy: 'createdAt', sortOrder: 'desc' },
  ] as const;
  client.setQueryData(listKey, { items: [], total: 0 });
  const { user, router } = renderApp('/admin/articles/1/edit', { client });
  await screen.findByRole('textbox', { name: '标题' });
  await user.click(screen.getByRole('button', { name: '提交' }));
  await waitFor(() => expect(started).toBe(true));
  await act(() => router.navigate('/admin/articles/2/edit'));
  const title = await screen.findByRole('textbox', { name: '标题' });
  await user.clear(title);
  await user.type(title, 'B 的未保存草稿');
  await act(async () => {
    release();
  });
  await waitFor(() => expect(client.getMutationCache().getAll()[0]?.state.status).toBe('success'));
  expect(router.state.location.pathname).toBe('/admin/articles/2/edit');
  expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('B 的未保存草稿');
  expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
});
it('does not mount an editor for invalid article IDs', async () => {
  renderApp('/admin/articles/0/edit');
  expect(await screen.findByText('无效的文章地址')).toBeVisible();
  expect(screen.queryByRole('textbox', { name: '标题' })).not.toBeInTheDocument();
});
