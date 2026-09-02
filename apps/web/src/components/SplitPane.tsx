/**
 * Two panes with a draggable divider. The capture desk (slice 002) reads the contribution on the
 * left and writes questions on the right; how wide each side has to be depends on the person, so
 * the position is remembered per device.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cx } from './cx';

export interface SplitPaneProps {
  /** localStorage key; distinct per view so two split panes do not fight over one width. */
  storageKey: string;
  left: ReactNode;
  right: ReactNode;
  /** Width of the left pane in percent. */
  initial?: number;
  min?: number;
  max?: number;
  className?: string;
}

function load(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw === null ? Number.NaN : Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function SplitPane({
  storageKey,
  left,
  right,
  initial = 50,
  min = 25,
  max = 75,
  className,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [percent, setPercent] = useState(() => load(storageKey, initial));
  const [dragging, setDragging] = useState(false);

  const clamp = useCallback((value: number) => Math.min(max, Math.max(min, value)), [min, max]);

  const persist = useCallback(
    (value: number) => {
      try {
        localStorage.setItem(storageKey, String(value));
      } catch {
        /* ignore: the width then simply resets on the next start */
      }
    },
    [storageKey],
  );

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (event: PointerEvent): void => {
      const box = containerRef.current?.getBoundingClientRect();
      if (box === undefined || box.width === 0) return;
      setPercent(clamp(((event.clientX - box.left) / box.width) * 100));
    };
    const onUp = (): void => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, clamp]);

  useEffect(() => {
    if (!dragging) persist(percent);
  }, [dragging, percent, persist]);

  return (
    <div ref={containerRef} className={cx('flex min-h-0 w-full items-stretch', className)}>
      <div className="min-w-0" style={{ width: `${percent}%` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
        onPointerDown={() => setDragging(true)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') setPercent((p) => clamp(p - 2));
          if (event.key === 'ArrowRight') setPercent((p) => clamp(p + 2));
        }}
        className={cx(
          'relative mx-1 w-1 shrink-0 cursor-col-resize rounded-full transition-colors',
          dragging ? 'bg-accent-300' : 'bg-transparent hover:bg-line-strong',
        )}
      />
      <div className="min-w-0 flex-1">{right}</div>
    </div>
  );
}
