# 090 — Eingaben gehören dem Akteur

**Status:** review bestanden (R2, 25.09.)
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
- `apps/web/e2e/010c-lesezustand.spec.ts` (Nachtrag des Architekten 25.09.: nur die Szenarien, die sich auf eine über den
  Akteurwechsel erhaltene Suche in der Beantwortung stützen; sie tippen die Suche nach dem Wechsel neu, ihr Prüfziel bleibt)
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

```
Slice: 090-eingaben-je-akteur
Done: Beim Akteurwechsel werden geleert: Suche der Historie, Suche der Beantwortung (sofort, auch in
      der Entprellung), Erfassung draft/free/offenes Formular (ContributionPane), Rückgabe-Dialog der
      Bühne (returnOpen). Vergleich jeweils über die id. e2e 090 mit 20 Fällen, je Feld ein Wechsel zu einer
      Rolle ohne und einer mit dem Feld; 010c-Szenarien, die sich auf die Suche stützten, tippen sie neu.
Evidence: pnpm gates auf 725b772 grün, Schluss wörtlich:
      ✓ built in 2.05s
      mark-test-run: wrote /home/user/wt/s090/.claude/state/last-test-run (clean tree) at commit 725b772, tree 238d970b769d…
      Rot vor der Änderung:
      - Suchen (Historie, Beantwortung), vor 2aa068e/93d9f1b:
          Error: expect(received).not.toBe(expected)  Expected: not "Vertraulicher Suchbegriff"
      - Review R1, Erfassung (capture → admin, capture → moderation → capture; draft und free), vor 725b772:
          Error: expect(received).not.toBe(expected)
          Expected: not "GEHEIM-DRAFT Redebeitrag der vorigen Person."
          Expected: not "GEHEIM-DRAFT Frage der vorigen Person?"
          > 79 |   await expect.poll(() => valueOrAbsent(page, testId)).not.toBe(secret);
      - Review R1, Bühne (podium → approver und podium → admin), vor 725b772:
          Error: expect(locator).toHaveCount(expected) failed  Expected: 0  Received: 1
          > 460 |   await expect(page.getByTestId('stage-return-reason')).toHaveCount(0);
      - Review R1 Befund 6, Entprellung zurückgenommen (Probe, nicht committet):
          Expected value: not "GEHEIM"  Received array: ["GEHEIM", null]        (Beantwortung)
          Expected value: not "GEHEIM"  Received array: [null, "GEHEIM", null]  (Historie)
      Danach: e2e 090 20/20; --repeat-each=3 60/60; taskset -c 0,1 --workers=1 20/20.
      e2e 010c --repeat-each=3 81/81. Volle Suite 116 passed, 0 failed; axe ohne serious/critical.
      Kein Screenshot (Akzeptanzkriterium 3).
      Angepasste 010c-Szenarien (Files allowed, Nachtrag des Architekten):
      - "Ziel 5: Suche aktiv, Wechsel zu observer … kein Toast" und "Runde 2 (N1) … zwei fremde Ereignisse:
        kein Toast": observer tippt die Suche nach dem Wechsel neu (searchAgainAfterSwitch,
        typeSearchAndExpectDetailRead). Der Helfer zählt getQuestion: 0 Aufrufe bei leerer Suche (vollständige
        Liste, Auswahl verborgen, der Test prüfte nichts), mindestens einer nach dem Neutippen. Danach dieselben
        Zusicherungen; Prüfziel gleich: der maskierte 404 einer Auswahl einer anderen Rolle ist kein Fehler.
      - "Runde 2 … erste Detailabfrage mit 500: ein Toast": 500 wird nach dem Wechsel auf die erste
        Detailabfrage der neu getippten, gefilterten Liste gesetzt; Kommentar nachgezogen (nicht mehr die
        allererste Ladung nach dem Wechsel). Prüfziel gleich: ein echter Fehler zeigt genau einen Toast.
      - "Runde 3 (R3-1)", beide Reihenfolgen: Verzögerung der Liste (600 ms) und 500 (150 ms) greifen beim neu
        getippten Suchlauf. Prüfziel gleich: Liste zuletzt, maskierter 404 zuerst, der 500 bleibt ein Toast
        mit "Testfehler".
Open: Fokus nach der Wahl im Rollenumschalter fällt auf BODY (Ursache RoleSwitcher.tsx), Folgeliste.
      Mit einer Rolle geprüft, die das Feld auch sieht, und schon vor 090 dicht (Regressionsschutz):
      Antwortentwurf und Quellen, Begründung Rückgabe (Beantwortung), Name bei der Registrierung, Nummer im
      Zusammenführen-Dialog. Einheit im Zuweisen-Dialog und SuggestDialog sind Auswahlfelder ohne getippten
      Text, nicht geprüft.
Touched: apps/web/src/features/history/Page.tsx, apps/web/src/features/answers/Page.tsx,
      apps/web/src/features/answers/useBacklog.ts, apps/web/src/features/capture/ContributionPane.tsx,
      apps/web/src/features/stage/Page.tsx, apps/web/e2e/090-eingaben-je-akteur.spec.ts,
      apps/web/e2e/010c-lesezustand.spec.ts, docs/slices/090-eingaben-je-akteur.md
```

