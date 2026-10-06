# takt-054 — Erfassung: kein leeres Eingabeformular, solange der Redebeitrag noch lädt

**Status:** spec · **Risikoklasse:** niedrig bis mittel (Oberfläche der Erfassung; kein Vertrag, kein Dienst, keine Rechte, kein Personenbezug. Leitplanken §4) · ca. 1 AStd · **Lanes:** web
**Rolle:** implementierer-oberflaeche; Review in frischem Kontext
**Regeln:** AGENTS.md R1, R2, R3, R10, R12. Keine Rule ids aus `transitions.ts`.
**Depends on:** 046 (gemergt) · **Glossar: neue Begriffe:** nein

## Anlass

CI `e2e-http`, Lauf 37471605355 (PR #171): `046-nachfragen.spec.ts:148` E1 scheiterte. Ein Fehler der Oberfläche, kein
Testproblem (Befund der Ursachenanalyse vom 06.10.2026):

1. `apps/web/src/features/capture/Page.tsx` speichert beim ersten Render, solange `speakerId` noch `null` ist, über
   `landPair` ein leeres Paar `{ questions: [], contributions: [] }`, so dass `landed` nicht mehr `null` ist.
2. Antwortet danach `listContributions({ speakerId })` mit einem Redebeitrag `c1`, ändert sich der Schlüssel der Fragen,
   `landPair` hält bis zur Antwort von `listQuestions({ contributionId: c1 })` das alte leere Paar.
3. In diesem Fenster ist `contribution` `undefined` und `loading` (`contributions.status === 'loading' || landed === null`)
   `false`; `ContributionPane` zeigt deshalb das leere Eingabeformular (`capture-text`, `capture-submit`) statt des
   vorhandenen Redebeitrags, eine HTTP-Runde lang (in der Demo nur Mikrotasks).
4. Wer in diesem Fenster tippt (der Test tat es), schreibt in den falschen Zustand; sobald die Fragen landen, verschwindet
   das Formular samt Eingabe. Der Kommentar an `loading` will genau das verhindern.

## Ziel

1. Solange der frischeste gelesene Redebeitrag (`latestContribution`) bekannt ist, das gezeigte Paar ihn aber noch nicht
   enthält (`contribution === undefined`), gilt die Erfassung als ladend (Gerüst statt Formular).
2. Die Entscheidung steckt in einer reinen Funktion (z. B. `deskLoading` in `useCapture.ts`) mit Tabellentest.
3. Ein deterministischer e2e-Fall im Projekt `http` (und, soweit möglich, `in-process`) verzögert die Fragen eines
   Redebeitrags (`page.route` auf `**/v1/questions?*contributionId=*`, z. B. 1,5 s) und prüft: `capture-text` erscheint in
   diesem Fenster nicht, `capture-contribution-new` wird sichtbar.

## Nicht-Ziele

- Keine Änderung an `landPair`, `useAsync`, Live-Store oder Dienst. Kein neuer Text (das Gerüst gibt es schon).
- Ein Sprecher ohne Redebeitrag sieht weiter sofort das Formular.

## Abnahme

- Tabellentest zuerst rot (Zeile „landed = leeres Paar, freshest = c1, shown = undefined“ → ladend), dann grün.
- e2e-Fall wie in Ziel 3, im Projekt `http` grün im CI-Lauf `e2e-http` des PR (Lauf-ID im Bericht).
- `pnpm gates` grün; 046 und 002 in-process mit `--repeat-each=3` grün.

## Files allowed

- `apps/web/src/features/capture/Page.tsx` (nur die `loading`-Eigenschaft und der Aufruf der Hilfsfunktion)
- `apps/web/src/features/capture/useCapture.ts` (nur die neue reine Funktion)
- `apps/web/src/features/capture/useCapture.test.ts` oder eine neue Testdatei `apps/web/src/features/capture/deskLoading.test.ts`
- `apps/web/e2e/046-nachfragen.spec.ts` (nur ein zusätzlicher Fall bzw. ein robuster Wartepunkt an den Verzweigungen
  `fresh`/`another`)
- `docs/slices/takt-054-erfassung-ladezustand.md`
- `docs/folgeliste.md`
