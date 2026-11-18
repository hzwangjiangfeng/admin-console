import { act, screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderApp } from '../../test/renderApp';
import { server } from '../../test/server';
import { makeArticle } from '../../test/fixtures';
async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: '标题' }), '新文章');
  await user.click(screen.getByRole('combobox', { name: '所属频道' }));
  await user.click(await screen.findByRole('option', { name: '技术' }));
  await user.type(screen.getByRole('textbox', { name: '正文' }), '正文');
}
it('returns to default list and opens the exact created article from persistent success feedback', async () => {
  const { user, router } = renderApp('/admin/articles/new');
  await fill(user);
  await user.click(screen.getByRole('button', { name: '提交' }));
  await waitFor(() =>
    expect(router.state.location.pathname + router.state.location.search).toBe('/admin/articles'),
  );
  await waitFor(() => expect(screen.getByText('新增成功')).toBeVisible());
  await user.click(screen.getByRole('button', { name: '查看文章' }));
  expect(router.state.location.pathname).toBe('/admin/articles/36');
  expect(await screen.findByRole('heading', { name: '新文章' })).toBeVisible();
});
it('keeps creation successful when list refresh fails and retries only the query', async () => {
  let posts = 0;
  server.use(
    http.post('*/api/admin/articles', () => {
      posts++;
      return HttpResponse.json(makeArticle({ id: 99 }), { status: 201 });
    }),
    http.get('*/api/admin/articles', () =>
      HttpResponse.json({ code: 'INTERNAL_ERROR', message: '列表刷新失败' }, { status: 500 }),
    ),
  );
  const { user, router } = renderApp('/admin/articles/new');
  await fill(user);
  await user.click(screen.getByRole('button', { name: '提交' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/admin/articles'));
  await waitFor(() => expect(screen.getByText('新增成功')).toBeVisible());
  expect(await screen.findByText('列表刷新失败')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '重试' }));
  expect(posts).toBe(1);
  expect(screen.getByRole('button', { name: '查看文章' })).toBeVisible();
});
it('keeps input after network failure', async () => {
  server.use(http.post('*/api/admin/articles', () => HttpResponse.error()));
  const { user } = renderApp('/admin/articles/new');
  await fill(user);
  await user.click(screen.getByRole('button', { name: '提交' }));
  expect(await screen.findByText('网络连接失败，请检查网络后重试')).toBeVisible();
  expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('新文章');
});
it('does not navigate away from a new draft when an abandoned create completes', async () => {
  let started = false,
    release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.post('*/api/admin/articles', async () => {
      started = true;
      await pending;
      return HttpResponse.json(makeArticle({ id: 99 }), { status: 201 });
    }),
  );
  const { user, router, queryClient } = renderApp('/admin/articles/new');
  await fill(user);
  await user.click(screen.getByRole('button', { name: '提交' }));
  await waitFor(() => expect(started).toBe(true));
  await act(() => router.navigate('/admin/articles/2/edit'));
  const title = await screen.findByRole('textbox', { name: '标题' });
  await user.clear(title);
  await user.type(title, '新的编辑草稿');
  await act(async () => {
    release();
  });
  await waitFor(() =>
    expect(queryClient.getMutationCache().getAll()[0]?.state.status).toBe('success'),
  );
  expect(router.state.location.pathname).toBe('/admin/articles/2/edit');
  expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('新的编辑草稿');
  expect(screen.queryByRole('button', { name: '查看文章' })).not.toBeInTheDocument();
});
it('cancels to a remembered list without submitting', async () => {
  const { user, router } = renderApp('/admin/articles/new', {
    entries: [{ pathname: '/admin/articles/new', state: { from: '/admin/articles?page=2' } }],
  });
  await user.click(screen.getByRole('button', { name: '取消' }));
  expect(router.state.location.pathname + router.state.location.search).toBe(
    '/admin/articles?page=2',
  );
});
