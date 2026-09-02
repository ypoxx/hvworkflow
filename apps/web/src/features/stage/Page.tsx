/**
 * Bühne — the view of the person who reads the answers out.
 *
 * It is a different device (design principle 10): large type, maximum contrast, two keys, and in
 * "Nur Bühne" no navigation at all. The shell may not be touched from a feature, so podium-only
 * mode is a fixed overlay above it; the choice is remembered per device.
 *
 * "Vorgelesen, weiter" is one movement of the hand: deliver, and — only if the record allows it —
 * close in the same breath. Both writes carry the version they read, so a podium that has been
 * away for a minute cannot overwrite a return that happened in the meantime.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { etagOf } from '@hv/domain';
import type { StageView } from '@hv/domain';
import { api } from '../../api';
import { useApiVersion } from '../../api/useApiVersion';
import { Button, Dialog, Panel, PageHeader, cx, showProblem, showToast } from '../../components';
import { getLang, translate, useT } from '../../i18n';
import { Podium, StageQueue } from './Podium';
import { isInteractiveTarget } from './lib';

const STAGE_ONLY_KEY = 'hv-stage-only-v1';

function loadStageOnly(): boolean {
  try {
    return localStorage.getItem(STAGE_ONLY_KEY) === '1';
  } catch {
    return false;
  }
}

function Counter({ testId, label, value }: { testId: string; label: string; value: number }) {
  return (
    <div data-testid={testId} className="flex flex-col leading-tight">
      <span className="hv-label">{label}</span>
      <span className="font-mono text-[20px] font-medium tabular-nums text-ink-900">{value}</span>
    </div>
  );
}

/** The podium's own return dialog: the reason is written under time pressure, so it gets room. */
function ReturnDialog({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const t = useT();
  const [reason, setReason] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    setReason('');
    const timer = window.setTimeout(() => ref.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('stage.return.title')}
      description={t('stage.return.body')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            data-testid="stage-return-submit"
            disabled={busy || reason.trim() === ''}
            onClick={() => onSubmit(reason.trim())}
          >
            {t('action.question.return')}
          </Button>
        </>
      }
    >
      <label className="block">
        <span className="hv-label">{t('stage.return.reason')}</span>
        <textarea
          ref={ref}
          data-testid="stage-return-reason"
          rows={3}
          value={reason}
          placeholder={t('stage.return.placeholder')}
          onChange={(event) => setReason(event.target.value)}
          className={cx(
            'mt-1 w-full resize-y rounded-md border border-line bg-surface px-2 py-1.5',
            'text-[13px] text-ink-900 transition-colors duration-100',
            'placeholder:text-ink-400 hover:border-ink-300',
          )}
        />
      </label>
    </Dialog>
  );
}

