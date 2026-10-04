/**
 * Scheibe 053 (decision 5): one question as the steering desk needs it — number, status, answer track, unit, seat,
 * the Wortmeldung and the wording — and its next steering step. Compact on purpose: no editor, no versions, no
 * history; those stay in the Beantwortung.
 *
 * Every button comes from `_actions` through `steeringActions` (never a role, never the status, AGENTS.md R4/R5);
 * at most one is primary (D2), "Verweigerung vorschlagen" never. What may not be done is not shown (D9). Nothing of a
 * refusal's justification or wording is shown here, only its badge.
 */
import type { Permission, Question, StageSeat, Unit } from '@hv/domain';
import { Badge, Button, KeyValue, KeyValueList, Panel, StatusBadge, Toolbar, ToolbarSpacer, TrackBadge } from '../../components';
import { actionLabel, useT } from '../../i18n';
import { latestIsRefusal } from '../answers/refusal';
import { steeringActions } from './steering';
import type { SteeringAction } from './steering';

const PERMISSION: Readonly<Record<SteeringAction, Permission>> = {
  classify: 'question.classify',
  assign: 'question.assign',
  forward: 'question.forward',
  refuse: 'question.refuse.propose',
};

export function SteeringDetail({
  question,
  units,
  seats,
  busy,
  onAction,
}: {
  question: Question;
  units: readonly Unit[];
  seats: readonly StageSeat[];
  /** The write door is taken (takt-008): buttons stay focusable but do nothing. */
  busy: boolean;
  onAction: (action: SteeringAction) => void;
}) {
  const t = useT();
  const { primary, secondary } = steeringActions(question._actions);
  const unit = units.find((candidate) => candidate.id === question.unitId);
  const seatId = question.seatId ?? question.stageAssignment;
  const seat = seatId === undefined ? undefined : seats.find((candidate) => candidate.id === seatId);
  const seatLabel = seat !== undefined && seat.label.trim() !== '' ? seat.label : undefined;

  const button = (action: SteeringAction, isPrimary: boolean) => (
    <Button
      key={action}
      size="sm"
      {...(isPrimary ? { 'data-primary': 'true' } : {})}
      variant={isPrimary ? 'primary' : 'secondary'}
      data-testid={`steering-${action}`}
      aria-disabled={busy}
      onClick={() => {
        if (!busy) onAction(action);
      }}
    >
      {actionLabel(t, PERMISSION[action])}
    </Button>
  );

  return (
    <Panel
      className="h-full"
      padded={false}
      bodyClassName="flex min-h-0 flex-col"
      title={
        <span className="flex items-center gap-2">
          {/* Focus target after a write without a primary action (takt-008), never a Tab stop of its own. */}
          <span
            tabIndex={-1}
            data-testid="steering-detail-number"
            className="font-mono text-[13px] text-ink-900 outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            {question.number}
          </span>
          <StatusBadge status={question.status} />
          {question.track !== undefined && <TrackBadge track={question.track} />}
          {latestIsRefusal(question) && (
            <span data-testid="steering-detail-refusal">
              <Badge tone="warning">{t('answers.refusal.badge')}</Badge>
            </span>
          )}
        </span>
      }
      footer={
        primary === undefined && secondary.length === 0 ? undefined : (
          <div data-testid="steering-actions">
            <Toolbar label={t('answers.detail.actions')}>
              {secondary.map((action) => button(action, false))}
              <ToolbarSpacer />
              {primary !== undefined && button(primary, true)}
            </Toolbar>
          </div>
        )
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 py-4">
          <KeyValueList className="grid-cols-2 sm:grid-cols-3">
            <KeyValue label={t('answers.detail.unit')}>
              <span data-testid="steering-detail-unit">{unit === undefined ? t('common.none') : (unit.shortName ?? unit.name)}</span>
            </KeyValue>
            <KeyValue label={t('answers.detail.stageAssignment')}>
              {seatId === undefined ? (
                <span data-testid="steering-detail-seat">{t('common.none')}</span>
              ) : seatLabel !== undefined ? (
                <span data-testid="steering-detail-seat">{seatLabel}</span>
              ) : (
                <span data-testid="steering-detail-seat" className="font-mono">{seatId}</span>
              )}
            </KeyValue>
            <KeyValue label={t('answers.detail.speaker')}>
              <span className="truncate">{question.speakerDisplayName ?? t('common.none')}</span>
            </KeyValue>
          </KeyValueList>

          <div>
            <span className="hv-label">{t('answers.detail.label')}</span>
            <p className="mt-1 text-[15px] leading-6 text-ink-900">{question.text}</p>
          </div>

          {question.returnReason !== undefined && (
            <p className="rounded-md border border-status-in-review-bd bg-status-in-review-bg px-3 py-2 text-[13px] text-status-in-review-fg">
              <span className="hv-label mr-2 text-status-in-review-fg">{t('answers.detail.returned')}</span>
              {question.returnReason}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
