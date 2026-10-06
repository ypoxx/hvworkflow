/**
 * Scheibe 054 (decision 4): the writing mode (Schreibmodus) — a switch of the page, not a dialog and not a layer: the
 * list and the detail are not rendered, the question stands above, the answer field fills the content area; header,
 * navigation and language switch of the shell stay (owner question 9). It does not trap the Tab key.
 *
 * Ctrl+Enter (macOS: Cmd+Enter) saves when there is unsaved text — never "Weiterleiten" (owner question 3). Escape
 * leaves and keeps the text, unless a dialog took the key first. The actions come from `focusActions` (`_actions` and
 * the two states of the interface, never a role or the status, AGENTS.md R4/R5).
 */
import { useId } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AnswerBodyInput, Question } from '@hv/domain';
import { previewText } from '../../api/answerFormat';
import { Button, Panel, StaleBanner, Toolbar, ToolbarSpacer, cx } from '../../components';
import { useT } from '../../i18n';
import { AnswerBodyEditor } from '../answers/AnswerBodyEditor';
import { saveDecision } from '../answers/draft';
import { latestIsRefusal } from '../answers/refusal';
import { ReadingTime, ReturnedNote, focusActionLabel } from './FocusDetail';
import { focusActions, isSaveChord, shouldLeaveWriting } from './focus';
import type { FocusAction } from './focus';

/**
 * Scheibe 060 (decision 7.2): what Ctrl+Enter does — save, open the comparison while the notice of a newer version stands
 * (`canSave` itself unchanged), nothing when saving is locked, or ignore a key that is not the chord.
 */
export function saveKeyStep(
  chord: Parameters<typeof isSaveChord>[0],
  ui: { canSave: boolean; rebase: boolean },
): 'save' | 'compare' | 'none' | 'ignore' {
  if (!isSaveChord(chord)) return 'ignore';
  const decision = saveDecision({ rebase: ui.rebase }, ui.canSave);
  return decision === 'send' ? 'save' : decision;
}

const TEST_IDS: Readonly<Record<FocusAction, string>> = {
  save: 'focus-save',
  submit: 'focus-writing-submit',
  forward: 'focus-writing-forward',
  write: 'focus-writing-write',
};

