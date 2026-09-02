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
import { ListOrdered, Plus, TriangleAlert } from 'lucide-react';
import type { Speaker, SpeakerRegistration } from '@hv/domain';
import { etagOf } from '@hv/domain';
import { api } from '../../api';
import { Button, EmptyState, Panel, PageHeader, Toolbar, showProblem } from '../../components';
import { actionLabel, getLang, translate, useT } from '../../i18n';
import { useMeeting } from '../../app/useMeeting';
import { MoveDialog } from './MoveDialog';
import { NowSpeaking } from './NowSpeaking';
import { RoundSection } from './RoundSection';
import { ROW_COLUMNS } from './SpeakerRow';
import type { SpeakerRowActions } from './SpeakerRow';
import { useSpeakers } from './useSpeakers';
import { RegisterDialog } from './RegisterDialog';

/** The failed-write message: title from the problem, fallback from the dictionary. */
const problemTitle = (): string => translate(getLang(), 'toast.problem');

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
  const { status, speakers, reload } = useSpeakers();

  // While a reorder is in flight the list shows the new order; the refetch then confirms it.
  const [override, setOverride] = useState<readonly Speaker[] | null>(null);
  useEffect(() => setOverride(null), [speakers]);
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
  const mayRegister = view.length === 0 || view.some((speaker) => speaker._actions.includes('speaker.update'));

  const run = useCallback(
    async (id: string, action: () => Promise<unknown>): Promise<boolean> => {
      setBusyId(id);
      try {
        await action();
        return true;
      } catch (error: unknown) {
        showProblem(error, problemTitle());
        reload();
        return false;
      } finally {
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
          const running = viewRef.current.find(
            (s) => s.status === 'speaking' && s.id !== speaker.id,
          );
          if (running !== undefined) {
            await api.updateSpeaker(
              running.id,
              { status: 'finished' },
              { ifMatch: etagOf(running.version) },
            );
          }
          await api.updateSpeaker(
            speaker.id,
            { status: 'speaking' },
            { ifMatch: etagOf(speaker.version) },
          );
        });
      },
      onFinish: (speaker) => {
        void run(speaker.id, () =>
          api.updateSpeaker(
            speaker.id,
            { status: 'finished' },
            { ifMatch: etagOf(speaker.version) },
          ),
        );
      },
      onWithdraw: (speaker) => {
        void run(speaker.id, () =>
          api.updateSpeaker(
            speaker.id,
            { status: 'withdrawn' },
            { ifMatch: etagOf(speaker.version) },
          ),
        );
      },
      onMove: (speaker) => setMoving(speaker),
    }),
    [run],
  );

  const register = useCallback(
    async (input: SpeakerRegistration): Promise<boolean> =>
      run('new', () => api.registerSpeaker(input)),
    [run],
  );

  const move = useCallback(
    async (speaker: Speaker, round: number): Promise<boolean> =>
      run(speaker.id, async () => {
        await api.updateSpeaker(speaker.id, { round }, { ifMatch: etagOf(speaker.version) });
        // The dialog promises the end of the round, so the positions of the target round are
        // written once more with this Wortmeldung appended.
        if (speaker._actions.includes('speaker.reorder')) {
          const target = viewRef.current
            .filter((s) => s.round === round && s.id !== speaker.id)
            .map((s) => s.id);
          await api.reorderSpeakers(round, [...target, speaker.id]);
        }
      }),
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
      // No `ifMatch`: the order is a property of the round, not of one Wortmeldung, and the
      // contract's reorder takes the whole sequence of ids.
      api
        .reorderSpeakers(
          moved.round,
          reordered.map((s) => s.id),
        )
        .catch((error: unknown) => {
          showProblem(error, problemTitle());
          setOverride(null);
          reload();
        });
    },
    [reload],
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

  return (
    <div className="flex min-h-full flex-col gap-5">
      <PageHeader
        title={t('page.speakers.title')}
        description={t('page.speakers.description')}
        {...(registerButton !== undefined ? { actions: registerButton } : {})}
      />

      {status === 'error' && view.length === 0 ? (
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
            onCall={actions.onCall}
            onFinish={actions.onFinish}
          />

          <Toolbar label={t('page.speakers.title')} className="shrink-0">
            <span className="text-2xs text-ink-500">{t('speakers.drag.hint')}</span>
          </Toolbar>

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

      <RegisterDialog
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
