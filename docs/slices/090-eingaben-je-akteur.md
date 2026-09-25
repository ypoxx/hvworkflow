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

**Nachtrag des Architekten (25.09., nach dem ersten Bauversuch):** Der erste Versuch mit `key={actor.id}` an den
`Routes` zeigte zweierlei. Erstens verwirft 010d die meisten Eingaben bereits (Erfassung `draft`/`free`, Antwortentwurf,
Begründung, Name bei der Registrierung: die e2e dafür waren vor der Änderung schon grün). Zweitens bricht der
Neuaufbau 25 bestehende Szenarien (Auswahl und Reiter gehen verloren, der Demo-Durchgang 003 reißt) und bringt das in
010b bewusst beseitigte Flackern „keine Leseberechtigung“ zurück. Der Schlüssel an den Routen ist damit zu grob.

Entscheidung: **gezielt je Feld.** Undicht ist nachweislich die Suche der Historie; jedes weitere Textfeld wird im
e2e-Durchgang geprüft (Liste unten). Wo ein Feld den Wechsel überlebt, wird es beim Wechsel des Akteurs geleert, mit dem
Muster aus `answers/Page.tsx` (`viewActorId`, Vergleich über `id`, nie über die Rolle, Regel 4). Auswahl, Reiter und
Filterwahl (keine eingegebenen Texte) bleiben, wie 010d sie festlegt. Was eine Ansicht in `localStorage` hält (etwa der
Bühnenkontrast), ist Geräteeinstellung und bleibt.

## Ziel

1. Jede getippte Eingabe, die einen Akteurwechsel überlebt, wird beim Wechsel geleert. Mindestens die Suche der
   Historie; zu prüfen außerdem: Filtertextfeld in `answers/WorkList.tsx`, Eingaben in `capture/SuggestDialog.tsx`,
   Begründung auf der Bühne (`stage/Page.tsx`), Felder in `answers/ActionDialogs.tsx` (Einheit, Nummer). Ein Kommentar
   an jeder Stelle sagt warum.
2. e2e-Datei `apps/web/e2e/090-eingaben-je-akteur.spec.ts`, je Feld ein Fall „Rolle A tippt, Wechsel zu B (und falls
   nötig zurück zu A), Feld leer bzw. Dialog geschlossen“. Die Fälle für schon dichte Felder bleiben als
   Regressionsschutz; die Fälle für undichte Felder sind vor der Änderung rot (Ausgabe im Bericht).
3. `docs/produktplan-beta.md` Abschnitt 5 erhält den Eintrag 090 (vom Architekten gesetzt, Tor `downgrade-check`).

## Nicht-Ziele

Kein Neuaufbau der Routen je Akteur; Fokus nach der Wahl im Rollenumschalter (fällt auf `BODY`, Ursache in
`RoleSwitcher.tsx`) → Folgeliste, nicht hier und nicht als `test.fail` im e2e. Kein Entwurfsspeicher je Akteur (Z.365 /
060), keine Änderung an Kern, Vertrag, Dienst, Rechten, i18n; keine Politur aus der Folgeliste (010e).

## Files allowed

- `apps/web/src/features/{history,answers,capture,stage,speakers}/**` (nur die Rücksetzung getippter Eingaben)
- `apps/web/e2e/090-eingaben-je-akteur.spec.ts` (neu)
- `docs/produktplan-beta.md` (nur der Eintrag 090 in Abschnitt 5, vom Architekten)
- `docs/slices/090-eingaben-je-akteur.md`

## Akzeptanzkriterium

1. Die e2e aus Ziel 2 für undichte Felder sind vor der Änderung rot und danach grün, auch mit `--repeat-each=3` und
   einmal unter `taskset -c 0,1` mit einem Worker.
2. Alle Playwright-Szenarien grün (volle Suite, keine bestehende Zusicherung geändert), axe ohne serious/critical;
   `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).
3. Kein Screenshot nötig (kein neuer sichtbarer Zustand).

## Arbeitsweise

- Worktree `/home/user/wt/s090`, Branch `claude/slice-090-eingaben-je-akteur`.
- Playwright mit eigenem Port (z. B. 5190), Chromium unter `/opt/pw-browsers`; danach `git checkout -- docs/evidence`.
- Logdateien nur über `mktemp`. Jeder Commit nennt „Scheibe 090“ und endet mit `[skip netlify]`. Nicht pushen.

## Bericht

## Review findings
