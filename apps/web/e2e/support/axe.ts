/**
 * Slice 013 — the shared axe-core gate every Playwright scenario runs at each view change (goal 1).
 * Same two-pass method slice 020 built and its review sharpened (docs/slices/020-rueckbau-passung.md,
 * review round 2, "sharpen, do not retry"): a blanket `disableRules`/`.exclude('.text-ink-500')`
 * hides *every* element that happens to share a utility class, new ones included — so the check
 * splits into two independent passes:
 *
 *   (a) every rule except `color-contrast`, on the whole page, with zero exclusions — nothing this or
 *       any future slice adds can hide behind a class-wide exclusion any more;
 *   (b) `color-contrast` alone, excluding only the individual selectors named, with a rule id, a
 *       reason, an expiry date and an owner *role* (never a person), in `axe-exceptions.json`.
 *
 * Both passes must be free of "serious"/"critical" impact violations (goal 1: "ein Verstoß der Stufe
 * 'serious' oder 'critical' lässt den Test scheitern"). A "moderate" or "minor" finding is logged but
 * does not fail the run — it belongs in the Bericht as an open item, not as a silent exclusion.
 *
 * Slice 013 follow-up 1 (from 020's review): `AX_020_01` used to live inside
 * `020-rueckbau-passung.spec.ts` itself, as a bare TypeScript array; it now lives once, here, in
 * `axe-exceptions.json`, and 020's own spec reads it from this module instead of keeping its own copy.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

/** Derived from `AxeBuilder.analyze()`'s own, already-resolved return type instead of an `import
 *  type … from 'axe-core'` — `apps/web` has no direct dependency on `axe-core` itself (only on
 *  `@axe-core/playwright`, which depends on it), and pnpm's isolated `node_modules` makes that
 *  transitive package unresolvable from here, even though the exact same type is reachable through
 *  the wrapper's own declaration file. */
type AxeAnalysis = Awaited<ReturnType<InstanceType<typeof AxeBuilder>['analyze']>>;
type AxeViolation = AxeAnalysis['violations'][number];

export interface AxeException {
  /** A human-auditable name shared by every selector belonging to the same underlying debt (e.g.
   *  "AX-020-01") — several rows may carry the same id when one piece of debt shows up in many
   *  components; each row still stands on its own as "a rule id, a selector, a reason, an expiry". */
  readonly id: string;
  /** The axe-core rule id this exception narrows, e.g. "color-contrast". Never a whole rule turned
   *  off wholesale (AGENTS.md rule 1) — only this one rule, only for this one selector. */
  readonly rule: string;
  /** A CSS selector (may itself be a comma-separated selector list) scoped as tightly as the
   *  pre-existing markup allows — never a bare utility class alone that a new element could reuse. */
  readonly selector: string;
  /** File:line (or line range) of the pre-existing component this selector targets, for audit. */
  readonly location: string;
  /** Why this is debt, not a defect this slice owns. */
  readonly reason: string;
  /** ISO date (`YYYY-MM-DD`); enforced below at import time, not just documentation — AGENTS.md
   *  rule 8 ("time comes from the injected clock") governs `packages/domain/src/api.ts` and
   *  `apps/api/src/server.ts` (`scripts/now-check.mjs`'s own scan roots), not this test harness, so
   *  a plain `new Date()` here is not a rule-8 violation, just an ordinary expiry check. */
  readonly expires: string;
  /** A role ("Umsetzer"), never a person's name (AGENTS.md rule 11). */
  readonly owner: string;
}

// `.pathname` rather than Node's `fileURLToPath` (see the `node:fs` note above) — `URL` itself is a
// DOM/web-standard global already covered by `tsconfig.app.json`'s `lib`. Every test file's own
// `import.meta.url` is a real `file://` URL of an absolute path, and this project runs Linux-only
// (no Windows drive-letter path to get wrong). `decodeURIComponent` (review round 1, nit 9):
// `.pathname` is percent-encoded (e.g. a space would arrive as `%20`); this repository's own path
// has none today, but `readFileSync` must see the real path, not the URL-escaped one, on principle.
const EXCEPTIONS_PATH = decodeURIComponent(
  new URL('./axe-exceptions.json', import.meta.url).pathname,
);

/** Read once per test file import; the list is small and the file never changes mid-run. */
export const AXE_EXCEPTIONS: readonly AxeException[] = JSON.parse(
  readFileSync(EXCEPTIONS_PATH, 'utf8'),
) as AxeException[];

