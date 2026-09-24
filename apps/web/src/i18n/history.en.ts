import { historyDe } from './history.de';

export const historyEn: typeof historyDe = {
  'history.search.label': 'Search the corpus',
  'history.search.placeholder': 'Number, speaker, question or answer text',
  'history.results.title': 'Results',
  'history.results.label': 'List of results',
  'history.results.count': '{shown} of {total}',
  'history.results.more': 'Narrow the search to see the remaining results.',
  'history.results.empty.title': 'No match',
  'history.results.empty.body': 'No question matches this search text.',
  'history.results.loading': 'Searching the corpus …',
  'history.tab.label': 'View',
  'history.tab.question': 'History of one question',
  'history.tab.stream': 'Event stream',
  'history.timeline.title': 'History',
  'history.timeline.label': 'History of question {number}',
  'history.timeline.empty.title': 'No question selected',
  'history.timeline.empty.body':
    'Select a result on the left. Its course from capture to podium then appears here.',
  'history.stream.title': 'Event stream',
  'history.stream.description': 'The last {n} events of the general meeting.',
  'history.stream.empty.title': 'No events yet',
  'history.stream.empty.body': 'As soon as work happens in the meeting, it shows up here.',
  'history.col.time': 'Time',
  'history.col.event': 'Event',
  'history.col.detail': 'Details',
  'history.col.subject': 'Subject',
  'history.payload.version': 'Version {version}',
  'history.payload.reason': 'Reason: {reason}',
  'history.payload.unit': 'Answering unit: {unit}',
  'history.payload.track': 'Answer track: {track}',
  'history.payload.agenda': 'Agenda item {number}',
  'history.payload.assignment': 'Podium assignment: {assignment}',
  'history.payload.position': 'Position {position}',
  'history.payload.status': '{from} → {to}',
  'history.payload.merged': 'Merged into {number}',
  'history.payload.sources': 'Sources: {sources}',
  'history.payload.speaker': 'Request to speak: {name}',
  'history.payload.round': 'Round {round}',
  'history.question.label': 'Question {number}',
  'history.kpi.captureToDelivery': 'Capture → read out',
  'history.kpi.versions': 'Versions',
  'history.kpi.returns': 'Returns',
  'history.kpi.running': 'in progress',
  'history.sparkline.caption': 'Events per 5 minutes, last 2 hours',
  // Slice 010b (read paths in the interface): the states a 403 R-PERM-02/03 render instead of a
  // toast, recognised by ruleId alone (docs/slices/010b-lesepfade-oberflaeche.md, goals 1-3).
  // Whole view — no role at all may read `listQuestions` here (e.g. podium).
  'history.forbidden.title': 'This role has no read permission for this view.',
  'history.forbidden.body': 'The history is not open for reading in this role.',
  // The "History of one question" tab (`getQuestionHistory`) — e.g. observer, who may find the
  // question but holds no `history.read` (Nebenabfrage split, goals 2/3).
  'history.timeline.forbidden.title': 'This role has no read permission for the history of this question.',
  'history.timeline.forbidden.body': 'This role may not view the course of this question.',
  // The "Event stream" tab (`listEvents`) — e.g. observer, who holds no `event.read`.
  'history.stream.forbidden.title': 'This role has no read permission for the event stream.',
  'history.stream.forbidden.body': 'The event stream is not open for reading in this role.',
};
