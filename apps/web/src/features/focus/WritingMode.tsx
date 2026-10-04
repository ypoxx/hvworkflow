/**
 * Scheibe 054 (decision 4): the writing mode (Schreibmodus) — a switch of the page, not a dialog and not a layer: the
 * list and the detail are not rendered, the question stands above, the answer field fills the content area; header,
 * navigation and language switch of the shell stay (owner question 9). It does not trap the Tab key.
 *
 * Ctrl+Enter (macOS: Cmd+Enter) saves when there is unsaved text — never "Weiterleiten" (owner question 3). Escape
 * leaves and keeps the text, unless a dialog took the key first. The actions come from `focusActions` (`_actions` and
 * the two states of the interface, never a role or the status, AGENTS.md R4/R5).
 */
import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Question } from '@hv/domain';
import { Button, Panel, StaleBanner, Toolbar, ToolbarSpacer, cx } from '../../components';
import { useT } from '../../i18n';
import { latestIsRefusal } from '../answers/refusal';
import { ReadingTime, ReturnedNote, focusActionLabel } from './FocusDetail';
import { focusActions, isSaveChord, shouldLeaveWriting } from './focus';
import type { FocusAction } from './focus';

const TEST_IDS: Readonly<Record<FocusAction, string>> = {
  save: 'focus-save',
  submit: 'focus-writing-submit',
  forward: 'focus-writing-forward',
  write: 'focus-writing-write',
};

export function WritingMode({
  question,
  text,
  sources,
  dirty,
  busy,
  rebase,
  stale,
  dialogOpen,
  onText,
  onSources,
  onAction,
  onClose,
  onRebase,
  onStaleReload,
}: {
  question: Question;
  text: string;
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
  onText: (value: string) => void;
  onSources: (value: string) => void;
  onAction: (action: FocusAction) => void;
  onClose: () => void;
  /** Replace the text by the newer version. */
  onRebase: () => void;
  onStaleReload: () => void;
}) {
  const t = useT();
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const keysId = useId();
  const { primary, secondary } = focusActions(question._actions, { dirty, writing: true });
  const mayDraft = question._actions.includes('answer.draft');
  const canSave = mayDraft && dirty && text.trim() !== '' && !busy;

  // Opening puts the caret at the end of the text (decision 5).
  useEffect(() => {
    const editor = editorRef.current;
    if (editor === null) return;
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
  }, []);

  const onFieldKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const chord = {
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing,
    };
    if (!isSaveChord(chord)) return;
    event.preventDefault();
    if (canSave) onAction('save');
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
        onClick={() => {
          if (!locked) onAction(action);
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
      {rebase && <StaleBanner testId="focus-rebase" message={t('focus.write.rebase')} onReload={onRebase} />}
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

          <label className="flex min-h-[12rem] flex-1 flex-col">
            <span className="hv-label">{t('answers.editor.label')}</span>
            <textarea
              ref={editorRef}
              data-testid="focus-editor"
              value={text}
              placeholder={t('answers.editor.placeholder')}
              aria-describedby={keysId}
              onChange={(event) => onText(event.target.value)}
              onKeyDown={onFieldKeyDown}
              className={cx(
                'mt-1 min-h-0 w-full flex-1 resize-none rounded-md border border-line bg-surface px-3 py-2.5',
                'text-[15px] leading-relaxed text-ink-900 transition-colors duration-100',
                'placeholder:text-ink-400 hover:border-ink-300',
              )}
            />
          </label>

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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <ReadingTime text={text} />
            {question.approval !== undefined && (
              <span data-testid="focus-approval-hint" className="flex items-center gap-1.5 text-2xs text-status-in-review-fg">
                <AlertTriangle size={13} strokeWidth={1.75} aria-hidden="true" />
                {t('answers.editor.hint')}
              </span>
            )}
            <span id={keysId} data-testid="focus-write-keys" className="ml-auto text-2xs text-ink-600">
              {t('focus.write.keys')}
            </span>
          </div>
        </div>
      </Panel>
    </div>
  );
}
