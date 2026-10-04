/**
 * An event payload, said in the language of the house (docs/glossar.md): a reason, a version, an
 * answering unit by name, an answer track, the position on the podium. Nothing is invented here —
 * every line is a value that stands in the event log, only spelled out for a person.
 *
 * The switch is exhaustive over `DomainEvent`; a new event type makes this file fail to compile
 * rather than silently show an empty row.
 */
import type { DomainEvent } from '@hv/domain';
import { roleLabel, stageAssignmentLabel, statusLabel, trackLabel } from '../../i18n';
import type { Translate } from '../../i18n';
// Not re-exported by the i18n entry point (outside this slice's files); a label helper, not a dictionary.
import { forwardReasonLabel } from '../../i18n/labels';
import { excerpt } from './lib';

export interface SummaryContext {
  unitNames: ReadonlyMap<string, string>;
  agendaNumbers: ReadonlyMap<string, number>;
  questionNumbers: ReadonlyMap<string, string>;
  speakerNames: ReadonlyMap<string, string>;
  /**
   * Scheibe 045: `<subjectId>:<version>` of every draft with a refusal kind among the loaded events. An
   * approval of such a version is labelled "Verweigerung freigegeben" (`eventLabel`); a proposal outside
   * the loaded window (paging, takt-038) leaves the ordinary label.
   */
  refusalVersions: ReadonlySet<string>;
}

/** Scheibe 045: the keys of `SummaryContext.refusalVersions`, read off the loaded events only. */
export function refusalVersionsOf(events: readonly DomainEvent[]): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const event of events) {
    if (event.type !== 'AnswerDrafted') continue;
    const kind = event.payload.answer.answerKind;
    if (kind === 'refusal_no_claim' || kind === 'refusal_with_ground') {
      keys.add(`${event.subjectId}:${event.payload.answer.version}`);
    }
  }
  return keys;
}

/** The thing the event happened to: a question by its number, a speaker by name. */
export function eventSubject(event: DomainEvent, context: SummaryContext): string | undefined {
  return context.questionNumbers.get(event.subjectId) ?? context.speakerNames.get(event.subjectId);
}

export function eventSummary(t: Translate, event: DomainEvent, context: SummaryContext): string {
  const parts: string[] = [];
  const unit = (id: string): string => context.unitNames.get(id) ?? id;

  switch (event.type) {
    case 'MeetingCreated':
      parts.push(event.payload.title);
      break;
    case 'SpeakerRegistered':
      // The log can contain both historical cleartext and new PII. The current actor's speaker
      // projection is the only source allowed to supply a name to this view.
      if (context.speakerNames.has(event.subjectId)) {
        parts.push(t('history.payload.speaker', { name: context.speakerNames.get(event.subjectId)! }));
      }
      parts.push(t('history.payload.round', { round: event.payload.round }));
      break;
    case 'RoleAssigned':
    case 'RoleRevoked':
      parts.push(roleLabel(t, event.payload.role));
      break;
    case 'SpeakersReordered':
      parts.push(t('history.payload.round', { round: event.payload.round }));
      break;
    case 'SpeakerUpdated':
      if (event.payload.round !== undefined) {
        parts.push(t('history.payload.round', { round: event.payload.round }));
      }
      break;
    case 'ContributionCaptured':
      parts.push(excerpt(event.payload.text));
      break;
    case 'QuestionCaptured':
      parts.push(excerpt(event.payload.text));
      break;
    case 'QuestionClassified': {
      parts.push(t('history.payload.track', { track: trackLabel(t, event.payload.track) }));
      const agendaItemId = event.payload.agendaItemId;
      if (agendaItemId !== undefined) {
        const number = context.agendaNumbers.get(agendaItemId);
        if (number !== undefined) parts.push(t('history.payload.agenda', { number }));
      }
      if (event.payload.stageAssignment !== undefined) {
        parts.push(
          t('history.payload.assignment', {
            assignment: stageAssignmentLabel(t, event.payload.stageAssignment),
          }),
        );
      }
      break;
    }
    case 'QuestionAssigned':
      parts.push(t('history.payload.unit', { unit: unit(event.payload.unitId) }));
      break;
    case 'QuestionForwarded': {
      // Scheibe 048: from where to where, and the closed reason code by its label (an unknown code of a
      // later contract stage stays the code). A question without a previous unit names only the target.
      const from = event.payload.fromUnitId;
      parts.push(from !== undefined
        ? t('history.payload.unitChange', { from: unit(from), to: unit(event.payload.unitId) })
        : t('history.payload.unit', { unit: unit(event.payload.unitId) }));
      parts.push(t('history.payload.forwardReason', { reason: forwardReasonLabel(t, event.payload.reasonCode) }));
      break;
    }
    case 'AnswerDrafted': {
      parts.push(t('history.payload.version', { version: event.payload.answer.version }));
      // Scheibe 045: the kind of a refusal, and the ground's title from the snapshot in the event (the
      // catalogue at the time of the proposal, never the current one). `payload.pii` is never read here.
      const answer = event.payload.answer;
      if (answer.answerKind === 'refusal_no_claim') parts.push(t('history.payload.refusal.noClaim'));
      if (answer.answerKind === 'refusal_with_ground') {
        parts.push(t('history.payload.refusal.withGround', { title: answer.refusalGround?.title ?? answer.refusalGroundId ?? '' }));
      }
      const sources = event.payload.answer.sources;
      if (sources !== undefined && sources.length > 0) {
        parts.push(t('history.payload.sources', { sources: sources.join('; ') }));
      }
      break;
    }
    case 'QuestionSubmittedForReview':
    case 'QuestionApproved':
      parts.push(t('history.payload.version', { version: event.payload.answerVersion }));
      break;
    case 'QuestionLegalCleared':
      if (event.payload.answerVersion !== undefined) {
        parts.push(t('history.payload.version', { version: event.payload.answerVersion }));
      }
      break;
    case 'QuestionReturned':
      parts.push(
        t('history.payload.status', {
          from: statusLabel(t, event.payload.fromStatus),
          to: statusLabel(t, event.payload.toStatus),
        }),
      );
      parts.push(t('history.payload.reason', { reason: event.payload.reason }));
      break;
    case 'QuestionStaged':
      parts.push(t('history.payload.position', { position: event.payload.stagePosition }));
      break;
    case 'QuestionDelivered':
      if (event.payload.answerVersion !== undefined) {
        parts.push(t('history.payload.version', { version: event.payload.answerVersion }));
      }
      break;
    case 'QuestionClosed':
      break;
    case 'QuestionWithdrawn':
      parts.push(t('history.payload.reason', { reason: event.payload.reason }));
      break;
    case 'QuestionMerged':
      parts.push(
        t('history.payload.merged', {
          number:
            context.questionNumbers.get(event.payload.intoQuestionId) ??
            event.payload.intoQuestionId,
        }),
      );
      break;
    case 'ContributionClaimed':
    case 'ContributionReleased':
    case 'QuestionClaimed':
    case 'QuestionReleased':
    case 'IdempotencyRecorded':
      // The event label is enough; command keys and claim actors are not repeated in the summary.
      break;
    case 'AgendaItemsReplaced':
    case 'UnitsReplaced':
    case 'StageSeatsReplaced':
      // Scheibe 040b: the event label is enough; seat labels in the history follow with slice 056.
      break;
  }

  return parts.join(' · ');
}
