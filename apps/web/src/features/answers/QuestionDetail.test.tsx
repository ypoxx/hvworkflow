/**
 * Scheibe 045, Test 9: the refusal in the answer detail, rendered statically. "Verweigerung freigeben"
 * takes the place of "Freigeben" as the primary action; "Verweigerung vorschlagen" is never primary;
 * the justification (Begründung) is rendered only where the record carries it — the interface asks no
 * right and no role for it (044a §6).
 */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import type { AnswerBodyInput, AnswerVersion, Permission, Question, RefusalGround } from '@hv/domain';
import { getActor } from '../../api/actor';
import { createDraftBuffer, createMemoryStore } from '../../api/draftBuffer';
import type { DraftBuffer } from '../../api/draftBuffer';
import { saveDecision } from './draft';
import { translate } from '../../i18n';
import type { TKey, TParams } from '../../i18n';
import { AnswerText } from '../../components';
import { AnswerEditor } from './AnswerEditor';
import { AnswerDiff, QuestionDetail } from './QuestionDetail';

const de = (key: TKey, params?: TParams) => translate('de', key, params);
const at = '2027-04-20T10:00:00.000Z';
const JUSTIFICATION_MARKER = 'interne begruendung fuenfundvierzig';

const G1 = {
  id: 'g1', title: 'Titel g1', stageText: 'Baustein g1.',
  legalRef: { source: 'AktG', citation: 'Zitat', docVersion: '1', docHash: null, verified: false }, hash: 'h-g1',
} as RefusalGround;

function refusal(extra: Partial<AnswerVersion> = {}): AnswerVersion {
  return {
    version: 1, text: 'Zu dieser Frage gibt der Vorstand keine Auskunft.', createdAt: at,
    createdBy: { id: 'u-legal-1', role: 'legal' },
    answerKind: 'refusal_with_ground', refusalGroundId: 'g1', refusalGroundHash: 'h-g1', ...extra,
  };
}

function noGround({ refusalGroundId: _id, refusalGroundHash: _hash, ...rest }: AnswerVersion): AnswerVersion {
  return rest;
}

function q(actions: Permission[], answers: AnswerVersion[]): Question {
  return {
    id: 'q1', number: 'F-0001', contributionId: 'c1', speakerId: 's1', text: 'Frage?', status: 'in_review',
    track: 'expert_track', answers, version: 3, createdAt: at, updatedAt: at, _actions: actions,
  };
}

function render(question: Question): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <QuestionDetail
        question={question}
        history={[]}
        historyForbidden={false}
        units={[]}
        busy={false}
        draftResetToken={0}
        versionFocus={{ token: 0, version: 0 }}
        catalogue={{ status: 'ready', grounds: [G1] }}
        onAction={() => undefined}
      />
    </MemoryRouter>,
  );
}
const buttonTag = (html: string, testId: string): string =>
  html.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? '';
const isPrimary = (tag: string): boolean => /bg-accent-600/.test(tag);

