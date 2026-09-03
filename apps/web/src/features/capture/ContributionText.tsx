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
import type { Contribution, Question, QuestionCapture } from '@hv/domain';
import { Button, Kbd, cx } from '../../components';
import { useT } from '../../i18n';
import type { Marker } from './sentences';
import { markedSegmentsOf } from './sentences';

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
  questions,
  hoveredQuestionId,
  onHoverQuestion,
}: {
  contribution: Contribution;
  canCapture: boolean;
  onCapture: (questions: QuestionCapture[]) => void;
  /** In card order: a marker's number is this Einzelfrage's 1-based position in that list. */
  questions: readonly Question[];
  hoveredQuestionId: string | null;
  onHoverQuestion: (id: string | null) => void;
}) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  // Read by the Alt+Q handler, which is registered once and runs outside the render pass.
  const pendingRef = useRef<PendingSelection | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const markers = useMemo<Marker[]>(
    () =>
      questions.flatMap((question, index) =>
        question.span !== undefined
          ? [{ id: question.id, number: index + 1, start: question.span.start, end: question.span.end }]
          : [],
      ),
    [questions],
  );
  const segments = useMemo(
    () => markedSegmentsOf(contribution.text.length, markers),
    [contribution.text.length, markers],
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
        {segments.map((segment) => {
          const marker = segment.marker;
          if (marker === undefined) {
            return (
              <span key={segment.start} data-offset={segment.start}>
                {contribution.text.slice(segment.start, segment.end)}
              </span>
            );
          }
          const hovered = hoveredQuestionId === marker.id;
          return (
            <span
              key={segment.start}
              data-offset={segment.start}
              data-question-id={marker.id}
              title={t('capture.covered.title')}
              onMouseEnter={() => onHoverQuestion(marker.id)}
              onMouseLeave={() => onHoverQuestion(null)}
              className={cx(
                'rounded-[3px] box-decoration-clone px-0.5 text-ink-900 transition-colors duration-100',
                hovered ? 'bg-accent-200' : 'bg-accent-100',
              )}
            >
              <sup
                aria-hidden="true"
                data-testid={`capture-marker-${marker.number}`}
                className={cx(
                  'mr-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full',
                  'border border-accent-300 bg-accent-100 align-middle font-mono text-[10px]',
                  'leading-none font-medium text-accent-700 no-underline',
                )}
              >
                {marker.number}
              </sup>
              {contribution.text.slice(segment.start, segment.end)}
            </span>
          );
        })}
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
            <Kbd>{t('capture.key.alt')}</Kbd>
            <Kbd>{t('capture.key.q')}</Kbd>
          </span>
        </div>
      )}
    </>
  );
}
