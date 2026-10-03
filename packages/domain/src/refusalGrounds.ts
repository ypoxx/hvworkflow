/**
 * The catalogue of refusal grounds (Verweigerungsgründe) for refusal path B ("Verweigerung trotz
 * Anspruchs", Scheibe 044a, contract 0.4.0 `RefusalGround`). Global code data, no meeting scope;
 * maintained by the legal review (076), never at runtime.
 *
 * Built on the default ("auf Standard gebaut"): ADR 0012 is proposed and not read by Recht (E15).
 * Wording, numbering, conditions and wording blocks are a draft of the implementation; no source in
 * the repository proves them, and whether the list is complete (docs/anforderungen-recherche.md:64)
 * is expressly not proven. Every `legalRef` therefore stays `verified: false` with `docHash: null`
 * (honesty rule of rules.ts): the citation says what is and is not proven.
 *
 * The legal conditions stand in the title, because an entry has only `title`, `stageText` and
 * `legalRef`: whoever chooses a ground sees its condition, and the wording block asserts nothing
 * beyond it. Texts are content in the meeting's content language (E21: `de`), not interface strings.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { canonicalJson } from './envelope.js';
import type { LegalRef } from './rules.js';

export interface RefusalGroundEntry {
  readonly id: string;
  readonly title: string;
  /** Wording block for the podium (Formulierungsbaustein); the interface prefills the refusal text. */
  readonly stageText: string;
  readonly legalRef: LegalRef;
}

/**
 * An entry plus `hash`: SHA-256 as lower-case hex over the UTF-8 bytes of the RFC 8785 form of the
 * entry without `hash` (043a). The value range is objects, strings, `null` and booleans, for which
 * `canonicalJson` (envelope.ts) equals RFC 8785. An answer version keeps it as `refusalGroundHash`;
 * an approval against a changed entry fails R-GUARD-11.
 */
export interface RefusalGround extends RefusalGroundEntry {
  readonly hash: string;
}

const citation = (n: number): string =>
  `§ 131 Abs. 3 Satz 1 Nr. ${n} AktG. Gliederung und Wortlaut nicht aus einer Quelle im Repositorium belegt; ` +
  'Bezug nur docs/anforderungen-recherche.md:24, :64; Entwurf der Umsetzung, ungeprüft (E15)';

const legalRef = (n: number): LegalRef => ({ source: 'AktG', citation: citation(n), docVersion: null, docHash: null, verified: false });

const ENTRIES: readonly RefusalGroundEntry[] = [
  {
    id: 'aktg-131-3-nr1',
    title: 'Nach vernünftiger kaufmännischer Beurteilung nicht unerheblicher Nachteil für die Gesellschaft oder ein verbundenes Unternehmen',
    stageText: 'Zu dieser Frage gibt der Vorstand keine Auskunft, weil die Erteilung der Auskunft nach vernünftiger kaufmännischer ' +
      'Beurteilung geeignet ist, der Gesellschaft oder einem verbundenen Unternehmen einen nicht unerheblichen Nachteil zuzufügen.',
    legalRef: legalRef(1),
  },
  {
    id: 'aktg-131-3-nr2',
    title: 'Steuerliche Wertansätze oder Höhe einzelner Steuern',
    stageText: 'Die Frage betrifft steuerliche Wertansätze oder die Höhe einzelner Steuern; hierzu gibt der Vorstand keine Auskunft.',
    legalRef: legalRef(2),
  },
  {
    id: 'aktg-131-3-nr3',
    title: 'Unterschied zwischen Bilanzansatz und höherem Wert — nur, wenn nicht die Hauptversammlung den Jahresabschluss feststellt',
    stageText: 'Zum Unterschied zwischen dem Wert, mit dem Gegenstände in der Jahresbilanz angesetzt sind, und einem höheren Wert ' +
      'dieser Gegenstände gibt der Vorstand keine Auskunft.',
    legalRef: legalRef(3),
  },
  {
    id: 'aktg-131-3-nr4',
    title: 'Bilanzierungs- und Bewertungsmethoden — nur, soweit die Angabe im Anhang für ein den tatsächlichen Verhältnissen ' +
      'entsprechendes Bild ausreicht, und nur, wenn nicht die Hauptversammlung den Jahresabschluss feststellt',
    stageText: 'Über die Bilanzierungs- und Bewertungsmethoden gibt der Vorstand keine weitere Auskunft, weil ihre Angabe im Anhang ' +
      'ausreicht, um ein den tatsächlichen Verhältnissen entsprechendes Bild der Vermögens-, Finanz- und Ertragslage der ' +
      'Gesellschaft zu vermitteln.',
    legalRef: legalRef(4),
  },
  {
    id: 'aktg-131-3-nr5',
    title: 'Strafbarkeit des Vorstands',
    stageText: 'Zu dieser Frage gibt der Vorstand keine Auskunft, weil er sich durch die Erteilung der Auskunft strafbar machen würde.',
    legalRef: legalRef(5),
  },
  {
    id: 'aktg-131-3-nr6',
    title: 'Nur Kredit-, Finanzdienstleistungs- und Wertpapierinstitute: angewandte Bilanzierungs- und Bewertungsmethoden und ' +
      'vorgenommene Verrechnungen, die in Jahresabschluss, Lagebericht, Konzernabschluss oder Konzernlagebericht nicht ' +
      'angegeben werden müssen',
    stageText: 'Angaben über angewandte Bilanzierungs- und Bewertungsmethoden und vorgenommene Verrechnungen, die im ' +
      'Jahresabschluss, Lagebericht, Konzernabschluss oder Konzernlagebericht nicht gemacht zu werden brauchen, macht der ' +
      'Vorstand auch hier nicht.',
    legalRef: legalRef(6),
  },
  {
    id: 'aktg-131-3-nr7',
    title: 'Auskunft auf der Internetseite — nur, wenn sie seit mindestens sieben Tagen vor Beginn und in der Hauptversammlung ' +
      'durchgehend zugänglich ist',
    stageText: 'Die erbetene Auskunft ist auf der Internetseite der Gesellschaft seit mindestens sieben Tagen vor Beginn der ' +
      'Hauptversammlung und während der Hauptversammlung durchgehend zugänglich; der Vorstand verweist darauf.',
    legalRef: legalRef(7),
  },
];

/** SHA-256 of the canonical form, lower-case hex. Computed here: `envelope.ts` keeps its digest private. */
export function refusalGroundHash(entry: RefusalGroundEntry): string {
  const { id, title, stageText, legalRef: ref } = entry;
  const bytes = sha256(new TextEncoder().encode(canonicalJson({ id, title, stageText, legalRef: ref })));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Freezes the list, every entry and every nested object: a runtime change through an imported
 * reference cannot alter a ground behind the hash (Missbrauchsfall "Katalog zur Laufzeit verändert"). */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

export const REFUSAL_GROUNDS: readonly RefusalGround[] = deepFreeze(
  ENTRIES.map((entry) => ({ ...entry, legalRef: { ...entry.legalRef }, hash: refusalGroundHash(entry) })),
);

/** A deep copy for readers (`listRefusalGrounds`): a caller never holds a reference into the catalogue. */
export function copyRefusalGrounds(): RefusalGround[] {
  return REFUSAL_GROUNDS.map((ground) => ({ ...ground, legalRef: { ...ground.legalRef } }));
}