describe('QuestionDetail with a refusal (Test 9)', () => {
  it('with question.refuse.approve the primary action is approving the refusal', () => {
    const html = render(q(['question.refuse.approve', 'question.return', 'question.read'], [refusal()]));
    const approve = buttonTag(html, 'answer-refuse-approve');
    expect(approve).not.toBe('');
    expect(isPrimary(approve)).toBe(true);
    expect(html).toContain(de('answers.refusal.approve.label', { version: 1 }));
    expect(buttonTag(html, 'answer-approve')).toBe('');
  });

  it('"Verweigerung vorschlagen" is never primary', () => {
    for (const actions of [
      ['question.refuse.propose'],
      ['question.refuse.propose', 'answer.draft'],
      ['question.refuse.propose', 'question.assign', 'question.return'],
    ] as Permission[][]) {
      const tag = buttonTag(render(q(actions, [])), 'answer-refuse');
      expect(tag).not.toBe('');
      expect(isPrimary(tag)).toBe(false);
    }
  });

  it('no offer without question.refuse.propose in _actions', () => {
    expect(buttonTag(render(q(['answer.draft', 'question.read'], [])), 'answer-refuse')).toBe('');
  });

  it('the version card names the kind, the ground and "ungeprüft"; the justification only when it is in the record', () => {
    const without = render(q(['question.read'], [refusal()]));
    expect(without).toContain(de('answers.refusal.kind.withGround'));
    expect(without).toContain('Titel g1');
    expect(without).toContain(de('answers.refusal.ground.unverified'));
    expect(without).not.toContain(de('answers.refusal.justification.label'));
    expect(without).not.toContain(JUSTIFICATION_MARKER);

    const withJustification = render(q(['question.read'], [refusal({ refusalJustification: JUSTIFICATION_MARKER })]));
    expect(withJustification).toContain(de('answers.refusal.justification.label'));
    expect(withJustification).toContain(JUSTIFICATION_MARKER);
  });

  it('a changed ground on the latest version is named', () => {
    const html = render(q(['question.read'], [refusal({ refusalGroundHash: 'h-old' })]));
    expect(html).toContain(de('answers.refusal.ground.changed'));
  });

  it('an ordinary answer carries no refusal badge', () => {
    const html = render(q(['question.read'], [{ version: 1, text: 'Antwort.', createdAt: at, createdBy: { id: 'u', role: 'expert' } }]));
    expect(html).not.toContain(de('answers.refusal.kind.withGround'));
    expect(html).not.toContain(de('answers.refusal.kind.noClaim'));
  });

  it('the editor over a refusal carries the hint', () => {
    const html = render(q(['answer.draft', 'question.read'], [{ ...noGround(refusal()), answerKind: 'refusal_no_claim' }]));
    expect(html).toContain('data-testid="answer-editor"');
    expect(html).toContain(de('answers.refusal.editorHint'));
    const plain = render(q(['answer.draft', 'question.read'], []));
    expect(plain).not.toContain(de('answers.refusal.editorHint'));
  });
});

/**
 * Scheibe 055b, Tests 6 and 7: the version card shows its version through the one renderer (the same markup as on the
 * podium, Recht/Freigabe); a version that changes only the formatting says so instead of an empty diff; the editor is
 * the answer field with its toolbar; the justification of a refusal never goes through the renderer.
 */
describe('QuestionDetail with the answer format (Scheibe 055b, Tests 6 and 7)', () => {
  const BODY = {
    language: 'de' as const,
    blocks: [
      { type: 'paragraph' as const, content: [{ text: 'Die ' }, { text: 'Dividende', marks: ['bold' as const] }, { text: ' steigt.' }] },
      { type: 'list' as const, items: [[{ text: 'eins', marks: ['highlight' as const] }], [{ text: 'zwei' }]] },
    ],
  };
  const TEXT = 'Die Dividende steigt.\n\neins\nzwei';
  const FORMATTED: AnswerVersion = { version: 1, text: TEXT, body: BODY, createdAt: at, createdBy: { id: 'u', role: 'expert' } };
  const answerPart = (html: string): string | undefined =>
    html.match(/<div[^>]*data-answer-text="true"[^>]*>([\s\S]*?)<\/div>/)?.[1]; // i18n-ok: expected markup in a test, not a rendered text

  it('Test 6: the version card holds the same renderer markup as AnswerText', () => {
    const html = render(q(['question.read'], [FORMATTED]));
    const card = html.slice(html.indexOf('data-testid="answer-version"'));
    expect(answerPart(card)).toBe(answerPart(renderToStaticMarkup(<AnswerText answer={FORMATTED} />)));
    expect(card).toContain('<strong>Dividende</strong>'); // i18n-ok: expected markup in a test, not a rendered text
  });

  it('Test 7: same text, other body → "Nur die Auszeichnung ist geändert" instead of an empty diff', () => {
    const plainBody = { language: 'de' as const, blocks: [{ type: 'paragraph' as const, content: [{ text: 'Die Dividende steigt.' }] }] };
    const boldBody = { language: 'de' as const, blocks: [{ type: 'paragraph' as const, content: [{ text: 'Die ' }, { text: 'Dividende', marks: ['bold' as const] }, { text: ' steigt.' }] }] };
    const html = renderToStaticMarkup(
      <AnswerDiff previous={{ text: 'Die Dividende steigt.', body: plainBody }} current={{ text: 'Die Dividende steigt.', body: boldBody }} />,
    );
    expect(html).toContain('data-testid="answer-diff-format-only"');
    expect(html).toContain(de('answers.version.formatOnly'));
    expect(html).not.toContain('data-testid="answer-diff"');
  });

  it('Test 7: other text → the word diff as before; same text and same body → the diff (nothing changed)', () => {
    const changed = renderToStaticMarkup(<AnswerDiff previous={{ text: 'Die Dividende steigt.' }} current={{ text: 'Die Dividende sinkt.' }} />);
    expect(changed).toContain('data-testid="answer-diff"');
    expect(changed).not.toContain('answer-diff-format-only');
    expect(changed).toContain('sinkt.');
    const same = renderToStaticMarkup(<AnswerDiff previous={{ text: 'A', body: BODY }} current={{ text: 'A', body: structuredClone(BODY) }} />);
    expect(same).not.toContain('answer-diff-format-only');
  });

  it('Test 7: answer-editor is the answer field (textbox) with the toolbar', () => {
    const html = render(q(['answer.draft', 'question.read'], []));
    expect(html).toMatch(/<div[^>]*data-testid="answer-editor"[^>]*role="textbox"|<div[^>]*role="textbox"[^>]*data-testid="answer-editor"/);
    expect(html).not.toContain('<textarea');
    expect(html).toContain('role="toolbar"');
    expect(html).toContain('data-testid="format-bold"');
  });

  it('Test 7: the justification of a refusal is never inside the renderer', () => {
    const html = render(q(['question.read'], [refusal({ refusalJustification: JUSTIFICATION_MARKER })]));
    expect(html).toContain(JUSTIFICATION_MARKER);
    const part = answerPart(html) ?? '';
    expect(part).toContain('Zu dieser Frage gibt der Vorstand keine Auskunft.');
    expect(part).not.toContain(JUSTIFICATION_MARKER);
  });
});

