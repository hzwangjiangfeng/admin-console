import { ConfigProvider } from 'antd';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, type InitialEntry } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import type { QueryClient } from '@tanstack/react-query';
import { AppProviders } from '../app/AppProviders';
import { createAppQueryClient } from '../lib/queryClient';
import { routes } from '../router';
export function renderApp(
  entry: string,
  options: { client?: QueryClient; entries?: InitialEntry[]; initialIndex?: number } = {},
) {
  const queryClient =
    options.client ??
    createAppQueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  const router = createMemoryRouter(routes, {
    initialEntries: options.entries ?? [entry],
    initialIndex: options.initialIndex,
  });
  const result = render(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <AppProviders queryClient={queryClient}>
        <RouterProvider router={router} />
      </AppProviders>
    </ConfigProvider>,
  );
  return { ...result, user: userEvent.setup(), router, queryClient };
}
