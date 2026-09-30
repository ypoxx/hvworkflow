/**
 * Slice 036b: the connection indicator (Verbindungsanzeige) in the header. HTTP mode only, and only outside `live`: it
 * says that the data may be older than the screen suggests and since when ("Stand von HH:MM:SS"). A polite status
 * region that never takes the focus; the state is carried by text and icon, never by colour alone.
 */
import { CloudOff, Loader2, RefreshCw, Timer } from 'lucide-react';
import type { ComponentType } from 'react';
import { useConnectionState, type ConnectionPhase, type ConnectionState } from '../api/connection';
import { DEMO_MODE } from '../api/mode';
import { useT, type TKey, type Translate } from '../i18n';

type ShownPhase = Exclude<ConnectionPhase, 'idle' | 'live'>;

const PHASES: Readonly<Record<ShownPhase, { key: TKey; Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }> }>> = {
  connecting: { key: 'shell.connection.connecting', Icon: Loader2 },
  reconnecting: { key: 'shell.connection.reconnecting', Icon: RefreshCw },
  polling: { key: 'shell.connection.polling', Icon: Timer },
  offline: { key: 'shell.connection.offline', Icon: CloudOff },
};

/** The time of the hall, as the clock in the header (Europe/Berlin), to the second. */
const TIME_FORMAT = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const isShown = (phase: ConnectionPhase): phase is ShownPhase => phase !== 'idle' && phase !== 'live';

export function ConnectionStatusView({ state, demo, t }: { state: ConnectionState; demo: boolean; t: Translate }) {
  // ADR 0002: the demo has no stream and shows no indicator.
  if (demo) return null;
  const phase = state.phase;
  if (!isShown(phase)) {
    // The region stays in the DOM, so that a later change is announced.
    return <div role="status" aria-live="polite" data-testid="connection-status" data-phase={phase} className="sr-only" />;
  }
  const { key, Icon } = PHASES[phase];
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="connection-status"
      data-phase={phase}
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-sunken px-2 py-1 text-2xs text-ink-700"
    >
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
      <span className="font-medium">{t(key)}</span>
      {state.asOf !== undefined && (
        <span className="text-ink-500">{t('shell.connection.asOf', { time: TIME_FORMAT.format(state.asOf) })}</span>
      )}
    </div>
  );
}

export function ConnectionStatus() {
  const state = useConnectionState();
  const t = useT();
  return <ConnectionStatusView state={state} demo={DEMO_MODE} t={t} />;
}
