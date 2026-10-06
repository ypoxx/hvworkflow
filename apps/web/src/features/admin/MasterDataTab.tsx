/**
 * Scheibe 041 (decision 4): one master-data tab — Fachbereiche, Tagesordnung or Bühnenplätze of the managed meeting.
 * The tab reads the meeting version first and the list after it (`readMaster`); every add, edit and remove is its own
 * dialog and one whole-list replacement with `If-Match` of that version (`writeMaster`, decision 6). 412 closes the
 * dialog, reads again and says so; a refusal stays in the dialog with its rule id. The counters next to units and
 * seats come from the service (`counts.byUnit`, `counts.bySeat`) and explain why a removal is refused.
 */
import { useCallback, useEffect, useState } from 'react';
import type { AgendaItem, Meeting, StageSeat, Unit } from '@hv/domain';
import { api } from '../../api';
import { useApiVersion } from '../../api/useApiVersion';
import { Badge, Button, TBody, TD, TH, THead, TR, Table, showProblem, showToast } from '../../components';
import { useT } from '../../i18n';
import type { TKey, Translate } from '../../i18n';
import { useActorDialog } from './actorScope';
import { EntryDialog } from './EntryDialog';
import { entryName, formOf } from './entries';
import { PRIMARY_FOCUS_KEY, usePendingFocus } from './focus';
import { nextAgendaNumber, nextSeatPosition } from './lists';
import { readMaster, writeMaster } from './masterData';
import type { MasterChange, MasterItems, MasterKind, MasterRead } from './masterData';
import { EmptyList, LoadingRows, ReadFailed, RowAction, TabFrame } from './parts';
import { attempt, outcomeEffects } from './problems';
import type { DialogProblem } from './problems';
import { RemoveDialog } from './RemoveDialog';

interface KindTexts {
  title: TKey;
  add: TKey;
  edit: TKey;
  body: TKey;
  empty: TKey;
}

const TEXTS: Readonly<Record<MasterKind, KindTexts>> = {
  units: { title: 'admin.tab.units', add: 'admin.units.add', edit: 'admin.units.edit', body: 'admin.units.body', empty: 'admin.units.empty' },
  agenda: { title: 'admin.tab.agenda', add: 'admin.agenda.add', edit: 'admin.agenda.edit', body: 'admin.agenda.body', empty: 'admin.agenda.empty' },
  seats: { title: 'admin.tab.seats', add: 'admin.seats.add', edit: 'admin.seats.edit', body: 'admin.seats.body', empty: 'admin.seats.empty' },
};

type Read<K extends MasterKind> = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; read: MasterRead<K> };
type EntryDialogState = { kind: 'add' } | { kind: 'edit'; id: string } | { kind: 'remove'; id: string };

/** A counter of the service, or a dash when it is missing. */
function count(counts: Record<string, number> | undefined, id: string): string {
  const value = counts?.[id];
  return value === undefined ? '–' : String(value);
}

function progressOf(item: AgendaItem): { key: TKey; tone: 'neutral' | 'accent' | 'success' } {
  if (item.votingClosedAt !== undefined) return { key: 'admin.agenda.progress.votingClosed', tone: 'success' };
  if (item.votingOpenedAt !== undefined) return { key: 'admin.agenda.progress.votingOpened', tone: 'accent' };
  if (item.openedAt !== undefined) return { key: 'admin.agenda.progress.opened', tone: 'accent' };
  return { key: 'admin.agenda.progress.none', tone: 'neutral' };
}

