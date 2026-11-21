import { it, expect } from 'vitest';
import { getArticleListReturnTo, createArticleListState } from './navigation';
it('preserves complete internal list addresses', () => {
  expect(getArticleListReturnTo({ from: '/admin/articles?page=3&keyword=react' })).toBe(
    '/admin/articles?page=3&keyword=react',
  );
  expect(createArticleListState({ pathname: '/admin/articles', search: '?page=2' })).toEqual({
    from: '/admin/articles?page=2',
  });
});
it.each([
  undefined,
  null,
  {},
  { from: 3 },
  { from: 'https://evil.example/admin/articles' },
  { from: '//evil.example/admin/articles' },
  { from: '/admin/articles/3/edit' },
  { from: '/\\evil.example/admin/articles' },
])('rejects unsafe return address %#', (state) =>
  expect(getArticleListReturnTo(state)).toBe('/admin/articles'),
);
