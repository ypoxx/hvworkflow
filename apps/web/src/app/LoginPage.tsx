import type { components } from '../../../../packages/contract/src/types';
import { LanguageToggle } from './LanguageToggle';
import { useT } from '../i18n';

type TransparencyNotice = components['schemas']['TransparencyNotice'];

export function safeReturnTo(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || value.length > 512 || /[\\\u0000-\u001f\u007f]/.test(value)) return '/';
  return value;
}

export function safeSummaryUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function LoginPage({
  notice,
  returnTo,
  onLogin,
  authError = false,
}: {
  notice: TransparencyNotice | null;
  returnTo: string;
  onLogin: () => void;
  authError?: boolean;
}) {
  const t = useT();
  const complete = Boolean(
    typeof notice?.version === 'string' && notice.version.trim() &&
    typeof notice?.text?.de === 'string' && notice.text.de.trim() &&
    typeof notice?.text?.en === 'string' && notice.text.en.trim(),
  );
  const summaryUrl = safeSummaryUrl(notice?.dataProtectionSummaryUrl);
  const loginUrl = `/auth/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;

  return (
    <main className="min-h-screen bg-canvas px-4 py-10 text-ink-900 sm:px-8" id="main">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <span className="font-semibold">{t('app.name')}</span>
          <LanguageToggle />
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-10">
          <h1 className="mb-3 text-2xl font-semibold">{t('login.title')}</h1>
          <p className="mb-6 text-ink-600">{t('login.intro')}</p>
          {authError && <p role="alert" className="mb-5 rounded-md bg-red-50 p-3 text-red-800">{t('login.sessionError')}</p>}
          {complete && notice ? (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold">{t('login.noticeTitle')}</h2>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">{t('login.noticeUnverified')}</span>
                <span className="text-sm text-ink-700">{t('login.noticeVersion', { version: notice.version })}</span>
              </div>
              <section aria-label={t('login.noticeDe')} className="mb-5">
                <h3 className="mb-2 font-medium" lang="de">{t('login.noticeDe')}</h3>
                <p className="whitespace-pre-wrap text-sm leading-6" lang="de">{notice.text.de}</p>
              </section>
              <section aria-label={t('login.noticeEn')} className="mb-6">
                <h3 className="mb-2 font-medium" lang="en-US">{t('login.noticeEn')}</h3>
                <p className="whitespace-pre-wrap text-sm leading-6" lang="en-US">{notice.text.en}</p>
              </section>
              {summaryUrl && (
                <p className="mb-6 text-sm">
                  <a className="text-accent-700 underline underline-offset-2" href={summaryUrl} target="_blank" rel="noopener noreferrer">
                    {t('login.dsfa')}
                  </a>
                </p>
              )}
              <a className="inline-flex min-h-11 items-center justify-center rounded-md bg-ink-900 px-5 py-2 font-medium text-white hover:bg-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900" href={loginUrl} onClick={onLogin}>
                {t('login.action')}
              </a>
            </>
          ) : (
            <p role="alert" className="rounded-md bg-amber-50 p-4 text-amber-900">
              {t('login.noticeUnavailableDe')}<br />{t('login.noticeUnavailableEn')}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
