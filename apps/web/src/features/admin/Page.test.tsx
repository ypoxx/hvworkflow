/**
 * Scheibe 041, Test 7: the page and its dialogs. The web package has no DOM test environment (no jsdom, no Testing
 * Library; adding one is outside this slice's files), so — as in 045 and 053 — the components are rendered statically,
 * the kit's portal `Dialog` is replaced by an in-place frame, and every behaviour that needs a click or a key is a pure
 * function tested here (tab and listbox keys, the input sent, the revoke call, the dialog falling with the actor). The
 * interactive path itself runs in the browser in `e2e/041-verwaltung.spec.ts` (E1–E7).
 */
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HvApi, Meeting, Unit } from '@hv/domain';
import { ApiProblem } from '@hv/domain';
import { roleCards } from '../../api/roleCards';
import { actionLabel, roleLabel, translate } from '../../i18n';
import type { TKey } from '../../i18n';

vi.mock('../../components', async (original) => ({
  ...(await original<typeof import('../../components')>()),
  Dialog: ({ title, description, footer, children }: { title: string; description?: string; footer?: ReactNode; children?: ReactNode }) => (
    <div role="dialog" aria-label={title}>
      <p>{description}</p>
      {children}
      <div data-frame="footer">{footer}</div>
    </div>
  ),
}));

const { readAccess } = await import('./access');
const { AdminLayout } = await import('./AdminLayout');
const { ADMIN_TABS, rovingTarget } = await import('./tabs');
const { AssignDialog } = await import('./AssignDialog');
const { RevokeDialog } = await import('./RevokeDialog');
const { RemoveDialog } = await import('./RemoveDialog');
const { RoleCardView } = await import('./RoleCardsTab');
const { followActor } = await import('./actorScope');
const { EMPTY_ASSIGN_FORM } = await import('./assignments');
const { attempt } = await import('./problems');
const { readMaster, writeMaster } = await import('./masterData');

