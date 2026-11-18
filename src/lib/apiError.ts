import axios from 'axios';
import type { FieldErrors } from '../types/articles';
export class ApiError extends Error {
  constructor(message: string, public status: number | null = null, public code = 'NETWORK_ERROR', public fieldErrors?: FieldErrors) { super(message); this.name = 'ApiError'; }
}
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data;
    const body = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    return new ApiError(typeof body.message === 'string' ? body.message : error.response ? '请求失败，请稍后重试' : '网络连接失败，请检查网络后重试', error.response?.status ?? null, typeof body.code === 'string' ? body.code : error.response ? 'REQUEST_ERROR' : 'NETWORK_ERROR', body.fieldErrors && typeof body.fieldErrors === 'object' ? body.fieldErrors as FieldErrors : undefined);
  }
  return new ApiError('请求失败，请稍后重试', null, 'UNKNOWN_ERROR');
}
