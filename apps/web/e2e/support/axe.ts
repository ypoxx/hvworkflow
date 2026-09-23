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
import { fileURLToPath } from 'node:url';
import type { Result } from 'axe-core';
import type { Page } from '@playwright/test';

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
  /** ISO date; the exception check below is documentation only (the file's expiry is enforced by
   *  the Bericht and the review, not by a runtime clock check R8 would forbid in a Playwright spec). */
  readonly expires: string;
  /** A role ("Umsetzer"), never a person's name (AGENTS.md rule 11). */
  readonly owner: string;
}

const EXCEPTIONS_PATH = fileURLToPath(new URL('./axe-exceptions.json', import.meta.url));

/** Read once per test file import; the list is small and the file never changes mid-run. */
export const AXE_EXCEPTIONS: readonly AxeException[] = JSON.parse(
  readFileSync(EXCEPTIONS_PATH, 'utf8'),
) as AxeException[];

function selectorsForRule(rule: string): string[] {
  return AXE_EXCEPTIONS.filter((exception) => exception.rule === rule).map(
    (exception) => exception.selector,
  );
}

function isSerious(violation: Result): boolean {
  return violation.impact === 'serious' || violation.impact === 'critical';
}

function logPass(label: string, pass: string, violations: readonly Result[]): void {
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
