# 017 — i18n-Wörterbuch in Feature-Module teilen

**Status:** spec
**Risikoklasse:** niedrig · 1 AStd · Kalender 28.09.2026 (W1) · Lane: web-shell (i18n)
**Rolle/Modell:** Mechaniker · Haiku 4.5; Review Sonnet 5
**Rule ids:** AGENTS.md Regeln 1, 2, 9, 10, 12
**Quellen-IDs:** Produktplan 5.1 (Lane-Regel „Feature-i18n-Modul"), 6.2 (eigenes i18n-Modul je Scheibe), 6.4 (i18n-Paritäts-Tor je Modul)
**Depends on:** —

## Ziel

Heute liegen alle 437 Schlüssel in zwei Dateien (`apps/web/src/i18n/de.ts`, `en.ts`). Parallele
Oberflächenscheiben würden sich dort ständig in die Quere kommen. Diese Scheibe teilt beide
Wörterbücher in Feature-Module, ohne einen einzigen Schlüssel oder Text zu ändern.

1. **Module.** Neue Dateien `apps/web/src/i18n/<modul>.de.ts` und `<modul>.en.ts` für die sechs Module
   `shell`, `speakers`, `capture`, `answers`, `stage`, `history`. Zuordnung nach Schlüsselpräfix:
   - `speakers` ← alle Schlüssel `speakers.*`
   - `capture` ← alle Schlüssel `capture.*`
   - `answers` ← alle Schlüssel `answers.*`
   - `stage` ← alle Schlüssel `stage.*`
   - `history` ← alle Schlüssel `history.*`
   - `shell` ← alles andere (app, boot, error, nav, header, lang, meeting, page, placeholder, process,
     role, shortcuts, clock, common, demo, status, track, action, event, source, stale, time, toast)
   Jedes deutsche Modul exportiert eine Konstante (z. B. `export const speakersDe = { … } as const`
   oder in derselben Form wie heute `de`), jedes englische Modul ist gegen sein deutsches Gegenstück
   typisiert (`export const speakersEn: typeof speakersDe = { … }` bzw. ein Typalias, damit ein
   fehlender oder zusätzlicher Schlüssel ein Übersetzungsfehler von `tsc` ist). Reihenfolge und
   Wortlaut der Einträge bleiben exakt erhalten, einschließlich der Abschnittskommentare.
2. **Indexdateien.** `de.ts` und `en.ts` bleiben die Einstiegspunkte mit denselben Exporten (`de`,
   `en: Dictionary`) und führen die Module nur noch per Spread zusammen. `types.ts`, `store.ts`,
   `labels.ts`, `index.ts` und alle Komponenten bleiben unverändert und kompilieren weiter.
3. **Paritäts-Tor je Modul.** Neuer Vitest `apps/web/src/i18n/parity.test.ts`, der für jedes Modul prüft:
   (a) Deutsch und Englisch haben dieselbe Schlüsselmenge; (b) kein Wert ist leer; (c) die Platzhalter
   `{name}` sind je Schlüssel in beiden Sprachen dieselbe Menge; (d) jeder Schlüssel eines Feature-Moduls
   trägt das Präfix seines Moduls (`speakers.` usw.), und das Modul `shell` enthält keinen Schlüssel mit
   einem der fünf Feature-Präfixe; (e) kein Schlüssel kommt in zwei Modulen vor; (f) die Summe über alle
   Module ist 437 und gleich der Schlüsselzahl von `de` und von `en`.
4. **Hinweis für spätere Scheiben.** Ein Kopfkommentar in `de.ts` erklärt in zwei, drei Sätzen: neue
   Schlüssel gehören in das Modul des Features; neue Feature-Module (später focus, steering,
   clearing, cockpit, admin) werden in `de.ts`/`en.ts` und in der Modulliste des Paritätstests ergänzt.

## Nicht-Ziele

- Kein Schlüssel wird umbenannt, hinzugefügt, gelöscht oder umformuliert. Kein Text ändert sich.
- Keine Änderung an Komponenten, `labels.ts`, `store.ts`, `index.ts`, `types.ts` (außer, `tsc` verlangt
  in `types.ts` zwingend eine Anpassung — dann nur dort und im Bericht begründet).
- Kein Lazy Loading, keine neue Bibliothek, keine Änderung an `package.json`.

## Files allowed

- `apps/web/src/i18n/de.ts`, `apps/web/src/i18n/en.ts`
- `apps/web/src/i18n/{shell,speakers,capture,answers,stage,history}.{de,en}.ts` (neu)
- `apps/web/src/i18n/parity.test.ts` (neu)
- `apps/web/src/i18n/types.ts` (nur falls zwingend, siehe Nicht-Ziele)
- diese Datei (`docs/slices/017-i18n-feature-module.md`, nur Abschnitt „Bericht")

## Akzeptanzkriterium

1. Schlüsselzählung vorher und nachher: 437 in `de`, 437 in `en`; die Schlüsselmenge ist identisch mit
   dem Stand vor der Scheibe (Nachweis: ein kurzer Node-Einzeiler oder der Paritätstest, Ausgabe im Bericht).
2. Für jeden Schlüssel ist der deutsche und der englische Text byte-gleich zum Stand vor der Scheibe
   (Nachweis: Vergleich der zusammengeführten Objekte gegen `git show HEAD~:…`-Stand oder gegen einen vor
   dem Umbau erzeugten JSON-Abzug; Ausgabe im Bericht).
3. `parity.test.ts` läuft grün und würde rot bei fehlendem englischen Schlüssel (einmal lokal
   ausprobieren, nicht committen; Ausgabe des roten Laufs im Bericht).
4. `pnpm gates` grün, inkl. Vokabular-Tor.

## Nachweise

Ausgabe von `pnpm gates` (Ende), Schlüsselzählung 437/437, Ausgabe des absichtlich roten Paritätslaufs.

## Arbeitsweise

- Arbeite nur im Worktree `/home/user/wt/017` (Branch `claude/slice-017-i18n-module`). Absolute Pfade.
- Jeder Commit endet in der Betreffzeile mit `[skip netlify]` und nennt die Scheibe, z. B.
  `refactor(web): i18n in Feature-Module geteilt (Scheibe 017) [skip netlify]`.
- Nicht pushen; der Orchestrator pusht.

## Bericht

Slice: 017 — i18n-Wörterbuch in Feature-Module teilen

Done: 437 Schlüssel aus de.ts und en.ts in sechs Feature-Module (shell, speakers, capture, answers, stage, history) aufgeteilt, ohne einen Schlüssel oder Text zu ändern. Indexdateien de.ts und en.ts re-exportieren die gemergten Module. parity.test.ts mit sechs Verifikationen implementiert.

Evidence: 
```
apps/web test:  Test Files  3 passed (3)
apps/web test:       Tests  35 passed (35)
...
vocabulary-check: ok

Schlüsselzählung: 437 DE / 437 EN (Bericht verfiziert)
Module: shell=173, speakers=62, capture=45, answers=78, stage=37, history=42 (Summe 437)

Byte-Gleichheit: Alle Werte der Original-Dumps (JSON) matchen den gemergten Modulen
```

Absichtlich roter Paritätslauf (mit gelöschtem Schlüssel app.name aus shell.en):
```
FAIL  src/i18n/parity.test.ts > i18n parity checks > module shell > (a) German and English have the same key set
Error: Missing in EN: app.name

FAIL  src/i18n/parity.test.ts > i18n parity checks > (f) Total key count is 437 across all modules and matches de and en
AssertionError: expected 436 to be 437

Test Files  1 failed | 2 passed (3)
Tests  2 failed | 33 passed (35)
```
Nach Wiederherstellung: grün.

Open: Keine

Touched: 
- `apps/web/src/i18n/de.ts` (Index, re-exports modules)
- `apps/web/src/i18n/en.ts` (Index, re-exports modules)
- `apps/web/src/i18n/shell.de.ts` (neu, 173 Schlüssel)
- `apps/web/src/i18n/shell.en.ts` (neu, typisiert gegen shell.de)
- `apps/web/src/i18n/speakers.de.ts` (neu, 62 Schlüssel)
- `apps/web/src/i18n/speakers.en.ts` (neu, typisiert gegen speakers.de)
- `apps/web/src/i18n/capture.de.ts` (neu, 45 Schlüssel)
- `apps/web/src/i18n/capture.en.ts` (neu, typisiert gegen capture.de)
- `apps/web/src/i18n/answers.de.ts` (neu, 78 Schlüssel)
- `apps/web/src/i18n/answers.en.ts` (neu, typisiert gegen answers.de)
- `apps/web/src/i18n/stage.de.ts` (neu, 37 Schlüssel)
- `apps/web/src/i18n/stage.en.ts` (neu, typisiert gegen stage.de)
- `apps/web/src/i18n/history.de.ts` (neu, 42 Schlüssel)
- `apps/web/src/i18n/history.en.ts` (neu, typisiert gegen history.de)
- `apps/web/src/i18n/parity.test.ts` (neu, 35 Tests)

Commit: ff11daf

## Review findings

(vom Reviewer)
