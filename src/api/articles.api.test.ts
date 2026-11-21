import { it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import {
  getArticle,
  getArticles,
  createArticle,
  updateArticle,
  deleteArticle,
} from './articles.api';
import { resetArticleStore } from '../mocks/data/articles';
import { makeArticle } from '../test/fixtures';
import { DEFAULT_ARTICLE_PARAMS } from '../utils/articles/listParams';
it('rejects an HTML homepage returned with HTTP 200 instead of caching it as a list', async () => {
  server.use(
    http.get('*/api/admin/articles', () =>
      HttpResponse.html('<!doctype html><html><body>Vite homepage</body></html>'),
    ),
  );
  await expect(getArticles(DEFAULT_ARTICLE_PARAMS)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
    status: 200,
  });
});
it.each([
  { items: null, total: 0 },
  { items: [], total: -1 },
  { items: [{ id: 1 }], total: 1 },
  {},
])('rejects malformed list response %#', async (body) => {
  server.use(http.get('*/api/admin/articles', () => HttpResponse.json(body)));
  await expect(getArticles(DEFAULT_ARTICLE_PARAMS)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
});
it('does not repeat writes or report deletion success when HTML is returned', async () => {
  let posts = 0,
    patches = 0,
    deletes = 0;
  const html = () => HttpResponse.html('<!doctype html><html>Wrong API destination</html>');
  server.use(
    http.post('*/api/admin/articles', () => {
      posts++;
      return html();
    }),
    http.patch('*/api/admin/articles/1', () => {
      patches++;
      return html();
    }),
    http.delete('*/api/admin/articles/1', () => {
      deletes++;
      return html();
    }),
  );
  await expect(
    createArticle({ title: '标题', channelId: 1, content: '正文' }),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  await expect(updateArticle(1, { title: '修改' })).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
  await expect(deleteArticle(1)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  expect({ posts, patches, deletes }).toEqual({ posts: 1, patches: 1, deletes: 1 });
});
it('keeps legitimate empty list responses valid', async () => {
  server.use(http.get('*/api/admin/articles', () => HttpResponse.json({ items: [], total: 0 })));
  await expect(getArticles(DEFAULT_ARTICLE_PARAMS)).resolves.toEqual({ items: [], total: 0 });
});
it('initializes identical server timestamps and refreshes only updatedAt on valid PATCH', async () => {
  const created = await createArticle({ title: '新文章', channelId: 1, content: '正文' });
  expect(created).toHaveProperty('updatedAt', created.createdAt);
  resetArticleStore([
    {
      ...makeArticle({ id: 1 }),
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-02T00:00:00.000Z',
    },
  ]);
  const lowerBound = Date.now();
  const updated = await updateArticle(1, { title: '修改后的文章' });
  expect(updated.createdAt).toBe('2020-01-01T00:00:00.000Z');
  expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(lowerBound);
  expect(updated.updatedAt).toMatch(/Z$/);
  expect((await getArticle(1)).updatedAt).toBe(updated.updatedAt);
  expect((await getArticles(DEFAULT_ARTICLE_PARAMS)).items[0].updatedAt).toBe(updated.updatedAt);
});
it('rejects client timestamp changes and leaves both timestamps unchanged after failed writes', async () => {
  const seed = { ...makeArticle({ id: 1 }), updatedAt: '2020-01-02T00:00:00.000Z' };
  resetArticleStore([seed]);
  await expect(updateArticle(1, { title: '' })).rejects.toMatchObject({ status: 422 });
  for (const field of ['createdAt', 'updatedAt']) {
    const input = {
      title: '不应保存',
      channelId: 1,
      content: '正文',
      [field]: '2030-01-01T00:00:00.000Z',
    };
    await expect(updateArticle(1, input)).rejects.toMatchObject({ status: 422 });
    await expect(createArticle(input)).rejects.toMatchObject({ status: 422 });
  }
  expect(await getArticle(1)).toEqual(seed);
});
it('performs HTTP CRUD with generated IDs and unchanged creation time', async () => {
  const created = await createArticle({ title: ' 新建 ', channelId: 1, content: '一\n二' });
  expect(created.id).toBeGreaterThan(0);
  expect(created.title).toBe('新建');
  expect(created.createdAt).toMatch(/Z$/);
  expect(await getArticle(created.id)).toEqual(created);
  const updated = await updateArticle(created.id, { title: '更新' });
  expect(updated.content).toBe('一\n二');
  expect(updated.createdAt).toBe(created.createdAt);
  await expect(deleteArticle(created.id)).resolves.toBeUndefined();
  await expect(getArticle(created.id)).rejects.toMatchObject({
    status: 404,
    code: 'ARTICLE_NOT_FOUND',
  });
});
it('returns summaries and filtered totals before pagination', async () => {
  const list = await getArticles({ ...DEFAULT_ARTICLE_PARAMS, channelId: 1, pageSize: 2 });
  expect(list.total).toBe(12);
  expect(list.items).toHaveLength(2);
  expect(list.items[0].channelId).toBe(1);
  expect(list.items[0]).not.toHaveProperty('content');
  const empty = await getArticles({ ...DEFAULT_ARTICLE_PARAMS, page: 99 });
  expect(empty).toEqual({ items: [], total: 35 });
});
it('maps validation fields and response-less network failures', async () => {
  await expect(createArticle({ title: '', channelId: 99, content: '' })).rejects.toMatchObject({
    status: 422,
    code: 'VALIDATION_ERROR',
    fieldErrors: { channelId: expect.any(Array) },
  });
  server.use(http.get('*/api/admin/articles/1', () => HttpResponse.error()));
  await expect(getArticle(1)).rejects.toMatchObject({ status: null, code: 'NETWORK_ERROR' });
});
it('normalizes HTTP 400 and 500 without relying on fieldErrors', async () => {
  for (const status of [400, 500]) {
    server.use(
      http.get('*/api/admin/articles/1', () =>
        HttpResponse.json({ code: 'TEST_ERROR', message: '请求失败' }, { status }),
      ),
    );
    await expect(getArticle(1)).rejects.toMatchObject({ status, message: '请求失败' });
  }
});
