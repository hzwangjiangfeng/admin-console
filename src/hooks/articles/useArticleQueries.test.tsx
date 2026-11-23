import { it, expect, vi } from 'vitest';
import { QueryObserver } from '@tanstack/react-query';
import { createAppQueryClient } from '../../lib/queryClient';
import { articleDetailOptions } from './useArticleQueries';
import { articleKeys } from './articleKeys';
import { makeArticle } from '../../test/fixtures';
it('serves fresh details without requesting and refreshes stale data', async () => {
  const client = createAppQueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(articleKeys.detail(1), makeArticle({ title: '新鲜缓存' }));
  expect((await client.query(articleDetailOptions(1))).title).toBe('新鲜缓存');
  client.setQueryData(articleKeys.detail(1), makeArticle({ title: '旧缓存' }), {
    updatedAt: Date.now() - 61000,
  });
  expect((await client.query(articleDetailOptions(1))).title).toBe('React 实践 01');
  client.clear();
});
it('garbage collects only after five minutes without observers', async () => {
  vi.useFakeTimers();
  const client = createAppQueryClient();
  client.setQueryData(articleKeys.detail(1), makeArticle());
  const observer = new QueryObserver(client, articleDetailOptions(1));
  const stop = observer.subscribe(() => {});
  stop();
  await vi.advanceTimersByTimeAsync(299999);
  expect(client.getQueryData(articleKeys.detail(1))).toBeDefined();
  await vi.advanceTimersByTimeAsync(2);
  expect(client.getQueryData(articleKeys.detail(1))).toBeUndefined();
  client.clear();
  vi.useRealTimers();
});
