import type { ArticleListParams } from '../../types/articles';
import { isChannelId } from '../../constants/channels';
export const DEFAULT_ARTICLE_PARAMS: ArticleListParams = { page: 1, pageSize: 10, keyword: '', channelId: null, sortBy: 'createdAt', sortOrder: 'desc' };
export function parseArticleId(raw: string | undefined | null): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
export function normalizeArticleParams(search: URLSearchParams): ArticleListParams {
  const channel = parseArticleId(search.get('channelId'));
  return { page: parseArticleId(search.get('page')) ?? 1, pageSize: parseArticleId(search.get('pageSize')) ?? 10, keyword: (search.get('keyword') ?? '').trim(), channelId: channel !== null && isChannelId(channel) ? channel : null, sortBy: search.get('sortBy') === 'updatedAt' ? 'updatedAt' : 'createdAt', sortOrder: search.get('sortOrder') === 'asc' ? 'asc' : 'desc' };
}
export function serializeArticleParams(params: ArticleListParams) {
  const search = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize), sortBy: params.sortBy, sortOrder: params.sortOrder });
  if (params.keyword) search.set('keyword', params.keyword);
  if (params.channelId !== null) search.set('channelId', String(params.channelId));
  return search;
}
