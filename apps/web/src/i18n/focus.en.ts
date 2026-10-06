import { focusDe } from './focus.de';

export const focusEn: typeof focusDe = {
  'focus.list.label': 'My questions, oldest first',
  'focus.list.count': '{n} questions',
  'focus.empty.title': 'No question to answer',
  'focus.empty.body':
    'The questions whose answer you may draft and forward appear here. There is none with you right now.',
  'focus.forbidden.title': 'No read permission for this view in this role',
  'focus.forbidden.body': 'This role may not read the questions.',
  'focus.detail.empty': 'Choose a question on the left.',
  'focus.forwarded': 'Forwarded from {from}. Reason: {reason}',
  'focus.latest.title': 'Latest answer version',
  'focus.latest.none': 'No answer version yet.',
  'focus.write.open': 'Write the answer',
  'focus.write.continue': 'Continue the draft',
  'focus.write.title': 'Writing mode',
  'focus.write.close': 'Leave writing mode',
  'focus.write.keys': 'Ctrl+Enter saves the draft. Escape leaves writing mode; the text is kept.',
  'focus.write.gone': '{number} is no longer with you. The unsaved text was discarded.',
  'focus.write.goneKept': '{number} is no longer with you. Your unsaved text stays on this device until {time}.',
  'focus.write.rebase': 'A newer answer version has arrived meanwhile. Your text is not saved.',
  'focus.draft.unsaved': 'Unsaved text. Save first; then the question can be forwarded.',
  'focus.reading.time': 'Reading time approx. {time} min',
  'focus.reading.over': 'Longer than two minutes.',
  'focus.reading.help': 'Based on 130 words per minute; the target is two minutes.',
};
