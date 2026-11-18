import { it, expect } from 'vitest';
import { resetArticleStore } from './data/articles';
import { getArticles } from '../api/articles.api';
import { DEFAULT_ARTICLE_PARAMS, normalizeArticleParams } from '../utils/articles/listParams';
import { makeArticle } from '../test/fixtures';
const sortingCases = [
  ['createdAt', 'asc', [1, 2, 3]],
  ['createdAt', 'desc', [3, 2, 1]],
  ['updatedAt', 'asc', [2, 1, 3]],
  ['updatedAt', 'desc', [3, 1, 2]],
] as const;
it.each(sortingCases)(
  'sorts the entire result by %s %s before paginating',
  async (field, order, expected) => {
    resetArticleStore([
      {
        ...makeArticle({ id: 1 }),
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
      },
      {
        ...makeArticle({ id: 2 }),
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      {
        ...makeArticle({ id: 3 }),
        createdAt: '2026-01-03T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
      },
    ]);
    const params = normalizeArticleParams(
      new URLSearchParams(`sortBy=${field}&sortOrder=${order}`),
    );
    expect((await getArticles(params)).items.map((article) => article.id)).toEqual([...expected]);
    const page = await getArticles({ ...params, page: 2, pageSize: 1 });
    expect(page.items.map((article) => article.id)).toEqual([expected[1]]);
    expect(page.total).toBe(3);
  },
);
it('uses ID as stable tie breaker in both sort directions', async () => {
  resetArticleStore([makeArticle({ id: 1 }), makeArticle({ id: 3 }), makeArticle({ id: 2 })]);
  expect((await getArticles(DEFAULT_ARTICLE_PARAMS)).items.map((a) => a.id)).toEqual([3, 2, 1]);
  expect(
    (await getArticles({ ...DEFAULT_ARTICLE_PARAMS, sortOrder: 'asc' })).items.map((a) => a.id),
  ).toEqual([1, 2, 3]);
});
it('returns zero total for unmatched titles', async () =>
  expect(await getArticles({ ...DEFAULT_ARTICLE_PARAMS, keyword: '不存在' })).toEqual({
    items: [],
    total: 0,
  }));
it('rejects malformed JSON with HTTP 400', async () => {
  const response = await fetch('http://localhost:5173/api/admin/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad',
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: 'BAD_REQUEST' });
});
