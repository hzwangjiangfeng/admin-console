import { it, expect } from 'vitest';
import { normalizeArticleParams, parseArticleId, serializeArticleParams } from './listParams';
const defaults = { page: 1, pageSize: 10, keyword: '', channelId: null, sortBy: 'createdAt', sortOrder: 'desc' };
it.each(['', '-1', '0', 'abc', '1.5', '12abc', '9007199254740992', '1e2'])('rejects malformed pagination %s', value => {
  expect(normalizeArticleParams(new URLSearchParams({ page: value, pageSize: value }))).toEqual(defaults);
});
it('normalizes valid filters and ignores unknown arguments', () => {
  expect(normalizeArticleParams(new URLSearchParams('page=2&pageSize=20&keyword=%20react%20&channelId=3&sortOrder=asc&unused=1'))).toEqual({ ...defaults, page: 2, pageSize: 20, keyword: 'react', channelId: 3, sortOrder: 'asc' });
  expect(normalizeArticleParams(new URLSearchParams('channelId=99&sortBy=bad&sortOrder=bad'))).toEqual(defaults);
});
it.each(['0', '-1', '12abc', '1.5', 'Infinity', '9007199254740992', '//3'])('rejects invalid ID %s', value => expect(parseArticleId(value)).toBeNull());
it('accepts safe decimal IDs and omits empty filters when serializing', () => {
  expect(parseArticleId('3')).toBe(3);
  expect(serializeArticleParams({ ...defaults, sortBy: 'createdAt', sortOrder: 'desc' }).has('channelId')).toBe(false);
  expect(serializeArticleParams({ ...defaults, sortBy: 'createdAt', sortOrder: 'desc' }).has('keyword')).toBe(false);
});
it.each(['asc','desc'] as const)('preserves updatedAt sorting and serializes %s consistently',order=>{
 const actual=normalizeArticleParams(new URLSearchParams(`sortBy=updatedAt&sortOrder=${order}`));
 expect(actual).toEqual({...defaults,sortBy:'updatedAt',sortOrder:order});
 const serialized=serializeArticleParams(actual);
 expect(serialized.get('sortBy')).toBe('updatedAt');
 expect(normalizeArticleParams(serialized)).toEqual(actual);
});
it('does not accept the misspelled updateAt sort field',()=>expect(normalizeArticleParams(new URLSearchParams('sortBy=updateAt')).sortBy).toBe('createdAt'));
