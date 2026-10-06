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
