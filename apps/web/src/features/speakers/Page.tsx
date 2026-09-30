/**
 * Wortmeldeliste (slice 002). The morning desk of the meeting office: who is at the microphone, who
 * is next, and the order of every round. Data comes through `HvApi` only, actions come from
 * `speaker._actions` only, and every write carries the version it saw (AGENTS.md rules 4 and 6).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { Announcements, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Eye, ListOrdered, Lock, Plus, TriangleAlert } from 'lucide-react';
import type { Speaker, SpeakerRegistration } from '@hv/domain';
import { etagOf } from '@hv/domain';
import { api } from '../../api';
import { useActor } from '../../api/actor';
import { Button, EmptyState, Panel, PageHeader, showProblem } from '../../components';
import { actionLabel, getLang, translate, useT } from '../../i18n';
import { useMeeting } from '../../app/useMeeting';
import { MoveDialog } from './MoveDialog';
import { NowSpeaking } from './NowSpeaking';
import { RoundSection } from './RoundSection';
import { ROW_COLUMNS } from './SpeakerRow';
import type { SpeakerRowActions } from './SpeakerRow';
import { applyWriteResult, etagForList, keepNewest, moveSpeakerToRound, useSpeakers } from './useSpeakers';
import { RegisterDialog } from './RegisterDialog';

/** The failed-write message: title from the problem, fallback from the dictionary. */
const problemTitle = (): string => translate(getLang(), 'toast.problem');

const NO_ROWS: readonly Speaker[] = [];

