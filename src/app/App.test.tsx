import { it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp } from '../test/renderApp';
it('renders the article list inside accessible admin navigation', async () => {
  renderApp('/admin/articles');
  expect(await screen.findByRole('heading', { name: '文章列表' })).toBeVisible();
  expect(screen.getByRole('navigation', { name: '后台导航' })).toBeVisible();
});
it('redirects the root to the list', async () => {
  const { router } = renderApp('/');
  await screen.findByRole('heading', { name: '文章列表' });
  expect(router.state.location.pathname).toBe('/admin/articles');
});
it('offers a list link for unknown pages', async () => {
  renderApp('/missing');
  expect(await screen.findByText('页面不存在')).toBeVisible();
  expect(screen.getByRole('link', { name: '返回列表' })).toHaveAttribute('href', '/admin/articles');
});
