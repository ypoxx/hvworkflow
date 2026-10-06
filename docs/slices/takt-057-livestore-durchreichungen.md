# takt-057 — übrige Durchreichungen des Live-Stores unter den Akteurschutz

**Status:** gebaut · **Risikoklasse:** mittel (Sicherheit: Antworten einer Person können nach einem Akteurwechsel eine
andere erreichen; nur Web-Adapter und Historie-Ansicht, kein Vertrag, kein Dienst. Leitplanken §4) · ca. 1 AStd ·
**Lanes:** web-api
**Rolle:** Implementierer Oberfläche baut; Review in frischem Kontext, Perspektive Sicherheit
**Regeln:** AGENTS.md R1, R2, R3, R12; Bedrohungsmodell T-G1-I-09 (Strom/Lesungen nach Akteurwechsel); Reviewer-Checkliste SC-03.
**Depends on:** takt-056 (gemergt, #177; `guarded()` deckt `getCockpit` und `listEvents`) · **Glossar: neue Begriffe:** nein

## Anlass

Das Review von takt-056 fand weitere Stellen, an denen der Live-Store (`apps/web/src/api/liveStore.ts`) Antworten ohne den
Akteurschutz (`forCaller`) durchreicht. Codex P1 auf #178 verlangt nach der Eigentümerregel (Sicherheitsbefunde werden nie auf
die Folgeliste geschoben), sie vor dem Merge des Doku-PRs zu bauen statt sie als „vor Rollout“ zu führen.

## Ziel

1. **Schreibantworten** (alle Methoden aus `WRITE_METHODS`) und **`seedDemo`**: eine vor einem Akteurwechsel oder `clear()`
   begonnene Schreibung liefert ihren Inhalt (z. B. eine Frage mit `_actions` der vorigen Rechte) nicht an den Aufrufer, genau
   wie eine Lesung (Promise bleibt unerfüllt, siehe Kopfkommentar des Live-Stores). Das Invalidierungssignal bleibt erhalten:
   `settleWrite` läuft bei `observeWrites` weiter auf Erfolg und Fehler, unabhängig davon, ob die Antwort zugestellt wird.
   Ohne angemeldete Person (Akteur `undefined`) bleibt der Weg wie heute (Adapter antwortet direkt).
2. **`lastWriteEtag`**: liefert `undefined`, wenn seit der letzten erfolgreichen Schreibung ein Akteurwechsel oder ein `clear()`
   stattfand; sonst den Wert des Adapters. Kein Adapter-Eingriff nötig (Merker im Store).
3. **Historie** (`apps/web/src/features/history/Page.tsx`): das gehaltene Ereignisfenster gehört nur derselben Person im
   strukturellen Sinn (`actorKey` aus `api/liveStore.ts`, alle Felder des `Actor`), nicht nur derselben id. Ein Rollenwechsel
   bei gleicher id liest das Fenster neu. Andere Ansichten und `keyBelongsTo` selbst bleiben unverändert.
4. **`guarded()`**: der abgemeldete Pfad fängt einen synchron werfenden Aufruf ab (abgelehnte Promise statt Wurf), wie der
   angemeldete Pfad.

## Nicht-Ziele

- Keine Änderung an Dienst, Vertrag, `http.ts`, Domäne oder an anderen Ansichten; kein neues Puffern.
- Keine Änderung der Bedeutung von Erfolg/Fehler einer Schreibung für dieselbe Person.

## Abnahme

- Tests in `apps/web/src/api/liveStore061.test.ts` (Datei der Schutzfälle), jeder zuerst rot, dann grün:
  - eine Schreibung, deren Antwort nach `clear('actor')` ankommt, erreicht den Aufrufer nicht; `settleWrite`-Wirkung
    (Invalidierung) tritt trotzdem ein (bei `observeWrites: true`);
  - `seedDemo` ebenso zurückgehalten;
  - `lastWriteEtag` ist nach `clear()` bzw. Akteurwechsel `undefined`, vorher der Adapterwert;
  - `guarded()`-Lesung (`listEvents` oder `getCockpit`): Ablehnung wird für dieselbe Person zugestellt, nach Wechsel nicht;
  - Akteurwechsel **ohne** `clear()` (nur `getActor()` liefert eine andere Person) hält eine laufende Antwort zurück;
  - abgemeldet: synchron werfender Adapter ergibt eine abgelehnte Promise.
