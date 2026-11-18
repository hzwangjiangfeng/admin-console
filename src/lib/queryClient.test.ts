import { it, expect } from 'vitest';
import { createAppQueryClient } from './queryClient';
it('applies the agreed cache policy without turning off automatic refresh', () => {
  const options = createAppQueryClient().getDefaultOptions().queries;
  expect(options?.staleTime).toBe(60_000);
  expect(options?.gcTime).toBe(300_000);
  expect(options?.refetchInterval).toBeUndefined();
  expect(options?.refetchOnWindowFocus).not.toBe(false);
});
