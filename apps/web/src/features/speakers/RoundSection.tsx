/**
 * One round (Runde) of the Wortmeldeliste. The round with the microphone is open, the others are
 * collapsed to a single line with their counts — the list has 118 entries and only one round is
 * being worked on at a time.
 */
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Speaker } from '@hv/domain';
import { Badge, Panel, ProgressBar, cx } from '../../components';
import { useT } from '../../i18n';
import { ROW_COLUMNS, SpeakerRow } from './SpeakerRow';
import type { SpeakerRowActions } from './SpeakerRow';

/**
 * The column head. Decorative: every row carries its own labels through aria-label and badge text,
 * so the strip is hidden from assistive technology instead of pretending to be a table header.
 */
function HeadStrip() {
  const t = useT();
  return (
    <div
      aria-hidden="true"
      className="grid items-center gap-2 border-b border-line bg-sunken px-2 py-1.5"
      style={{ gridTemplateColumns: ROW_COLUMNS }}
    >
      <span />
      <span className="hv-label truncate text-right">{t('speakers.column.number')}</span>
      <span className="hv-label truncate">{t('speakers.column.name')}</span>
      <span className="hv-label truncate">{t('speakers.column.kind')}</span>
      <span className="hv-label truncate text-right">{t('speakers.column.minutes')}</span>
      <span className="hv-label truncate">{t('speakers.column.status')}</span>
      <span className="hv-label truncate text-right">{t('speakers.column.elapsed')}</span>
      <span className="hv-label truncate text-right">{t('speakers.column.questions')}</span>
      <span className="hv-label truncate text-right">{t('speakers.column.actions')}</span>
    </div>
  );
}

export function RoundSection({
  round,
  speakers,
  open,
  current,
  busyId,
  onToggle,
  actions,
}: {
  round: number;
  speakers: readonly Speaker[];
  open: boolean;
  current: boolean;
  busyId: string | null;
  onToggle: () => void;
  actions: SpeakerRowActions;
}) {
  const t = useT();
  const waiting = speakers.filter((s) => s.status === 'waiting').length;
  const finished = speakers.filter((s) => s.status === 'finished').length;

  return (
    <section data-testid={`speakers-round-${round}`}>
      <Panel
        padded={false}
        className={cx('shrink-0', current && 'border-line-strong')}
        title={
          <div className="-my-1 flex w-full items-center gap-2 py-1">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={
                open
                  ? t('speakers.round.collapse', { round })
                  : t('speakers.round.expand', { round })
              }
              className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left"
            >
              {open ? (
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  className="shrink-0 text-ink-400"
                  aria-hidden="true"
                />
              ) : (
                <ChevronRight
                  size={14}
                  strokeWidth={2}
                  className="shrink-0 text-ink-400"
                  aria-hidden="true"
                />
              )}
              <span className="shrink-0 text-[13px] font-semibold text-ink-900">
                {t('header.round', { round })}
              </span>
              {current && <Badge tone="accent">{t('speakers.round.current')}</Badge>}
              <span className="shrink-0 text-2xs text-ink-500">
                {t('speakers.round.count', { count: speakers.length })}
              </span>
              {waiting > 0 && (
                <span className="shrink-0 text-2xs text-ink-500">
                  · {t('speakers.state.waiting')} <span className="font-mono">{waiting}</span>
                </span>
              )}
            </button>
            <span
              data-testid={`round-progress-${round}`}
              className="flex shrink-0 items-center gap-2"
            >
              {/*
               * `ProgressBar` already carries its own `w-full`; a width utility handed in through
               * `className` would collide with it (equal specificity, undefined winner — it rendered
               * at 0 px in practice), so the width is fixed on this wrapper instead and the bar just
               * fills it.
               */}
              <span className="w-20 shrink-0">
                <ProgressBar
                  value={finished}
                  max={speakers.length}
                  tone="accent"
                  label={t('speakers.round.progress.label', { round })}
                />
              </span>
              <span className="whitespace-nowrap font-mono text-2xs tabular-nums text-ink-500">
                {t('speakers.round.progress', { finished, total: speakers.length })}
              </span>
            </span>
          </div>
        }
      >
        {open &&
          (speakers.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-500">
              {t('speakers.round.empty')}
            </p>
          ) : (
            <>
              <HeadStrip />
              <SortableContext
                items={speakers.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul aria-label={t('speakers.list.label', { round })}>
                  {speakers.map((speaker) => (
                    <SpeakerRow
                      key={speaker.id}
                      speaker={speaker}
                      busy={busyId === speaker.id}
                      actions={actions}
                    />
                  ))}
                </ul>
              </SortableContext>
            </>
          ))}
      </Panel>
    </section>
  );
}