function Head({ kind, t }: { kind: MasterKind; t: Translate }) {
  const actions = (
    <TH>
      <span className="sr-only">{t('admin.row.actions')}</span>
    </TH>
  );
  if (kind === 'units') {
    return (
      <tr>
        <TH>{t('admin.units.col.shortName')}</TH>
        <TH>{t('admin.units.col.name')}</TH>
        <TH>{t('admin.units.col.id')}</TH>
        <TH numeric>{t('admin.units.col.open')}</TH>
        {actions}
      </tr>
    );
  }
  if (kind === 'agenda') {
    return (
      <tr>
        <TH numeric className="w-16">{t('admin.agenda.col.number')}</TH>
        <TH>{t('admin.agenda.col.title')}</TH>
        <TH>{t('admin.agenda.col.progress')}</TH>
        {actions}
      </tr>
    );
  }
  return (
    <tr>
      <TH numeric className="w-20">{t('admin.seats.col.position')}</TH>
      <TH>{t('admin.seats.col.label')}</TH>
      <TH>{t('admin.seats.col.person')}</TH>
      <TH>{t('admin.seats.col.device')}</TH>
      <TH numeric>{t('admin.seats.col.staged')}</TH>
      {actions}
    </tr>
  );
}

function Cells({ kind, item, meeting, t }: { kind: MasterKind; item: MasterItems[MasterKind]; meeting: Meeting | null; t: Translate }) {
  if (kind === 'units') {
    const unit = item as Unit;
    return (
      <>
        <TD className="font-medium text-ink-900">{unit.shortName ?? t('common.none')}</TD>
        <TD>{unit.name}</TD>
        <TD mono className="text-[12px] text-ink-600">{unit.id}</TD>
        <TD numeric mono data-testid="admin-unit-open">{count(meeting?.counts.byUnit, unit.id)}</TD>
      </>
    );
  }
  if (kind === 'agenda') {
    const agendaItem = item as AgendaItem;
    const progress = progressOf(agendaItem);
    return (
      <>
        <TD numeric mono>{agendaItem.number}</TD>
        <TD>{agendaItem.title}</TD>
        <TD>
          <Badge tone={progress.tone} dot>
            {t(progress.key)}
          </Badge>
        </TD>
      </>
    );
  }
  const seat = item as StageSeat;
  return (
    <>
      <TD numeric mono>{seat.position ?? '–'}</TD>
      <TD>{seat.label}</TD>
      <TD mono={seat.personId !== undefined} className="text-[12px]">{seat.personId ?? t('common.none')}</TD>
      <TD mono={seat.deviceId !== undefined} className="text-[12px]">{seat.deviceId ?? t('common.none')}</TD>
      <TD numeric mono>{count(meeting?.counts.bySeat, seat.id)}</TD>
    </>
  );
}

const ADD_TEST_IDS: Readonly<Record<MasterKind, string>> = {
  units: 'admin-units-add',
  agenda: 'admin-agenda-add',
  seats: 'admin-seats-add',
};

