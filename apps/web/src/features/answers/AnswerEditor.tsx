/**
 * Where the answer is written. Two fields, one button, and one warning that matters: a new version
 * voids an existing approval (R-GUARD-04) — the person has to know that before they type, not after
 * the server says no. Scheibe 055b: the answer text is the answer field with the house format
 * (`AnswerBodyEditor`, compact). takt-048 (owner decision 05.10.2026, 055b question 4): the field starts with the latest
 * answer version; saving is offered only for a changed draft (`canSave`), so an unchanged one never voids an approval.
 */
import { useId } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AnswerBodyInput } from '@hv/domain';
import { Button, cx } from '../../components';
import { useT } from '../../i18n';
import { AnswerBodyEditor } from './AnswerBodyEditor';

interface AnswerEditorProps {
  /** What the field holds (the walker's input form), `null` when empty. */
  body: AnswerBodyInput | null;
  /** The field rebuilds from `body` when this changes: discard, a foreign version, an actor change (decision 7). */
  generation: number;
  sources: string;
  busy: boolean;
  /** takt-048: a changed, non-empty draft that may be written now (`draft.ts` `canSave`); otherwise saving is locked. */
  canSave: boolean;
  /** takt-048: the draft differs from its base; only then "Verwerfen" is offered. */
  dirty: boolean;
  primary: boolean;
  hasApproval: boolean;
  onBody: (value: AnswerBodyInput | null) => void;
  onSources: (value: string) => void;
  onSave: () => void;
  onDiscard: () => void;
}

export function AnswerEditor({
  body,
  generation,
  sources,
  busy,
  canSave,
  dirty,
  primary,
  hasApproval,
  onBody,
  onSources,
  onSave,
  onDiscard,
}: AnswerEditorProps) {
  const t = useT();
  const labelId = useId();

  return (
    <section className="rounded-lg border border-line-strong bg-sunken p-3">
      <h3 className="text-[13px] font-semibold text-ink-900">{t('answers.editor.title')}</h3>

      <div className="mt-2 block">
        <span id={labelId} className="hv-label">
          {t('answers.editor.label')}
        </span>
        <AnswerBodyEditor
          testId="answer-editor"
          // Review 055b, finding 5: the field is built from the draft, so a remount never shows an empty field over a
          // draft that the save button would still send.
          initial={body}
          generation={generation}
          labelId={labelId}
          size="compact"
          onChange={onBody}
          className="mt-1"
        />
      </div>

      <label className="mt-2 block">
        <span className="hv-label">{t('answers.editor.sources.label')}</span>
        <input
          data-testid="answer-sources"
          value={sources}
          placeholder={t('answers.editor.sources.placeholder')}
          onChange={(event) => onSources(event.target.value)}
          className={cx(
            'mt-1 h-8 w-full rounded-md border border-line bg-surface px-2.5',
            'text-[13px] text-ink-900 transition-colors duration-100',
            'placeholder:text-ink-400 hover:border-ink-300',
          )}
        />
        {/* Slice 013 (axe, goal 1): ink-500 measured 3.74:1 at this size — below 4.5:1; ink-600 is
         * an existing token and clears WCAG AA (see QuestionDetail.tsx's lapsed-approval hint). */}
        <span className="mt-1 block text-2xs text-ink-600">{t('answers.editor.sources.hint')}</span>
      </label>

      <div className="mt-3 flex items-center gap-2">
        {hasApproval && (
          <span className="flex items-center gap-1.5 text-2xs text-status-in-review-fg">
            <AlertTriangle size={13} strokeWidth={1.75} aria-hidden="true" />
            {t('answers.editor.hint')}
          </span>
        )}
        <span className="flex-1" />
        {dirty && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={onDiscard}>
            {t('answers.editor.discard')}
          </Button>
        )}
        {/* takt-008: `aria-disabled`, not `disabled` — after a saved version the draft is unchanged
         *  (takt-048: its base is what was sent), and a natively disabled button would drop the focus
         *  it holds to `<body>`. Locked like this it keeps focus, looks disabled (Button.tsx) and
         *  ignores a second Enter. */}
        <Button
          size="sm"
          variant={primary ? 'primary' : 'secondary'}
          data-testid="answer-submit-draft"
          aria-disabled={!canSave}
          onClick={onSave}
        >
          {t('answers.editor.save')}
        </Button>
      </div>
    </section>
  );
}
