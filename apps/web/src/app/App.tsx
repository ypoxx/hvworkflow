/**
 * Start of the interface: seed the demo corpus once, then mount the shell. Everything above the
 * router is deliberately thin — providers, boot, error boundary, nothing else.
 */
import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router';
import { seedIfEmpty } from '../api';
import { ToastProvider } from '../components';
import { AppShell } from './AppShell';
import { BootFailure, BootScreen } from './BootScreen';
import { ErrorBoundary } from './ErrorBoundary';

/** One boot per page load: React 19 runs effects twice in development, seeding must not. */
let bootPromise: Promise<void> | undefined;
function boot(): Promise<void> {
  bootPromise ??= seedIfEmpty();
  return bootPromise;
}

type BootPhase = { kind: 'loading' } | { kind: 'ready' } | { kind: 'failed'; error: Error };

function Boot() {
  const [phase, setPhase] = useState<BootPhase>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    boot()
      .then(() => {
        if (!cancelled) setPhase({ kind: 'ready' });
      })
      .catch((error: unknown) => {
        bootPromise = undefined;
        if (!cancelled) {
          setPhase({
            kind: 'failed',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (phase.kind === 'loading') return <BootScreen />;
  if (phase.kind === 'failed') {
    return (
      <BootFailure
        error={phase.error}
        onRetry={() => {
          setPhase({ kind: 'loading' });
          setAttempt((value) => value + 1);
        }}
      />
    );
  }
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export function App() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <Boot />
      </ErrorBoundary>
    </ToastProvider>
  );
}