const t = (key: TKey, params?: Record<string, string | number>) => translate('de', key, params);
const CARDS = roleCards();
const UNITS: readonly Unit[] = [
  { id: 'unit-fin', name: 'Finanzen und Controlling', shortName: 'Finanzen' },
  { id: 'unit-ir', name: 'Investor Relations', shortName: 'IR' },
];
const MEETING = {
  id: 'meeting-2026',
  title: 'Ordentliche Hauptversammlung 2026',
  legalEntity: 'Muster AG',
  date: '2026-06-18',
  status: 'running',
  version: 17,
} as Meeting;

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const has = (html: string, text: string): boolean => html.includes(escape(text));
/** A rule id rendered in mono (D5); the pattern is built from the id, never written as markup in this file. */
const inMono = (html: string, text: string): boolean => new RegExp(`font-mono[^>]*>${text}<`).test(html);
/** One attribute of a tag, read without writing the attribute literally into this file. */
const attr = (tag: string, name: string): string | undefined => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const tagOf = (html: string, testId: string): string => html.match(new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? '';
const blocked = (html: string, testId: string): boolean => tagOf(html, testId).includes('aria-disabled="true"');
function optionValues(html: string, testId: string): string[] {
  const start = html.indexOf(`data-testid="${testId}"`);
  const select = start < 0 ? '' : html.slice(start, html.indexOf('</select>', start));
  return [...select.matchAll(/<option[^>]*value="([^"]*)"/g)].map((match) => match[1] ?? '');
}

/** A fake HvApi that records the name of every method called and answers only what a case sets. */
function recordingApi(answers: Partial<Record<keyof HvApi, (...args: unknown[]) => Promise<unknown>>>) {
  const calls: string[] = [];
  const api = new Proxy({} as HvApi, {
    get: (_target, name: string) => (...args: unknown[]) => {
      calls.push(name);
      const answer = answers[name as keyof HvApi];
      return answer ? answer(...args) : Promise.reject(new Error(`unexpected call ${name}`));
    },
  });
  return { api, calls };
}

describe('(a) without the right: the locked state and no further read', () => {
  it('403 on listRoleAssignments → forbidden, and nothing else is called', async () => {
    const { api, calls } = recordingApi({
      listRoleAssignments: () => Promise.reject(new ApiProblem(403, 'Forbidden', 'x', 'R-PERM-01')),
    });
    expect(await readAccess(api)).toEqual({ status: 'forbidden' });
    expect(calls).toEqual(['listRoleAssignments']);
  });

  it('a list → ready with it; another failure → failed (not locked)', async () => {
    const ok = recordingApi({ listRoleAssignments: () => Promise.resolve([]) });
    expect(await readAccess(ok.api)).toEqual({ status: 'ready', assignments: [] });
    const error = new ApiProblem(500, 'Server error', 'x');
    const failed = recordingApi({ listRoleAssignments: () => Promise.reject(error) });
    expect(await readAccess(failed.api)).toEqual({ status: 'failed', error });
  });

  it('the locked state names the right, never a role, and shows no tab list', () => {
    const html = renderToStaticMarkup(
      <AdminLayout meeting={MEETING} access={{ status: 'forbidden' }} tab="roles" onTab={() => undefined} lang="de">
        <p data-testid="panel-probe" />
      </AdminLayout>,
    );
    expect(html).toContain('data-testid="admin-forbidden"');
    expect(tagOf(html, 'admin-forbidden')).toContain('role="status"');
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('panel-probe');
    // The locked region says exactly its title and its sentence with the right's label — nothing else, so no role.
    const region = html.slice(html.lastIndexOf('<', html.indexOf('data-testid="admin-forbidden"')));
    const text = region.replace(/<[^>]+>/g, '');
    expect(text).toBe(escape(t('admin.forbidden.title') + t('admin.forbidden.body', { right: actionLabel(t, 'admin.roles.manage') })));
  });
});

describe('(b) header and tabs', () => {
  const render = (tab: (typeof ADMIN_TABS)[number]['id']) =>
    renderToStaticMarkup(
      <AdminLayout meeting={MEETING} access={{ status: 'ready', assignments: [] }} tab={tab} onTab={() => undefined} lang="de">
        <p data-testid="panel-probe" />
      </AdminLayout>,
    );

  it('the header names the meeting, its state and its version in mono', () => {
    const html = render('roles');
    expect(has(html, MEETING.title)).toBe(true);
    expect(has(html, 'Muster AG')).toBe(true);
    expect(has(html, t('meeting.state.running'))).toBe(true);
    const version = tagOf(html, 'admin-meeting-version');
    expect(version).toContain('font-mono');
    expect(html).toMatch(/data-testid="admin-meeting-version"[^>]*>17</);
  });

  it('six tabs in order, the roles tab first and selected, each controlling its panel', () => {
    const html = render('roles');
    expect(ADMIN_TABS.map((tab) => tab.testId)).toEqual([
      'admin-tab-roles', 'admin-tab-units', 'admin-tab-agenda', 'admin-tab-seats', 'admin-tab-role-cards', 'admin-tab-meetings',
    ]);
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(6);
    expect(tagOf(html, 'admin-tab-roles')).toContain('aria-selected="true"');
    expect(tagOf(html, 'admin-tab-roles')).toContain('tabindex="0"');
    expect(tagOf(html, 'admin-tab-units')).toContain('aria-selected="false"');
    expect(tagOf(html, 'admin-tab-units')).toContain('tabindex="-1"');
    const controls = tagOf(html, 'admin-tab-roles').match(/aria-controls="([^"]+)"/)?.[1];
    expect(controls).toBeDefined();
    expect(html).toContain(`id="${controls}"`);
    expect(html).toContain('role="tabpanel"');
  });

  it('another selected tab carries aria-selected', () => {
    const html = render('seats');
    expect(tagOf(html, 'admin-tab-seats')).toContain('aria-selected="true"');
    expect(tagOf(html, 'admin-tab-roles')).toContain('aria-selected="false"');
  });

  it('arrow right/left, Home and End move between the tabs and wrap', () => {
    const count = ADMIN_TABS.length;
    expect(rovingTarget('ArrowRight', 0, count, 'horizontal')).toBe(1);
    expect(rovingTarget('ArrowRight', count - 1, count, 'horizontal')).toBe(0);
    expect(rovingTarget('ArrowLeft', 0, count, 'horizontal')).toBe(count - 1);
    expect(rovingTarget('Home', 3, count, 'horizontal')).toBe(0);
    expect(rovingTarget('End', 1, count, 'horizontal')).toBe(count - 1);
    expect(rovingTarget('ArrowDown', 1, count, 'horizontal')).toBeUndefined();
    expect(rovingTarget('Enter', 1, count, 'horizontal')).toBeUndefined();
  });
});

