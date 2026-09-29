# takt-027 — Übernahme zeigt keine personId mehr

**Status:** review · **Risikoklasse:** hoch (personenbezogene Daten, Leitplanken §4) · **Lanes:** core · **Perspektive:** Datenschutz
**Regeln:** AGENTS.md R1–R3, R7, R12; ADR 0009 (Pseudonymisierung), Scheibe 026 (Maskierung), Scheibe 028 (Übernahme)
**Ausgangspunkt:** Nachprüfung 028 (29.09.2026), Befund minor 4 (Datenschutz); Codex P1 auf #66: Datenschutzbefunde halten
den Merge und gehören nicht in die Folgeliste (AGENTS.md R3). `viewQuestion` und `viewContribution` in
`packages/domain/src/api.ts` geben die aktive Übernahme (`claim`) samt `personId` an jeden Leser der Frage bzw. des
Redebeitrags aus, auch an Rollen mit reinem Leserecht. Die Ereignis-Ansicht (`maskEvent`, 026) entfernt `personId`
dagegen — inkonsistent und unnötig: die Präsenzanzeige braucht nur `actorId`.

## Ziel

Beide Ansichten geben `claim` nur mit `actorId`, `claimedAt`, `expiresAt` aus. `personId` bleibt im Ereignis
(`ContributionClaimed`/`QuestionClaimed`, append-only, R7) und erscheint in keiner Leseansicht. Keine Vertragsänderung:
`Claim.personId` ist im Vertrag optional; die Antwort lässt das Feld weg.

## Nicht-Ziele

Keine Änderung an Ereignissen, Rechten, `maskEvent`, Vertrag oder Oberfläche; keine weitere Maskierung (Folgeliste 026:
rekursive Maske).

## Files allowed

- `docs/slices/takt-027-claim-personid.md`
- `packages/domain/src/api.ts` (nur `viewQuestion`/`viewContribution` und ein Helfer für die Übernahme)
- `packages/domain/src/__tests__/claims028.test.ts`

## Abnahme

1. Rot zuerst: Test „never shows the claimant personId in contribution or question views“ — Übernahme durch Akteure
   mit `personId` (Erfassung, Fachbereich); weder die Antwort des Übernehmenden noch die Lesung durch eine andere Rolle
   enthält `personId`; das Ereignis im Log trägt sie weiter. Vor der Änderung rot
   (`expected { actorId: 'capture-a', …(3) } to not have property "personId"`), danach grün.
2. Bestehende 028-Tests in Domäne und API grün.
3. `pnpm gates` grün auf sauberem Commit; Nachweis unten.

## Nachweis

(folgt nach dem Gates-Lauf)

## Review findings

folgt
