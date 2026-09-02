/**
 * An event payload, said in the language of the house (docs/glossar.md): a reason, a version, an
 * answering unit by name, an answer track, the position on the podium. Nothing is invented here —
 * every line is a value that stands in the event log, only spelled out for a person.
 *
 * The switch is exhaustive over `DomainEvent`; a new event type makes this file fail to compile
 * rather than silently show an empty row.
 */
import type { DomainEvent } from '@hv/domain';
import { stageAssignmentLabel, statusLabel, trackLabel } from '../../i18n';
import type { Translate } from '../../i18n';
import { excerpt } from './lib';

export interface SummaryContext {
  unitNames: ReadonlyMap<string, string>;
  agendaNumbers: ReadonlyMap<string, number>;
  questionNumbers: ReadonlyMap<string, string>;
  speakerNames: ReadonlyMap<string, string>;
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
      parts.push(t('history.payload.speaker', { name: event.payload.displayName }));
      parts.push(t('history.payload.round', { round: event.payload.round }));
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
    case 'AnswerDrafted': {
      parts.push(t('history.payload.version', { version: event.payload.answer.version }));
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
  }

  return parts.join(' · ');
}
