import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createArticle, updateArticle, deleteArticle } from '../../api/articles.api';
import type { Article, CreateArticleInput, UpdateArticleInput } from '../../types/articles';
import type { ApiError } from '../../lib/apiError';
import { articleKeys } from './articleKeys';
export function useCreateArticleMutation() {
 const client = useQueryClient();
 return useMutation<Article, ApiError, CreateArticleInput>({ mutationFn: createArticle, onSuccess: () => { void client.invalidateQueries({queryKey: articleKeys.lists()}).catch(() => {}); } });
}
export function useUpdateArticleMutation() {
 const client = useQueryClient();
 return useMutation<Article, ApiError, {id: number; input: UpdateArticleInput}>({ mutationFn: v => updateArticle(v.id, v.input), onSuccess: (_, v) => { void client.invalidateQueries({queryKey: articleKeys.lists()}).catch(() => {}); void client.invalidateQueries({queryKey: articleKeys.detail(v.id), exact: true}).catch(() => {}); } });
}
export function useDeleteArticleMutation() {
 const client = useQueryClient();
 return useMutation<void, ApiError, number>({ mutationFn: deleteArticle, onSuccess: (_, id) => { client.removeQueries({queryKey: articleKeys.detail(id), exact: true}); void client.invalidateQueries({queryKey: articleKeys.lists()}).catch(() => {}); } });
}
