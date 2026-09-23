import { useT } from '../../../../i18n';

export function Page() {
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
    </div>
  );
}