/**
 * Review round 1, minor 7 (also raised independently on PR #19): an expiry date that is only ever
 * read by a human is not enforced at all. `expires` must be a real date `YYYY-MM-DD` (checked first,
 * fail closed); once valid it sorts correctly as a plain string. Runs once, at import time, in every spec file that
 * imports this module — an expired exception fails every scenario immediately, loudly, and by name,
 * rather than quietly keeping a stale allowance alive.
 */
function assertNoExpiredExceptions(exceptions: readonly AxeException[]): void {
  // Review round 2 (Codex on PR #19): fail closed on a missing or malformed date. A value such as
  // `2026-1-1` or `31.12.2026` would otherwise never compare as expired and keep the allowance alive.
  const malformed = exceptions.filter(
    (exception) =>
      typeof exception.expires !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(exception.expires) ||
      Number.isNaN(Date.parse(`${exception.expires}T00:00:00Z`)) ||
      new Date(`${exception.expires}T00:00:00Z`).toISOString().slice(0, 10) !== exception.expires,
  );
  if (malformed.length > 0) {
    const names = malformed.map((exception) => `${exception.id} (expires: ${String(exception.expires)})`).join(', ');
    throw new Error(`axe-exceptions.json: expiry must be a real date YYYY-MM-DD: ${names}.`);
  }
  const today = new Date().toISOString().slice(0, 10);
  const expired = exceptions.filter((exception) => exception.expires < today);
  if (expired.length === 0) return;
  const names = expired.map((exception) => `${exception.id} (${exception.selector})`).join(', ');
  throw new Error(
    `axe-exceptions.json: ${expired.length} exception(s) expired as of ${today}: ${names}. ` +
      'Renew the expiry date after re-checking the debt, or remove the exception and fix the finding.',
  );
}

assertNoExpiredExceptions(AXE_EXCEPTIONS);

function selectorsForRule(rule: string): string[] {
  return AXE_EXCEPTIONS.filter((exception) => exception.rule === rule).map(
    (exception) => exception.selector,
  );
}

function isSerious(violation: AxeViolation): boolean {
  return violation.impact === 'serious' || violation.impact === 'critical';
}

function logPass(label: string, pass: string, violations: readonly AxeViolation[]): void {
  const serious = violations.filter(isSerious);
  console.log(
    `[axe] ${label} (${pass}): ${violations.length} violation group(s), ${serious.length} serious/critical`,
  );
  for (const violation of violations) {
    const targets = violation.nodes.map((node) => node.target.join(' ')).join(', ');
    console.log(`  - ${violation.id} [${violation.impact ?? 'n/a'}] ${violation.helpUrl}`);
    console.log(`    targets: ${targets}`);
  }
}

export interface AxeReport {
  readonly label: string;
  readonly other: { readonly total: number; readonly serious: number };
  readonly colorContrast: { readonly total: number; readonly serious: number };
}

/**
 * Runs both passes against the page's current state (whatever view or dialog is open right now) and
 * asserts zero "serious"/"critical" violations in each. `label` identifies the view in the console
 * log and in the Bericht's axe table — pass the same label scheme 020 used
 * ("<ansicht> (<zustand>)", e.g. "answers (expert, answer_drafted question)").
 */
export async function checkAxe(page: Page, label: string): Promise<AxeReport> {
  const other = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  const otherSerious = other.violations.filter(isSerious);
  logPass(label, 'a, all rules except color-contrast, no exclusions', other.violations);
  expect(otherSerious, JSON.stringify(otherSerious, null, 2)).toEqual([]);

  let colorBuilder = new AxeBuilder({ page }).withRules(['color-contrast']);
  for (const selector of selectorsForRule('color-contrast')) {
    colorBuilder = colorBuilder.exclude(selector);
  }
  const colorContrast = await colorBuilder.analyze();
  const colorSerious = colorContrast.violations.filter(isSerious);
  logPass(label, 'b, color-contrast only, named exceptions excluded', colorContrast.violations);
  expect(colorSerious, JSON.stringify(colorSerious, null, 2)).toEqual([]);

  return {
    label,
    other: { total: other.violations.length, serious: otherSerious.length },
    colorContrast: { total: colorContrast.violations.length, serious: colorSerious.length },
  };
}
