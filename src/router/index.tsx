import { createBrowserRouter, Navigate, Link, type RouteObject } from 'react-router-dom';
import ArticleEditPage from '../pages/articles/ArticleEditPage';
import ArticleCreatePage from '../pages/articles/ArticleCreatePage';
import ArticleDetailPage from '../pages/articles/ArticleDetailPage';
import ArticleListPage from '../pages/articles/ArticleListPage';
import App from '../App';
import AdminLayout from '../layouts/AdminLayout';
export const routes: RouteObject[] = [
  {
    element: <App />,
    children: [
      { path: '/', element: <Navigate to="/admin/articles" replace /> },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { path: 'articles/:id/edit', element: <ArticleEditPage /> },
          { path: 'articles/new', element: <ArticleCreatePage /> },
          { path: 'articles', element: <ArticleListPage /> },
          { path: 'articles/:id', element: <ArticleDetailPage /> },
        ],
      },
      {
        path: '*',
        element: (
          <main>
            <h1>页面不存在</h1>
            <Link to="/admin/articles">返回列表</Link>
          </main>
        ),
      },
    ],
  },
];
export function createAppRouter() {
  return createBrowserRouter(routes);
}
