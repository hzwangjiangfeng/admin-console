import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { it, expect } from 'vitest';
import { AppProviders } from '../../app/AppProviders';
import { createAppQueryClient } from '../../lib/queryClient';
import { articleKeys } from './articleKeys';
import { DEFAULT_ARTICLE_PARAMS } from '../../utils/articles/listParams';
import { makeArticle } from '../../test/fixtures';
import {
  useCreateArticleMutation,
  useUpdateArticleMutation,
  useDeleteArticleMutation,
} from './useArticleMutations';
it('invalidates all lists and only the updated detail', async () => {
  const client = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders queryClient={client}>{children}</AppProviders>
  );
  const a = articleKeys.list(DEFAULT_ARTICLE_PARAMS),
    b = articleKeys.list({ ...DEFAULT_ARTICLE_PARAMS, page: 2 });
  client.setQueryData(a, { items: [], total: 0 });
  client.setQueryData(b, { items: [], total: 0 });
  client.setQueryData(articleKeys.detail(1), makeArticle());
  client.setQueryData(articleKeys.detail(2), makeArticle({ id: 2 }));
  const { result } = renderHook(useUpdateArticleMutation, { wrapper });
  await act(() => result.current.mutateAsync({ id: 1, input: { title: '更新' } }));
  expect(client.getQueryState(a)?.isInvalidated).toBe(true);
  expect(client.getQueryState(b)?.isInvalidated).toBe(true);
  expect(client.getQueryState(articleKeys.detail(1))?.isInvalidated).toBe(true);
  expect(client.getQueryState(articleKeys.detail(2))?.isInvalidated).toBe(false);
  client.clear();
});
it('creation invalidates lists and deletion removes only its own detail', async () => {
  const client = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders queryClient={client}>{children}</AppProviders>
  );
  const list = articleKeys.list(DEFAULT_ARTICLE_PARAMS);
  client.setQueryData(list, { items: [], total: 0 });
  client.setQueryData(articleKeys.detail(1), makeArticle());
  client.setQueryData(articleKeys.detail(2), makeArticle({ id: 2 }));
  const create = renderHook(useCreateArticleMutation, { wrapper });
  await act(() =>
    create.result.current.mutateAsync({ title: '新建', channelId: 1, content: '内容' }),
  );
  expect(client.getQueryState(list)?.isInvalidated).toBe(true);
  expect(client.getQueryState(articleKeys.detail(1))?.isInvalidated).toBe(false);
  const remove = renderHook(useDeleteArticleMutation, { wrapper });
  await act(() => remove.result.current.mutateAsync(1));
  expect(client.getQueryData(articleKeys.detail(1))).toBeUndefined();
  expect(client.getQueryData(articleKeys.detail(2))).toBeDefined();
  client.clear();
});
