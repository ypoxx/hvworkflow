# takt-056 — Ereignisstrom (`listEvents`) unter dem Akteurschutz des Live-Stores

**Status:** gebaut · **Risikoklasse:** mittel (Sicherheit: Daten einer Person erreichen nach einem Akteurwechsel eine andere; nur
Web-Adapter, kein Vertrag, kein Dienst. Leitplanken §4) · ca. 0,5 AStd · **Lanes:** web-api
**Rolle:** Orchestrator baut (kleiner Takt); Review in frischem Kontext, Perspektive Sicherheit
**Regeln:** AGENTS.md R1, R2, R3, R12; Bedrohungsmodell T-G1-I-09 (Strom/Lesungen nach Akteurwechsel); Reviewer-Checkliste SC-03.
**Depends on:** 061 Teil A (gemergt; `guarded()` in `liveStore.ts`) · **Glossar: neue Begriffe:** nein

## Anlass

Codex P1 auf #168 (061 Teil A) fand, dass die ungepufferte Leitstand-Lesung `getCockpit` den Akteurschutz des Live-Stores
umging: eine vor `clear()` oder einem Personenwechsel angeforderte Antwort erreichte die neue Person. Behoben mit `guarded()`.
Dieselbe Lücke hat `listEvents` (Ereignisstrom der Historie, ebenfalls ungepuffert, `apps/web/src/api/liveStore.ts`): eine
Ereignisseite der vorigen Person kann nach dem Wechsel bei der neuen ankommen. Codex P1 auf #176 verlangt, das nicht auf die
Folgeliste zu schieben.

## Ziel

`listEvents` läuft wie `getCockpit` über `guarded()`: ungepuffert, aber eine vor einem Akteurwechsel oder `clear()`
angeforderte Antwort erreicht den Aufrufer nicht. Die Seitenschleife der Historie (`features/history/lib.ts`) bleibt unverändert;
eine zurückgehaltene Seite lässt die alte Schleife stehen, die Ansicht lädt für die neue Person neu (Versionssprung).

## Nicht-Ziele

- Kein Puffern von `listEvents`, keine Änderung an Dienst oder Vertrag, keine Änderung an der Historie-Ansicht.

## Abnahme

- `apps/web/src/api/liveStore061.test.ts` (Datei der Schutzfälle): ein Fall „listEvents withheld after an actor change“, zuerst
  rot, dann grün; ein Fall, dass eine Lesung nach dem Wechsel ankommt.
- `pnpm gates` grün.

## Files allowed

- `apps/web/src/api/liveStore.ts` (nur die Zeile `listEvents` und deren Kommentar)
- `apps/web/src/api/liveStore061.test.ts`
- `docs/slices/takt-056-listevents-akteurschutz.md`

## Bericht

```
Slice: takt-056-listevents-akteurschutz
Done: listEvents läuft über guarded() (ungepuffert, unter dem Akteurschutz); eine vor Akteurwechsel/clear angeforderte
      Ereignisseite erreicht den Aufrufer nicht. Test in liveStore061.test.ts zuerst rot (Review bestätigt: mit der alten
      Zeile „expected true to be false“), dann grün.
Evidence: pnpm gates auf bb78d41 (Merge mit der Basis inkl. takt-055; der takt-056-Diff ist unverändert):
      packages/domain test:       Tests  555 passed (555)
      apps/web test:       Tests  1134 passed (1134)
      apps/api test:       Tests  710 passed (710)
      slice-scope: 3 changed file(s), all within "docs/slices/takt-056-listevents-akteurschutz.md"'s "Files allowed" list (4 pattern(s)).
      ✓ built in 1.85s
      mark-test-run: wrote /home/user/wt/takt056/.claude/state/last-test-run (clean tree) at commit bb78d41, tree 1c9f4ba44f9f…
Open: Review (frischer Kontext, Perspektive Sicherheit): kein Blocker, kein Major. Die verbleibenden Durchreichungen des
      Live-Stores ohne Akteurprüfung (lastWriteEtag, Schreibantworten, seedDemo) und der id-Vergleich in history/Page.tsx
      (keyBelongsTo) tragen keinen Inhalt in den Lesepfad einer anderen Person; sie werden als eigener Sicherheitstakt
      takt-057 vor dem Rollout gebaut (Folgeliste, Abschnitt „Vor Rollout“), nicht als Kleinbefund aufgeschoben.
Touched: apps/web/src/api/liveStore.ts, apps/web/src/api/liveStore061.test.ts, docs/slices/takt-056-listevents-akteurschutz.md
```
