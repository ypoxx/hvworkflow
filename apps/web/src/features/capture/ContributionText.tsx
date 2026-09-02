/**
 * The Redebeitrag, read-only, with the captured passages tinted. Atomisation happens here: mark a
 * passage, take it as an Einzelfrage — with the mouse through the floating action, with the
 * keyboard through `Alt+Q` (design principle 7).
 *
 * The offsets are the point of the whole screen: an Einzelfrage carries the exact character range
 * it was taken from, which is what makes the Restabdeckung provable. Each segment therefore knows
 * its own start offset (`data-offset`), and the DOM selection is translated back into it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Highlighter } from 'lucide-react';
import type { Contribution, QuestionCapture } from '@hv/domain';
import { Button, Kbd, cx } from '../../components';
import { useT } from '../../i18n';
import { segmentsOf } from './sentences';

interface PendingSelection {
  text: string;
  start: number;
  end: number;
  /** Viewport position of the marked passage; the floating action follows it. */
  x: number;
  y: number;
  below: boolean;
}

/** Shorter marks are slips of the hand, not a question. */
const MIN_SELECTION = 4;

/** Character offset of a DOM position inside the contribution text, or null if it sits outside. */
function offsetOf(container: HTMLElement, node: Node, offset: number): number | null {
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  const holder = element?.closest<HTMLElement>('[data-offset]');
  if (holder === null || holder === undefined || !container.contains(holder)) return null;
  const base = Number(holder.dataset['offset']);
  if (!Number.isFinite(base)) return null;
  return node.nodeType === Node.TEXT_NODE ? base + offset : base;
}

export function ContributionText({
  contribution,
  canCapture,
  onCapture,
}: {
  contribution: Contribution;
  canCapture: boolean;
  onCapture: (questions: QuestionCapture[]) => void;
}) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  // Read by the Alt+Q handler, which is registered once and runs outside the render pass.
  const pendingRef = useRef<PendingSelection | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const segments = useMemo(
    () => segmentsOf(contribution.text.length, contribution.coverage.uncovered),
    [contribution.text.length, contribution.coverage.uncovered],
  );

  const capture = useCallback(
    (selection: PendingSelection) => {
      onCapture([{ text: selection.text, span: { start: selection.start, end: selection.end } }]);
      window.getSelection()?.removeAllRanges();
      setPending(null);
    },
    [onCapture],
  );

  useEffect(() => {
    if (!canCapture) return undefined;
    const text = contribution.text;

    const onSelectionChange = (): void => {
      const container = containerRef.current;
      const selection = window.getSelection();
      if (
        container === null ||
        selection === null ||
        selection.rangeCount === 0 ||
        selection.isCollapsed
      ) {
        setPending(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        setPending(null);
        return;
      }
      const rawStart = offsetOf(container, range.startContainer, range.startOffset);
      const rawEnd = offsetOf(container, range.endContainer, range.endOffset);
      if (rawStart === null || rawEnd === null || rawEnd <= rawStart) {
        setPending(null);
        return;
      }
      // Trim on both sides so that wording and span stay exactly congruent.
      const raw = text.slice(rawStart, rawEnd);
      const start = rawStart + (raw.length - raw.trimStart().length);
      const end = rawEnd - (raw.length - raw.trimEnd().length);
      if (end - start < MIN_SELECTION) {
        setPending(null);
        return;
      }
      const box = range.getBoundingClientRect();
      const below = box.top < 96;
      setPending({
        text: text.slice(start, end),
        start,
        end,
        x: Math.min(Math.max(box.left + box.width / 2, 180), window.innerWidth - 180),
        y: below ? box.bottom + 8 : box.top - 8,
        below,
      });
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [canCapture, contribution.text]);

  useEffect(() => {
    if (!canCapture) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code !== 'KeyQ' && event.key.toLowerCase() !== 'q') return;
      const selection = pendingRef.current;
      if (selection === null) return;
      event.preventDefault();
      capture(selection);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canCapture, capture]);

  return (
    <>
      <div
        ref={containerRef}
        data-testid="capture-contribution-text"
        className="text-[13px] leading-6 text-ink-800 selection:bg-accent-100"
      >
        {segments.map((segment) => (
          <span
            key={segment.start}
            data-offset={segment.start}
            className={cx(
              segment.covered &&
                'rounded-[3px] bg-accent-50 box-decoration-clone px-0.5 text-ink-900 shadow-[inset_0_-1px_0_var(--color-accent-200)]',
            )}
            {...(segment.covered ? { title: t('capture.covered.title') } : {})}
          >
            {contribution.text.slice(segment.start, segment.end)}
          </span>
        ))}
      </div>

      {pending !== null && (
        <div
          className={cx(
            'fixed z-50 flex items-center gap-2 rounded-md border border-line bg-surface p-1 pr-2',
            'shadow-[0_12px_32px_-10px_rgba(31,30,28,0.35)]',
          )}
          style={{
            left: pending.x,
            top: pending.y,
            transform: pending.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
          }}
        >
          <Button
            variant="primary"
            size="sm"
            data-testid="capture-add-selection"
            // Keep the marked passage alive: a plain mousedown would collapse the selection.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => capture(pending)}
            icon={<Highlighter size={14} strokeWidth={1.75} aria-hidden="true" />}
          >
            {t('capture.selection.add')}
          </Button>
          <span className="flex items-center gap-1">
            <Kbd>Alt</Kbd>
            <Kbd>Q</Kbd>
          </span>
        </div>
      )}
    </>
  );
}