export function WritingMode({
  question,
  body,
  generation,
  sources,
  dirty,
  busy,
  rebase,
  stale,
  dialogOpen,
  onBody,
  onSources,
  onAction,
  onClose,
  onCompare,
  onStaleReload,
  compare,
  restoredNote,
  keptNote,
}: {
  question: Question;
  /** What the answer field holds (055b): the input form the walker read, `null` when empty. */
  body: AnswerBodyInput | null;
  /** The field rebuilds from `body` when this changes (a foreign version, "neu laden"). */
  generation: number;
  sources: string;
  dirty: boolean;
  /** The write door is taken (takt-008). */
  busy: boolean;
  /** A newer answer version arrived over changed text (decision 4). */
  rebase: boolean;
  /** The write door's "Stand veraltet" (412) stands above this question. */
  stale: boolean;
  /** A dialog of the page is open over the writing mode: Escape is its own then. */
  dialogOpen: boolean;
  onBody: (value: AnswerBodyInput | null) => void;
  onSources: (value: string) => void;
  onAction: (action: FocusAction) => void;
  onClose: () => void;
  /** Scheibe 060: open "Fassungen vergleichen" (the notice's button, and saving while the notice stands). */
  onCompare: () => void;
  onStaleReload: () => void;
  /** Scheibe 060: the comparison, shown in place of the field and the sources while it is open. */
  compare?: ReactNode;
  /** Scheibe 060: the line "wiederhergestellt" above the field. */
  restoredNote?: ReactNode;
  /** Scheibe 060: the line "zwischengespeichert" (or "nicht möglich"). */
  keptNote?: ReactNode;
}) {
  const t = useT();
  const keysId = useId();
  const labelId = useId();
  const { primary, secondary } = focusActions(question._actions, { dirty, writing: true });
  const mayDraft = question._actions.includes('answer.draft');
  // The plain text of the previewed document (055b decision 7): the reading time and "nothing to save" read it.
  const text = previewText(body);
  const canSave = mayDraft && dirty && text !== '' && !busy;

  const onFieldKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const chord = {
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing,
    };
    const step = saveKeyStep(chord, { canSave, rebase });
    if (step === 'ignore') return;
    event.preventDefault();
    if (step === 'save') onAction('save');
    else if (step === 'compare') onCompare();
  };

  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!shouldLeaveWriting({ key: event.key, defaultPrevented: event.defaultPrevented, dialogOpen })) return;
    event.preventDefault();
    onClose();
  };

  const button = (action: FocusAction, isPrimary: boolean) => {
    const locked = action === 'save' ? !canSave : busy;
    return (
      <Button
        key={action}
        size="sm"
        {...(isPrimary ? { 'data-primary': 'true' } : {})}
        variant={isPrimary ? 'primary' : 'secondary'}
        data-testid={TEST_IDS[action]}
        aria-disabled={locked}
        onClick={(event) => {
          // Scheibe 060 (decision 9): the second click of a double click never acts — the first one did, or it was a
          // decision in the comparison, which closed it, and the second lands on the button now standing there.
          if (locked || event.detail > 1) return;
          // Scheibe 060 (decision 7.2): saving while the notice of a newer version stands opens the comparison.
          if (action === 'save' && rebase) onCompare();
          else onAction(action);
        }}
      >
        {focusActionLabel(t, action, dirty)}
      </Button>
    );
  };

  return (
    <div
      data-testid="focus-writing"
      tabIndex={-1}
      onKeyDown={onRootKeyDown}
      className="flex h-full min-h-0 flex-col gap-2 outline-none"
    >
      {stale && <StaleBanner testId="stale-banner" message={t('answers.stale.banner')} onReload={onStaleReload} />}
      {rebase && compare === undefined && (
        <StaleBanner testId="focus-rebase" message={t('focus.write.rebase')} actionLabel={t('answers.editor.compare')} onReload={onCompare} />
      )}
      <Panel
        className="min-h-0 flex-1"
        padded={false}
        bodyClassName="flex min-h-0 flex-col"
        title={
          <span className="flex items-center gap-2">
            <span>{t('focus.write.title')}</span>
            <span data-testid="focus-writing-number" className="font-mono text-[13px] text-ink-900">
              {question.number}
            </span>
          </span>
        }
        footer={
          <Toolbar label={t('answers.detail.actions')}>
            <Button size="sm" variant="ghost" data-testid="focus-writing-close" onClick={onClose}>
              {t('focus.write.close')}
            </Button>
            {secondary.map((action) => button(action, false))}
            <ToolbarSpacer />
            {primary !== undefined && button(primary, true)}
          </Toolbar>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {question.returnReason !== undefined && <ReturnedNote reason={question.returnReason} />}
          <div>
            <span className="hv-label">{t('answers.detail.label')}</span>
            <p data-testid="focus-writing-question" className="mt-1 text-[16px] leading-6 text-ink-900">
              {question.text}
            </p>
          </div>

          {latestIsRefusal(question) && (
            <p
              data-testid="focus-refusal-hint"
              className="rounded-md border border-line-strong bg-ink-50 px-3 py-2 text-[13px] text-ink-700"
            >
              {t('answers.refusal.editorHint')}
            </p>
          )}

          {compare !== undefined ? compare : (
            <>
              {restoredNote}
              {/* Opening puts the caret at the end of the text (054 decision 5): `autoFocusEnd`. */}
              <div className="flex min-h-[14rem] flex-1 flex-col">
                <span id={labelId} className="hv-label">
                  {t('answers.editor.label')}
                </span>
                <AnswerBodyEditor
                  testId="focus-editor"
                  initial={body}
                  generation={generation}
                  labelId={labelId}
                  describedBy={keysId}
                  size="large"
                  autoFocusEnd
                  onChange={onBody}
                  onKeyDown={onFieldKeyDown}
                  className="mt-1 flex-1"
                />
              </div>

              <label className="block">
                <span className="hv-label">{t('answers.editor.sources.label')}</span>
                <input
                  data-testid="focus-sources"
                  value={sources}
                  placeholder={t('answers.editor.sources.placeholder')}
                  onChange={(event) => onSources(event.target.value)}
                  onKeyDown={onFieldKeyDown}
                  className={cx(
                    'mt-1 h-8 w-full rounded-md border border-line bg-surface px-2.5',
                    'text-[13px] text-ink-900 transition-colors duration-100',
                    'placeholder:text-ink-400 hover:border-ink-300',
                  )}
                />
                <span className="mt-1 block text-2xs text-ink-600">{t('answers.editor.sources.hint')}</span>
              </label>
            </>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <ReadingTime text={text} />
            {question.approval !== undefined && (
              <span data-testid="focus-approval-hint" className="flex items-center gap-1.5 text-2xs text-status-in-review-fg">
                <AlertTriangle size={13} strokeWidth={1.75} aria-hidden="true" />
                {t('answers.editor.hint')}
              </span>
            )}
            {keptNote}
            <span id={keysId} data-testid="focus-write-keys" className="ml-auto text-2xs text-ink-600">
              {t('focus.write.keys')}
            </span>
          </div>
        </div>
      </Panel>
    </div>
  );
}
