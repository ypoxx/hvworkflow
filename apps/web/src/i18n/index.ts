/** The i18n entry point. Components import from here, never from the dictionaries directly. */
export { getLang, setLang, translate, useLang, useT } from './store';
export {
  actionLabel,
  eventTypeLabel,
  roleLabel,
  stageAssignmentLabel,
  statusLabel,
  trackLabel,
  trackShortLabel,
} from './labels';
export { LANGS } from './types';
export type { Dictionary, Lang, TKey, TParams, Translate } from './types';
