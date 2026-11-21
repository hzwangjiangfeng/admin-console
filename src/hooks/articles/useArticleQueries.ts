import { queryOptions, useQuery } from '@tanstack/react-query';
import { getArticle, getArticles } from '../../api/articles.api';
import { articleKeys } from './articleKeys';
import type { ArticleListParams } from '../../types/articles';
import type { ApiError } from '../../lib/apiError';
export const articleDetailOptions = (id: number) =>
  queryOptions<
    Awaited<ReturnType<typeof getArticle>>,
    ApiError,
    Awaited<ReturnType<typeof getArticle>>,
    ReturnType<typeof articleKeys.detail>
  >({
    queryKey: articleKeys.detail(id),
    queryFn: ({ signal }) => getArticle(id, signal),
    staleTime: 60_000,
  });
export const useArticleDetailQuery = (id: number) => useQuery(articleDetailOptions(id));
export const useArticleListQuery = (p: ArticleListParams) =>
  useQuery<Awaited<ReturnType<typeof getArticles>>, ApiError>({
    queryKey: articleKeys.list(p),
    queryFn: ({ signal }) => getArticles(p, signal),
  });
