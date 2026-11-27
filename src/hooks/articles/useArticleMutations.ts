import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createArticle, updateArticle, deleteArticle } from '../../api/articles.api';
import type { Article, CreateArticleInput, UpdateArticleInput } from '../../types/articles';
import type { ApiError } from '../../lib/apiError';
import { articleKeys } from './articleKeys';
export function useCreateArticleMutation() {
  const client = useQueryClient();
  return useMutation<Article, ApiError, CreateArticleInput>({
    mutationFn: createArticle,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: articleKeys.lists() }).catch(() => {});
    },
  });
}
export function useUpdateArticleMutation() {
  const client = useQueryClient();
  return useMutation<Article, ApiError, { id: number; input: UpdateArticleInput }>({
    mutationFn: (v) => updateArticle(v.id, v.input),
    onSuccess: (_, v) => {
      void client.invalidateQueries({ queryKey: articleKeys.lists() }).catch(() => {});
      void client
        .invalidateQueries({ queryKey: articleKeys.detail(v.id), exact: true })
        .catch(() => {});
    },
  });
}
export function useDeleteArticleMutation() {
  const client = useQueryClient();
  return useMutation<void, ApiError, number>({
    mutationFn: deleteArticle,
    onSuccess: (_, id) => {
      client.removeQueries({ queryKey: articleKeys.detail(id), exact: true });
      void client.invalidateQueries({ queryKey: articleKeys.lists() }).catch(() => {});
    },
  });
}

export function useDeleteArticlesMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const deletedIds: number[] = [];
      const failedIds: number[] = [];
      for (const id of ids) {
        try {
          await deleteArticle(id);
          deletedIds.push(id);
        } catch {
          failedIds.push(id);
        }
      }
      return { deletedIds, failedIds };
    },
    onSuccess: ({ deletedIds }) => {
      for (const id of deletedIds)
        client.removeQueries({ queryKey: articleKeys.detail(id), exact: true });
      void client.invalidateQueries({ queryKey: articleKeys.lists() }).catch(() => {});
    },
  });
}

export function useUpdateArticlesStatusMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: number[]; status: 'published' | 'archived' }) => {
      const updatedIds: number[] = [];
      const failedIds: number[] = [];
      for (const id of ids) {
        try {
          await updateArticle(id, { status });
          updatedIds.push(id);
        } catch {
          failedIds.push(id);
        }
      }
      return { updatedIds, failedIds };
    },
    onSuccess: ({ updatedIds }) => {
      for (const id of updatedIds) {
        void client
          .invalidateQueries({ queryKey: articleKeys.detail(id), exact: true })
          .catch(() => {});
      }
      void client.invalidateQueries({ queryKey: articleKeys.lists() }).catch(() => {});
    },
  });
}
