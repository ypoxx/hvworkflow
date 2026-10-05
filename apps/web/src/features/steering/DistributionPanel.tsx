/**
 * Scheibe 053 (decision 3): the distribution (Verteilung) above the work list — where the open questions lie. Two
 * narrow strips, no chart, no cross table: open per answering unit and on the podium per seat, both totals from the
 * service (`Meeting.counts`), never a figure per person (040b). A unit cell is a button that filters the list to that
 * unit; "Ohne Fachbereich" and the seats are plain cells, because the list has no such filter and 053 builds none.
 */
import { useId } from 'react';
import type { ReactNode } from 'react';
import type { Meeting, StageSeat, Unit } from '@hv/domain';
import { cx } from '../../components';
import { useT } from '../../i18n';
import { noUnitCount, seatCells, unitCells } from './distribution';

/** The seat list as the page holds it (`listMeetingStageSeats`). */
export interface SeatRead {
  status: 'loading' | 'ready' | 'failed';
  seats: readonly StageSeat[];
}

const CELL = 'inline-flex h-8 shrink-0 items-center gap-2 rounded-md border px-2.5 text-2xs';

/**
 * The number of a cell: mono, right-aligned (D5). A zero steps back in grey 600, without a coloured area (D4); decided
 * 05.10.2026 (053 addendum to D4, takt-048): grey 300 measured 1.68:1, grey 600 holds 6.26:1 on the cell and 5.63:1 on
 * the active cell (WCAG 1.4.3), grey 500 would fail (3.54:1 active).
 */
function Count({ value }: { value: number }) {
  return (
    <span className={cx('min-w-5 text-right font-mono tabular-nums', value === 0 ? 'text-ink-600' : 'text-ink-900')}>{value}</span>
  );
}

function Strip({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  const labelId = useId();
  const helpId = useId();
  return (
    <div className="grid grid-cols-[13rem_1fr] items-start gap-4">
      <div className="min-w-0 pt-1">
        <p id={labelId} className="text-[13px] font-medium text-ink-900">
          {label}
        </p>
        <p id={helpId} className="mt-0.5 text-2xs leading-4 text-ink-600">
          {help}
        </p>
      </div>
      <div role="group" aria-labelledby={labelId} aria-describedby={helpId} className="flex min-h-8 flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}

function Failed() {
  const t = useT();
  return (
    <p role="status" data-testid="steering-distribution-failed" className="flex h-8 items-center text-[13px] text-ink-600">
      {t('steering.distribution.failed')}
    </p>
  );
}

export function DistributionPanel({
  meeting,
  units,
  seats,
  activeUnitId,
  onUnit,
}: {
  meeting: Meeting | null;
  units: readonly Unit[];
  seats: SeatRead;
  /** The unit filter of the work list (`'all'` when none), so the matching cell says it is pressed. */
  activeUnitId: string;
  onUnit: (unitId: string) => void;
}) {
  const t = useT();
  const titleId = useId();

  let body: ReactNode;
  if (meeting === null || seats.status === 'loading') {
    // Principle 8: a line of the strips' height in their place, so nothing jumps when the numbers arrive.
    body = (
      <p data-testid="steering-distribution-loading" className="flex min-h-[4.5rem] items-center text-[13px] text-ink-600">
        {t('steering.distribution.loading')}
      </p>
    );
  } else if (units.length === 0 && seats.status === 'ready' && seats.seats.length === 0) {
    body = (
      <p data-testid="steering-distribution-empty" className="flex min-h-8 items-center text-[13px] text-ink-600">
        {t('steering.distribution.empty')}
      </p>
    );
  } else {
    const unitRow = unitCells(meeting.counts, units);
    const without = noUnitCount(meeting.counts);
    const seatRow = seats.status === 'ready' ? seatCells(meeting.counts, seats.seats) : undefined;
    body = (
      <div className="space-y-3">
        <Strip label={t('steering.distribution.units')} help={t('steering.distribution.unitsHelp')}>
          {unitRow === undefined || without === undefined ? (
            <Failed />
          ) : (
            <>
              {unitRow.map((cell) => {
                const active = activeUnitId === cell.unitId;
                return (
                  <button
                    key={cell.unitId}
                    type="button"
                    data-testid="steering-unit-cell"
                    data-unit={cell.unitId}
                    data-count={cell.count}
                    aria-pressed={active}
                    aria-label={t('steering.distribution.filter', { unit: cell.name, count: cell.count })}
                    onClick={() => onUnit(cell.unitId)}
                    className={cx(
                      CELL,
                      'transition-colors duration-100',
                      active
                        ? 'border-accent-600 bg-accent-50 text-accent-700'
                        : 'border-line bg-surface text-ink-700 hover:border-ink-300 hover:bg-ink-50',
                    )}
                  >
                    <span className="max-w-32 truncate">{cell.name}</span>
                    <Count value={cell.count} />
                  </button>
                );
              })}
              <div data-testid="steering-unit-none" data-count={without} className={cx(CELL, 'border-dashed border-line text-ink-600')}>
                <span>{t('steering.distribution.noUnit')}</span>
                <Count value={without} />
              </div>
            </>
          )}
        </Strip>
        <Strip label={t('steering.distribution.seats')} help={t('steering.distribution.seatsHelp')}>
          {seatRow === undefined ? (
            <Failed />
          ) : (
            seatRow.map((cell) => (
              <div
                key={cell.seatId}
                data-testid="steering-seat-cell"
                data-seat={cell.seatId}
                data-count={cell.count}
                className={cx(CELL, 'border-line bg-surface text-ink-700')}
              >
                <span className={cx('max-w-40 truncate', !cell.labelled && 'font-mono')}>{cell.label}</span>
                <Count value={cell.count} />
              </div>
            ))
          )}
        </Strip>
      </div>
    );
  }

  return (
    <section
      aria-labelledby={titleId}
      data-testid="steering-distribution"
      className="shrink-0 rounded-lg border border-line bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(31,30,28,0.04)]"
    >
      <h2 id={titleId} className="hv-label mb-2">
        {t('steering.distribution.title')}
      </h2>
      {body}
    </section>
  );
}
