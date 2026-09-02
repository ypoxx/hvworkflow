/**
 * Left half of the capture desk: whose Wortmeldung, which Redebeitrag, and its wording. Either the
 * desk is writing a new Redebeitrag down (textarea) or it is working on one that exists — then the
 * text is read-only, tinted where it is already covered, and the atomisation tools sit under it.
 */
import { useEffect, useId, useState } from 'react';
import { ListChecks, MessageSquareQuote, PencilLine, Plus, TriangleAlert } from 'lucide-react';
import type { Contribution, QuestionCapture, Speaker } from '@hv/domain';
import { Badge, Button, EmptyState, Kbd, Panel, cx } from '../../components';
import { actionLabel, useLang, useT } from '../../i18n';
import { ContributionText } from './ContributionText';
import { CoverageBar } from './CoverageBar';
import { Field, FIELD_CONTROL, FIELD_TEXTAREA } from './fields';

function timeOf(lang: string, iso: string): string {
  return new Intl.DateTimeFormat(lang, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(new Date(iso));
}

function Skeleton() {
  const t = useT();
  return (
    <div className="grid gap-2 px-4 py-4">
      <span className="sr-only" role="status">
        {t('capture.loading')}
      </span>
      {[0, 1, 2, 3, 4, 5].map((line) => (
        <span
          key={line}
          aria-hidden="true"
          className={cx('h-3 rounded-full bg-ink-100', line % 3 === 2 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export interface ContributionPaneProps {
  speakers: readonly Speaker[];
  speakerId: string | null;
  onSelectSpeaker: (id: string) => void;
  contributions: readonly Contribution[];
  contribution: Contribution | undefined;
  onSelectContribution: (id: string) => void;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  canCapture: boolean;
  writing: boolean;
  onWrite: (text: string) => Promise<boolean>;
  onCaptureQuestions: (questions: QuestionCapture[]) => void;
  onOpenSuggest: () => void;
}

export function ContributionPane({
  speakers,
  speakerId,
  onSelectSpeaker,
  contributions,
  contribution,
  onSelectContribution,
  loading,
  failed,
  onRetry,
  canCapture,
  writing,
  onWrite,
  onCaptureQuestions,
  onOpenSuggest,
}: ContributionPaneProps) {
  const t = useT();
  const lang = useLang();
  const ids = useId();
  const [draft, setDraft] = useState('');
  const [free, setFree] = useState('');
  const [composing, setComposing] = useState(false);

  const speaker = speakers.find((s) => s.id === speakerId);
  // Without a Redebeitrag there is nothing to read, so the desk starts writing straight away.
  const showForm = canCapture && (composing || contribution === undefined);

  useEffect(() => {
    setComposing(false);
    setDraft('');
    setFree('');
  }, [speakerId]);

  const rounds = new Map<number, Speaker[]>();
  for (const entry of speakers) {
    const bucket = rounds.get(entry.round);
    if (bucket === undefined) rounds.set(entry.round, [entry]);
    else bucket.push(entry);
  }

  const submitText = async (): Promise<void> => {
    if (draft.trim() === '') return;
    const ok = await onWrite(draft.trim());
    if (ok) {
      setDraft('');
      setComposing(false);
    }
  };

  const addFree = (): void => {
    if (free.trim() === '') return;
    onCaptureQuestions([{ text: free.trim() }]);
    setFree('');
  };

  return (
    <Panel
      className="h-full"
      padded={false}
      bodyClassName="flex min-h-0 flex-col"
      title={t('capture.contribution.label')}
      {...(speaker !== undefined ? { description: speaker.displayName } : {})}
      actions={
        canCapture && contribution !== undefined && !showForm ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setComposing(true)}
            icon={<Plus size={14} strokeWidth={2} aria-hidden="true" />}
          >
            {t('capture.contribution.new')}
          </Button>
        ) : undefined
      }
      footer={
        contribution !== undefined && !showForm && canCapture ? (
          <div className="flex items-end gap-2 py-1">
            <Field label={t('capture.free.label')} htmlFor={`${ids}-free`} className="flex-1">
              <input
                id={`${ids}-free`}
                data-testid="capture-free-input"
                className={FIELD_CONTROL}
                value={free}
                placeholder={t('capture.free.placeholder')}
                onChange={(event) => setFree(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addFree();
                  }
                }}
              />
            </Field>
            <Button
              size="sm"
              variant="secondary"
              data-testid="capture-free-add"
              disabled={free.trim() === ''}
              onClick={addFree}
              className="h-8"
            >
              {t('capture.free.add')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              data-testid="capture-suggest"
              onClick={onOpenSuggest}
              className="h-8"
              icon={<ListChecks size={14} strokeWidth={1.75} aria-hidden="true" />}
            >
              {t('capture.suggest.open')}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="shrink-0 border-b border-line px-4 py-3">
        <div className="flex items-end gap-3">
          <Field label={t('capture.speaker.label')} htmlFor={`${ids}-speaker`} className="flex-1">
            <select
              id={`${ids}-speaker`}
              data-testid="capture-speaker-select"
              className={FIELD_CONTROL}
              value={speakerId ?? ''}
              onChange={(event) => onSelectSpeaker(event.target.value)}
            >
              {speakerId === null && <option value="">{t('capture.speaker.empty')}</option>}
              {[...rounds.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([round, list]) => (
                  <optgroup key={round} label={t('header.round', { round })}>
                    {list.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {t('capture.speaker.option', {
                          number: entry.number,
                          name: entry.displayName,
                        })}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
          </Field>
          {contributions.length > 1 && (
            <Field
              label={t('capture.contribution.label')}
              htmlFor={`${ids}-contribution`}
              className="w-64"
            >
              <select
                id={`${ids}-contribution`}
                data-testid="capture-contribution-select"
                className={FIELD_CONTROL}
                value={contribution?.id ?? ''}
                onChange={(event) => onSelectContribution(event.target.value)}
              >
                {contributions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {t('capture.contribution.option', {
                      time: timeOf(lang, entry.capturedAt),
                      chars: entry.text.length,
                    })}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        {contribution !== undefined && !showForm && (
          <div className="mt-3 flex items-start gap-6">
            <div className="min-w-0 flex-1">
              <CoverageBar contribution={contribution} />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <Badge tone="outline" mono>
                  {timeOf(lang, contribution.capturedAt)}
                </Badge>
                <Badge tone="neutral">
                  {contribution.source === 'transcript'
                    ? t('capture.contribution.source.transcript')
                    : t('capture.contribution.source.manual')}
                </Badge>
              </div>
              {canCapture && (
                <span className="flex items-center gap-1.5 text-2xs text-ink-500">
                  {t('capture.selection.hint')}
                  <Kbd>{t('capture.key.alt')}</Kbd>
                  <Kbd>{t('capture.key.q')}</Kbd>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {speakerId === null ? (
          <EmptyState
            icon={MessageSquareQuote}
            title={t('capture.speaker.empty')}
            description={t('capture.speaker.emptyBody')}
          />
        ) : failed && contribution === undefined ? (
          <EmptyState
            icon={TriangleAlert}
            title={t('capture.error.title')}
            description={t('capture.error.body')}
            action={
              <Button variant="secondary" onClick={onRetry}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : loading && contribution === undefined ? (
          <Skeleton />
        ) : showForm ? (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <label htmlFor={`${ids}-text`} className="hv-label">
              {t('capture.text.label')}
            </label>
            <textarea
              id={`${ids}-text`}
              data-testid="capture-text"
              className={cx(FIELD_TEXTAREA, 'min-h-40 flex-1')}
              value={draft}
              placeholder={t('capture.text.placeholder')}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="flex items-center justify-end gap-2">
              {contribution !== undefined && (
                <Button variant="ghost" onClick={() => setComposing(false)}>
                  {t('capture.contribution.back')}
                </Button>
              )}
              <Button
                variant="primary"
                data-testid="capture-submit"
                disabled={writing || draft.trim() === ''}
                onClick={() => void submitText()}
                icon={<PencilLine size={16} strokeWidth={1.75} aria-hidden="true" />}
              >
                {actionLabel(t, 'contribution.capture')}
              </Button>
            </div>
          </div>
        ) : contribution === undefined ? (
          <EmptyState
            icon={MessageSquareQuote}
            title={t('capture.text.empty.title')}
            description={t('capture.text.empty.body')}
          />
        ) : (
          <ContributionText
            contribution={contribution}
            canCapture={canCapture}
            onCapture={onCaptureQuestions}
          />
        )}
      </div>
    </Panel>
  );
}
