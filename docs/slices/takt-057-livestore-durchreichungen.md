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
   begonnene Schreibung liefert ihren Inhalt (z. B. eine Frage mit `_actions` der vorigen Rechte) nicht an den Aufrufer.
   **Geändert nach Review-Befund 1 (Major):** anders als eine Lesung bleibt ihre Promise nicht unerfüllt, sondern lehnt mit
   dem inhaltslosen Merker `WithheldAnswer` (exportiert aus `liveStore.ts`, `extends Error`) ab: keine Nutzlast, kein Text
   des Dienstes, kein Status, nie das Problemobjekt der vorigen Person. Grund: die Ansichten werden bei einem Akteurwechsel
   nicht neu eingehängt, und jedes `clear()` (auch Stromende `roles_changed`/`forbidden`/`session` bei derselben Person)
   hebt die Epoche; ihre Schreibsperren (`speakers/Page.tsx` `inFlight`, `capture/Page.tsx` `writingRef`,
   `answers/useWriteDoor.ts` `writing`/`lock`) fallen nur in `catch`/`finally` und blieben sonst für immer stehen.
   `showProblem` (`components/toastStore.ts`) zeigt für den Merker keine Meldung. Lesungen (`read()`, die `guarded`-Lesungen
   `getCockpit`/`listEvents`) bleiben unerfüllt wie bisher (Ladeschlüssel der Ansichten; Codex auf #168). Das Invalidierungssignal bleibt erhalten:
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
  - eine Schreibung, deren Antwort oder Fehler nach `clear('actor')` ankommt, erreicht den Aufrufer nicht, sondern lehnt mit
    `WithheldAnswer` ohne Inhalt des Adapters ab (Review-Befund 1); `settleWrite`-Wirkung (Invalidierung) tritt trotzdem ein
    (bei `observeWrites: true`);
  - `seedDemo` ebenso zurückgehalten (Ablehnung mit `WithheldAnswer`);
  - die erste Schreibung einer neuen Person nach einem strukturellen Akteurwechsel ohne `clear()` macht `lastWriteEtag`
    wieder zum Adapterwert (Review-Befund 2);
  - `lastWriteEtag` ist nach `clear()` bzw. Akteurwechsel `undefined`, vorher der Adapterwert;
  - `guarded()`-Lesung (`listEvents` oder `getCockpit`): Ablehnung wird für dieselbe Person zugestellt, nach Wechsel nicht;
  - Akteurwechsel **ohne** `clear()` (nur `getActor()` liefert eine andere Person) hält eine laufende Antwort zurück;
  - abgemeldet: synchron werfender Adapter ergibt eine abgelehnte Promise.
- Historie: ein Unit-Test (bestehende Testdatei der Historie oder neue neben `Page.tsx`), dass ein Fenster bei gleicher id und
  anderem strukturellem Akteur nicht als eigenes gilt; dazu (Review-Befund 4) ein Test auf der Ebene, auf der `Page.tsx`
  das gehaltene Fenster anzeigt und als Ausgangspunkt des Weiterlesens nimmt: gleiche id, andere Rolle → nicht angezeigt,
  `listEvents` liest von vorn.
- `showProblem(new WithheldAnswer())` zeigt keine Meldung (Review-Befund 1).
- Ein Test auf Hook-Ebene (`answers/useWriteDoor.ts`): nach einer zurückgehaltenen Schreibung über den Live-Store nimmt die
  Schreibtür die nächste Aktion an (Review-Befund 1).
- `pnpm gates` grün.

## Files allowed

- `apps/web/src/api/liveStore.ts`
- `apps/web/src/api/liveStore061.test.ts`
- `apps/web/src/features/history/Page.tsx`
- `apps/web/src/features/history/*.test.{ts,tsx}` (bestehende oder eine neue Testdatei; beim Bau von `*.test.ts(x)` berichtigt, das Tor liest Klammern wörtlich)
- `docs/slices/takt-057-livestore-durchreichungen.md`
- nach Review-Befund 1: `apps/web/src/components/toastStore.ts`, `apps/web/src/components/toastStore.test.ts`,
  `apps/web/src/features/answers/useWriteDoor.test.tsx` (nur Test; die drei Schreibtüren selbst brauchen keine Änderung,
  siehe Bericht)

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

### Nachtrag nach dem Review (frischer Kontext, Perspektive Sicherheit: kein Leck, 1 Major, 3 Minor, 2 Nit)

```
Slice: takt-057-livestore-durchreichungen (Review-Befunde)
Done: Befund 1 (Major): eine zurückgehaltene Schreibung bzw. seedDemo lehnt mit `WithheldAnswer` ab (liveStore.ts,
      extends Error, fester Text, keine Nutzlast/Status/cause); Lesungen bleiben unerfüllt. showProblem zeigt dafür keine
      Meldung. Die drei Schreibtüren erholen sich ohne Änderung über ihr catch/finally: speakers/Page.tsx `run` (showProblem
      still, reload, finally gibt inFlight frei), capture/Page.tsx beide Schreibungen (isVersionConflict liest nur `status`,
      der Merker hat keinen → showProblem still, finally gibt writingRef frei), answers/useWriteDoor.ts (settleProblem:
      problemStatus undefined → 'toast' → still; onProblem in QuestionDetail prüft nur 412; Sperre fällt, reload).
      Befund 2: write() liest Epoche und Akteur nach observeActor(). Befund 3: Testkommentar berichtigt, drei
      Regressionswächter benannt. Befund 4: shownStream/heldStreamBase in Page.tsx (Anzeige und Startpunkt des
      Weiterlesens), getestet mit advanceStream: gleiche id, andere Rolle → nichts angezeigt, listEvents(0, 1) von vorn.
      Nit 5: abgemeldet bleibt etagStale unberührt. Nit 6: seedDemo im abgemeldeten Wurf-Test.
      Zuerst rot: 4 Store-Fälle (WithheldAnswer: „expected false to be true“), Befund 2 und Nit 5 („expected undefined to
      be '"v7"'/'"v9"'“), toastStore („WithheldAnswer is not a constructor“), useWriteDoor („expected false to be true“:
      Sperre blieb stehen), Historie („shownStream is not a function“). Nit 6 war schon grün (guarded fängt seit e107f93).
Evidence: pnpm gates auf 63d746a (danach nur dieser Bericht), Ausgabe-Ende:
      packages/domain test:       Tests  562 passed (562)
      apps/web test:       Tests  1154 passed (1154)
      apps/api test:       Tests  710 passed (710)
      slice-scope: warning — "docs/slices/takt-057-livestore-durchreichungen.md"'s "Files allowed" section differs from its version at the commit that introduced it (e107f93).
      slice-scope: 8 changed file(s), all within "docs/slices/takt-057-livestore-durchreichungen.md"'s "Files allowed" list (9 pattern(s)).
      ✓ built in 2.15s
      mark-test-run: wrote /home/user/wt/takt057/.claude/state/last-test-run (clean tree) at commit 63d746a, tree 527502a3fe23…
Open: Re-Check des Majors (schmal). oxlint-Warnungen only-export-components für vier Hilfsfunktionen in history/Page.tsx
      (lib.ts nicht erlaubt). Die slice-scope-Warnung ist die gewollte Spec-Änderung nach Befund 1.
Touched: zusätzlich apps/web/src/components/toastStore.ts, apps/web/src/components/toastStore.test.ts,
      apps/web/src/features/answers/useWriteDoor.test.tsx
```
