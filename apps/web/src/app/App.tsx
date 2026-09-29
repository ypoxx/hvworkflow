/** Start the selected build mode before mounting any business view. */
import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router';
import { DEMO_MODE, LegacyDemoLogError, resetDemo, seedIfEmpty, sessionAuth } from '../api';
import { getTransparencyNotice, type TransparencyNotice } from '../api/http';
import { Button, ToastProvider } from '../components';
import { useT } from '../i18n';
import { AppShell } from './AppShell';
import { BootFailure, BootScreen } from './BootScreen';
import { ErrorBoundary } from './ErrorBoundary';
import { LoginPage } from './LoginPage';
import { LanguageToggle } from './LanguageToggle';

/** One demo seed per page load, including React development's second effect pass. */
let demoBootPromise: Promise<void> | undefined;
function bootDemo(): Promise<void> {
  demoBootPromise ??= seedIfEmpty();
  return demoBootPromise;
}

type DemoPhase = { kind: 'loading' } | { kind: 'ready' } | { kind: 'failed'; error: Error };

function DemoBoot() {
  const [phase, setPhase] = useState<DemoPhase>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    bootDemo()
      .then(() => {
        if (!cancelled) setPhase({ kind: 'ready' });
      })
      .catch((error: unknown) => {
        demoBootPromise = undefined;
        if (!cancelled) {
          setPhase({
            kind: 'failed',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });
    return () => { cancelled = true; };
  }, [attempt]);

  if (phase.kind === 'loading') return <BootScreen />;
  if (phase.kind === 'failed') {
    return (
      <BootFailure
        error={phase.error}
        legacy={phase.error instanceof LegacyDemoLogError}
        onReset={resetDemo}
        onRetry={() => {
          setPhase({ kind: 'loading' });
          setAttempt((value) => value + 1);
        }}
      />
    );
  }
  return <BrowserRouter><AppShell /></BrowserRouter>;
}

const auth = sessionAuth;
let httpBootPromise: Promise<void> | undefined;

function HttpLogin({ authError }: { authError: boolean }) {
  const [notice, setNotice] = useState<TransparencyNotice | null>(null);
  useEffect(() => {
    let active = true;
    getTransparencyNotice()
      .then((next) => { if (active) setNotice(next); })
      .catch(() => { if (active) setNotice(null); });
    return () => { active = false; };
  }, []);
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return <LoginPage notice={notice} returnTo={returnTo} onLogin={() => undefined} authError={authError} />;
}

/** A valid session without an active role: sign-out only, no sign-in button (that would loop). */
function NoRolePage({ onLogout }: { onLogout: () => Promise<void> }) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  return (
    <main className="min-h-screen bg-canvas px-4 py-10 text-ink-900 sm:px-8" id="main">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <span className="font-semibold">{t('app.name')}</span>
          <LanguageToggle />
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-10">
          <h1 className="mb-3 text-2xl font-semibold">{t('noRole.title')}</h1>
          <p className="mb-6 text-ink-600">{t('noRole.body')}</p>
          {failed && <p role="alert" className="mb-5 rounded-md bg-red-50 p-3 text-red-800">{t('session.logoutFailed')}</p>}
          <Button onClick={() => { setFailed(false); void onLogout().catch(() => setFailed(true)); }}>{t('session.logout')}</Button>
        </div>
      </div>
    </main>
  );
}

function HttpBoot() {
  const adapter = auth!;
  const [state, setState] = useState(adapter.getState);

  useEffect(() => {
    const unsubscribe = adapter.subscribe(() => setState(adapter.getState()));
    httpBootPromise ??= adapter.start();
    void httpBootPromise.catch(() => undefined);
    return unsubscribe;
  }, [adapter]);

  useEffect(() => {
    if (state.kind !== 'signedIn') return undefined;
    const refresh = () => {
      if (document.visibilityState === 'visible') void adapter.refresh().catch(() => undefined);
    };
    const timer = window.setInterval(refresh, 20 * 60 * 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [adapter, state.kind]);

  if (state.kind === 'checking') return <BootScreen />;
  if (state.kind === 'noRole') return <NoRolePage onLogout={adapter.logout} />;
  if (state.kind !== 'signedIn') return <HttpLogin authError={state.kind === 'error'} />;
  return <BrowserRouter><AppShell /></BrowserRouter>;
}

export function App() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        {DEMO_MODE ? <DemoBoot /> : <HttpBoot />}
      </ErrorBoundary>
    </ToastProvider>
  );
}