export function StagePage() {
  const t = useT();
  const version = useApiVersion();
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((value) => value + 1), []);

  const [stage, setStage] = useState<StageView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [stageOnly, setStageOnly] = useState(loadStageOnly);

  // The keyboard handler must see the current record without being rebound on every fetch.
  const stageRef = useRef<StageView | null>(null);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    let cancelled = false;
    api
      .getStage()
      .then((next) => {
        if (cancelled) return;
        setStage(next);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoading(false);
        // The language is read at call time so that a language switch does not refetch the podium.
        showProblem(error, translate(getLang(), 'toast.problem'));
      });
    return () => {
      cancelled = true;
    };
  }, [version, nonce]);

  const toggleStageOnly = useCallback(() => {
    setStageOnly((value) => {
      const next = !value;
      try {
        localStorage.setItem(STAGE_ONLY_KEY, next ? '1' : '0');
      } catch {
        /* ignore: podium-only mode then simply starts off again */
      }
      return next;
    });
  }, []);

  /** Read out: deliver, and close straight away where the record allows it. One click, one hand. */
  const deliver = useCallback(async () => {
    const current = stageRef.current?.current;
    if (current === null || current === undefined) return;
    if (!current._actions.includes('question.deliver')) return;
    setBusy(true);
    try {
      const delivered = await api.deliverQuestion(current.id, { ifMatch: etagOf(current.version) });
      const alsoClose = delivered._actions.includes('question.close');
      if (alsoClose) {
        await api.closeQuestion(delivered.id, { ifMatch: etagOf(delivered.version) });
      }
      showToast({
        tone: 'success',
        title: alsoClose ? t('stage.toast.closed') : t('stage.toast.delivered'),
        detail: delivered.number,
      });
    } catch (error) {
      showProblem(error, t('toast.problem'));
      // A refusal — 412 above all — means the podium is looking at an old copy. Refetch.
      reload();
    } finally {
      setBusy(false);
    }
  }, [reload, t]);

  const returnAnswer = useCallback(
    async (reason: string) => {
      const current = stageRef.current?.current;
      if (current === null || current === undefined) return;
      setBusy(true);
      try {
        await api.returnQuestion(current.id, reason, { ifMatch: etagOf(current.version) });
        setReturnOpen(false);
        showToast({ tone: 'success', title: t('action.question.return'), detail: current.number });
      } catch (error) {
        showProblem(error, t('toast.problem'));
        reload();
      } finally {
        setBusy(false);
      }
    },
    [reload, t],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (returnOpen) return; // the dialog owns the keyboard
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isInteractiveTarget(event.target)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        void deliver();
        return;
      }
      if (event.key === 'r' || event.key === 'R') {
        const current = stageRef.current?.current;
        if (
          current !== null &&
          current !== undefined &&
          current._actions.includes('question.return')
        ) {
          event.preventDefault();
          setReturnOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deliver, returnOpen]);

  const view: StageView = stage ?? { current: null, queue: [], deliveredCount: 0, openCount: 0 };

  const counters = (
    <div className="flex items-center gap-6">
      <Counter
        testId="stage-counter-delivered"
        label={t('stage.counter.delivered')}
        value={view.deliveredCount}
      />
      <Counter testId="stage-counter-open" label={t('stage.counter.open')} value={view.openCount} />
    </div>
  );

  const toggle = (
    <Button
      data-testid="stage-only-toggle"
      variant={stageOnly ? 'secondary' : 'ghost'}
      aria-pressed={stageOnly}
      aria-label={stageOnly ? t('stage.only.leave') : t('stage.only.enter')}
      icon={
        stageOnly ? (
          <Minimize2 size={15} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Maximize2 size={15} strokeWidth={1.75} aria-hidden="true" />
        )
      }
      onClick={toggleStageOnly}
    >
      {stageOnly ? t('stage.only.leave') : t('stage.only.label')}
    </Button>
  );

  const podium = loading ? (
    <div
      aria-busy="true"
      aria-label={t('answers.list.loading')}
      className="flex min-h-0 flex-1 flex-col gap-4"
    >
      <div className="h-5 w-40 animate-pulse rounded-sm bg-ink-50" />
      <div className="h-16 w-3/4 animate-pulse rounded-sm bg-ink-50" />
      <div className="h-32 w-full animate-pulse rounded-sm bg-ink-50" />
    </div>
  ) : (
    <Podium
      stage={view}
      busy={busy}
      onNext={() => void deliver()}
      onReturn={() => setReturnOpen(true)}
    />
  );

  const dialog = (
    <ReturnDialog
      open={returnOpen}
      busy={busy}
      onClose={() => setReturnOpen(false)}
      onSubmit={(reason) => void returnAnswer(reason)}
    />
  );

  if (stageOnly) {
    return (
      <div data-testid="stage-only" className="fixed inset-0 z-40 flex flex-col bg-surface">
        <div className="flex shrink-0 items-center gap-6 border-b border-line px-8 py-3">
          {counters}
          <span className="flex-1" />
          {toggle}
        </div>
        <div className="flex min-h-0 flex-1 gap-8 px-8 py-6">
          {podium}
          <aside className="hidden w-72 shrink-0 border-l border-line pl-6 lg:flex lg:min-h-0 lg:flex-col">
            <StageQueue stage={view} />
          </aside>
        </div>
        {dialog}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title={t('page.stage.title')}
        description={t('page.stage.description')}
        actions={
          <>
            {counters}
            {toggle}
          </>
        }
      />
      <div className="flex min-h-0 flex-1 gap-4">
        <Panel className="min-w-0 flex-1" bodyClassName="flex min-h-0 flex-col">
          {podium}
        </Panel>
        <div className="hidden w-72 shrink-0 lg:block">
          <Panel className="h-full" bodyClassName="flex min-h-0 flex-col">
            <StageQueue stage={view} />
          </Panel>
        </div>
      </div>
      {dialog}
    </div>
  );
}
