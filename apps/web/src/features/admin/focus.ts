/**
 * Scheibe 041 (takt-008): after a successful write the focus goes back to the button that started it — or, when that
 * row is gone, to the tab's primary action — once the new list is on screen. Only while the person is still in this tab
 * (or nowhere): a focus elsewhere is never taken away (6.9).
 */
import { useCallback, useEffect, useRef } from 'react';

export const PRIMARY_FOCUS_KEY = 'primary';

export function usePendingFocus(listVersion: unknown) {
  const container = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);

  useEffect(() => {
    const key = pending.current;
    const root = container.current;
    if (key === null || root === null) return;
    const active = document.activeElement;
    // A dialog still closing holds the focus for a moment; the next list answer settles it.
    if (active?.closest('[role="dialog"]')) return;
    if (active !== null && active !== document.body && !root.contains(active)) {
      pending.current = null;
      return;
    }
    const target =
      root.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(key)}"]`) ??
      root.querySelector<HTMLElement>(`[data-focus-key="${PRIMARY_FOCUS_KEY}"]`);
    if (target === null) return;
    pending.current = null;
    target.focus();
  }, [listVersion]);

  const arm = useCallback((key: string) => {
    pending.current = key;
  }, []);

  return { container, arm };
}
