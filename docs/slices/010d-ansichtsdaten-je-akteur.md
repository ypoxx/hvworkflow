# 010d — Ansichtsdaten gehören dem Schlüssel des Akteurs

**Status:** spec
**Risikoklasse:** niedrig · 1 AStd · Lanes: web-speakers, web-capture, web-answers, web-history, e2e (eigene Datei).
Startet nach 010c (dieselben Feature-Verzeichnisse).
**Rolle:** Implementierer-Oberfläche; Review in frischem Kontext (Perspektive Barrierefreiheit)
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 10, 12; docs/design-prinzipien.md D5, D6 (Fehlerzustand gestaltet), D9 (was
nicht erlaubt ist, wird nicht angeboten)
**Quellen-IDs:** `docs/slices/010c-lesezustand-je-ladevorgang.md`, Review-Befunde Runde 1, Punkte 2, 4 (Beantwortung) und 5
**Depends on:** 010c (gemergt `24eca01`)
**Perspektive:** Barrierefreiheit · **Glossar: neue Begriffe:** nein

## Festlegung des Architekten

010c bindet Lesezustände (bereit, lädt, verweigert, Fehler) an den Schlüssel ihres Ladevorgangs. Übrig sind drei
Stellen derselben Familie: (a) die **Daten** der vorigen Rolle bleiben nach einem Rollenwechsel mit ihren `_actions`
sichtbar und bedienbar, bis die neue Rolle geantwortet hat; (b) nach einem ersten Ladefehler zeigt die Beantwortung
den leeren Zustand „Kein Treffer … Auswahl zurücksetzen“, obwohl keine Auswahl gesetzt ist; (c) der Ausgang eines
älteren Schreibvorgangs (412, Erfolg) wirkt auf die inzwischen gezeigte andere Frage. Der Server lehnt in (a) jeden
Schreibversuch ab (Regel 4 ist erfüllt); verletzt ist D9 in der Oberfläche.

## Ziel

1. Daten mit `_actions` werden nur angeboten, wenn ihr Schlüssel dem aktuellen Akteur gehört (Wortmeldungen,
   Erfassung, Beantwortung, Historie; die Bühne tut es schon). Bis zur ersten Antwort der neuen Rolle: Ladezustand
   (vorhandenes Skelett), keine Aktionsknöpfe der vorigen Rolle.
2. Beantwortung: ein Ladefehler ohne Daten zeigt einen gestalteten Fehlerzustand mit vorhandenen Komponenten und
   i18n-Schlüsseln (oder neuen Schlüsseln de/en, falls keiner passt, dann i18n in Files allowed), nie den Leertext
   „Kein Treffer“.
3. Beantwortung: Ausgang eines Schreibens (Banner „Stand veraltet“, Dialog schließen, Entwurf leeren) wirkt nur, wenn
   `taken.id === question.id` zum Zeitpunkt der Antwort.

4. Testschärfung aus 010c Runde 4: R3-1-e2e prüft zusätzlich den Toast-Text („Testfehler“); Unit-Tabelle des
   Detail-Gates um die Reihenfolge „Liste zuerst“ (404 geschluckt, 500 gezeigt, weiterer Fehler unterdrückt) ergänzt,
   byte-gleich in `answers/lib.test.ts` und `history/lib.test.ts`. Dafür zusätzlich in Files allowed:
   `apps/web/e2e/010c-lesezustand.spec.ts`.

5. Aus der Prüfung der CI-Korrekturen von 010c (beide minor, Testrobustheit): `installHarness` lädt die App-Module
   ohne `await` im Seitenkontext oder begründet im Bericht, warum der eine verbliebene `import()` in `waitForCorpus`
   sicher ist (`010c-lesezustand.spec.ts:118`); der Ablehnungszweig in `unrelatedEvent` verträgt `null`/`undefined`
   (`(error as { detail?: string } | null)?.detail ?? String(error)`, `:280`).

## Nicht-Ziele

Keine Änderung an Kern, Vertrag, Dienst, Rechten; kein neues Token; kein gemeinsamer Ordner außerhalb der Features.

## Files allowed

- `apps/web/src/features/{speakers,capture,answers,history}/**`
- `apps/web/src/i18n/{answers,speakers,capture,history}.{de,en}.ts` und `apps/web/src/i18n/parity.test.ts` (nur falls
  Ziel 2 neue Schlüssel braucht; nur die Schlüsselzahl im Paritätstest)
- `apps/web/e2e/010d-ansichtsdaten.spec.ts` (neu), `apps/web/e2e/010c-lesezustand.spec.ts` (nur Ziel 4)
- `docs/evidence/010d-*.png`
- `docs/slices/010d-ansichtsdaten-je-akteur.md`

## Akzeptanzkriterium

1. Je Ziel ein e2e, das vor der Änderung rot ist. Ziel 1: Rollenwechsel mit zurückgehaltenen Lesevorgängen der neuen
   Rolle → kein Aktionsknopf der vorigen Rolle sichtbar; Ziel 2: erster Abruf 500 → Fehlerzustand, kein „Kein
   Treffer“; Ziel 3: Schreiben auf A läuft, Wechsel auf B, A antwortet 412/Erfolg → B unverändert.
2. Screenshot des Fehlerzustands (Ziel 2) in `docs/evidence/`.
3. Alle Playwright-Szenarien grün, axe ohne serious/critical; `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).

## Arbeitsweise

- Worktree `/home/user/wt/takt` nach 010c, Branch `claude/slice-010d-ansichtsdaten` vom Integrationsbranch.
- Playwright mit eigenem Port, Chromium unter `/opt/pw-browsers`; danach `git checkout -- docs/evidence` außer den
  eigenen 010d-Screenshots.
- Logdateien nur über `mktemp`. Jeder Commit nennt „Scheibe 010d“ und endet mit `[skip netlify]`. Nicht pushen.

## Bericht

(vom Implementierer)

## Review findings

(vom Reviewer)
