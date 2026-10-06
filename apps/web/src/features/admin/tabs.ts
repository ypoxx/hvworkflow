/**
 * Scheibe 041: the six sections of the Verwaltung and the keys of a roving focus (WAI-ARIA tabs and listbox): arrows
 * move and wrap, Home and End jump. Pure, so the key handling is tested without a browser.
 */
import type { TKey } from '../../i18n';

export const ADMIN_TABS = [
  { id: 'roles', labelKey: 'admin.tab.roles', testId: 'admin-tab-roles' },
  { id: 'units', labelKey: 'admin.tab.units', testId: 'admin-tab-units' },
  { id: 'agenda', labelKey: 'admin.tab.agenda', testId: 'admin-tab-agenda' },
  { id: 'seats', labelKey: 'admin.tab.seats', testId: 'admin-tab-seats' },
  { id: 'roleCards', labelKey: 'admin.tab.roleCards', testId: 'admin-tab-role-cards' },
  { id: 'meetings', labelKey: 'admin.tab.meetings', testId: 'admin-tab-meetings' },
] as const satisfies readonly { id: string; labelKey: TKey; testId: string }[];

export type AdminTabId = (typeof ADMIN_TABS)[number]['id'];

const KEYS = {
  horizontal: { previous: 'ArrowLeft', next: 'ArrowRight' },
  vertical: { previous: 'ArrowUp', next: 'ArrowDown' },
} as const;

/** The index a key moves to, or `undefined` when the key is not one of the roving keys. */
export function rovingTarget(
  key: string,
  index: number,
  count: number,
  orientation: 'horizontal' | 'vertical',
): number | undefined {
  if (count <= 0) return undefined;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === KEYS[orientation].next) return (index + 1) % count;
  if (key === KEYS[orientation].previous) return (index - 1 + count) % count;
  return undefined;
}
