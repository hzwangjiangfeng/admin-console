import { http, HttpResponse } from 'msw';
import { ARTICLE_STATUS_NEXT } from '../constants/articleStatuses';
import type { Article } from '../types/articles';
import { articleStore } from './data/articles';
import { normalizeArticleParams, parseArticleId } from '../utils/articles/listParams';
import { validateArticleInput } from '../utils/articles/validation';
const notFound = () =>
  HttpResponse.json({ code: 'ARTICLE_NOT_FOUND', message: '文章不存在' }, { status: 404 });
const malformed = () =>
  HttpResponse.json({ code: 'BAD_REQUEST', message: '请求格式错误' }, { status: 400 });
export const articleHandlers = [
  http.get('*/api/admin/articles', ({ request }) => {
    const p = normalizeArticleParams(new URL(request.url).searchParams);
    const filtered = articleStore.articles.filter(
      (a) =>
        (!p.keyword || a.title.includes(p.keyword)) &&
        (p.channelId === null || a.channelId === p.channelId) &&
        (p.status === null || a.status === p.status),
    );
    const direction = p.sortOrder === 'desc' ? -1 : 1;
    filtered.sort(
      (a, b) => direction * (Date.parse(a[p.sortBy]) - Date.parse(b[p.sortBy]) || a.id - b.id),
    );
    const start = (p.page - 1) * p.pageSize;
    const items = filtered
      .slice(start, start + p.pageSize)
      .map(({ id, title, channelId, status, createdAt, updatedAt }) => ({
        id,
        title,
        channelId,
        status,
        createdAt,
        updatedAt,
      }));
    return HttpResponse.json({ items, total: filtered.length });
  }),
  http.get('*/api/admin/articles/:id', ({ params }) => {
    const article = articleStore.articles.find((a) => a.id === parseArticleId(String(params.id)));
    return article ? HttpResponse.json(article) : notFound();
  }),
  http.post('*/api/admin/articles', async ({ request }) => {
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return malformed();
    }
    const result = validateArticleInput(input, 'create');
    if (!result.ok)
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: result.formError ?? '请检查表单内容',
          fieldErrors: result.fieldErrors,
        },
        { status: 422 },
      );
    const now = new Date().toISOString();
    const article: Article = {
      ...result.values,
      id: articleStore.nextId++,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    articleStore.articles.push(article);
    return HttpResponse.json(article, { status: 201 });
  }),
  http.patch('*/api/admin/articles/:id', async ({ params, request }) => {
    const article = articleStore.articles.find((a) => a.id === parseArticleId(String(params.id)));
    if (!article) return notFound();
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return malformed();
    }
    const result = validateArticleInput(input, 'update');
    if (!result.ok)
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: result.formError ?? '请检查表单内容',
          fieldErrors: result.fieldErrors,
        },
        { status: 422 },
      );
    if (
      result.values.status !== undefined &&
      ARTICLE_STATUS_NEXT[article.status] !== result.values.status
    )
      return HttpResponse.json(
        { code: 'INVALID_STATUS_TRANSITION', message: '当前状态不支持此操作' },
        { status: 409 },
      );
    Object.assign(article, result.values, { updatedAt: new Date().toISOString() });
    return HttpResponse.json(article);
  }),
  http.delete('*/api/admin/articles/:id', ({ params }) => {
    const index = articleStore.articles.findIndex(
      (a) => a.id === parseArticleId(String(params.id)),
    );
    if (index === -1) return notFound();
    if (articleStore.articles[index].status === 'published')
      return HttpResponse.json(
        { code: 'ARTICLE_IS_PUBLISHED', message: '已发布文章不能删除，请先下架' },
        { status: 409 },
      );
    articleStore.articles.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
