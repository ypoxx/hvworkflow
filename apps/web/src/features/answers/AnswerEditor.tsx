/**
 * Where the answer is written. Two fields, one button, and one warning that matters: a new version
 * voids an existing approval (R-GUARD-04) — the person has to know that before they type, not after
 * the server says no.
 */
import { AlertTriangle } from 'lucide-react';
import { Button, cx } from '../../components';
import { useT } from '../../i18n';

interface AnswerEditorProps {
  text: string;
  sources: string;
  busy: boolean;
  primary: boolean;
  hasApproval: boolean;
  onText: (value: string) => void;
  onSources: (value: string) => void;
  onSave: () => void;
  onDiscard: () => void;
}

export function AnswerEditor({
  text,
  sources,
  busy,
  primary,
  hasApproval,
  onText,
  onSources,
  onSave,
  onDiscard,
}: AnswerEditorProps) {
  const t = useT();
  const empty = text.trim() === '';

  return (
    <section className="rounded-lg border border-line-strong bg-sunken p-3">
      <h3 className="text-[13px] font-semibold text-ink-900">{t('answers.editor.title')}</h3>

      <label className="mt-2 block">
        <span className="hv-label">{t('answers.editor.label')}</span>
        <textarea
          data-testid="answer-editor"
          rows={6}
          value={text}
          placeholder={t('answers.editor.placeholder')}
          onChange={(event) => onText(event.target.value)}
          className={cx(
            'mt-1 w-full resize-y rounded-md border border-line bg-surface px-2.5 py-2',
            'text-[13px] leading-relaxed text-ink-900 transition-colors duration-100',
            'placeholder:text-ink-400 hover:border-ink-300',
          )}
        />
      </label>

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
        <span className="mt-1 block text-2xs text-ink-500">{t('answers.editor.sources.hint')}</span>
      </label>

      <div className="mt-3 flex items-center gap-2">
        {hasApproval && (
          <span className="flex items-center gap-1.5 text-2xs text-status-in-review-fg">
            <AlertTriangle size={13} strokeWidth={1.75} aria-hidden="true" />
            {t('answers.editor.hint')}
          </span>
        )}
        <span className="flex-1" />
        {!empty && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={onDiscard}>
            {t('answers.editor.discard')}
          </Button>
        )}
        <Button
          size="sm"
          variant={primary ? 'primary' : 'secondary'}
          data-testid="answer-submit-draft"
          disabled={busy || empty}
          onClick={onSave}
        >
          {t('answers.editor.save')}
        </Button>
      </div>
    </section>
  );
}