describe('(c) "Rolle zuordnen"', () => {
  const render = (form = EMPTY_ASSIGN_FORM, problem?: { key: TKey; ruleId?: string }) =>
    renderToStaticMarkup(
      <AssignDialog
        cards={CARDS}
        units={UNITS}
        subjects={['kennung-a', 'kennung-b']}
        busy={false}
        {...(problem !== undefined ? { problem } : {})}
        onClose={() => undefined}
        onSubmit={() => undefined}
        initialForm={form}
      />,
    );
  const unitBound = CARDS.find((card) => card.unitBound)!;
  const notBound = CARDS.find((card) => !card.unitBound)!;

  it('titled with the right; the roles in the order of the rights table, none preselected', () => {
    const html = render();
    expect(attr(html.match(/<div[^>]*role="dialog"[^>]*>/)?.[0] ?? '', 'aria-label')).toBe(escape(actionLabel(t, 'admin.roles.manage')));
    expect(optionValues(html, 'admin-assign-role')).toEqual(['', ...CARDS.map((card) => card.role)]);
    for (const card of CARDS) expect(has(html, roleLabel(t, card.role))).toBe(true);
    expect(html).not.toMatch(/<option[^>]*value="[a-z]+"[^>]*selected/);
    expect(optionValues(html, 'admin-assign-unit')).toEqual(['', 'unit-fin', 'unit-ir']);
  });

  it('the subjects already in the table are offered as data, with the pseudonym hint', () => {
    const html = render();
    expect(html).toContain('<datalist');
    expect(html).toContain('value="kennung-a"');
    expect(has(html, t('admin.assign.subject.hint'))).toBe(true);
  });

  it('a unit-bound role shows the hint; another role does not', () => {
    expect(has(render({ ...EMPTY_ASSIGN_FORM, role: unitBound.role }), t('admin.assign.unit.boundHint'))).toBe(true);
    expect(has(render({ ...EMPTY_ASSIGN_FORM, role: notBound.role }), t('admin.assign.unit.boundHint'))).toBe(false);
  });

  it('submitting is locked until subject and role are set; an impossible local time marks the field', () => {
    expect(blocked(render(), 'admin-assign-submit')).toBe(true);
    expect(blocked(render({ ...EMPTY_ASSIGN_FORM, subjectId: 'kennung-c' }), 'admin-assign-submit')).toBe(true);
    expect(blocked(render({ ...EMPTY_ASSIGN_FORM, subjectId: 'kennung-c', role: notBound.role }), 'admin-assign-submit')).toBe(false);
    const impossible = render({ subjectId: 'kennung-c', role: notBound.role, unitId: '', expires: '2027-03-28T02:30' });
    expect(blocked(impossible, 'admin-assign-submit')).toBe(true);
    expect(has(impossible, t('admin.assign.expires.invalid'))).toBe(true);
  });

  it('no field for personId and none for a deputy', () => {
    const html = render();
    expect(html).not.toContain('personId');
    expect(html).not.toContain('deputy');
  });

  it('(d) 409 R-ADM-07 → the message with text and rule id in the dialog, the inputs stay', () => {
    const form = { subjectId: 'u-self', role: notBound.role, unitId: 'unit-ir', expires: '' };
    const html = render(form, { key: 'admin.problem.R-ADM-07', ruleId: 'R-ADM-07' });
    const alert = tagOf(html, 'admin-problem');
    expect(alert).toContain('role="alert"');
    expect(has(html, t('admin.problem.R-ADM-07'))).toBe(true);
    expect(inMono(html, 'R-ADM-07')).toBe(true);
    expect(html).toContain('value="u-self"');
    expect(html).toMatch(/<option[^>]*value="unit-ir"[^>]*selected/);
  });
});

