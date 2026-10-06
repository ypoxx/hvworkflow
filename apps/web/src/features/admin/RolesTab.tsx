/**
 * Scheibe 041 (decision 3): the role assignments (Rollenzuordnungen) of the managed meeting — one row per assignment,
 * sorted by subject id and the order of the rights table; state badge (display only), "Rolle zuordnen" as the one
 * primary action, "Entziehen" per active row. The list itself is read by the page (it decides the locked state).
 */
import { useCallback, useEffect, useId, useState } from 'react';
import type { RoleAssignment, RoleAssignmentCreate, Unit } from '@hv/domain';
import { api } from '../../api';
import { roleCards } from '../../api/roleCards';
import { useApiVersion } from '../../api/useApiVersion';
import { Badge, Button, TBody, TD, TH, THead, TR, Table, showProblem, showToast } from '../../components';
import type { BadgeTone } from '../../components';
import { roleLabel, useLang, useT } from '../../i18n';
import type { TKey } from '../../i18n';
import type { Access } from './access';
import { useActorDialog } from './actorScope';
import { AssignDialog } from './AssignDialog';
import { assignmentState, submitRevoke, visibleAssignments } from './assignments';
import type { AssignmentState } from './assignments';
import { PRIMARY_FOCUS_KEY, usePendingFocus } from './focus';
import { EmptyList, LoadingRows, ReadFailed, RowAction, TabFrame } from './parts';
import { attempt, outcomeEffects } from './problems';
import type { DialogProblem } from './problems';
import { RevokeDialog } from './RevokeDialog';
import { formatBerlinDateTime } from './time';

const STATE_KEYS: Readonly<Record<AssignmentState, TKey>> = {
  active: 'admin.roles.state.active',
  expired: 'admin.roles.state.expired',
  revoked: 'admin.roles.state.revoked',
};
const STATE_TONES: Readonly<Record<AssignmentState, BadgeTone>> = {
  active: 'success',
  expired: 'warning',
  revoked: 'neutral',
};

type RolesDialog = { kind: 'assign' } | { kind: 'revoke'; assignment: RoleAssignment };

const NO_UNITS: readonly Unit[] = [];

