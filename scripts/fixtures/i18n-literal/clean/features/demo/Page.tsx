import { useT } from '../../../../i18n';

export function Page({ total, results, checked }: { total: number; results: unknown[]; checked: boolean }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2" data-testid="demo-page">
      <span>{t('demo.role')}</span>
      <span>·</span>
      <span>12</span>
      <button title={t('demo.save')} aria-label={t('demo.save')}>
        {t('demo.save')}
      </button>
      <span>Wortmeldung</span> {/* i18n-ok: fixture text deliberately left as a literal for the test */}
      {/* round 1, M6: a comment that merely talks about tags in prose, e.g. no <div>/<p> inside a
       * <button> — must never be read as real JSX text or attributes once comments are masked. */}
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-md bg-ink-900 font-mono text-2xs font-medium text-white"
      >
        HV
      </span>
      {total > results.length && (
        <p className="shrink-0 border-t border-line bg-sunken px-4 py-1.5 text-2xs text-ink-500">
          {t('demo.more')}
        </p>
      )}
      {checked ? (
        <span>{t('demo.yes')}</span>
      ) : (
        <span className="text-ink-300">{t('demo.no')}</span>
      )}
    </div>
  );
}
