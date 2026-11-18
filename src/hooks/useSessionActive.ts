import { useCallback, useEffect, useRef } from 'react';

/** Gate page-local effects after an async operation; never cancels the write itself. */
export function useSessionActive() {
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  return useCallback(() => active.current, []);
}
