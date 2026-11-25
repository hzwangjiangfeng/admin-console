import type { ArticleStatus } from '../types/articles';

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已下架',
};
export const STATUS_OPTIONS = Object.entries(ARTICLE_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));
export const ARTICLE_STATUS_NEXT: Record<ArticleStatus, ArticleStatus> = {
  draft: 'published',
  published: 'archived',
  archived: 'published',
};
export function isArticleStatus(value: unknown): value is ArticleStatus {
  return typeof value === 'string' && Object.hasOwn(ARTICLE_STATUS_LABELS, value);
}
