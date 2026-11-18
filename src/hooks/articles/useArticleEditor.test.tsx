import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { AppProviders } from '../../app/AppProviders';
import { createAppQueryClient } from '../../lib/queryClient';
import { makeArticle } from '../../test/fixtures';
import { server } from '../../test/server';
import { articleKeys } from './articleKeys';
import { useArticleEditor } from './useArticleEditor';
it('initializes from fresh cache and then freezes the snapshot', async () => {
  const client = createAppQueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(articleKeys.detail(1), makeArticle({ title: '缓存标题' }));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders queryClient={client}>{children}</AppProviders>
  );
  const { result } = renderHook(() => useArticleEditor(1), { wrapper });
  await waitFor(() => expect(result.current.initialValues?.title).toBe('缓存标题'));
  act(() => client.setQueryData(articleKeys.detail(1), makeArticle({ title: '新查询结果' })));
  expect(result.current.initialValues?.title).toBe('缓存标题');
  client.clear();
});
it('ignores a late response after the article ID changes', async () => {
  let release!: (value: ReturnType<typeof makeArticle>) => void;
  const pending = new Promise<ReturnType<typeof makeArticle>>((resolve) => {
    release = resolve;
  });
  server.use(http.get('*/api/admin/articles/1', async () => HttpResponse.json(await pending)));
  const client = createAppQueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders queryClient={client}>{children}</AppProviders>
  );
  const { result, rerender } = renderHook(({ id }) => useArticleEditor(id), {
    wrapper,
    initialProps: { id: 1 },
  });
  rerender({ id: 2 });
  await waitFor(() => expect(result.current.initialValues?.title).toBe('Vue 笔记 02'));
  await act(async () => {
    release(makeArticle({ title: '不应串入' }));
    await pending;
  });
  expect(result.current.initialValues?.title).toBe('Vue 笔记 02');
  client.clear();
});
