/** Start the selected build mode before mounting any business view. */
import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router';
import { DEMO_MODE, LegacyDemoLogError, resetDemo, seedIfEmpty, sessionAuth } from '../api';
import { getTransparencyNotice, type TransparencyNotice } from '../api/http';
import { ToastProvider } from '../components';
import { AppShell } from './AppShell';
import { BootFailure, BootScreen } from './BootScreen';
import { ErrorBoundary } from './ErrorBoundary';
import { LoginPage } from './LoginPage';

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
