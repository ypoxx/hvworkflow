# 080b — Korpus 28/230 als eine Quelle

**Status:** in Arbeit (26.09.)
**Risikoklasse:** mittel · 1 AStd · 08.10.2026 (W2, vorgezogen) · Lanes: core, e2e
**Rolle:** Implementierer-Backend (Seed, Adapter, e2e-Konstanten); Review in frischem Kontext (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** AGENTS.md Regeln 1, 2, 11, 12
**Quellen-IDs:** Feedback #14; `docs/produktplan-beta.md` Abschnitt 5, Eintrag 080b
**Depends on:** 080 (gemergt `252f3fe`)
**Perspektive:** Prozess (Demo-Tauglichkeit) · **Glossar: neue Begriffe:** nein · Bedrohungs-IDs: keine berührt (nur synthetischer Korpus, Regel 11); Missbrauchsfall: keiner

## Festlegung des Architekten

Gelesen vor der Spec (Lehre aus 080): `seedEvents` (packages/domain/src/seed.ts) hat feste Rundengrößen
`[40, 34, 28, 16]` (118 Wortmeldungen) und eine Fragenzahl aus den Optionen. `HvApi.seedDemo` setzt den Standard
`questions ?? 800`. Die 800 stehen außerdem fest in `apps/web/src/api/index.ts` (`SEED_QUESTIONS`) und in zehn
e2e-Dateien (`const SEEDED_QUESTIONS = 800`). Feste Zahlen in Tests: `seed.test.ts` (800, Bühne 3..12, mehr als 10
Wartende, Runde 3), `seed-fictitious-names.test.ts` (Fingerabdruck über 800), `apps/api/src/__tests__/acceptance.test.ts`
(800 über HTTP, bleibt als Lasttest).

- **Zwei benannte Korpora** in seed.ts: `CORPUS_DEMO` (28 Wortmeldungen in vier Runden, Vorschlag `[8, 7, 8, 5]`,
  230 Fragen, Seed 2027) und `CORPUS_LOAD` (die heutigen `[40, 34, 28, 16]`, 800 Fragen, Seed 2027).
  `SeedOptions` erhält `roundSizes?`. **Ohne Angabe gilt `CORPUS_LOAD.roundSizes`**, damit der Lastkorpus und der
  Fingerabdruck in `seed-fictitious-names.test.ts` bytegleich bleiben (dieser Test wird nicht angefasst).
- `HvApi.seedDemo(options?)` nimmt `roundSizes?` mit auf (nur Domänentyp; der Vertrag nennt nur `questions` und `seed`).
  Der **Standard ist `CORPUS_DEMO`**: fehlt `questions`, gilt `CORPUS_DEMO.questions`; fehlt `roundSizes`, gilt
  `CORPUS_DEMO.roundSizes`. Der Dienst übernimmt das unverändert (Autoseed und `POST /v1/demo/seed`).
- Die Szene bleibt: ein Sprecher am Mikrofon in Runde 3, Wartende, eine kurze, nie leere Bühnen-Warteschlange, alle
  neun Status vertreten. Passt die Szene mit `[8, 7, 8, 5]` nicht (etwa kein `staged`), darf der Implementierer die
  Rundengrößen innerhalb von 28 Wortmeldungen verschieben und nennt das im Bericht; `statusFor` bleibt unverändert.
- **Eine Quelle:** Web-Adapter und alle e2e-Konstanten lesen aus `CORPUS_DEMO` (Import aus `@hv/domain`, wie ihn
  `020-rueckbau-passung.spec.ts` schon nutzt). `grep -rn "SEEDED_QUESTIONS = " apps/web/e2e` ist danach leer.
- **Umsortierung mit Begründung** (bisher Teil von 080b) braucht ein neues Feld in `SpeakerOrder` und damit eine
  Vertragsänderung. Sie geht als **080c** in den Plan, nach 0.4.0 (043).

## Ziel

1. `CORPUS_DEMO`, `CORPUS_LOAD` exportiert (auch über `packages/domain/src/index.ts`, falls der Export dort gebündelt
   ist); `seedEvents` mit `roundSizes?`; `HvApi.seedDemo` mit Standard `CORPUS_DEMO`.
2. `seed.test.ts`: die bestehenden Fälle laufen gegen `CORPUS_LOAD` (unverändert grün), neue Fälle gegen `CORPUS_DEMO`:
   genau 28 Wortmeldungen und 230 Fragen, deterministisch, alle neun Status, Bühne mindestens 1 und höchstens 8, ein
   Sprecher am Mikrofon in Runde 3, mindestens 3 Wartende.
3. `apps/web/src/api/index.ts` säht `CORPUS_DEMO` (Fragen, Rundengrößen, Seed).
4. Alle e2e-Dateien importieren die Zahl aus `CORPUS_DEMO`. Szenarien, die sich auf die Größe des alten Korpus stützten
   (etwa „mindestens n Zeilen“, eine feste Position), werden auf den neuen Korpus umgestellt; das Prüfziel jeder
   Zusicherung bleibt (keine Zusicherung schwächen, keine streichen, kein `test.skip`/`test.fail`).
5. API-Tests, die sich auf den bisherigen Standard stützen (Seed ohne `questions`), angepasst; `acceptance.test.ts`
   bleibt bei ausdrücklich 800 Fragen.

## Nicht-Ziele

Keine Vertragsänderung, keine Umsortierung (080c), keine Änderung an `statusFor` oder am Textbaukasten, kein neuer
sichtbarer Zustand in der Oberfläche; `seed-fictitious-names.test.ts` bleibt unangetastet.

## Files allowed

- `packages/domain/src/{seed,api,index}.ts`
- `packages/domain/src/__tests__/{seed,api}.test.ts`
- `apps/web/src/api/index.ts`
- `apps/web/e2e/*.spec.ts`, `apps/web/e2e/*.ts` (nur Korpuszahl und korpusabhängige Stellen)
- `apps/api/src/__tests__/*.test.ts` (nur Stellen, die sich auf den Standardkorpus stützen)
- `docs/produktplan-beta.md` (nur Einträge 080b und 080c, vom Architekten), `docs/slices/080b-korpus-eine-quelle.md`

## Akzeptanzkriterium

1. `grep -rn "SEEDED_QUESTIONS = \|SEED_QUESTIONS = " apps/web` ohne Treffer; die Zahl steht nur in seed.ts.
2. `seed.test.ts` grün mit beiden Korpora; `seed-fictitious-names.test.ts` unverändert grün.
3. Volle e2e-Suite grün (Anzahl nennen), axe ohne serious/critical; `pnpm gates` grün (Commit nennen, Schluss einmal
   wörtlich). Kein Screenshot nötig; fremde Evidenz danach mit `git checkout -- docs/evidence` zurücksetzen.

## Arbeitsweise

- Worktree `/home/user/wt/s080b`, Branch `claude/slice-080b-korpus` (vom Architekten angelegt).
- Playwright auf eigenem Port (z. B. 5193), Chromium unter `/opt/pw-browsers`. Logs nur über `mktemp`.
- Commits nennen „Scheibe 080b“ und enden mit `[skip netlify]`. Nicht pushen.
- Stößt eine Zusicherung auf eine Datei außerhalb von Files allowed oder auf eine feste Zahl, die hier nicht genannt
  ist: anhalten und melden.

## Bericht

(folgt)
