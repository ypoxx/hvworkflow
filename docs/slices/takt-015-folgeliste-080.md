# takt-015 — Folgeliste aus 080 gebündelt

**Status:** review bestanden (Sonnet, R1, 26.09.)
**Klasse:** S (Kleinänderungsspur) · Risikoklasse niedrig · Lanes: core, web-speakers
**Rolle:** Implementierer-Backend (Kern, Tests, eine Spaltenbreite); Review in frischem Kontext mit Sonnet (niedriges Risiko, AGENTS.md Regel 3)
**Rule ids:** AGENTS.md Regeln 1, 2, 5, 7, 12; R-SPK-01, R-SPK-00
**Quellen-IDs:** `docs/folgeliste.md` Abschnitt „Sprecher und Zustandstabelle (aus 080)“, Punkte R1 minor 3, 4, 5, nit 6;
Entscheidung des Eigentümers 26.09. (Restbudget für diese Nacharbeit)
**Depends on:** 080 (gemergt `252f3fe`)
**Perspektive:** Prozess · **Glossar: neue Begriffe:** nein

## Ziel

1. **Leerer PATCH schreibt kein Ereignis.** `updateSpeaker` (packages/domain/src/api.ts): Bleibt nach dem Zuschnitt auf
   benannte Felder kein wirksames Feld übrig (leerer Body oder nur veraltete Felder wie `requestedMinutes`), wird
   **kein** `SpeakerUpdated` geschrieben; die Antwort ist die unveränderte Sicht (Version gleich). If-Match wird
   trotzdem geprüft (412 bleibt 412). Kommentar warum (keine grundlosen 412 bei parallelen Clients).
2. **Tests** in `packages/domain/src/__tests__/transitions.test.ts`:
   - leerer PATCH und PATCH nur mit `requestedMinutes`: kein neues Ereignis, Version unverändert;
   - veraltetes If-Match bei verbotenem Übergang (`finished → speaking`) → 412, nicht 409 (Reihenfolge);
   - Wiederholung eines `updateSpeaker` mit demselben Idempotenzschlüssel nach R-SPK-01 → gleiche Antwort, kein
     zweites Ereignis, kein 409.
   Der Vertragstest in `apps/api/src/__tests__/contract.test.ts` („accepted and ignored“) prüft zusätzlich, dass die
   Version gleich bleibt.
3. **legalRef R-SPK-01** (packages/domain/src/transitions.ts): Das Zitat der Ist-Analyse wird bis „mit laufender
   Redezeitmessung“ vervollständigt, mit dem Satz, dass 080 die Messung nach Feedback #15 entfernt (Ableitung).
   `docs/legal-trace.md` per Snapshot neu erzeugt, Diff nur diese Zeile.
4. **EN-Spaltenkopf** „Questions“ in `apps/web/src/features/speakers/SpeakerRow.tsx` (`ROW_COLUMNS`) nicht mehr
   abgeschnitten: Spalte so breit, dass DE und EN passen. Screenshots `docs/evidence/080-wortmeldeliste-{de,en}.png` über
   die bestehende e2e-Datei 080 neu erzeugen.
5. Die vier Punkte in `docs/folgeliste.md` als erledigt streichen (Zeilen entfernen, ein Satz „erledigt in takt-015“).

## Nicht-Ziele

Knopfwahl aus `_actions`, Guard „nur ein Mikrofon offen“, Vertragsarbeit für 043 (bleiben auf der Folgeliste).
Keine weiteren Umbauten.

## Files allowed

- `packages/domain/src/{api,transitions}.ts`
- `packages/domain/src/__tests__/transitions.test.ts`
- `apps/api/src/__tests__/contract.test.ts`
- `docs/legal-trace.md` (nur generiert)
- `apps/web/src/features/speakers/SpeakerRow.tsx`, `apps/web/src/features/speakers/RoundSection.tsx` (nur die Spaltenbreite)
- `docs/evidence/080-wortmeldeliste-{de,en}.png`
- `docs/folgeliste.md` (nur die vier Punkte)
- `docs/slices/takt-015-folgeliste-080.md`

## Akzeptanzkriterium

1. Die neuen Tests sind vor der Änderung zu Punkt 1 rot (Ausgabe im Bericht) und danach grün.
2. EN-Screenshot zeigt „QUESTIONS“ ungekürzt.
3. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich); e2e nur `080` und `002`.

## Arbeitsweise

- Worktree `/home/user/wt/t015`, Branch `claude/takt-015-folgeliste-080` (vom Architekten angelegt).
- Playwright auf eigenem Port (z. B. 5192), Chromium unter `/opt/pw-browsers`; fremde Evidenz danach mit
  `git checkout -- docs/evidence` zurücksetzen.
- Logdateien nur über `mktemp`. Commits nennen „takt-015“ und enden mit `[skip netlify]`. Nicht pushen.

## Bericht

```
Slice: takt-015-folgeliste-080
Done: updateSpeaker schreibt bei wirkungslosem PATCH kein Ereignis (If-Match davor, 412 bleibt 412); vier Tests
      (leer, nur requestedMinutes, 412 vor 409, Idempotenz-Wiederholung) plus Versionsprüfung im Vertragstest;
      legalRef R-SPK-01 vollständig zitiert; Fragen-Spalte 62 → 84 px, EN „QUESTIONS“ ungekürzt.
Evidence: rot vor Ziel 1 (pnpm --filter @hv/domain test -- --run transitions.test.ts):
      FAIL … an empty PATCH writes no event and leaves the version unchanged — expected 2 to be 1
      FAIL … a PATCH with only the deprecated requestedMinutes writes no event … — expected 2 to be 1
      Tests  2 failed | 111 passed (113)
      (412-vor-409 und Wiederholung waren schon grün: sie sichern bestehendes Verhalten.)
      pnpm gates auf 73ba8ed grün, Schluss wörtlich:
      ✓ built in 1.27s
      mark-test-run: wrote /home/user/wt/t015/.claude/state/last-test-run (clean tree) at commit 73ba8ed, tree 9cf0a3eb4816…
      e2e 080 + 002: 2 passed, axe 0 serious/critical. docs/evidence/080-wortmeldeliste-{de,en}.png
Open: Ziel 5 (Folgeliste) erledigt der Orchestrator auf claude/bautag-2026-09-26 (8e5b124), weil der Abschnitt dort liegt.
      Review (Sonnet) bestanden, ein minor (dieser Bericht fehlte) hiermit behoben.
Touched: packages/domain/src/{api,transitions}.ts, __tests__/transitions.test.ts; apps/api/src/__tests__/contract.test.ts;
      docs/legal-trace.md; apps/web/src/features/speakers/SpeakerRow.tsx; docs/evidence/080-wortmeldeliste-{de,en}.png
```
