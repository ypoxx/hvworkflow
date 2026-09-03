/**
 * One row of the Wortmeldeliste: 36 px, one line, everything the chair needs to decide who speaks
 * next. Actions are rendered from `speaker._actions` only — what the actor may not do is absent,
 * never greyed out (design principle 9).
 */
import type { CSSProperties, KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRightLeft, Ban, Check, GripVertical, Mic, MicOff, Minus, PencilLine } from 'lucide-react';
import { Link } from 'react-router';
import type { Speaker } from '@hv/domain';
import { Badge, Button, cx } from '../../components';
import { useT } from '../../i18n';
import { KIND_ICON, STATE_TONE, speakerKindLabel, speakerStateLabel } from './labels';
import { SpeakingTimer } from './SpeakingTimer';

/** One grid for the head strip and every row, so the columns line up across all rounds. */
export const ROW_COLUMNS = '26px 46px minmax(0,1fr) 104px 92px 104px 78px 62px 100px';

export interface SpeakerRowActions {
  onCall: (speaker: Speaker) => void;
  onFinish: (speaker: Speaker) => void;
  onWithdraw: (speaker: Speaker) => void;
  onMove: (speaker: Speaker) => void;
}

/** Arrow keys walk the list; the row itself is the stop, its buttons follow with Tab. */
function onRowKeyDown(event: KeyboardEvent<HTMLLIElement>): void {
  if (event.target !== event.currentTarget) return;
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const sibling =
    event.key === 'ArrowDown'
      ? event.currentTarget.nextElementSibling
      : event.currentTarget.previousElementSibling;
  if (sibling instanceof HTMLElement) {
    event.preventDefault();
    sibling.focus();
  }
}

