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
import { Contrast, Lock, Maximize2, Minimize2 } from 'lucide-react';
import { etagOf } from '@hv/domain';
import type { Permission, StageView } from '@hv/domain';
import { api } from '../../api';
import { getActor, useActor } from '../../api/actor';
import { useApiVersion } from '../../api/useApiVersion';
import {
  Button,
  Dialog,
  EmptyState,
  Panel,
  PageHeader,
  cx,
  showProblem,
  showToast,
} from '../../components';
import { getLang, translate, useT } from '../../i18n';
import { Podium, StageQueue } from './Podium';
import {
  NO_VERDICT,
  isCurrentLoad,
  isInteractiveTarget,
  isReadForbidden,
  loadKey,
  readVerdict,
} from './lib';
import type { KeyedRead, ReadVerdict } from './lib';

const STAGE_ONLY_KEY = 'hv-stage-only-v1';
const STAGE_CONTRAST_KEY = 'hv-stage-contrast-v1';

/** Points #3/#9 (feedback, slice 020): a person who may only read out never has any of these. */
const WORK_ACTIONS: readonly Permission[] = [
  'question.capture',
  'question.classify',
  'answer.draft',
  'question.approve',
];

/**
 * takt-008: the question a "Vorgelesen, weiter" was written against, as it was read. Slice 010c,
 * Ziel 6 (N2 of takt-008's Nachprüfung): `answered` is set once the write itself has answered, so
 * that a failed read-back frees only a lock that is waiting for the record, never one whose write is
 * still on its way.
 */
interface DeliverLock {
  id: string;
  version: number;
  answered: boolean;
}