export function MasterDataTab({
  kind,
  meetingId,
  meeting,
  actorId,
}: {
  kind: MasterKind;
  meetingId: string;
  /** The header's meeting, only for the counters (never for `If-Match`). */
  meeting: Meeting | null;
  actorId: string;
}) {
  const t = useT();
  const texts = TEXTS[kind];
  const version = useApiVersion();
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<Read<MasterKind>>({ status: 'loading' });
  const [dialog, setDialog] = useActorDialog<EntryDialogState>(actorId);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<DialogProblem | undefined>(undefined);
  const { container, arm } = usePendingFocus(state);
  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    readMaster(api, meetingId, kind).then(
      (read) => {
        if (!cancelled) setState({ status: 'ready', read });
      },
      () => {
        // A failure is a state of the tab (D6), also after an earlier success: never stale rows with a fresh version.
        if (!cancelled) setState({ status: 'failed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [kind, meetingId, version, tick]);

  const open = (next: EntryDialogState): void => {
    setProblem(undefined);
    setDialog(next);
  };
  const close = useCallback(() => {
    setProblem(undefined);
    setDialog(null);
  }, [setDialog]);

  const write = async (change: MasterChange<MasterKind>, focusKey: string): Promise<void> => {
    if (state.status !== 'ready') return;
    const read = state.read;
    setBusy(true);
    setProblem(undefined);
    const effects = outcomeEffects(await attempt(() => writeMaster(api, meetingId, kind, read, change)));
    setBusy(false);
    if (effects.problem !== undefined) setProblem(effects.problem);
    if (effects.error !== undefined) showProblem(effects.error, t('toast.problem'));
    if (effects.toast !== undefined) showToast({ tone: 'neutral', title: t(effects.toast) });
    if (effects.close) {
      arm(focusKey);
      close();
    }
    if (effects.reload) reload();
  };

  const items = state.status === 'ready' ? state.read.items : [];
  const find = (id: string): MasterItems[MasterKind] | undefined => items.find((item) => item.id === id);
  const next = kind === 'agenda' ? nextAgendaNumber(items as readonly AgendaItem[]) : nextSeatPosition(items as readonly StageSeat[]);
  const edited = dialog !== null && dialog.kind !== 'add' ? find(dialog.id) : undefined;

  return (
    <div ref={container} className="h-full">
      <TabFrame
        title={t(texts.title)}
        action={
          <Button
            variant="primary"
            data-testid={ADD_TEST_IDS[kind]}
            data-focus-key={PRIMARY_FOCUS_KEY}
            aria-disabled={state.status !== 'ready'}
            onClick={() => open({ kind: 'add' })}
          >
            {t(texts.add)}
          </Button>
        }
      >
        {state.status === 'loading' && <LoadingRows />}
        {state.status === 'failed' && <ReadFailed onRetry={reload} />}
        {state.status === 'ready' && items.length === 0 && <EmptyList text={t(texts.empty)} />}
        {state.status === 'ready' && items.length > 0 && (
          <Table>
            <THead>
              <Head kind={kind} t={t} />
            </THead>
            <TBody>
              {items.map((item) => {
                const name = entryName(kind, item);
                return (
                  <TR key={item.id}>
                    <Cells kind={kind} item={item} meeting={meeting} t={t} />
                    {/* The kit's row takes no attributes; the action cell carries the row's hooks for the e2e. */}
                    <TD className="whitespace-nowrap text-right" data-testid="admin-row" data-kind={kind} data-id={item.id} data-name={name}>
                      <RowAction
                        label={t('admin.row.edit')}
                        name={t('admin.row.editNamed', { name })}
                        testId="admin-row-edit"
                        focusKey={`edit-${item.id}`}
                        onClick={() => open({ kind: 'edit', id: item.id })}
                      />
                      <RowAction
                        label={t('admin.row.remove')}
                        name={t('admin.row.removeNamed', { name })}
                        testId="admin-row-remove"
                        focusKey={`remove-${item.id}`}
                        onClick={() => open({ kind: 'remove', id: item.id })}
                      />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </TabFrame>

      {dialog?.kind === 'add' && (
        <EntryDialog
          key={`${actorId}:${kind}:add`}
          kind={kind}
          titleKey={texts.add}
          bodyKey={texts.body}
          initial={formOf(kind, undefined, next)}
          busy={busy}
          {...(problem !== undefined ? { problem } : {})}
          onClose={close}
          onSubmit={(entry) => void write({ op: 'add', entry } as MasterChange<MasterKind>, PRIMARY_FOCUS_KEY)}
        />
      )}
      {dialog?.kind === 'edit' && edited !== undefined && (
        <EntryDialog
          key={`${actorId}:${kind}:edit:${dialog.id}`}
          kind={kind}
          titleKey={texts.edit}
          bodyKey={texts.body}
          initial={formOf(kind, edited, next)}
          busy={busy}
          {...(problem !== undefined ? { problem } : {})}
          onClose={close}
          onSubmit={(entry) => void write({ op: 'replace', id: dialog.id, entry } as MasterChange<MasterKind>, `edit-${dialog.id}`)}
        />
      )}
      {dialog?.kind === 'remove' && edited !== undefined && (
        <RemoveDialog
          key={`${actorId}:${kind}:remove:${dialog.id}`}
          name={entryName(kind, edited)}
          busy={busy}
          {...(problem !== undefined ? { problem } : {})}
          onClose={close}
          onConfirm={() => void write({ op: 'remove', id: dialog.id }, PRIMARY_FOCUS_KEY)}
        />
      )}
    </div>
  );
}
