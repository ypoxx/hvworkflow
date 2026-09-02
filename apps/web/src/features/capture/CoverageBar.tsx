/**
 * Restabdeckung: how much of the Redebeitrag is already covered by Einzelfragen. Legal has to be
 * able to say at any moment that nothing was overlooked, so this figure is the honest measure of
 * the desk's work — one bar, one number, no decoration.
 */
import type { Contribution } from '@hv/domain';
import { useT } from '../../i18n';

export function CoverageBar({ contribution }: { contribution: Contribution }) {
  const t = useT();
  const total = contribution.text.length;
  const ratio = Math.min(1, Math.max(0, contribution.coverage.coveredRatio));
  const percent = Math.round(ratio * 100);
  const covered = Math.round(ratio * total);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="hv-label">{t('capture.coverage.label')}</span>
        <span
          data-testid="capture-coverage"
          className="font-mono text-[13px] font-medium tabular-nums text-ink-900"
        >
          {t('capture.coverage.value', { percent })}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t('capture.coverage.label')}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-150"
      >
        <div
          className="h-full rounded-full bg-accent-500 transition-[width] duration-100"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-2xs text-ink-500">{t('capture.coverage.hint', { covered, total })}</p>
    </div>
  );
}
