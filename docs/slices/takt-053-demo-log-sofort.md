# takt-053 — Demo-Ereignisprotokoll beim Verlassen der Seite sofort schreiben

**Status:** gebaut · **Risikoklasse:** niedrig (nur Demo-Betriebsart im Browser; kein Vertrag, kein Dienst, keine Rechte, kein Personenbezug, keine Workflows. Leitplanken §4) · ca. 0,5 AStd · **Lanes:** web-api
**Rolle:** Orchestrator baut (kleiner Takt); Review in frischem Kontext
**Regeln:** AGENTS.md R1, R2, R3, R7 (das Protokoll wird nur geschrieben, nie verändert), R12. Keine Rule ids aus `transitions.ts`.
**Depends on:** – · **Glossar: neue Begriffe:** nein

## Anlass

Gefunden beim Bau von 060 (CI-Fehler E1, Läufe 37460605618 und 37463402183): Die Demo schreibt ihr Ereignisprotokoll mit
150 ms Verzögerung nach `localStorage` (`saveLog` in `apps/web/src/api/index.ts`). Wird die Seite innerhalb dieser 150 ms
neu geladen oder geschlossen, fehlt das zuletzt geschriebene Ereignis danach, z. B. eine eben gespeicherte Antwortversion.
In der Vorführung ist das ein stiller Datenverlust. Die HTTP-Betriebsart ist nicht betroffen.

Zweiter Befund beim Lesen: `resetDemo()` löscht den Schlüssel und lädt neu. Steht dann noch ein verzögertes Schreiben
aus, darf es den alten Stand nicht zurückschreiben; mit einem Sofort-Schreiben beim Verlassen würde genau das passieren.

## Ziel

1. Das verzögerte Schreiben bleibt (ein Schub von Ereignissen wird einmal geschrieben), aber ein ausstehender Stand wird
   bei `pagehide` und bei `visibilitychange` nach `hidden` sofort geschrieben.
2. `resetDemo()` verwirft ein ausstehendes Schreiben und schaltet den Schreiber ab (`stop`), bevor es den Schlüssel
   löscht; auch ein Schreiben, das zwischen Löschen und Entladen angestoßen wird, schreibt nichts mehr.
3. Die Logik steckt in einer kleinen, testbaren Funktion `createDebouncedSaver` mit `save`, `flush`, `cancel`, `stop`.

## Nicht-Ziele

- Kein anderes Speicherformat, kein anderer Schlüssel, keine Änderung an `parseDemoLog`/`loadLog`.
- Keine Änderung an 060-Dateien oder an der HTTP-Betriebsart.

## Abnahme

- Unit-Tests (zuerst rot): `flush` schreibt einen ausstehenden Stand sofort und genau einmal; ohne ausstehenden Stand
  schreibt `flush` nichts; `cancel` verwirft; mehrere `save` im Fenster schreiben einmal den letzten Stand.
- `index.ts` meldet `flush` an `pagehide` und `visibilitychange` (hidden) an, `resetDemo` ruft `cancel` vor dem Löschen.
- `pnpm gates` grün.

## Files allowed

- `apps/web/src/api/demoLogSaver.ts` (neu)
- `apps/web/src/api/demoLogSaver.test.ts` (neu)
- `apps/web/src/api/index.ts` (nur `saveLog`, die Anmeldung der Ereignisse, `resetDemo`)
- `docs/slices/takt-053-demo-log-sofort.md`
- `docs/folgeliste.md` (nur den 060-Eintrag zum Demo-Protokoll als erledigt markieren)

## Bericht

- Gebaut vom Orchestrator; Spec 674c284, Umsetzung ffb6cbf, Review-Nacharbeit im Folge-Commit.
- Rot zuerst: `demoLogSaver.test.ts` scheiterte ohne Modul (`Cannot find module './demoLogSaver'`), der `stop`-Fall
  scheiterte vor der Nacharbeit (1 failed | 5 passed); danach grün.
- `pnpm gates` grün auf ffb6cbf (domain 519, web 929, api 700) und auf dem Nacharbeits-Commit **6616f59** (letzter
  Code-Stand; danach nur dieser Bericht). Echter Schluss des Laufs auf 6616f59:

```
packages/domain test:       Tests  519 passed (519)
apps/web test:       Tests  931 passed (931)
apps/api test:       Tests  700 passed (700)
slice-scope: 4 changed file(s), all within "docs/slices/takt-053-demo-log-sofort.md"'s "Files allowed" list (7 pattern(s)).
✓ built in 2.87s
mark-test-run: wrote /home/user/wt/takt053/.claude/state/last-test-run (clean tree) at commit 6616f59, tree c76c6242d39c…
```
- Review (frischer Kontext, Sonnet, niedriges Risiko): kein Blocker, kein Major. Minor 1 (Reset durch spätes Schreiben
  rückgängig) behoben mit `stop`; Test-Nits (`afterEach` für echte Uhr, `save` nach `cancel`) übernommen.

## Offen

- Bekannte Grenze, kein Ziel dieses Takts: mehrere Tabs desselben Browsers schreiben das ganze Protokoll unter einem
  Schlüssel, der letzte Schreiber gewinnt. Mit dem Sofort-Schreiben beim Verbergen eines Tabs tritt das häufiger ein.
  Die Demo ist für ein Gerät und einen Tab gedacht.
- Die Verdrahtung in `index.ts` (Anmeldung der Ereignisse, `stop` vor dem Löschen) hat keinen eigenen Test; die
  Reihenfolge hält der Code.
- `docs/folgeliste.md` hat auf dieser Basis keinen 060-Eintrag zum Demo-Protokoll (er liegt im Branch von 060); er wird
  beim Doku-Pass als erledigt geführt.
