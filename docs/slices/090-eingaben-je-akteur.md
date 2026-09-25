# 090 — Eingaben gehören dem Akteur

**Status:** spec
**Risikoklasse:** mittel (Datenschutz) · 0,5 AStd · 25.09.2026 (W0, vorgezogen) · Lanes: web-shell, e2e (eigene Datei)
**Rolle:** Implementierer-Oberfläche; Review in frischem Kontext (Perspektive Datenschutz) (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 10, 12; docs/design-prinzipien.md D9
**Quellen-IDs:** Codex auf PR #35 (als Datenschutzbefund eingestuft); `docs/bautage/uebergabe-2026-09-25.md` Schritt 3; 010d
**Depends on:** 010d (gemergt `ba2dca7`)
**Perspektive:** Datenschutz · **Glossar: neue Begriffe:** nein

## Festlegung des Architekten

010d bindet geladene **Daten** an den Akteur. Offen ist die andere Richtung: **eingegebener Text** lebt als
Komponentenzustand weiter, wenn der Akteur wechselt. Betroffen sind mindestens `ContributionPane` (`draft`, `free`),
der Antwortentwurf (`AnswerEditor`), die Begründungsfelder in `answers/ActionDialogs.tsx` und `stage/Page.tsx`,
`RegisterDialog` (Name, Organisation eines Aktionärs) und die Suche der Historie. Wer nach einem Wechsel am Gerät sitzt,
sieht, was die vorige Person getippt hat. In der Demo wechselt eine Person die Rolle; in Produktion wird es relevant,
sobald sich zwei Personen nacheinander auf einem Gerät anmelden.

Entscheidung: **nicht Feld für Feld**, sondern an einer Stelle. Der Inhalt von `<main>` (die `Routes` in
`apps/web/src/app/AppShell.tsx`) wird mit `key={actor.id}` versehen, sodass ein Akteurwechsel jede Ansicht neu
aufbaut und jeden lokalen Zustand verwirft (Eingaben, offene Dialoge, Auswahl, Filter). Vergleich über `id`, nie über
die Rolle (Regel 4). Das ist auch für künftige Felder richtig, ohne dass jemand daran denken muss. Was eine Ansicht in
`localStorage` hält (etwa der Bühnenkontrast), ist Geräteeinstellung, kein eingegebener Text, und bleibt.

Wenn der Neuaufbau eine bestehende Zusicherung aus 010c/010d bricht (etwa ein e2e, der einen offenen Zustand über den
Wechsel erwartet), ist die Zusicherung im Sinn dieser Scheibe anzupassen, nicht der Schlüssel aufzuweichen; im Bericht
nennen, welche und warum.

## Ziel

1. Akteurwechsel verwirft jede Eingabe in `<main>`: Neuaufbau der Routen über `key={actor.id}`, ein Kommentar sagt warum.
2. e2e-Datei `apps/web/e2e/090-eingaben-je-akteur.spec.ts`, **vor der Änderung rot**, je Feld ein Fall nach dem Muster
   „Rolle A tippt, Wechsel zu B (und falls nötig zurück zu A), Feld ist leer bzw. Dialog geschlossen“, mindestens für:
   Erfassung (`draft` und `free`), Antwortentwurf, Begründung in einem Aktionsdialog der Beantwortung,
   Wortmeldung registrieren (Name). Rückwechsel zu A zeigt ebenfalls leer (kein Wiederherstellen).
3. Ein Fall prüft, dass der Fokus nach dem Wechsel nicht auf `BODY` fällt, sondern im Rollenumschalter bleibt.

## Nicht-Ziele

Kein Entwurfsspeicher je Akteur (das ist Z.365 / 060), keine Änderung an Kern, Vertrag, Dienst, Rechten, i18n;
keine Politur aus der Folgeliste (010e).

## Files allowed

- `apps/web/src/app/AppShell.tsx`
- `apps/web/e2e/090-eingaben-je-akteur.spec.ts` (neu)
- `apps/web/e2e/010c-lesezustand.spec.ts`, `apps/web/e2e/010d-ansichtsdaten.spec.ts` (nur falls eine Zusicherung dem
  Neuaufbau widerspricht; im Bericht begründen)
- `docs/slices/090-eingaben-je-akteur.md`

## Akzeptanzkriterium

1. Die e2e aus Ziel 2 und 3 sind vor der Änderung rot (Ausgabe im Bericht) und danach grün, auch mit
   `--repeat-each=3` und einmal unter `taskset -c 0,1` mit einem Worker.
2. Alle Playwright-Szenarien grün, axe ohne serious/critical; `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).
3. Kein Screenshot nötig (kein neuer sichtbarer Zustand).

## Arbeitsweise

- Worktree `/home/user/wt/s090`, Branch `claude/slice-090-eingaben-je-akteur`.
- Playwright mit eigenem Port (z. B. 5190), Chromium unter `/opt/pw-browsers`; danach `git checkout -- docs/evidence`.
- Logdateien nur über `mktemp`. Jeder Commit nennt „Scheibe 090“ und endet mit `[skip netlify]`. Nicht pushen.

## Bericht

## Review findings