/** `null`: no explicit choice yet — the default may still be derived from the actor's rights. */
function loadStoredStageOnly(): boolean | null {
  try {
    const raw = localStorage.getItem(STAGE_ONLY_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return null;
  } catch {
    return null;
  }
}

/**
 * Point #3/#9: "Nur Bühne" as the default of a role that only reads answers out. Derived the same
 * way `deskActions` is derived in `features/capture/Page.tsx` — from `_actions` of the Bühnenfragen
 * themselves (never from the role name, AGENTS.md rule 4): the rights bundle carries the read-out
 * permission and none of the drafting, classifying, capturing or approving ones.
 */
function stageOnlyByRights(actions: readonly Permission[]): boolean {
  return actions.includes('question.deliver') && !WORK_ACTIONS.some((a) => actions.includes(a));
}

function loadStageContrast(): boolean {
  try {
    return localStorage.getItem(STAGE_CONTRAST_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * `--color-stage-text` rather than `text-ink-900`: identical near-black in the ordinary view, but
 * this counter also has to survive on the black ground of Kontrastmodus (point 6).
 */
function Counter({ testId, label, value }: { testId: string; label: string; value: number }) {
  return (
    <div data-testid={testId} className="flex flex-col leading-tight">
      <span className="hv-label">{label}</span>
      <span
        className="font-mono text-[20px] font-medium tabular-nums"
        style={{ color: 'var(--color-stage-text)' }}
      >
        {value}
      </span>
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
  // Ziel 1 (slice 010b): `getStage` is the Hauptabfrage of the Bühne — set from the 403's ruleId
  // alone (AGENTS.md rule 4), e.g. expert, who holds `question.read` but no `stage.read`.
  // Slice 010c: the answer carries the key of its load, and the refusal is the verdict of the
  // current key (`readVerdict`, lib.ts). A refusal belongs to the actor: a plain failure of the
  // same actor's next load keeps it (review round 1, finding 4 — it used to give way to "Die Bühne
  // ist frei"); an actor change resets it below.
  const [stageRead, setStageRead] = useState<KeyedRead | null>(null);
  const [shownVerdict, setShownVerdict] = useState<ReadVerdict>(NO_VERDICT);
  const [busy, setBusy] = useState(false);
  /**
   * takt-008: the question being read out, as it was read. "Vorgelesen, weiter" keeps focus while
   * it writes (`aria-disabled`, Podium.tsx), and the lock holds until the podium shows a different
   * question (or the same one in a newer version, or none) — not merely until the write has
   * answered, or a second press would act on the old copy and meet its own 412 and a problem toast
   * (review round 1, finding 3). Released at once when the write, or the read-back, fails.
   */
  const [delivering, setDelivering] = useState<DeliverLock | null>(null);
  // The same lock for a second activation in the same task, before React has rendered it.
  const writing = useRef<DeliverLock | null>(null);
  const stageBusy = busy || delivering !== null;
  const [returnOpen, setReturnOpen] = useState(false);
  // m2 (review round 1): `null` is its own, third state — "not decided yet", never rendered as
  // either layout (see the early return below) — not a silent stand-in for `false` any more.
  const [stageOnly, setStageOnly] = useState<boolean | null>(loadStoredStageOnly);
  const [contrast, setContrast] = useState(loadStageContrast);
  // A plain, un-staged probe: the only reliable way to see `question.capture` (point #3/#9), which
  // is never gated by a transition and so shows up regardless of that one question's own status.
  const [probeActions, setProbeActions] = useState<readonly Permission[]>([]);
  const [probeLoading, setProbeLoading] = useState(true);

  // The keyboard handler must see the current record without being rebound on every fetch.
  const stageRef = useRef<StageView | null>(null);
  // Minor A (review round 4): the record on screen, kept apart from `stageRef` — a load that fails
  // with anything but a read refusal hands the shortcuts back the record the podium still shows.
  const shownRef = useRef<StageView | null>(null);
  useEffect(() => {
    stageRef.current = stage;
    shownRef.current = stage;
  }, [stage]);

  // Adjusted during render: the render that shows the next question is the one that unlocks.
  if (
    delivering !== null &&
    (stage?.current?.id !== delivering.id || stage.current.version !== delivering.version)
  ) {
    setDelivering(null);
  }
  useEffect(() => {
    if (delivering === null) writing.current = null;
  }, [delivering]);

  /**
   * Minor B (review round 4): an actor change on an open page decides the layout afresh — back to
   * the `stage-deciding` skeleton until this actor's first `getStage` answer is in, so a stored
   * "Nur Bühne" overlay of the previous role does not stand for one response time. Only on an
   * actor change, never on an ordinary event (design principle 8). Adjusted during render, so not
   * even one frame of the old overlay is committed.
   *
   * Nit 3 (review round 5): the actor is compared by its `id` — stable across a fresh identity
   * object for the same person (an OIDC token refresh) — never by role name (AGENTS.md rule 4).
   * Codex P2-B on 948a721: the previous actor's record is dropped here too, so no later failure
   * (minor A, review round 4) can hand it back to the shortcuts or the screen.
   */
  const actorId = useActor().id;
  const [layoutActorId, setLayoutActorId] = useState(actorId);
  if (layoutActorId !== actorId) {
    setLayoutActorId(actorId);
    // Slice 090 (review R1, finding 5): the return dialog and its reason belong to the actor who
    // opened it; the next actor starts with it closed.
    setReturnOpen(false);
    setLoading(true);
    setStage(null);
    setShownVerdict({ actor: actorId, forbidden: false });
  }
  const verdict = readVerdict(
    shownVerdict,
    [{ read: stageRead, key: loadKey(actorId, `${version}:${nonce}`) }],
    actorId,
  );
  if (verdict !== shownVerdict) setShownVerdict(verdict);
  const forbidden = verdict.forbidden;

  useEffect(() => {
    let cancelled = false;
    // Minor 4 (review round 3): `version` bumps on every actor switch (api/useApiVersion.ts). Until
    // this version's own answer is in, the keyboard has no record to act on — the previous one
    // may belong to a role that could read (and deliver) what this one cannot. Only the ref the
    // shortcuts read is cleared: blanking the visible podium on every bump would make it jump on
    // every new event too (design principle 8), and the fresh answer replaces it within the load.
    stageRef.current = null;
    // Codex P2-B on 948a721: every answer is tied to the actor it was asked for. The actor can
    // change while the request is on its way, and the answer can arrive before the `version` bump
    // that would cancel this effect — it then belongs to the previous actor, with that actor's
    // question and `_actions`, and is dropped. `getActor()` is read at the moment of the answer, not
    // from React state, so no render has to happen first.
    //
    // Slice 010c: the same rule as in every other view, with the same key (`loadKey`, lib.ts).
    const requested = loadKey(getActor().id, `${version}:${nonce}`);
    const stale = (): boolean =>
      !isCurrentLoad(requested, cancelled ? null : loadKey(getActor().id, `${version}:${nonce}`));
    api
      .getStage()
      .then((next) => {
        if (stale()) return;
        setStage(next);
        setLoading(false);
        setStageRead({ key: requested, status: 'ready' });
      })
      .catch((error: unknown) => {
        if (stale()) return;
        setLoading(false);
        if (isReadForbidden(error)) {
          // Ziel 1 (slice 010b): a gestalteter Zustand, not an error toast. Minor 4 (review round
          // 2): `setStage(null)` too — a role that has just lost `stage.read` (a role switch bumps
          // `version`) must not go on reading out or returning a previous role's stale question
          // with Space/R (the keyboard handler below reads `stageRef.current`, which this clears).
          setStage(null);
          setStageRead({ key: requested, status: 'forbidden' });
          return;
        }
        // Minor A (review round 4): the podium goes on showing the last record it had, so the
        // shortcuts and "Vorgelesen, weiter" act on it again instead of doing nothing until the
        // next event. The server still decides every write (a stale record meets its 412/403).
        stageRef.current = shownRef.current;
        // Slice 010c: a failure is this load's answer too; a refusal of the same actor stands
        // (`readVerdict`), one of another actor was already reset with the actor change above.
        setStageRead({ key: requested, status: 'error' });
        // takt-008: the record the lock waits for will not come — the podium acts on what it shows.
        // Slice 010c, Ziel 6 (N2): only if the write has answered; a write still on its way keeps
        // its lock, or a second press would send a second "Vorgelesen".
        const lock = writing.current;
        if (lock !== null && lock.answered) {
          writing.current = null;
          setDelivering((held) => (held === lock ? null : held));
        }
        // The language is read at call time so that a language switch does not refetch the podium.
        showProblem(error, translate(getLang(), 'toast.problem'));
      });
    return () => {
      cancelled = true;
    };
  }, [version, nonce]);

  useEffect(() => {
    let cancelled = false;
    // Slice 010c: the probe's `_actions` decide the "Nur Bühne" default — an answer asked for the
    // previous actor must not decide it for the next one.
    const requested = loadKey(getActor().id, version);
    const current = (): string | null => (cancelled ? null : loadKey(getActor().id, version));
    api
      .listQuestions({ limit: 1 })
      .then((page) => {
        if (!isCurrentLoad(requested, current())) return;
        setProbeActions(page.items[0]?._actions ?? []);
        setProbeLoading(false);
      })
      .catch(() => {
        if (isCurrentLoad(requested, current())) setProbeLoading(false);
        /* the default then simply falls back to whatever the Bühnenfragen already show */
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  /**
   * Point #3/#9 / m2 (review round 1): the default is derived exactly once. `stageOnly !== null`
   * — a stored choice, or an earlier run of this very effect — stops it from running again; a
   * later, conscious toggle always wins because it always writes a concrete `true`/`false`.
   *
   * A meeting with no question at all (the empty-meeting e2e fixture, or a brand new one) can
   * never fill `actions` — nothing here is ever staged or captured, so neither fetch ever has a
   * question to read `_actions` off. Once both have genuinely settled with nothing to show, the
   * default falls back to the ordinary layout rather than leaving the page undecided forever.
   */
  useEffect(() => {
    if (stageOnly !== null) return;
    const actions = [
      ...(stage?.current?._actions ?? []),
      ...(stage?.queue[0]?._actions ?? []),
      ...probeActions,
    ];
    if (actions.length > 0) {
      setStageOnly(stageOnlyByRights(actions));
    } else if (!loading && !probeLoading) {
      setStageOnly(false);
    }
  }, [stageOnly, stage, probeActions, loading, probeLoading]);

  const toggleStageOnly = useCallback(() => {
    setStageOnly((value) => {
      const next = !(value ?? false);
      try {
        localStorage.setItem(STAGE_ONLY_KEY, next ? '1' : '0');
      } catch {
        /* ignore: podium-only mode then simply starts off again */
      }
      return next;
    });
  }, []);

  const toggleContrast = useCallback(() => {
    setContrast((value) => {
      const next = !value;
      try {
        localStorage.setItem(STAGE_CONTRAST_KEY, next ? '1' : '0');
      } catch {
        /* ignore: contrast mode then simply starts off again */
      }
      return next;
    });
  }, []);

  /**
   * Read out: deliver, and close straight away where the record allows it. One click, one hand.
   *
   * Slice 010c, Ziel 6 (N3 of takt-008's Nachprüfung): says whether a write was started. Nothing is
   * written while there is no record to act on (the read after a new `version` is still on its
   * way), the record offers no delivery, or a write is already in flight — and a press that wrote
   * nothing must not leave a focus marker behind (Podium.tsx).
   */
  const deliver = useCallback((): boolean => {
    const current = stageRef.current?.current;
    if (current === null || current === undefined) return false;
    if (!current._actions.includes('question.deliver')) return false;
    if (writing.current !== null) return false;
    const lock: DeliverLock = { id: current.id, version: current.version, answered: false };
    writing.current = lock;
    setDelivering(lock);
    void (async () => {
      try {
        const delivered = await api.deliverQuestion(current.id, {
          ifMatch: etagOf(current.version),
        });
        const alsoClose = delivered._actions.includes('question.close');
        if (alsoClose) {
          await api.closeQuestion(delivered.id, { ifMatch: etagOf(delivered.version) });
        }
        lock.answered = true;
        showToast({
          tone: 'success',
          title: alsoClose ? t('stage.toast.closed') : t('stage.toast.delivered'),
          detail: delivered.number,
        });
      } catch (error) {
        showProblem(error, t('toast.problem'));
        // Refused: nothing to wait for — unlock at once. Slice 010c, Ziel 6 (N2): only this
        // write's own lock; a newer write may already hold the next one.
        if (writing.current === lock) writing.current = null;
        setDelivering((held) => (held === lock ? null : held));
        // A refusal — 412 above all — means the podium is looking at an old copy. Refetch.
        reload();
      }
    })();
    return true;
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
      // Minor 4 (review round 2): a role without `stage.read` has no current question of its own
      // to act on — `stage` is `null` (cleared above) by the time this can fire, but the shortcuts
      // are refused outright rather than relying on `deliver`/`setReturnOpen` to no-op quietly.
      if (forbidden) return;
      if (returnOpen) return; // the dialog owns the keyboard
      // B1 (review round 1): the queue preview (`QueuePreview` in Podium.tsx) is a dialog too, and
      // it has no state of its own up here to check like `returnOpen` — Space must not deliver the
      // current question, R must not open the return dialog on top of it, while it is open. Any
      // open `Dialog` sets `aria-modal="true"` (components/Dialog.tsx), so this catches the preview
      // and every future stage dialog alike, without threading its open state through two files.
      if (document.querySelector('[aria-modal="true"]') !== null) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // takt-008 review round 1, finding 1: the podium's own buttons keep focus after a press, so
      // R ("Antwort zurückgeben") is let through from them. Only R: Space already activates the
      // focused button itself (on keyup) — handling it here as well would read out twice.
      const isR = event.key === 'r' || event.key === 'R';
      const fromPodiumButton =
        event.target instanceof HTMLElement && event.target.closest('[data-podium-key]') !== null;
      if (isInteractiveTarget(event.target) && !(isR && fromPodiumButton)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        deliver();
        return;
      }
      if (isR) {
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
  }, [deliver, returnOpen, forbidden]);

  /**
   * m2: neither layout renders until "Nur Bühne" is decided — a skeleton instead, so a role whose
   * default turns out to be "Nur Bühne" never flashes the ordinary shell first
   * (design-prinzipien.md #8, "nichts springt").
   *
   * Minor 4 (review round 3): nor until the first `getStage` answer is known (`loading`). A stored
   * "Nur Bühne" is decided at once, but whether it applies depends on that answer — a role refused
   * `stage.read` gets the ordinary layout — so the fullscreen overlay and its counters used to
   * flash for the length of the load and then jump away.
   */
  if (stageOnly === null || loading) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4" data-testid="stage-deciding">
        <PageHeader title={t('page.stage.title')} description={t('page.stage.description')} />
        <div
          aria-busy="true"
          aria-label={t('answers.list.loading')}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <div className="h-5 w-40 animate-pulse rounded-sm bg-ink-50" />
          <div className="h-16 w-3/4 animate-pulse rounded-sm bg-ink-50" />
          <div className="h-32 w-full animate-pulse rounded-sm bg-ink-50" />
        </div>
      </div>
    );
  }

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

  // A "secondary" button's own text (`text-ink-800`) would go dark-on-dark once Kontrastmodus turns
  // the ground black; `--color-stage-text` is near-black in the ordinary view and near-white there.
  const stageTextStyle = { color: 'var(--color-stage-text)' };

  const toggle = (
    <Button
      data-testid="stage-only-toggle"
      variant={stageOnly ? 'secondary' : 'ghost'}
      aria-pressed={stageOnly}
      aria-label={stageOnly ? t('stage.only.leave') : t('stage.only.enter')}
      style={stageOnly ? stageTextStyle : undefined}
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

  // Kontrastmodus (point 6): black ground, near-white text, one light accent — offered only inside
  // "Nur Bühne", the device this is actually for.
  const contrastToggle = (
    <Button
      data-testid="stage-contrast-toggle"
      variant={contrast ? 'secondary' : 'ghost'}
      aria-pressed={contrast}
      style={contrast ? stageTextStyle : undefined}
      aria-label={contrast ? t('stage.contrast.leave') : t('stage.contrast.enter')}
      icon={<Contrast size={15} strokeWidth={1.75} aria-hidden="true" />}
      onClick={toggleContrast}
    >
      {t('stage.contrast.label')}
    </Button>
  );

  const podium = forbidden ? (
    // Minor 5 (review round 2): `role="status"` marks the refusal as a status message. Nit 6
    // (review round 3): a live region mounted together with its content is often not announced,
    // so this is a hint to assistive technology, not a guaranteed announcement.
    <div
      data-testid="stage-forbidden"
      role="status"
      className="flex min-h-0 flex-1 items-center justify-center"
    >
      <EmptyState
        icon={Lock}
        title={t('stage.forbidden.title')}
        description={t('stage.forbidden.body')}
        className="max-w-xl"
      />
    </div>
  ) : (
    <Podium
      stage={view}
      busy={stageBusy}
      onNext={deliver}
      onReturn={() => setReturnOpen(true)}
    />
  );

  const dialog = (
    <ReturnDialog
      open={returnOpen}
      busy={stageBusy}
      onClose={() => setReturnOpen(false)}
      onSubmit={(reason) => void returnAnswer(reason)}
    />
  );

  // Minor 4 (review round 2): a stored "Nur Bühne" choice (`hv-stage-only-v1=1`) is a fact about
  // the device, not about whether this role may currently read the stage at all — a role that has
  // lost `stage.read` since falls back to the ordinary layout below, rather than a fullscreen
  // overlay whose own counters/contrast/toggle chrome would have nothing real to show either.
  if (stageOnly && !forbidden) {
    return (
      <div
        data-testid="stage-only"
        className={cx('fixed inset-0 z-40 flex flex-col bg-surface', contrast && 'stage-contrast')}
      >
        <div className="flex shrink-0 items-center gap-6 border-b border-line px-8 py-3">
          {counters}
          <span className="flex-1" />
          {contrastToggle}
          {toggle}
        </div>
        <div className="flex min-h-0 flex-1 gap-8 px-8 py-6">
          {podium}
          {/* Minor 4 (review round 3): no `!forbidden` guard here — this overlay only renders for
           *  a role that can read the stage (see the condition above). */}
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
        {...(forbidden
          ? {}
          : {
              actions: (
                <>
                  {counters}
                  {toggle}
                </>
              ),
            })}
      />
      <div className="flex min-h-0 flex-1 gap-4">
        <Panel className="min-w-0 flex-1" bodyClassName="flex min-h-0 flex-col">
          {podium}
        </Panel>
        {!forbidden && (
          <div className="hidden w-72 shrink-0 lg:block">
            <Panel className="h-full" bodyClassName="flex min-h-0 flex-col">
              <StageQueue stage={view} />
            </Panel>
          </div>
        )}
      </div>
      {dialog}
    </div>
  );
}
