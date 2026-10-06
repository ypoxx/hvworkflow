/**
 * Scheibe 061 (part B): the control desk (Leitstand) rendered statically, like `steering/DistributionPanel.test.tsx`.
 * W1 (badges with symbol, word and threshold; "Engpass"; one pattern of accessible names), W2 (the inflow chart), W3 (the
 * backlog with its threshold marker), W4 (states), W5 (no person in the DOM with list and thread open) and W8 (the
 * keyboard path is the document order; one primary button).
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Cockpit } from '@hv/domain';
import { COCKPIT_THRESHOLDS } from '../../api/cockpit';
import { translate } from '../../i18n';
import type { TKey, TParams } from '../../i18n';
import { CockpitView } from './CockpitView';
import type { CockpitViewProps } from './CockpitView';
import { cockpitFixture, UNITS } from './fixtures';
import { rowsFromRefs, threadEntries } from './lib';

/** The page's own sources (the kit's components keep their own spacing). */
const SOURCES = import.meta.glob<string>(['./CockpitView.tsx', './Figures.tsx', './DrillList.tsx', './Thread.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const de = (key: TKey, params?: TParams) => translate('de', key, params);
const T = COCKPIT_THRESHOLDS;

const noop = () => undefined;
function props(over: Partial<CockpitViewProps> = {}): CockpitViewProps {
  return {
    read: { status: 'ready', cockpit: cockpitFixture() },
    units: UNITS,
    selection: null,
    list: null,
    thread: null,
    announcement: '',
    onOpenList: noop,
    onOpenThread: noop,
    onCloseList: noop,
    onCloseThread: noop,
    onRetry: noop,
    ...over,
  };
}
const render = (over: Partial<CockpitViewProps> = {}): string => renderToStaticMarkup(<CockpitView {...props(over)} />);
const ready = (cockpit: Cockpit): Partial<CockpitViewProps> => ({ read: { status: 'ready', cockpit } });

/** Every opening tag carrying `data-testid="<id>"`. */
const tags = (html: string, testId: string): string[] =>
  [...html.matchAll(new RegExp(`<(\\w+)[^>]*data-testid="${testId}"[^>]*>`, 'g'))].map((match) => match[0]);
const attr = (tag: string, name: string): string | undefined => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
/** The markup of the first element with this test id, up to its closing tag (elements of this page do not nest themselves). */
function element(html: string, testId: string, nth = 0): string {
  const tag = tags(html, testId)[nth];
  if (tag === undefined) return '';
  const name = tag.match(/^<(\w+)/)?.[1] ?? 'div';
  const start = html.indexOf(tag);
  let depth = 0;
  const re = new RegExp(`<(/?)${name}\\b[^>]*>`, 'g');
  re.lastIndex = start;
  for (let m = re.exec(html); m !== null; m = re.exec(html)) {
    if (m[0].endsWith('/>')) continue;
    depth += m[1] === '/' ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  return html.slice(start);
}
const text = (markup: string): string => markup.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"');

describe('W1 levels in the markup', () => {
  it('calm figures carry no badge; elevated and critical carry symbol, word and threshold', () => {
    const html = render();
    const badges = tags(html, 'cockpit-level');
    // Oldest 50 min (critical), legal clearing over 10 min 6 (elevated), Finanzen 23 (elevated): three badges, nothing else.
    expect(badges.map((badge) => attr(badge, 'data-level'))).toEqual(['critical', 'attention', 'attention']);
    const oldest = element(html, 'cockpit-oldest');
    expect(text(oldest)).toContain(`kritisch · über ${T.oldestOpenSeconds.critical / 60} min`);
    expect(oldest).toContain('lucide-octagon-alert');
    const legal = element(html, 'cockpit-card-legal');
    expect(text(legal)).toContain(`erhöht · ab ${T.legalReviewOver10m.attention}`);
    expect(legal).toContain('lucide-triangle-alert');
    // No badge on the calm cards.
    for (const id of ['cockpit-card-open', 'cockpit-card-stage', 'cockpit-card-inflow']) {
      expect(element(html, id)).not.toContain('data-testid="cockpit-level"');
    }
  });

  it('"Engpass" stands at the legal clearing station exactly from elevated on, in the tone of its level', () => {
    const below = render(ready(cockpitFixture({ legalReview: { over10m: T.legalReviewOver10m.attention - 1, items: [] } })));
    expect(tags(below, 'cockpit-bottleneck')).toHaveLength(0);
    const at = render(ready(cockpitFixture({ legalReview: { over10m: T.legalReviewOver10m.attention, items: [] } })));
    const [badge] = tags(at, 'cockpit-bottleneck');
    expect(attr(badge ?? '', 'data-level')).toBe('attention');
    expect(element(at, 'cockpit-station', 4)).toContain('data-testid="cockpit-bottleneck"');
    const critical = render(ready(cockpitFixture({ legalReview: { over10m: T.legalReviewOver10m.critical, items: [] } })));
    expect(attr(tags(critical, 'cockpit-bottleneck')[0] ?? '', 'data-level')).toBe('critical');
  });

  it('every figure, station column and unit row has the one accessible name pattern', () => {
    const html = render();
    expect(attr(tags(html, 'cockpit-card-open')[0] ?? '', 'aria-label')).toBe('Liste öffnen: Ohne Endstatus, 55');
    // The sub-line belongs to the name of each card (aria-describedby).
    for (const id of ['cockpit-card-open', 'cockpit-card-legal', 'cockpit-card-stage', 'cockpit-card-inflow']) {
      const card = tags(html, id)[0] ?? '';
      const described = attr(card, 'aria-describedby') ?? '';
      expect(described, id).not.toBe('');
      expect(html, id).toContain(`id="${described}"`);
    }
    expect(attr(tags(html, 'cockpit-card-legal')[0] ?? '', 'aria-label'))
      .toBe(`Liste öffnen: Legal Clearing über 10 min, 6, erhöht · ab ${T.legalReviewOver10m.attention}`);
    // WCAG 2.5.3: the visible label is the label of the name, word for word.
    expect(text(element(html, 'cockpit-card-legal'))).toContain('Legal Clearing über 10 min');
    expect(attr(tags(html, 'cockpit-card-stage')[0] ?? '', 'aria-label')).toBe('Liste öffnen: Auf der Bühne, 8');
    expect(attr(tags(html, 'cockpit-card-inflow')[0] ?? '', 'aria-label')).toBe('Liste öffnen: Zulauf letzte 5 min, 3');
    const stations = tags(html, 'cockpit-station');
    expect(stations.map((tag) => attr(tag, 'data-status'))).toEqual(['captured', 'classified', 'assigned', 'answer_drafted', 'in_review', 'approved']);
    // The station names its bottleneck, not the threshold of another figure (review minor 2).
    expect(attr(stations[4] ?? '', 'aria-label')).toBe('Liste öffnen: im Legal Clearing, 14, Engpass');
    expect(attr(stations[0] ?? '', 'aria-label')).toBe('Liste öffnen: erfasst, 5');
    const units = tags(html, 'cockpit-unit-row');
    expect(attr(units[0] ?? '', 'aria-label')).toBe(`Liste öffnen: Finanzen, 23, erhöht · ab ${T.unitBacklog.attention}`);
    expect(attr(units.at(-1) ?? '', 'aria-label')).toBe('Liste öffnen: Ohne Fachbereich, 5');
    for (const tag of [...stations, ...units]) expect(tag.startsWith('<button')).toBe(true);
  });
});

describe('W2 inflow chart', () => {
  it('12 rectangles in a 280 × 48 box, the newest in the accent, empty windows as a line, axis and a full name', () => {
    const html = render();
    const [svg] = tags(html, 'cockpit-inflow-chart');
    expect(attr(svg ?? '', 'width')).toBe('280');
    expect(attr(svg ?? '', 'height')).toBe('48');
    expect(attr(svg ?? '', 'role')).toBe('img');
    expect(attr(svg ?? '', 'aria-label')).toBe('Zulauf je 5 Minuten in der letzten Stunde: 2, 3, 0, 5, 3, 2, 1, 2, 3, 2, 1, 3; zuletzt 3');
    const bars = tags(html, 'cockpit-inflow-bar');
    expect(bars).toHaveLength(12);
    expect(bars.filter((bar) => attr(bar, 'data-latest') === 'true')).toHaveLength(1);
    expect(attr(bars[11] ?? '', 'class')).toContain('fill-accent-500');
    // Contrast (orchestrator decision): bars in grey 500 (3.9:1), empty windows as a grey 500 stroke, both at least 3:1.
    expect(attr(bars[0] ?? '', 'class')).toContain('fill-ink-500');
    expect(attr(bars[2] ?? '', 'class')).toContain('fill-ink-500');
    expect(html).not.toContain('fill-ink-300');
    expect(attr(bars[2] ?? '', 'data-empty')).toBe('true');
    expect(attr(bars[2] ?? '', 'height')).toBe('1');
    const card = text(element(html, 'cockpit-card-inflow'));
    expect(card).toContain('−60 min');
    expect(card).toContain('jetzt');
    expect(card).toContain('letzte Stunde: 27');
  });
});

describe('W3 backlog per unit', () => {
  it('order, "no unit" last with its subline, data-count, fill only with a level, the marker at elevated / scale', () => {
    const html = render();
    const rows = tags(html, 'cockpit-unit-row');
    expect(rows.map((row) => attr(row, 'data-unit'))).toEqual(['unit-fin', 'unit-hr', 'unit-esg', 'none']);
    expect(rows.map((row) => attr(row, 'data-count'))).toEqual(['23', '9', '0', '5']);
    expect(text(element(html, 'cockpit-unit-row', 3))).toContain('noch nicht zugewiesen');
    const fills = tags(html, 'cockpit-unit-bar');
    expect(attr(fills[0] ?? '', 'class')).toContain('bg-tone-warning-fg');
    expect(attr(fills[1] ?? '', 'class')).toContain('bg-ink-400');
    expect(attr(fills[0] ?? '', 'style')).toContain(`width:${(23 / T.unitBacklog.critical) * 100}%`);
    // A zero draws no bar at all; a value above zero at least 2 px.
    expect(attr(fills[2] ?? '', 'style')).toContain('width:0%');
    expect(attr(fills[1] ?? '', 'style')).toContain('min-width:2px');
    const markers = tags(html, 'cockpit-unit-marker');
    expect(markers).toHaveLength(4);
    for (const marker of markers) {
      expect(attr(marker, 'aria-hidden')).toBe('true');
      expect(attr(marker, 'style')).toContain(`left:${(T.unitBacklog.attention / T.unitBacklog.critical) * 100}%`);
    }
    expect(text(element(html, 'cockpit-backlog'))).toContain(`Strich = Schwelle „erhöht“ (${T.unitBacklog.attention})`);
  });
});

describe('W4 states', () => {
  it('loading keeps the fixed heights of the layout and says so', () => {
    const html = render({ read: { status: 'loading' } });
    const [loading] = tags(html, 'cockpit-loading');
    expect(loading).toBeDefined();
    expect(attr(loading ?? '', 'aria-busy')).toBe('true');
    expect(tags(html, 'cockpit-loading-backlog')).toHaveLength(1);
    expect(html).toContain('min-h-');
    expect(tags(html, 'cockpit-oldest-open')).toHaveLength(0);
  });

  it('an error names its rule id and offers "Erneut laden"', () => {
    const html = render({ read: { status: 'error', ruleId: 'R-TIME-01' } });
    const error = text(element(html, 'cockpit-error'));
    expect(error).toContain('R-TIME-01');
    expect(text(element(html, 'cockpit-error-retry'))).toBe('Erneut laden');
    expect(tags(html, 'cockpit-oldest')).toHaveLength(0);
  });

  it('a refused read is a read state, never partial figures', () => {
    const html = render({ read: { status: 'forbidden' } });
    expect(text(element(html, 'cockpit-forbidden'))).toContain(de('cockpit.forbidden.title'));
    for (const id of ['cockpit-oldest', 'cockpit-card-open', 'cockpit-station', 'cockpit-unit-row']) expect(tags(html, id)).toHaveLength(0);
  });

  it('empty: "—", "Keine offene Einzelfrage.", no button (named exception to D2)', () => {
    const empty = cockpitFixture({
      oldestOpen: { ageSeconds: 0, items: [] },
      totals: { captured: 0, open: 0, staged: 0, answered: 0 },
      openByUnit: { 'unit-fin': 0, 'unit-hr': 0, 'unit-esg': 0 },
      openUnassigned: 0,
      legalReview: { over10m: 0, items: [] },
    });
    const html = render(ready(empty));
    const oldest = text(element(html, 'cockpit-oldest'));
    expect(oldest).toContain('—');
    expect(oldest).toContain('Keine offene Einzelfrage.');
    expect(tags(html, 'cockpit-oldest-open')).toHaveLength(0);
    expect(tags(html, 'cockpit-level')).toHaveLength(0);
  });

  it('8a: without a readable reference the main reading shows age and level, no number, no button', () => {
    const html = render(ready(cockpitFixture({ oldestOpen: { ageSeconds: 3000, items: [] } })));
    const oldest = element(html, 'cockpit-oldest');
    expect(text(oldest)).toContain('50');
    expect(text(oldest)).toContain('kritisch');
    expect(oldest).not.toContain('F-0125');
    expect(tags(html, 'cockpit-oldest-open')).toHaveLength(0);
    expect(tags(html, 'cockpit-oldest-next')).toHaveLength(0);
  });

  it('8a: a filtered oldest question is never the main reference; every readable one stands under "Danach die ältesten"', () => {
    // The true oldest (3000 s) is not readable; the first readable reference is younger.
    const items = cockpitFixture().oldestOpen.items.slice(1);
    const html = render(ready(cockpitFixture({ oldestOpen: { ageSeconds: 3000, items } })));
    const oldest = element(html, 'cockpit-oldest');
    expect(text(oldest)).toContain('50');
    expect(tags(html, 'cockpit-oldest-ref')).toHaveLength(0);
    expect(tags(html, 'cockpit-oldest-open')).toHaveLength(0);
    expect(tags(html, 'cockpit-oldest-next').map((tag) => attr(tag, 'data-id'))).toEqual(items.map((item) => item.id));
  });

  it('a meeting that is not running says so in a neutral badge; the canary line is quiet', () => {
    const html = render(ready(cockpitFixture({ meetingStatus: 'preparation' })));
    expect(text(element(html, 'cockpit-meeting-status'))).toBe('HV in Vorbereitung');
    expect(text(element(html, 'cockpit-canary'))).toBe('Kanarienfrage: nicht eingerichtet');
    expect(text(element(html, 'cockpit-asof'))).toBe('Stand 15:42:10');
    expect(tags(render(), 'cockpit-meeting-status')).toHaveLength(0);
  });
});

describe('D3 one padding token for every panel, spacing on the 4/8 grid', () => {
  it('the main reading uses p-4 like the cards; the sources of the page use no off-grid spacing', () => {
    const html = render();
    expect(attr(tags(html, 'cockpit-oldest')[0] ?? '', 'class')).toMatch(/\bp-4\b/);
    for (const [name, source] of Object.entries(SOURCES)) {
      for (const off of [/\bp-5\b/, /pt-2\.5/, /gap-1\.5/, /gap-x-2\.5/, /mt-0\.5/, /mx-1\.5/, /\bh-2\.5/, /\bw-2\.5/, /h-3\.5/]) {
        expect(`${name}: ${off.test(source) ? off.source : 'clean'}`).toBe(`${name}: clean`);
      }
    }
  });
});

describe('W5 privacy in the DOM, list and thread open', () => {
  it('no speaker name, no actor id, no return reason; only number, station, unit and times', () => {
    const cockpit = cockpitFixture();
    const html = render({
      ...ready(cockpit),
      selection: { list: 'legal', q: 'q-141' },
      list: { status: 'ready', rows: rowsFromRefs(cockpit.legalReview.items, 'legal'), total: 6 },
      thread: {
        status: 'ready',
        id: 'q-141',
        number: 'F-0141',
        text: 'Wie hoch war die Ausschüttungsquote im Geschäftsjahr 2025?',
        unitId: 'unit-fin',
        stageAssignment: 'cfo',
        entries: threadEntries([
          { status: 'captured', at: '2026-06-15T12:53:00.000Z' },
          { status: 'in_review', at: '2026-06-15T13:18:00.000Z' },
        ], 'in_review', cockpit.asOf),
      },
    });
    expect(tags(html, 'cockpit-list-row')).toHaveLength(6);
    // The count badge shows the number in mono; the words stay for assistive technology.
    const badge = element(html, 'cockpit-list-count');
    expect(badge).toMatch(/<span aria-hidden="true" class="font-mono">6<\/span>/);
    expect(badge).toContain('<span class="sr-only">6 Einzelfragen</span>');
    expect(html).toContain('Ausschüttungsquote');
    expect(html).not.toMatch(/\bu-[a-z]+(-[a-z0-9]+)?\b/); // no actor id (u-legal-1, u-exp-fin, …)
    expect(html).not.toMatch(/Birgit|Mertens|Wortmeldung|speaker/i);
    expect(html).not.toContain('Bitte Zahl');
  });
});

describe('W8 keyboard path and the one primary button', () => {
  it('the focusable elements follow decision 11: open thread, next oldest, four cards, stations, units, list, thread', () => {
    const cockpit = cockpitFixture();
    const html = render({
      ...ready(cockpit),
      selection: { list: 'legal', q: 'q-141' },
      list: { status: 'ready', rows: rowsFromRefs(cockpit.legalReview.items, 'legal'), total: 6 },
      thread: { status: 'ready', id: 'q-141', number: 'F-0141', entries: threadEntries(null, 'in_review', cockpit.asOf) },
    });
    const order = [...html.matchAll(/<button[^>]*data-testid="([^"]+)"/g)].map((match) => match[1]);
    const compact = order.filter((id, i) => id !== order[i - 1]);
    expect(compact).toEqual([
      'cockpit-oldest-open', 'cockpit-oldest-next',
      'cockpit-card-open', 'cockpit-card-legal', 'cockpit-card-stage', 'cockpit-card-inflow',
      'cockpit-station', 'cockpit-unit-row',
      'cockpit-list-close', 'cockpit-list-row',
      'cockpit-thread-close',
    ]);
    expect(html.match(/data-primary="true"/g)).toHaveLength(1);
    expect(tags(html, 'cockpit-oldest-open')[0]).toContain('data-primary="true"');
    // Roving focus in the list: one row in the tab order, arrows move within.
    const rows = tags(html, 'cockpit-list-row');
    expect(rows.filter((row) => attr(row, 'tabindex') === '0')).toHaveLength(1);
  });

  it('the live region is polite and silent until an announcement', () => {
    const [live] = tags(render(), 'cockpit-live');
    expect(attr(live ?? '', 'aria-live')).toBe('polite');
    expect(text(element(render({ announcement: 'Leitstand: x' }), 'cockpit-live'))).toBe('Leitstand: x');
  });
});
