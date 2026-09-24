/**
 * "Every rule id has a legalRef and at least one test" (slice 011), the `packages/domain` half
 * (Festlegung 3 of docs/slices/011-legal-trace-regelregister.md): no file access here — the file-
 * scanning half (every rule id mentioned in source vs. the register) lives in
 * `apps/api/src/__tests__/rule-register.test.ts`, because the domain must not import `node:fs`, not
 * even in a test (`arch`, rule `domain-no-node-core-modules`).
 *
 * `docs/legal-trace.md` is generated the same way `policy-truth-table.md` is (transitions.test.ts):
 * `toMatchFileSnapshot` diffs against the committed file, so a change to any rule's `legalRef` or
 * description shows up as a reviewable diff, never a silent edit.
 */
import { describe, expect, it } from 'vitest';
import { CROSS_CUTTING_EFFECTS, ruleRegister, type LegalSource } from '../rules.js';

const LEGAL_SOURCES: readonly LegalSource[] = [
  'AktG',
  'Satzung',
  'Geschäftsordnung',
  'Recherche',
  'Rechtekonzept',
  'Prozess',
  'Leitplanken',
];

describe('rule register', () => {
  it('has no duplicate rule ids', () => {
    const entries = ruleRegister();
    const ids = entries.map((e) => e.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is sorted by rule id', () => {
    const ids = ruleRegister().map((e) => e.ruleId);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
  });

  it('every entry has a legalRef with verified:false and a non-empty citation from the fixed source list', () => {
    for (const entry of ruleRegister()) {
      expect(LEGAL_SOURCES, `${entry.ruleId}: source`).toContain(entry.legalRef.source);
      expect(entry.legalRef.citation.length, `${entry.ruleId}: citation`).toBeGreaterThan(0);
      expect(entry.legalRef.docHash, `${entry.ruleId}: docHash`).toBeNull();
      expect(entry.legalRef.verified, `${entry.ruleId}: verified`).toBe(false);
    }
  });

  it('no entry is verified — a legal review changes this in a later slice (076), never here', () => {
    expect(ruleRegister().every((e) => e.legalRef.verified === false)).toBe(true);
  });

  it('every cross-cutting effect has a legalRef with verified:false from the fixed source list', () => {
    expect(CROSS_CUTTING_EFFECTS.length).toBeGreaterThan(0);
    for (const c of CROSS_CUTTING_EFFECTS) {
      expect(LEGAL_SOURCES, `${c.effect}: source`).toContain(c.legalRef.source);
      expect(c.legalRef.citation.length, `${c.effect}: citation`).toBeGreaterThan(0);
      expect(c.legalRef.docHash, `${c.effect}: docHash`).toBeNull();
      expect(c.legalRef.verified, `${c.effect}: verified`).toBe(false);
    }
  });

  it('every entry has one of the four rule kinds', () => {
    const kinds = new Set(ruleRegister().map((e) => e.kind));
    for (const kind of kinds) expect(['Übergang', 'Guard', 'Recht', 'Idempotenz']).toContain(kind);
  });

  it('matches the committed docs/legal-trace.md — any change must be reviewed', async () => {
    const lines: string[] = [
      '# Legal Trace — Regelregister',
      '',
      'Generiert aus packages/domain; kein Eintrag ist durch Recht geprüft (E15).',
      '',
      '| Regel-ID | Art | Beschreibung | Quelle | Fundstelle | Stand | geprüft |',
      '|---|---|---|---|---|---|---|',
    ];
    for (const e of ruleRegister()) {
      const description = e.description.replace(/\|/g, '\\|');
      const citation = e.legalRef.citation.replace(/\|/g, '\\|');
      const stand = e.legalRef.docVersion ?? '–';
      const verified = e.legalRef.verified ? 'ja' : 'nein';
      lines.push(`| ${e.ruleId} | ${e.kind} | ${description} | ${e.legalRef.source} | ${citation} | ${stand} | ${verified} |`);
    }
    // Querschnitt: effects every rule has, with no rule id of their own (Festlegung 1), so that the
    // document Recht receives shows them with a trace too.
    lines.push(
      '',
      '## Querschnitt (ohne Regel-ID)',
      '',
      'Wirkungen, die jede Übergangsregel hat und die an keiner einzelnen Regel-ID hängen; kein Eintrag ist durch Recht geprüft (E15).',
      '',
      '| Wirkung | Code | Quelle | Fundstelle | Stand | geprüft |',
      '|---|---|---|---|---|---|',
    );
    for (const c of CROSS_CUTTING_EFFECTS) {
      const cell = (x: string): string => x.replace(/\|/g, '\\|');
      const stand = c.legalRef.docVersion ?? '–';
      const verified = c.legalRef.verified ? 'ja' : 'nein';
      lines.push(`| ${cell(c.effect)} | ${cell(c.code)} | ${c.legalRef.source} | ${cell(c.legalRef.citation)} | ${stand} | ${verified} |`);
    }
    await expect(lines.join('\n') + '\n').toMatchFileSnapshot('../../../../docs/legal-trace.md');
  });
});
