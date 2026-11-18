import type { ArticleListParams } from '../../types/articles';
export const articleKeys = {
  all: ['articles'] as const,
  lists: () => ['articles', 'list'] as const,
  list: (params: ArticleListParams) => ['articles', 'list', params] as const,
  details: () => ['articles', 'detail'] as const,
  detail: (id: number) => ['articles', 'detail', id] as const,
};