/** The units of the meeting, for the unit column and the dialog; read again with every change of the log. */
function useUnits(meetingId: string): readonly Unit[] {
  const version = useApiVersion();
  const [units, setUnits] = useState<readonly Unit[]>(NO_UNITS);
  useEffect(() => {
    let cancelled = false;
    api.listMeetingUnits(meetingId).then(
      (next) => {
        if (!cancelled) setUnits(next);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [meetingId, version]);
  return units;
}

export function RolesTab({
  meetingId,
  access,
  now,
  actorId,
  onReload,
}: {
  meetingId: string;
  access: Access;
  now: Date;
  actorId: string;
  onReload: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const cards = roleCards();
  const roleOrder = cards.map((card) => card.role);
  const units = useUnits(meetingId);
  const [showInactive, setShowInactive] = useState(false);
  const [dialog, setDialog] = useActorDialog<RolesDialog>(actorId);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<DialogProblem | undefined>(undefined);
  const { container, arm } = usePendingFocus(access);
  const toggleId = useId();

  const open = (next: RolesDialog): void => {
    setProblem(undefined);
    setDialog(next);
  };
  const close = useCallback(() => {
    setProblem(undefined);
    setDialog(null);
  }, [setDialog]);

  const run = async (write: () => Promise<unknown>): Promise<void> => {
    setBusy(true);
    setProblem(undefined);
    const effects = outcomeEffects(await attempt(write));
    setBusy(false);
    if (effects.problem !== undefined) setProblem(effects.problem);
    if (effects.error !== undefined) showProblem(effects.error, t('toast.problem'));
    if (effects.toast !== undefined) showToast({ tone: 'neutral', title: t(effects.toast) });
    if (effects.close) {
      arm(PRIMARY_FOCUS_KEY);
      close();
    }
    if (effects.reload) onReload();
  };

  const all = access.status === 'ready' ? access.assignments : [];
  const rows = visibleAssignments(all, roleOrder, now, showInactive);
  const subjects = [...new Set(all.map((assignment) => assignment.subjectId))].sort();
  const unitName = (unitId: string | undefined): string => {
    if (unitId === undefined) return t('common.none');
    const unit = units.find((entry) => entry.id === unitId);
    return unit === undefined ? unitId : (unit.shortName ?? unit.name);
  };

  return (
    <div ref={container} className="h-full">
      <TabFrame
        title={t('admin.tab.roles')}
        toolbar={
          <label htmlFor={toggleId} className="mr-2 flex items-center gap-2 text-[13px] text-ink-700">
            <input
              id={toggleId}
              type="checkbox"
              data-testid="admin-roles-show-inactive"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
            />
            {t('admin.roles.showInactive')}
          </label>
        }
        action={
          <Button variant="primary" data-testid="admin-assign-open" data-focus-key={PRIMARY_FOCUS_KEY} onClick={() => open({ kind: 'assign' })}>
            {t('admin.roles.assign')}
          </Button>
        }
      >
        {access.status === 'loading' && <LoadingRows />}
        {access.status === 'failed' && <ReadFailed onRetry={onReload} />}
        {access.status === 'ready' && rows.length === 0 && <EmptyList text={t('admin.roles.empty')} />}
        {access.status === 'ready' && rows.length > 0 && (
          <Table>
            <THead>
              <tr>
                <TH>{t('admin.roles.col.subject')}</TH>
                <TH>{t('admin.roles.col.role')}</TH>
                <TH>{t('admin.roles.col.unit')}</TH>
                <TH>{t('admin.roles.col.expires')}</TH>
                <TH>{t('admin.roles.col.assigned')}</TH>
                <TH>{t('admin.roles.col.state')}</TH>
                <TH>
                  <span className="sr-only">{t('admin.row.actions')}</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((assignment) => {
                const state = assignmentState(assignment, now);
                return (
                  <TR key={assignment.id}>
                    <TD>
                      <span data-testid="admin-role-subject" className="font-mono text-[12px] text-ink-900">
                        {assignment.subjectId}
                      </span>
                      {assignment.deputyForSubjectId !== undefined && (
                        <span className="block text-2xs text-ink-600">
                          {t('admin.roles.deputyFor', { subject: assignment.deputyForSubjectId })}
                        </span>
                      )}
                    </TD>
                    <TD data-testid="admin-role-cell" data-role={assignment.role}>
                      {roleLabel(t, assignment.role)}
                    </TD>
                    <TD>{unitName(assignment.unitId)}</TD>
                    <TD mono={assignment.expiresAt !== undefined} data-testid="admin-role-expires">
                      {assignment.expiresAt === undefined
                        ? <span className="text-ink-600">{t('admin.roles.expires.meetingEnd')}</span>
                        : formatBerlinDateTime(assignment.expiresAt, lang)}
                    </TD>
                    <TD>
                      <span className="font-mono tabular-nums text-ink-800">{formatBerlinDateTime(assignment.assignedAt, lang)}</span>
                      {assignment.assignedBy.displayName !== undefined && (
                        <span className="ml-2 text-ink-600">{assignment.assignedBy.displayName}</span>
                      )}
                    </TD>
                    <TD>
                      <span data-testid="admin-role-state" data-state={state}>
                        <Badge tone={STATE_TONES[state]} dot>
                          {t(STATE_KEYS[state])}
                        </Badge>
                      </span>
                    </TD>
                    <TD className="text-right">
                      {state === 'active' && (
                        <RowAction
                          label={t('admin.roles.revoke')}
                          name={t('admin.roles.revokeNamed', { role: roleLabel(t, assignment.role), subject: assignment.subjectId })}
                          testId="admin-revoke"
                          focusKey={`revoke-${assignment.id}`}
                          onClick={() => open({ kind: 'revoke', assignment })}
                        />
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </TabFrame>

      {dialog?.kind === 'assign' && (
        <AssignDialog
          key={`${actorId}:assign`}
          cards={cards}
          units={units}
          subjects={subjects}
          busy={busy}
          {...(problem !== undefined ? { problem } : {})}
          onClose={close}
          onSubmit={(input: RoleAssignmentCreate) => {
            void run(() => api.assignRole(input));
          }}
        />
      )}
      {dialog?.kind === 'revoke' && (
        <RevokeDialog
          key={`${actorId}:revoke:${dialog.assignment.id}`}
          subjectId={dialog.assignment.subjectId}
          role={dialog.assignment.role}
          busy={busy}
          {...(problem !== undefined ? { problem } : {})}
          onClose={close}
          onSubmit={(reason) => {
            const id = dialog.assignment.id;
            void run(() => submitRevoke(api, id, reason));
          }}
        />
      )}
    </div>
  );
}
