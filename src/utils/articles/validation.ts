import type { CreateArticleInput, UpdateArticleInput, FieldErrors } from '../../types/articles';
import { isChannelId } from '../../constants/channels';
export type ValidationResult<T> = { ok: true; values: T } | { ok: false; fieldErrors: FieldErrors; formError?: string };
export const ARTICLE_FIELD_LIMITS = { title: 100, content: 20000 };
export function validateArticleInput(value: unknown, mode: 'create'): ValidationResult<CreateArticleInput>;
export function validateArticleInput(value: unknown, mode: 'update'): ValidationResult<UpdateArticleInput>;
export function validateArticleInput(value: unknown, mode: 'create' | 'update'): ValidationResult<CreateArticleInput | UpdateArticleInput> {
  const fieldErrors: FieldErrors = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, fieldErrors, formError: '请求体必须是对象' };
  const input = value as Record<string, unknown>;
  const allowed = ['title', 'channelId', 'content'];
  if (Object.keys(input).some(key => !allowed.includes(key))) return { ok: false, fieldErrors, formError: '包含不可编辑的字段' };
  if (mode === 'update' && Object.keys(input).length === 0) return { ok: false, fieldErrors, formError: '至少提交一个可编辑字段' };
  const values: UpdateArticleInput = {};
  if (mode === 'create' || Object.hasOwn(input, 'title')) {
    if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > ARTICLE_FIELD_LIMITS.title) fieldErrors.title = ['标题需为 1–100 字符，且不能只有空白'];
    else values.title = input.title.trim();
  }
  if (mode === 'create' || Object.hasOwn(input, 'channelId')) {
    if (typeof input.channelId !== 'number' || !isChannelId(input.channelId)) fieldErrors.channelId = ['请选择有效频道'];
    else values.channelId = input.channelId;
  }
  if (mode === 'create' || Object.hasOwn(input, 'content')) {
    if (typeof input.content !== 'string' || !input.content.trim() || input.content.length > ARTICLE_FIELD_LIMITS.content) fieldErrors.content = ['正文需为 1–20,000 字符，且不能只有空白'];
    else values.content = input.content;
  }
  return Object.keys(fieldErrors).length ? { ok: false, fieldErrors } : { ok: true, values: values as CreateArticleInput | UpdateArticleInput };
}
