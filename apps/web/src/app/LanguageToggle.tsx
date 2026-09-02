/** DE / EN as a segmented control. The house language is German; English is complete, not a fallback. */
import { cx } from '../components';
import { LANGS, setLang, useLang, useT } from '../i18n';
import type { Lang, TKey } from '../i18n';

const LABEL_KEYS: Readonly<Record<Lang, TKey>> = { de: 'lang.de', en: 'lang.en' };
const TITLE_KEYS: Readonly<Record<Lang, TKey>> = { de: 'lang.de.title', en: 'lang.en.title' };

export function LanguageToggle() {
  const t = useT();
  const lang = useLang();
  return (
    <div
      data-testid="lang-toggle"
      role="group"
      aria-label={t('lang.label')}
      className="flex h-9 items-center gap-0.5 rounded-md border border-line bg-sunken p-0.5"
    >
      {LANGS.map((candidate) => {
        const active = candidate === lang;
        return (
          <button
            key={candidate}
            type="button"
            data-testid={`lang-option-${candidate}`}
            aria-pressed={active}
            title={t(TITLE_KEYS[candidate])}
            onClick={() => setLang(candidate)}
            className={cx(
              'h-7 rounded-sm px-2 font-mono text-2xs font-medium transition-colors',
              active
                ? 'bg-surface text-ink-900 shadow-[0_1px_2px_rgba(31,30,28,0.12)]'
                : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {t(LABEL_KEYS[candidate])}
          </button>
        );
      })}
    </div>
  );
}