export function SpeakerRow({
  speaker,
  busy,
  actions,
}: {
  speaker: Speaker;
  busy: boolean;
  actions: SpeakerRowActions;
}) {
  const t = useT();
  const mayUpdate = speaker._actions.includes('speaker.update');
  const mayReorder = speaker._actions.includes('speaker.reorder');
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: speaker.id, disabled: !mayReorder });

  // The list only moves vertically; zeroing x keeps a dragged row inside its column grid.
  const style: CSSProperties = {
    gridTemplateColumns: ROW_COLUMNS,
    ...(transform !== null ? { transform: CSS.Translate.toString({ ...transform, x: 0 }) } : {}),
    ...(transition !== undefined ? { transition } : {}),
  };
  const speaking = speaker.status === 'speaking';
  const finished = speaker.status === 'finished';
  const withdrawn = speaker.status === 'withdrawn';
  const waiting = speaker.status === 'waiting';
  const KindIcon = KIND_ICON[speaker.kind];

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid="speaker-row"
      data-number={speaker.number}
      data-status={speaker.status}
      tabIndex={0}
      onKeyDown={onRowKeyDown}
      className={cx(
        'relative grid h-9 items-center gap-2 border-b border-line px-2 last:border-b-0',
        'transition-colors duration-100 hover:bg-ink-25 focus-visible:bg-ink-25',
        speaking && 'bg-accent-50 hover:bg-accent-50',
        isDragging && 'z-10 rounded-sm bg-surface shadow-[0_8px_24px_-10px_rgba(31,30,28,0.35)]',
        withdrawn && 'text-ink-400',
      )}
    >
      {speaking && (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-accent-500" />
      )}

      {mayReorder ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          data-testid="speaker-drag-handle"
          aria-label={t('speakers.drag.label', { number: speaker.number })}
          className={cx(
            'flex h-7 w-6 cursor-grab items-center justify-center rounded-sm text-ink-300',
            'transition-colors duration-100 hover:bg-ink-100 hover:text-ink-700',
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : (
        <span />
      )}

      <span
        className={cx(
          'text-right font-mono text-[13px] tabular-nums',
          waiting ? 'text-ink-900' : withdrawn ? 'text-ink-400' : 'text-ink-500',
        )}
      >
        {speaker.number}
      </span>

      <span className="flex min-w-0 items-baseline gap-2">
        <span
          className={cx(
            'truncate text-[13px] font-medium',
            withdrawn && 'text-ink-400 line-through',
            finished && 'text-ink-500',
            !withdrawn && !finished && 'text-ink-900',
          )}
        >
          {speaker.displayName}
        </span>
        {speaker.organisation !== undefined && (
          <span className="truncate text-2xs text-ink-500">{speaker.organisation}</span>
        )}
      </span>

      <span className="flex min-w-0 items-center gap-1 truncate text-2xs text-ink-600">
        <KindIcon size={14} strokeWidth={1.75} className="shrink-0 text-ink-400" aria-hidden="true" />
        <span className="truncate">{speakerKindLabel(t, speaker.kind)}</span>
      </span>

      <span className="text-right font-mono text-[13px] tabular-nums text-ink-600">
        {speaker.requestedMinutes === undefined
          ? '—'
          : t('speakers.minutes', { minutes: speaker.requestedMinutes })}
      </span>

      <span>
        {speaking ? (
          <Badge tone={STATE_TONE.speaking} dot>
            {speakerStateLabel(t, speaker.status)}
          </Badge>
        ) : finished ? (
          <Check
            size={14}
            strokeWidth={2}
            className="text-ink-500"
            role="img"
            aria-label={speakerStateLabel(t, speaker.status)}
          />
        ) : withdrawn ? (
          <Minus
            size={14}
            strokeWidth={2}
            className="text-ink-400"
            role="img"
            aria-label={speakerStateLabel(t, speaker.status)}
          />
        ) : (
          <span className="text-2xs text-ink-500">{speakerStateLabel(t, speaker.status)}</span>
        )}
      </span>

      <span className="text-right">
        {speaking ? (
          <SpeakingTimer
            startedAt={speaker.speakingStartedAt}
            requestedMinutes={speaker.requestedMinutes}
          />
        ) : (
          <span className="font-mono text-[13px] text-ink-300">—</span>
        )}
      </span>

      <span className="text-right font-mono text-[13px] tabular-nums text-ink-600">
        {speaker.questionCount > 0 ? (
          speaker.questionCount
        ) : (
          <span className="text-ink-300">0</span>
        )}
      </span>

      <span className="flex items-center justify-end gap-0.5">
        {(speaking || speaker.status === 'finished') && (
          <Link
            to={`/capture?speaker=${encodeURIComponent(speaker.id)}`}
            title={t('speakers.action.capture.title', { number: speaker.number })}
            aria-label={t('speakers.action.capture.title', { number: speaker.number })}
            className={cx(
              'flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-ink-500',
              'transition-colors duration-100 hover:bg-ink-100 hover:text-ink-900',
            )}
          >
            <PencilLine size={14} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        )}
        {mayUpdate && speaker.status === 'waiting' && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            disabled={busy}
            data-testid="speaker-call"
            title={t('speakers.action.call.title', { number: speaker.number })}
            aria-label={t('speakers.action.call.title', { number: speaker.number })}
            onClick={() => actions.onCall(speaker)}
            icon={<Mic size={14} strokeWidth={1.75} aria-hidden="true" />}
          />
        )}
        {mayUpdate && speaking && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            disabled={busy}
            data-testid="speaker-finish"
            title={t('speakers.action.finish.title', { number: speaker.number })}
            aria-label={t('speakers.action.finish.title', { number: speaker.number })}
            onClick={() => actions.onFinish(speaker)}
            icon={<MicOff size={14} strokeWidth={1.75} aria-hidden="true" />}
          />
        )}
        {mayUpdate && speaker.status === 'waiting' && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            disabled={busy}
            data-testid="speaker-move"
            title={t('speakers.action.move.title', { number: speaker.number })}
            aria-label={t('speakers.action.move.title', { number: speaker.number })}
            onClick={() => actions.onMove(speaker)}
            icon={<ArrowRightLeft size={14} strokeWidth={1.75} aria-hidden="true" />}
          />
        )}
        {mayUpdate && (speaker.status === 'waiting' || speaking) && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            disabled={busy}
            data-testid="speaker-withdraw"
            title={t('speakers.action.withdraw.title', { number: speaker.number })}
            aria-label={t('speakers.action.withdraw.title', { number: speaker.number })}
            onClick={() => actions.onWithdraw(speaker)}
            icon={<Ban size={14} strokeWidth={1.75} aria-hidden="true" />}
          />
        )}
      </span>
    </li>
  );
}
