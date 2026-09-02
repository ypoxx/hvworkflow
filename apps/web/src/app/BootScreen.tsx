/** What the tool shows while the synthetic corpus is being built, and if that ever fails. */
import { AlertTriangle } from 'lucide-react';
import { Button } from '../components';
import { useT } from '../i18n';

export function BootScreen() {
  const t = useT();
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-canvas">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ink-900 font-mono text-2xs font-medium text-white">
        HV
      </span>
      <div className="text-center">
        <p className="text-[13px] font-semibold text-ink-900">{t('boot.title')}</p>
        <p className="mt-1 text-[13px] text-ink-500">{t('boot.hint')}</p>
      </div>
      <div className="h-0.5 w-48 overflow-hidden rounded-full bg-ink-200">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-accent-600" />
      </div>
    </div>
  );
}

export function BootFailure({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="flex h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-tone-danger-bd bg-tone-danger-bg text-tone-danger-fg">
          <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-[15px] font-semibold text-ink-900">{t('boot.failed.title')}</h1>
        <p className="mt-1 text-[13px] text-ink-600">{t('boot.failed.hint')}</p>
        <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-sunken p-3 font-mono text-2xs text-ink-600">
          {error.message}
        </pre>
        <Button variant="primary" className="mt-5" onClick={onRetry}>
          {t('boot.failed.retry')}
        </Button>
      </div>
    </div>
  );
}
