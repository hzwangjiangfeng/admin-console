export function getArticleListReturnTo(state: unknown): string {
  const fallback = '/admin/articles';
  if (!state || typeof state !== 'object' || !('from' in state) || typeof state.from !== 'string')
    return fallback;
  const from = state.from;
  if (!from.startsWith('/') || from.startsWith('//') || from.includes('\\')) return fallback;
  try {
    const url = new URL(from, 'https://local.invalid');
    return url.origin === 'https://local.invalid' && url.pathname === fallback
      ? url.pathname + url.search
      : fallback;
  } catch {
    return fallback;
  }
}
export function createArticleListState(location: { pathname: string; search: string }) {
  return { from: getArticleListReturnTo({ from: location.pathname + location.search }) };
}
