import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import App from '../App';
import AdminLayout from '../layouts/AdminLayout';

function RedirectToArticleList() {
  return <Navigate to="/admin/articles" replace />;
}

export const routes: RouteObject[] = [
  {
    Component: App,
    children: [
      { path: '/', Component: RedirectToArticleList },
      {
        path: '/admin',
        Component: AdminLayout,
        children: [
          {
            path: 'articles/:id/edit',
            lazy: async () => ({
              Component: (await import('../pages/articles/ArticleEditPage')).default,
            }),
          },
          {
            path: 'articles/new',
            lazy: async () => ({
              Component: (await import('../pages/articles/ArticleCreatePage')).default,
            }),
          },
          {
            path: 'articles',
            lazy: async () => ({
              Component: (await import('../pages/articles/ArticleListPage')).default,
            }),
          },
          {
            path: 'articles/:id',
            lazy: async () => ({
              Component: (await import('../pages/articles/ArticleDetailPage')).default,
            }),
          },
        ],
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('../pages/NotFoundPage')).default }),
      },
    ],
  },
];
export function createAppRouter() {
  return createBrowserRouter(routes);
}