/**
 * Review 055b, finding 5: the Beantwortung's field is built from the draft it is given, so a remount (another render of
 * `AnswerEditor` while the page keeps the draft) never shows an empty field over text the save button would still send.
 */
describe('AnswerEditor remounted with a draft (review 055b, finding 5)', () => {
  const draft = { blocks: [{ type: 'paragraph', content: [{ text: 'Noch nicht gespeichert', marks: ['bold'] }] }] };
  const renderEditor = (body: typeof draft | null): string =>
    renderToStaticMarkup(
      <AnswerEditor
        body={body}
        generation={0}
        sources=""
        busy={false}
        canSave={body !== null}
        dirty={body !== null}
        primary
        hasApproval={false}
        onBody={() => undefined}
        onSources={() => undefined}
        onSave={() => undefined}
        onDiscard={() => undefined}
      />,
    );

  it('with a draft: no placeholder, saving open; without one: placeholder, saving locked', () => {
    const withDraft = renderEditor(draft);
    expect(withDraft).not.toContain('answer-editor-placeholder');
    expect(withDraft).toMatch(/data-testid="answer-submit-draft"[^>]*aria-disabled="false"|aria-disabled="false"[^>]*data-testid="answer-submit-draft"/);
    const empty = renderEditor(null);
    expect(empty).toContain('answer-editor-placeholder');
    expect(empty).toMatch(/data-testid="answer-submit-draft"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*data-testid="answer-submit-draft"/);
  });
});

/**
 * takt-048 (U6): the Beantwortung starts with the latest answer version (`draftBase`, as the focus view). Unchanged, the
 * draft is not saveable and saving is not the primary action; over a refusal the field starts empty with its hint.
 */
