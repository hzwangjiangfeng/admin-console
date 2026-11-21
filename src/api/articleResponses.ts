import type { Article, ArticleListItem, ArticleListResponse } from '../types/articles';
import { ApiError } from '../lib/apiError';

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
function isArticleSummary(value: unknown): value is ArticleListItem {
  return (
    isRecord(value) &&
    isPositiveInteger(value.id) &&
    typeof value.title === 'string' &&
    isPositiveInteger(value.channelId) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  );
}
export function invalidArticleResponse(status: number) {
  return new ApiError(
    '接口响应格式异常，请检查 API 地址、Mock 或后端配置',
    status,
    'INVALID_RESPONSE',
  );
}
export function readArticleList(data: unknown, status: number): ArticleListResponse {
  if (
    !isRecord(data) ||
    !Array.isArray(data.items) ||
    !data.items.every(isArticleSummary) ||
    typeof data.total !== 'number' ||
    !Number.isSafeInteger(data.total) ||
    data.total < 0
  )
    throw invalidArticleResponse(status);
  return { items: data.items, total: data.total };
}
export function readArticle(data: unknown, status: number): Article {
  if (!isRecord(data)) throw invalidArticleResponse(status);
  const content = data.content;
  if (!isArticleSummary(data) || typeof content !== 'string') throw invalidArticleResponse(status);
  return { ...data, content };
}
