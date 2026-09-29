# takt-025 — Nachprüfung: Fundstellen R-MTG und Tests für mehrdeutige Alt-Schlüssel

**Status:** Bau · **Risikoklasse:** niedrig (nur Fundstellen und Tests, kein Verhalten) · **Lanes:** core (nur Tests und `rules.ts`)
**Regeln:** AGENTS.md R1, R2, R5, R12
**Ausgangspunkt:** Nachprüfung der Codex-Scheiben vom 29.09.2026.
- **025, major (leicht):** `packages/domain/src/rules.ts`, `MEETING_RULES`, zitiert für R-MTG-01..06 die Zeilen
  18–23 von `docs/slices/025-jahrgang-lebenszyklus.md`. Die R-MTG-Tabelle steht dort auf den Zeilen **25–30**
  (18–23 sind Zielpunkte, Überschrift, Leerzeilen). Die falsche Fundstelle läuft in `docs/legal-trace.md`.
- **028, major (Testbeweis):** Abnahme 2 von 028 verlangt „unbeweisbar mehrdeutiger historischer Schlüssel → fester
  Fehler ohne Neubau“. `idempotent()`/`legacyMatch` in `packages/domain/src/api.ts` setzen das um
  (409 `R-IDEM-01`, „Historical idempotency command is ambiguous.“), aber kein Test belegt es, ebenso wenig den Replay
  alter v2-Ereignisse mit `idempotencyKey` und ohne `commandId`.

## Ziel

1. `MEETING_RULES` zitiert die Zeilen 25–30; `docs/legal-trace.md` wird über den bestehenden Snapshot-Test
   (`rules.test.ts`, `toMatchFileSnapshot`) neu erzeugt (`vitest -u` nur für diese Datei), nur die sechs R-MTG-Zeilen
   ändern sich. Vorher prüfen, dass die Zeilen 25–30 auf dem aktuellen Stand der Spec 025 wirklich die Tabelle sind.
2. Neue Domänentests in `packages/domain/src/__tests__/idempotency028.test.ts` mit handgebauten, korrekt verketteten
   v2-Ereignissen (vorhandene Stempel-/Seed-Helfer nutzen), die einen `idempotencyKey`, aber **keine** `commandId`
   tragen:
   (a) zusammenhängende `seq` desselben Akteurs und derselben Operation/Ressource → derselbe Aufruf mit demselben
   Schlüssel liefert das historische Ergebnis mit den ursprünglichen IDs, `store.lastSeq()` unverändert;
   (b) dieselben Kandidaten mit einer Lücke in `seq` (ein fremdes Ereignis dazwischen) → 409 `R-IDEM-01`,
   `lastSeq()` unverändert;
   (c) zwei Kandidaten mit verschiedenen `commandId` → 409 `R-IDEM-01`;
   (d) derselbe Schlüssel von einem **anderen** Akteur → kein Replay (neuer Schreibvorgang oder dessen reguläres
   Ergebnis), keine Preisgabe des fremden Ergebnisses.
   Die Tests müssen gegen den heutigen Code grün sein; ein Test, der rot ist, ist ein Befund: dann melden, nicht den
   Code ändern.

## Nicht-Ziele

Keine Verhaltensänderung in `api.ts`, `transitions.ts` oder `state.ts`; keine weiteren 028-Testlücken (Folgeliste).

## Files allowed

- `docs/slices/takt-025-nachpruefung-kleinteile.md`
- `packages/domain/src/rules.ts` (nur die sechs Zeilennummern in `MEETING_RULES`)
- `docs/legal-trace.md` (nur die generierten R-MTG-01..06-Zeilen)
- `packages/domain/src/__tests__/idempotency028.test.ts`

## Abnahme

1. `pnpm --filter @hv/domain exec vitest run src/__tests__/rules.test.ts src/__tests__/idempotency028.test.ts` grün,
   Diff von `legal-trace.md` nur sechs Zeilen.
2. `pnpm gates` grün auf sauberem Commit; Bericht mit wörtlichem Schluss.

## Nachweis

`vitest run src/__tests__/idempotency028.test.ts src/__tests__/rules.test.ts`: 2 Dateien, 22 Tests grün.
`pnpm gates` Exit 0 auf Commit `2cc657a` (Code-Stand dieses PRs nach der Umstellung von Test (a) auf `captureQuestions`; davor `9d460e8`). Wörtlicher Schluss:

```
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 3.35s
mark-test-run: wrote /home/user/wt/takt-025/.claude/state/last-test-run (clean tree) at commit 2cc657a, tree 7026bb5bbb6a…
```

## Review findings

Review in frischem Kontext (reviewer-sonnet, 29.09.2026): **freigegeben**, 0 blocker, 0 major. Fundstellen 25–30
geprüft, `legal-trace.md` nur sechs Zeilennummern. Mutationsprobe: Lückenprüfung, `ids.size > 1`, Akteursfilter und
`legacyMatch` einzeln entschärft → jeweils der zugehörige Test rot.

1. minor → Folgeliste: Test (c) läuft über den `commandOperation`-Pfad, nicht über `legacyMatch` (Titel ungenau).
2. minor → Folgeliste: Test (a) prüft nur `registerSpeaker` (pauschales `return true`); die operationsspezifischen
   Zweige von `legacyMatch` (etwa `captureQuestions`, Agenda) sind ungetestet.

Codex (ein Lauf): 1 × P2 — Test (a) mit zwei SpeakerRegistered schrieb eine Fehleinordnung fest → auf captureQuestions
umgestellt; Code-Korrektur (409 für mehrere Registrierungs-Kandidaten) → Folgeliste.
