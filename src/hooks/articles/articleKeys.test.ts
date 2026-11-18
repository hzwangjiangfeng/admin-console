import { it, expect } from 'vitest';
import { articleKeys } from './articleKeys';
import { normalizeArticleParams } from '../../utils/articles/listParams';
it('shares canonical keys for equivalent URLs and separates list/detail namespaces', () => {
 const a = normalizeArticleParams(new URLSearchParams());
 const b = normalizeArticleParams(new URLSearchParams('page=1&pageSize=10&sortBy=createdAt&sortOrder=desc'));
 expect(articleKeys.list(a)).toEqual(['articles', 'list', a]);
 expect(articleKeys.list(a)).toEqual(articleKeys.list(b));
 expect(articleKeys.detail(3)).toEqual(['articles', 'detail', 3]);
 expect(articleKeys.lists()).toEqual(['articles', 'list']);
});
it('separates the two sort fields and directions in list caches',()=>{
 const created=articleKeys.list(normalizeArticleParams(new URLSearchParams('sortBy=createdAt&sortOrder=desc')));
 const updatedDesc=articleKeys.list(normalizeArticleParams(new URLSearchParams('sortBy=updatedAt&sortOrder=desc')));
 const updatedAsc=articleKeys.list(normalizeArticleParams(new URLSearchParams('sortBy=updatedAt&sortOrder=asc')));
 expect(created).not.toEqual(updatedDesc);expect(updatedAsc).not.toEqual(updatedDesc);
});
