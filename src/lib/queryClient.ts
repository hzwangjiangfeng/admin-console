import { ApiError } from './apiError';
import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';
export function createAppQueryClient(config: QueryClientConfig = {}) {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...config.defaultOptions,
      queries: {
        staleTime: 60_000,
        gcTime: 300_000,
        retry: (failureCount, error) =>
          !(
            error instanceof ApiError &&
            ['INVALID_RESPONSE', 'MOCK_NOT_INTERCEPTED'].includes(error.code)
          ) && failureCount < 3,
        ...config.defaultOptions?.queries,
      },
      mutations: { ...config.defaultOptions?.mutations },
    },
  });
}