describe('QuestionDetail starts with the latest version (takt-048, U6)', () => {
  const V1: AnswerVersion = { version: 1, text: 'Erste Fassung.', createdAt: at, createdBy: { id: 'u', role: 'expert' } };
  const V2: AnswerVersion = {
    version: 2, text: 'Die Dividende steigt.', sources: ['Bericht', 'Anhang'], createdAt: at, createdBy: { id: 'u', role: 'expert' },
    body: { language: 'de', blocks: [{ type: 'paragraph', content: [{ text: 'Die ' }, { text: 'Dividende', marks: ['bold'] }, { text: ' steigt.' }] }] },
  };
  const drafted = (answers: AnswerVersion[]): Question => ({ ...q(['answer.draft', 'question.submit_review'], answers), status: 'answer_drafted' });
  const editorPart = (html: string): string => html.slice(html.indexOf('data-testid="answer-editor"'));

  it('with a latest version: no placeholder, saving locked, "Zur Prüfung" primary, no "Verwerfen"', () => {
    const html = render(drafted([V1, V2]));
    expect(html).not.toContain('answer-editor-placeholder');
    // The field's content is written by its effect (not in static markup); no placeholder means it is built non-empty.
    expect(editorPart(html)).not.toContain('aria-placeholder');
    expect(html).toMatch(/value="Bericht; Anhang"/);
    const save = buttonTag(html, 'answer-submit-draft');
    expect(save).toContain('aria-disabled="true"');
    expect(isPrimary(save)).toBe(false);
    expect(isPrimary(buttonTag(html, 'answer-submit-review'))).toBe(true);
    expect(html).not.toContain(de('answers.editor.discard'));
    expect(html).not.toContain('data-testid="answer-editor-rebase"');
  });

  it('without any other step, saving stays primary but locked until something changes', () => {
    const html = render({ ...drafted([V1]), _actions: ['answer.draft'] });
    const save = buttonTag(html, 'answer-submit-draft');
    expect(isPrimary(save)).toBe(true);
    expect(save).toContain('aria-disabled="true"');
  });

  it('latest version a refusal: placeholder and hint', () => {
    const html = render(drafted([V1, { ...noGround(refusal({ version: 2 })), answerKind: 'refusal_no_claim' }]));
    expect(html).toContain('answer-editor-placeholder');
    expect(html).toContain(de('answers.refusal.editorHint'));
    expect(editorPart(html)).not.toContain('Zu dieser Frage gibt der Vorstand keine Auskunft.');
    expect(buttonTag(html, 'answer-submit-draft')).toContain('aria-disabled="true"');
  });
});

/**
 * takt-048, follow-up to the design critique (D1, principle 5): the prefilled field says which version it starts from and
 * why saving is locked; the locked button points at that line (`aria-describedby`). No line without a base (no version,
 * a refusal: the field starts empty) and none once the draft is changed.
 */