function SkeletonRows() {
  const t = useT();
  return (
    <Panel padded={false} title={t('speakers.loading')}>
      <ul aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
          <li
            key={row}
            className="grid h-9 items-center gap-2 border-b border-line px-2 last:border-b-0"
            style={{ gridTemplateColumns: ROW_COLUMNS }}
          >
            <span />
            <span className="h-2 rounded-full bg-ink-100" />
            <span className="h-2 w-1/3 rounded-full bg-ink-100" />
            <span className="h-2 rounded-full bg-ink-100" />
            <span className="h-2 rounded-full bg-ink-100" />
            <span className="h-2 rounded-full bg-ink-100" />
            <span className="h-2 rounded-full bg-ink-100" />
            <span className="h-2 rounded-full bg-ink-100" />
            <span />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function SpeakersPage() {
  const t = useT();
  const meeting = useMeeting();
  const { status, speakers: listed, listVersion, reload } = useSpeakers();
  const actorId = useActor().id;

  /**
   * takt-032: an own write answers with the rows (`updateSpeaker`, `reorderSpeakers`) or the tag of
   * the list (`lastWriteEtag()`) to go on with. They are kept here, per actor, and hold until a list
   * with newer rows arrives: per row the higher version wins (`applyWriteResult`), the list tag holds
   * while the list shown is the one the write was made on (`etagForList`). Nothing is counted up.
   */
  const [written, setWritten] = useState<{ actorId: string; rows: readonly Speaker[] } | null>(null);
  const [listMark, setListMark] = useState<{ actorId: string; base: number; etag: string } | null>(null);
  const writtenRows = written !== null && written.actorId === actorId ? written.rows : NO_ROWS;
  const speakers = useMemo(() => applyWriteResult(listed, writtenRows), [listed, writtenRows]);
  const listEtag =
    listVersion === null
      ? null
      : etagForList(listVersion, listMark !== null && listMark.actorId === actorId ? listMark : null);
  // Read by the write handlers after an await, which run outside the render pass.
  const latest = useRef({ actorId, listed });
  useEffect(() => {
    latest.current = { actorId, listed };
  });
  /** What a write started on: its own actor and the list it saw. Its answer counts only for these. */
  const startOf = useCallback(() => ({ actorId: latest.current.actorId, listed: latest.current.listed }), []);
  const stillCurrent = useCallback(
    (start: { actorId: string; listed: readonly Speaker[] }) =>
      latest.current.actorId === start.actorId && latest.current.listed === start.listed,
    [],
  );
  const keepRows = useCallback(
    (start: { actorId: string; listed: readonly Speaker[] }, rows: readonly Speaker[]) => {
      if (!stillCurrent(start)) return;
      setWritten((previous) => ({
        actorId: start.actorId,
        rows: keepNewest(previous !== null && previous.actorId === start.actorId ? previous.rows : NO_ROWS, rows),
      }));
    },
    [stillCurrent],
  );
  // At most one own write on this page at a time: the tag read right after an await is then its own.
  const inFlight = useRef(false);
  // The round whose reorder is in flight (takt-032, Ziel 2): a signal for the interface, not a right.
  const [reorderRound, setReorderRound] = useState<number | null>(null);

  // While a reorder is in flight the list shows the new order; the refetch then confirms it.
  const [override, setOverride] = useState<readonly Speaker[] | null>(null);
  // Slice 010d: the override belongs to the list it was made on, and any other list — the refetch,
  // or none at all after a role switch (`useSpeakers` hands out another actor's rows to nobody) —
  // drops it in the same render. An effect would commit one frame of the previous role's rows.
  const [overrideOf, setOverrideOf] = useState(speakers);
  if (overrideOf !== speakers) {
    setOverrideOf(speakers);
    setOverride(null);
  }
  const view = override ?? speakers;
  // Read by the drag handlers and the announcements, which run outside the render pass.
  const viewRef = useRef<readonly Speaker[]>(view);
  useEffect(() => {
    viewRef.current = view;
  });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [moving, setMoving] = useState<Speaker | null>(null);
  const [roundOpen, setRoundOpen] = useState<Readonly<Record<number, boolean>>>({});

  /**
   * Slice 010d, Ziel 1: a dialog belongs to the actor who opened it from their own `_actions`. On
   * an actor change it closes in the same render (compared by `id`, never by role, AGENTS.md rule
   * 4) — the next actor has offered nothing yet, and may not be allowed what it would submit.
   */
  const [dialogActorId, setDialogActorId] = useState(actorId);
  if (dialogActorId !== actorId) {
    setDialogActorId(actorId);
    setRegisterOpen(false);
    setMoving(null);
  }

  const speaking = useMemo(() => view.find((s) => s.status === 'speaking'), [view]);
  const next = useMemo(() => view.find((s) => s.status === 'waiting'), [view]);
  const currentRound = meeting?.currentRound ?? speaking?.round ?? next?.round ?? 1;

  const rounds = useMemo(() => {
    const grouped = new Map<number, Speaker[]>();
    for (const speaker of view) {
      const bucket = grouped.get(speaker.round);
      if (bucket === undefined) grouped.set(speaker.round, [speaker]);
      else bucket.push(speaker);
    }
    return [...grouped.entries()].sort((a, b) => a[0] - b[0]);
  }, [view]);

  /**
   * Rounds offered in the dialogs: the ones that exist, plus the next one — the chair opens a new
   * round by moving the first Wortmeldung into it.
   */
  const roundNumbers = useMemo(() => {
    const numbers = rounds.map(([round]) => round);
    const highest = numbers.length > 0 ? Math.max(...numbers) : 0;
    return [...numbers, highest + 1];
  }, [rounds]);

  /**
   * Rights are data (AGENTS.md rule 4). `speaker.register` belongs to no existing resource, so the
   * contract carries no `_actions` list for it; the permission bundle that may change a Wortmeldung
   * is the same one that may take a new one, so the offer follows `speaker.update` on the list.
   */
  //
  // Slice 010d: an empty list offers it only once it is this actor's answer (`status` "ready"); while
  // the list loads — after a role switch, too — there is nothing yet to read the right from.
  const mayRegister =
    view.length > 0
      ? view.some((speaker) => speaker._actions.includes('speaker.update'))
      : status === 'ready';
  /**
   * Point #26 (feedback, slice 020): a role without any write right on the Wortmeldeliste used to
   * see no register button and no row actions with no explanation at all. Derived from `_actions`
   * alone, never from the role name (AGENTS.md rule 4).
   */
  const mayWriteSpeakers = view.some(
    (speaker) => speaker._actions.includes('speaker.update') || speaker._actions.includes('speaker.reorder'),
  );
  const readOnly = view.length > 0 && !mayWriteSpeakers;

  const run = useCallback(
    async (id: string, action: () => Promise<unknown>): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setBusyId(id);
      try {
        await action();
        return true;
      } catch (error: unknown) {
        showProblem(error, problemTitle());
        reload();
        return false;
      } finally {
        inFlight.current = false;
        setBusyId(null);
      }
    },
    [reload],
  );

  const actions: SpeakerRowActions = useMemo(
    () => ({
      // Calling the next speaker ends the running speech first: only one microphone is open.
      onCall: (speaker) => {
        void run(speaker.id, async () => {
          const start = startOf();
          const running = viewRef.current.find(
            (s) => s.status === 'speaking' && s.id !== speaker.id,
          );
          const answers: Speaker[] = [];
          if (running !== undefined) {
            answers.push(
              await api.updateSpeaker(
                running.id,
                { status: 'finished' },
                { ifMatch: etagOf(running.version) },
              ),
            );
          }
          answers.push(
            await api.updateSpeaker(
              speaker.id,
              { status: 'speaking' },
              { ifMatch: etagOf(speaker.version) },
            ),
          );
          keepRows(start, answers);
        });
      },
      onFinish: (speaker) => {
        void run(speaker.id, async () => {
          const start = startOf();
          keepRows(
            start,
            [
              await api.updateSpeaker(
                speaker.id,
                { status: 'finished' },
                { ifMatch: etagOf(speaker.version) },
              ),
            ],
          );
        });
      },
      onWithdraw: (speaker) => {
        void run(speaker.id, async () => {
          const start = startOf();
          keepRows(
            start,
            [
              await api.updateSpeaker(
                speaker.id,
                { status: 'withdrawn' },
                { ifMatch: etagOf(speaker.version) },
              ),
            ],
          );
        });
      },
      onMove: (speaker) => setMoving(speaker),
    }),
    [run, startOf, keepRows],
  );

  const register = useCallback(
    async (input: SpeakerRegistration): Promise<boolean> =>
      listVersion === null || listEtag === null
        ? false
        : run('new', async () => {
            const start = startOf();
            await api.registerSpeaker(input, { ifMatch: listEtag });
            // Right after the await, before anything else can write: the tag is this write's own.
            const etag = api.lastWriteEtag();
            if (etag !== undefined && stillCurrent(start)) {
              setListMark({ actorId: start.actorId, base: listVersion, etag });
            }
          }),
    [run, listVersion, listEtag, startOf, stillCurrent],
  );

  const move = useCallback(
    async (speaker: Speaker, round: number): Promise<boolean> =>
      run(speaker.id, () => moveSpeakerToRound(api, speaker, round)),
    [run],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const describe = useCallback(
    (
      key: 'speakers.dnd.lifted' | 'speakers.dnd.moved' | 'speakers.dnd.dropped',
      activeId: string,
      overId?: string,
    ) => {
      const list = viewRef.current;
      const active = list.find((s) => s.id === activeId);
      if (active === undefined) return undefined;
      const inRound = list.filter((s) => s.round === active.round);
      const target =
        overId === undefined ? active : (inRound.find((s) => s.id === overId) ?? active);
      return t(key, {
        number: active.number,
        position: inRound.indexOf(target) + 1,
        count: inRound.length,
      });
    },
    [t],
  );

  const announcements: Announcements = useMemo(
    () => ({
      onDragStart: ({ active }) => describe('speakers.dnd.lifted', String(active.id)),
      onDragOver: ({ active, over }) =>
        describe(
          'speakers.dnd.moved',
          String(active.id),
          over === null ? undefined : String(over.id),
        ),
      onDragEnd: ({ active, over }) =>
        describe(
          'speakers.dnd.dropped',
          String(active.id),
          over === null ? undefined : String(over.id),
        ),
      onDragCancel: () => t('speakers.dnd.cancelled'),
    }),
    [describe, t],
  );

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (over === null || active.id === over.id) return;
      // takt-032: while an own write runs, the versions on screen are not the ones to write with.
      if (inFlight.current) return;
      const list = viewRef.current;
      const moved = list.find((s) => s.id === active.id);
      const target = list.find((s) => s.id === over.id);
      if (moved === undefined || target === undefined || moved.round !== target.round) return;

      const inRound = list.filter((s) => s.round === moved.round);
      const from = inRound.findIndex((s) => s.id === moved.id);
      const to = inRound.findIndex((s) => s.id === target.id);
      if (from < 0 || to < 0) return;
      const reordered = arrayMove(inRound, from, to);

      let cursor = 0;
      setOverride(list.map((s) => (s.round === moved.round ? reordered[cursor++]! : s)));
      // The order is a property of the entire meeting's speaker list, including other rounds.
      if (listVersion === null || listEtag === null) {
        setOverride(null);
        return;
      }
      inFlight.current = true;
      setReorderRound(moved.round);
      const start = startOf();
      void (async () => {
        try {
          const rows = await api.reorderSpeakers(
            moved.round,
            reordered.map((s) => s.id),
            { ifMatch: listEtag },
          );
          // Right after the await: the answer's tag is the list version this write produced.
          const etag = api.lastWriteEtag();
          // Only the state the write began on takes the answer; after an actor switch or a newer
          // list it is dropped, and no override is revived (slice 010d).
          if (stillCurrent(start)) {
            keepRows(start, rows);
            if (etag !== undefined) setListMark({ actorId: start.actorId, base: listVersion, etag });
            setOverride(null);
          }
        } catch (error: unknown) {
          showProblem(error, problemTitle());
          setOverride(null);
          reload();
        } finally {
          inFlight.current = false;
          setReorderRound(null);
        }
      })();
    },
    [reload, listVersion, listEtag, startOf, stillCurrent, keepRows],
  );

  const registerButton = mayRegister ? (
    <Button
      variant="secondary"
      data-testid="speaker-register"
      onClick={() => setRegisterOpen(true)}
      icon={<Plus size={16} strokeWidth={2} aria-hidden="true" />}
    >
      {actionLabel(t, 'speaker.register')}
    </Button>
  ) : undefined;

  const empty = status !== 'loading' && view.length === 0;
  // Ziel 1 (slice 010b): recognised by the 403's ruleId in `useSpeakers`, never by the role
  // itself (AGENTS.md rule 4) — nothing here names a role.
  const forbidden = status === 'forbidden';

  // m3 (review round 1): the hint sits in the header's own meta slot, next to the title, the same
  // place `registerButton` would go — not a loose line that pushes the rest of the page down.
  const readOnlyHint = readOnly ? (
    <span
      data-testid="speakers-readonly-hint"
      className="flex items-center gap-1.5 text-[13px] text-ink-600"
    >
      <Eye size={14} strokeWidth={1.75} aria-hidden="true" />
      {t('speakers.readonly.hint')}
    </span>
  ) : undefined;
  // Slice 010b: a role that cannot even read the list has nothing to register into and no row to
  // act on — the header shows neither the register button nor the read-only hint while forbidden.
  const headerMeta = forbidden ? undefined : (registerButton ?? readOnlyHint);

  return (
    <div className="flex min-h-full flex-col gap-5">
      <PageHeader
        title={t('page.speakers.title')}
        description={t('page.speakers.description')}
        {...(headerMeta !== undefined ? { actions: headerMeta } : {})}
      />

      {forbidden ? (
        // Minor 5 (review round 2): `role="status"` marks the refusal as a status message. Nit 6
        // (review round 3): a live region mounted together with its content is often not announced,
        // so this is a hint to assistive technology, not a guaranteed announcement.
        <div data-testid="speakers-forbidden" role="status" className="grid min-h-0 flex-1">
          <Panel bodyClassName="grid place-items-center">
            <EmptyState
              icon={Lock}
              title={t('speakers.forbidden.title')}
              description={t('speakers.forbidden.body')}
              className="w-full max-w-xl"
            />
          </Panel>
        </div>
      ) : status === 'error' && view.length === 0 ? (
        <Panel bodyClassName="grid place-items-center">
          <EmptyState
            icon={TriangleAlert}
            title={t('speakers.error.title')}
            description={t('speakers.error.body')}
            action={
              <Button variant="secondary" onClick={reload}>
                {t('common.retry')}
              </Button>
            }
            className="w-full max-w-xl"
          />
        </Panel>
      ) : status === 'loading' && view.length === 0 ? (
        <SkeletonRows />
      ) : empty ? (
        <Panel bodyClassName="grid place-items-center">
          <EmptyState
            icon={ListOrdered}
            title={t('speakers.empty.title')}
            description={t('speakers.empty.body')}
            {...(registerButton !== undefined ? { action: registerButton } : {})}
            className="w-full max-w-xl"
          />
        </Panel>
      ) : (
        <>
          <NowSpeaking
            speaking={speaking}
            next={next}
            busyId={busyId}
            busyRound={reorderRound}
            onCall={actions.onCall}
            onFinish={actions.onFinish}
          />

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={{
              announcements,
              screenReaderInstructions: { draggable: t('speakers.dnd.instructions') },
            }}
            onDragEnd={onDragEnd}
          >
            <div className="flex flex-col gap-4">
              {rounds.map(([round, list]) => (
                <RoundSection
                  key={round}
                  round={round}
                  speakers={list}
                  current={round === currentRound}
                  open={roundOpen[round] ?? round === currentRound}
                  busyId={busyId}
                  busy={reorderRound === round}
                  onToggle={() =>
                    setRoundOpen((state) => ({
                      ...state,
                      [round]: !(state[round] ?? round === currentRound),
                    }))
                  }
                  actions={actions}
                />
              ))}
            </div>
          </DndContext>
        </>
      )}

      {/* Codex P1 on PR #38: keyed to the actor so a switch remounts the dialog and drops the previous actor's text synchronously; its own reset runs in an effect, one paint too late. */}
      <RegisterDialog
        key={actorId}
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        rounds={roundNumbers}
        defaultRound={currentRound}
        onSubmit={register}
      />
      <MoveDialog
        speaker={moving}
        rounds={roundNumbers}
        onClose={() => setMoving(null)}
        onSubmit={move}
      />
    </div>
  );
}
