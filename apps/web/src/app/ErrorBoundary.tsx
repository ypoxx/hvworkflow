/**
 * Last line of defence. The event log is append-only and lives outside React, so a crashed view can
 * always be rebuilt without losing anything — the screen says exactly that and offers the button.
 */
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../components';
import { useT } from '../i18n';

function ErrorScreen({ error, onReset }: { error: Error; onReset: () => void }) {
  const t = useT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-tone-danger-bd bg-tone-danger-bg text-tone-danger-fg">
          <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-[15px] font-semibold text-ink-900">{t('error.title')}</h1>
        <p className="mt-1 text-[13px] text-ink-600">{t('error.hint')}</p>
        <details className="mt-4">
          <summary className="cursor-pointer text-2xs text-ink-500">{t('error.details')}</summary>
          <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-sunken p-3 font-mono text-2xs text-ink-600">
            {error.message}
          </pre>
        </details>
        <Button variant="primary" className="mt-5" onClick={onReset}>
          {t('error.reset')}
        </Button>
      </div>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled error in the interface', error, info.componentStack);
  }

  readonly handleReset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return <ErrorScreen error={error} onReset={this.handleReset} />;
  }
}