## Review findings

**R1** (frischer Kontext, Datenschutz, Opus 5.5) auf `ab75640`: **nacharbeiten**, 1 Blocker, 3 Major, 2 minor, 1 nit.

1. Blocker: Erfassung `draft`/`free` überlebten den Wechsel zu einer Rolle, die das Feld auch sieht (capture → admin).
   Die ersten e2e wechselten nur zu Rollen ohne das Feld, deren Aushängen das Leck verdeckte → behoben (`725b772`).
2. Major: e2e ohne Wechsel zu einer Rolle mit demselben Feld → je Feld ergänzt, 20 Fälle.
3. Major: zwei weitere 010c-Szenarien (Ziel 5, Runde 2 N1) prüften nach der Änderung nichts mehr → Suche neu getippt,
   Detailabruf gezählt (0 ohne, ≥ 1 mit Suche).
4. Major: Planeintrag 011 versehentlich geändert (Orchestrator, `bf2ce5e`) → wiederhergestellt (`49d5e2f`).
5. Minor: Rückgabe-Dialog der Bühne öffnete sich für den nächsten Akteur wieder → geschlossen beim Wechsel, Test hart.
6. Minor: Entprellung ohne Test → Abrufe mitgeschnitten, kein Abruf nach dem Wechsel trägt den alten Begriff.
7. Nit: Kommentar in 010c → nachgezogen.

**R2** (enge Nachprüfung) auf `b232bd5`: **annehmen**. Alle Befunde geschlossen; Gegenprobe mit dem Code vor der
Korrektur: 6 Fälle rot, Entprellungsfälle rot. `pnpm gates` grün auf `b232bd5`. Ein nit (`expectCleared` prüft
zusätzlich `#main` per `innerText`, fügt nichts hinzu) → `docs/folgeliste.md`.

**Codex** (ein Lauf bei „ready“, `8d0ef0a`): 1 × P1 (Datenschutz): Die Rückgabe-Begründung der Bühne wird erst in einem
Effekt nach dem Öffnen geleert und kann für die nächste Person einen Frame lang aufblitzen. Ursache geprüft und
breiter als gemeldet: dasselbe Muster in den vier Aktionsdialogen der Beantwortung und in `RegisterDialog`. Behoben
vom Orchestrator (`08eaa2b`): jeder Dialog trägt einen Schlüssel aus Akteur-id und Dialogart (`key={`${actorId}:return`}` usw.),
ein Wechsel baut ihn neu auf und verwirft den Text synchron. e2e: ein MutationObserver prüft beim Wiederöffnen, ob ein
eingefügtes Feld den alten Text trägt; vor der Korrektur rot für Rückgabe (Beantwortung), Registrierung und
Zusammenführen (`Expected: false, Received: true`), die Bühne war bereits dicht (Neuladen beim Wechsel). Danach:
090 mit `--repeat-each=3` 60/60, unter `taskset -c 0,1` 20/20, volle Suite 116/116; `pnpm gates` grün auf `08eaa2b`:

```
✓ built in 2.31s
mark-test-run: wrote /home/user/wt/s090/.claude/state/last-test-run (clean tree) at commit 08eaa2b, tree 3c648dcadc8c…
```