describe('the start hint of the Beantwortung (takt-048, design critique D1)', () => {
  const V1: AnswerVersion = { version: 1, text: 'Erste Fassung.', createdAt: at, createdBy: { id: 'u', role: 'expert' } };
  const V2: AnswerVersion = { version: 2, text: 'Zweite Fassung.', createdAt: at, createdBy: { id: 'u', role: 'expert' } };
  const drafted = (answers: AnswerVersion[]): Question => ({ ...q(['answer.draft', 'question.submit_review'], answers), status: 'answer_drafted' });
  const hintTag = (html: string): string => html.match(/<[a-z]+[^>]*data-testid="answer-editor-start"[^>]*>/)?.[0] ?? '';

  it('with a latest version: the hint names its number, the locked save button is described by it', () => {
    const html = render(drafted([V1, V2]));
    expect(html).toContain(de('answers.editor.startsFrom', { version: 2 }));
    const id = hintTag(html).match(/ id="([^"]+)"/)?.[1] ?? '';
    expect(id).not.toBe('');
    const save = buttonTag(html, 'answer-submit-draft');
    expect(save).toContain('aria-disabled="true"');
    expect(save).toMatch(new RegExp(`aria-describedby="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  });

  it('no hint without a version and over a refusal', () => {
    for (const html of [
      render(drafted([])),
      render(drafted([V1, { ...noGround(refusal({ version: 2 })), answerKind: 'refusal_no_claim' }])),
    ]) {
      expect(hintTag(html)).toBe('');
      expect(buttonTag(html, 'answer-submit-draft')).not.toContain('aria-describedby');
    }
  });

  it('AnswerEditor: no hint and no description once the draft is changed', () => {
    const editor = (dirty: boolean, startsFrom?: number): string =>
      renderToStaticMarkup(
        <AnswerEditor
          body={{ blocks: [{ type: 'paragraph', content: [{ text: 'Text' }] }] }}
          generation={0}
          sources=""
          busy={false}
          canSave={dirty}
          dirty={dirty}
          {...(startsFrom !== undefined ? { startsFrom } : {})}
          primary
          hasApproval={false}
          onBody={() => undefined}
          onSources={() => undefined}
          onSave={() => undefined}
          onDiscard={() => undefined}
        />,
      );
    expect(hintTag(editor(false, 3))).not.toBe('');
    expect(editor(false, 3)).toContain(de('answers.editor.startsFrom', { version: 3 }));
    const changed = editor(true, 3);
    expect(hintTag(changed)).toBe('');
    expect(buttonTag(changed, 'answer-submit-draft')).not.toContain('aria-describedby');
  });
});

/**
 * Scheibe 060, U6: the Beantwortung with the draft buffer. A buffered draft is restored and says so (`draft-restored`);
 * over a newer foreign version the notice carries "Vergleichen" instead of "Neu laden" (the old reload discarded the text
 * without a word); rendering — a programmatic build — writes nothing to the buffer; saving with a standing notice opens
 * the comparison instead of sending (`saveDecision`, U2).
 */
describe('QuestionDetail with the draft buffer (Scheibe 060, U6)', () => {
  const ME = getActor().id;
  const plainInput = (text: string): AnswerBodyInput => ({ blocks: [{ type: 'paragraph', content: [{ text }] }] });
  const v = (n: number, text: string): AnswerVersion => ({ version: n, text, createdAt: at, createdBy: { id: 'u-legal-1', role: 'legal' } });
  const record = (answers: AnswerVersion[]): Question => ({
    ...q(['answer.draft', 'question.submit_review', 'question.read'], answers), meetingId: 'm-1', status: 'answer_drafted',
  });

  async function bufferWith(entryBody: AnswerBodyInput, baseVersion: number) {
    const store = createMemoryStore();
    const put = vi.spyOn(store, 'put');
    const del = vi.spyOn(store, 'delete');
    const buffer = createDraftBuffer({ store, now: () => Date.parse(at) + 60_000, getActor });
    await buffer.load();
    await buffer.put({ ownerId: ME, meetingId: 'm-1', questionId: 'q1', body: entryBody, sources: '', baseVersion });
    put.mockClear();
    del.mockClear();
    return { buffer, put, del };
  }

  function renderWith(question: Question, buffer: DraftBuffer): string {
    return renderToStaticMarkup(
      <MemoryRouter>
        <QuestionDetail
          question={question}
          history={[]}
          historyForbidden={false}
          units={[]}
          busy={false}
          draftResetToken={0}
          versionFocus={{ token: 0, version: 0 }}
          catalogue={{ status: 'ready', grounds: [G1] }}
          onAction={() => undefined}
          buffer={buffer}
        />
      </MemoryRouter>,
    );
  }

  it('a buffered draft is restored and says so; saving is open', async () => {
    const { buffer, put, del } = await bufferWith(plainInput('Antwort eins. Gepuffert060.'), 1);
    const html = renderWith(record([v(1, 'Antwort eins.')]), buffer);
    expect(html).toContain('data-testid="draft-restored"');
    expect(buttonTag(html, 'answer-submit-draft')).toContain('aria-disabled="false"');
    expect(put).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it('over a newer foreign version the notice carries "Vergleichen", not "Neu laden"', async () => {
    const { buffer } = await bufferWith(plainInput('Antwort eins. Gepuffert060.'), 1);
    const html = renderWith(record([v(1, 'Antwort eins.'), v(2, 'Antwort zwei.')]), buffer);
    expect(html).toContain('data-testid="answer-editor-rebase"');
    const compareLabel = translate('de', 'answers.editor.compare');
    expect(html).toMatch(new RegExp(`data-testid="answer-editor-rebase"[\\s\\S]*?<button[^>]*>${compareLabel}</button>`));
    expect(html).not.toContain(translate('de', 'stale.reload'));
  });

  it('without an entry: no restored line, nothing written', async () => {
    const store = createMemoryStore();
    const put = vi.spyOn(store, 'put');
    const buffer = createDraftBuffer({ store, now: () => Date.parse(at), getActor });
    await buffer.load();
    const html = renderWith(record([v(1, 'Antwort eins.')]), buffer);
    expect(html).not.toContain('draft-restored');
    expect(html).not.toContain('draft-kept');
    expect(put).not.toHaveBeenCalled();
  });

  it('saving with the notice standing opens the comparison instead of sending', () => {
    expect(saveDecision({ rebase: true }, true)).toBe('compare');
  });
});