- Historie: ein Unit-Test (bestehende Testdatei der Historie oder neue neben `Page.tsx`), dass ein Fenster bei gleicher id und
  anderem strukturellem Akteur nicht als eigenes gilt.
- `pnpm gates` grün.

## Files allowed

- `apps/web/src/api/liveStore.ts`
- `apps/web/src/api/liveStore061.test.ts`
- `apps/web/src/features/history/Page.tsx`
- `apps/web/src/features/history/*.test.{ts,tsx}` (bestehende oder eine neue Testdatei; beim Bau von `*.test.ts(x)` berichtigt, das Tor liest Klammern wörtlich)
- `docs/slices/takt-057-livestore-durchreichungen.md`

## Bericht

```
Slice: takt-057-livestore-durchreichungen
Done: Schreibungen (WRITE_METHODS) und seedDemo laufen über guarded(): eine Antwort oder ein Fehler nach Akteurwechsel/clear
      erreicht den Aufrufer nicht; settleWrite hängt an der Adapter-Promise innerhalb des geschützten Aufrufs und läuft
      immer. lastWriteEtag liefert nach Wechsel/clear undefined (Merker etagStale im Store), bis eine eigene Schreibung
      derselben Person gelingt. guarded() fängt abgemeldet synchrone Würfe ab. Historie: das gehaltene Ereignisfenster
      trägt den strukturellen Schlüssel (streamWindowKey/streamWindowOwned über actorKey); keyBelongsTo unverändert.
      Tests: 7 der 10 neuen Store-Fälle und alle 3 Historie-Fälle zuerst rot („expected true to be false“, „expected '"v7"'
      to be undefined“, „Error: sync was thrown“, „streamWindowKey is not a function“), dann grün. Die drei übrigen
      (Ablehnung derselben Person zugestellt, Wechsel ohne clear bei getCockpit, gleiche Person erhält Antwort/Fehler)
      deckt takt-056 bereits; per Mutation geprüft: ohne observeActor()-Vergleich in forCaller bzw. ohne reject werden sie rot.
Evidence: pnpm gates auf 77b5a2d (Code identisch mit dem Merge-Commit; danach nur dieser Bericht), Ausgabe-Ende:
      packages/domain test:       Tests  562 passed (562)
      apps/web test:       Tests  1147 passed (1147)
      apps/api test:       Tests  710 passed (710)
      slice-scope: 5 changed file(s), all within "docs/slices/takt-057-livestore-durchreichungen.md"'s "Files allowed" list (6 pattern(s)).
      ✓ built in 1.97s
      mark-test-run: wrote /home/user/wt/takt057/.claude/state/last-test-run (clean tree) at commit 77b5a2d, tree 79e5f4a8f61f…
      Kein Screenshot: keine sichtbare Änderung der Oberfläche, docs/evidence/ steht nicht in „Files allowed“.
Open: Review (frischer Kontext, Perspektive Sicherheit) steht aus. „Files allowed“ berichtigt: `*.test.ts(x)` →
      `*.test.{ts,tsx}` (das slice-scope-Tor liest Klammern wörtlich, keine Testdatei der Historie passte). Die zwei
      exportierten Hilfsfunktionen in Page.tsx erzeugen die oxlint-Warnung only-export-components (kein Fehler); lib.ts
      steht nicht in „Files allowed“. Schreibungen werfen jetzt auch angemeldet nicht mehr synchron (abgelehnte Promise).
Touched: apps/web/src/api/liveStore.ts, apps/web/src/api/liveStore061.test.ts, apps/web/src/features/history/Page.tsx,
      apps/web/src/features/history/Page.test.tsx, docs/slices/takt-057-livestore-durchreichungen.md
```