describe('(e) removing a unit that is still referenced', () => {
  it('409 R-ADM-02 from the service is a refusal with its rule id, and the list is not changed', async () => {
    const units: Unit[] = [...UNITS];
    const { api, calls } = recordingApi({
      getMeetingById: () => Promise.resolve(MEETING),
      listMeetingUnits: () => Promise.resolve(units),
      replaceMeetingUnits: () => Promise.reject(new ApiProblem(409, 'Conflict', 'Unit unit-fin is still referenced', 'R-ADM-02')),
    });
    const read = await readMaster(api, MEETING.id, 'units');
    const outcome = await attempt(() => writeMaster(api, MEETING.id, 'units', read, { op: 'remove', id: 'unit-fin' }));
    expect(outcome).toEqual({ kind: 'problem', key: 'admin.problem.R-ADM-02', ruleId: 'R-ADM-02' });
    expect(units).toEqual(UNITS);
    expect(read.items).toEqual(UNITS);
    expect(calls).toEqual(['getMeetingById', 'listMeetingUnits', 'replaceMeetingUnits']);
  });

  it('the remove dialog names the entry and shows the refusal with the rule id', () => {
    const html = renderToStaticMarkup(
      <RemoveDialog
        name="Finanzen"
        busy={false}
        problem={{ key: 'admin.problem.R-ADM-02', ruleId: 'R-ADM-02' }}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    expect(has(html, t('admin.remove.body', { name: 'Finanzen' }))).toBe(true);
    expect(tagOf(html, 'admin-problem')).toContain('role="alert"');
    expect(has(html, t('admin.problem.R-ADM-02'))).toBe(true);
    expect(inMono(html, 'R-ADM-02')).toBe(true);
  });
});

describe('(f) revoking', () => {
  it('the dialog names subject and role; R-ADM-08 shows with its rule id', () => {
    const card = CARDS[0]!;
    const html = renderToStaticMarkup(
      <RevokeDialog
        subjectId="kennung-a"
        role={card.role}
        busy={false}
        problem={{ key: 'admin.problem.R-ADM-08', ruleId: 'R-ADM-08' }}
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(has(html, t('admin.revoke.body', { subject: 'kennung-a', role: roleLabel(t, card.role) }))).toBe(true);
    expect(tagOf(html, 'admin-revoke-reason').toLowerCase()).toContain('maxlength="500"');
    expect(has(html, t('admin.problem.R-ADM-08'))).toBe(true);
    expect(inMono(html, 'R-ADM-08')).toBe(true);
  });
});

describe('(g) a change of actor closes an open dialog (090)', () => {
  it('compared by id: another actor drops the dialog, the same actor keeps it', () => {
    const open = { actorId: 'u-admin', dialog: { kind: 'assign' } };
    expect(followActor(open, 'u-admin')).toBe(open);
    expect(followActor(open, 'u-cap-1')).toEqual({ actorId: 'u-cap-1', dialog: null });
    const closed = { actorId: 'u-admin', dialog: null };
    expect(followActor(closed, 'u-cap-1')).toEqual({ actorId: 'u-cap-1', dialog: null });
  });
});

describe('(h) role cards', () => {
  it('arrow keys move through the roles (vertical listbox, wrapping), Home and End', () => {
    const count = CARDS.length;
    expect(rovingTarget('ArrowDown', 0, count, 'vertical')).toBe(1);
    expect(rovingTarget('ArrowUp', 0, count, 'vertical')).toBe(count - 1);
    expect(rovingTarget('ArrowDown', count - 1, count, 'vertical')).toBe(0);
    expect(rovingTarget('Home', 2, count, 'vertical')).toBe(0);
    expect(rovingTarget('End', 0, count, 'vertical')).toBe(count - 1);
    expect(rovingTarget('ArrowRight', 0, count, 'vertical')).toBeUndefined();
  });

  it('every card shows the label of each right it acts with, from the data, and the unit sentence when bound', () => {
    for (const card of CARDS) {
      const html = renderToStaticMarkup(<RoleCardView card={card} />);
      expect(html).toContain('data-testid="admin-role-card"');
      expect(has(html, roleLabel(t, card.role))).toBe(true);
      for (const permission of card.acts) expect(has(html, actionLabel(t, permission))).toBe(true);
      for (const permission of card.reads) expect(html).toContain(permission);
      expect(has(html, t('admin.roleCards.unitBound'))).toBe(card.unitBound);
      if (card.acts.length === 0 || card.reads.length === 0) expect(has(html, t('admin.roleCards.none'))).toBe(true);
    }
  });
});
