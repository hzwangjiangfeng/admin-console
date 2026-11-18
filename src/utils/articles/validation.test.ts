import { it, expect } from 'vitest';
import { validateArticleInput } from './validation';
const valid = { title: '标题', channelId: 1, content: '正文' };
it('trims titles but preserves body whitespace', () => {
  expect(
    validateArticleInput({ ...valid, title: ' 标题 ', content: '第一行\n第二行 ' }, 'create'),
  ).toEqual({ ok: true, values: { ...valid, content: '第一行\n第二行 ' } });
});
it.each([
  [100, true],
  [101, false],
])('checks title length %i', (length, ok) =>
  expect(validateArticleInput({ ...valid, title: 'a'.repeat(length as number) }, 'create').ok).toBe(
    ok,
  ),
);
it.each([
  [20000, true],
  [20001, false],
])('checks body length %i', (length, ok) =>
  expect(
    validateArticleInput({ ...valid, content: 'a'.repeat(length as number) }, 'create').ok,
  ).toBe(ok),
);
it.each([
  null,
  [],
  {},
  { ...valid, title: ' ' },
  { ...valid, channelId: 99 },
  { ...valid, content: '\n ' },
  { ...valid, id: 1 },
])('rejects malformed create %#', (value) =>
  expect(validateArticleInput(value, 'create').ok).toBe(false),
);
it('requires a writable patch and preserves omitted fields', () => {
  expect(validateArticleInput({ title: ' 新标题 ' }, 'update')).toEqual({
    ok: true,
    values: { title: '新标题' },
  });
  for (const value of [{}, { title: null }, { createdAt: 'x' }, { updatedAt: 'x' }, { wrong: 1 }])
    expect(validateArticleInput(value, 'update').ok).toBe(false);
});
