# 010c — Lesezustand je Ladevorgang

**Status:** spec
**Risikoklasse:** niedrig · 0,75 AStd · Lanes: web-speakers, web-capture, web-answers, web-stage, web-history, e2e (eigene
Datei). Startet nach takt-008 (dieselben Feature-Verzeichnisse).
**Rolle:** Implementierer-Oberfläche; Review in frischem Kontext (Perspektive Barrierefreiheit)
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 10, 12; docs/design-prinzipien.md (leere und verweigerte Zustände)
**Quellen-IDs:** `docs/slices/010b-lesepfade-oberflaeche.md`, Abschnitt „Codex auf `adec621` — Folgepunkte" (Punkte 1–4)
und Runde 5 (Serverfilter-Toast)
**Depends on:** 010b (gemergt `0a5eae3`), takt-008 (gemergt `c6ad01f`)
**Perspektive:** Barrierefreiheit · **Glossar: neue Begriffe:** nein

## Festlegung des Architekten

010b hat den gestalteten Zustand „keine Leseberechtigung" gebaut und Detailfehler bei verweigerter Liste als Klasse
behandelt (`createDetailProblemGate`). Übrig ist eine zweite Klasse: **Verweigerung und Fehler hängen nicht an dem
Ladevorgang, der sie erzeugt hat.** Nach einem Rollenwechsel von verweigert zu berechtigt bleibt „keine
Leseberechtigung" stehen, wenn der erste Abruf der neuen Rolle mit einem gewöhnlichen Fehler scheitert. Lösung als Muster,
nicht je Stelle: Jeder Lesezustand (bereit, lädt, verweigert, Fehler) trägt den Schlüssel seines Ladevorgangs (Akteur und
`version`), und eine Ansicht zeigt nur Zustände des aktuellen Schlüssels. Ein gemeinsamer Ort außerhalb der Feature-Ordner
ist nicht erlaubt (Vorbild `stage/lib.ts`); das Muster steht daher je Feature in dessen `lib.ts` oder `use*.ts`, mit
derselben Testtabelle.

## Ziel

1. `answers/useBacklog.ts`: `listForbidden` gehört zum Ladevorgang; ein gewöhnlicher Fehler der neuen Rolle hebt es auf.
2. `history/Page.tsx`: `historyForbidden` (Zeitleiste) und `streamForbidden` (Ereignisstrom) ebenso.
3. `capture/Page.tsx`: `needsProbe` wartet `speakers.settled` für den aktuellen Schlüssel ab (kein ungefilterter Abruf beim
   Wechsel von verweigert zu berechtigt).
4. `speakers/` und `stage/`: prüfen, ob dieselbe Klasse vorkommt; wenn ja, gleich behandeln, sonst im Bericht begründen.
5. Serverfilter-Toast (Beantwortung, Runde 5 von 010b): mit Filter kennt die Liste die ausgelassenen Fragen nicht. Lösung
   nach Wahl, begründet: Detailfehler einer Auswahl, die die gefilterte Liste nicht enthält, nach einem Rollenwechsel
   schlucken — oder im Bericht als bewusst offen führen, wenn es nur mit zweiter Liste ginge.

6. Folgepunkte aus der Nachprüfung von takt-008 (N1–N3, dieselbe Klasse bei Schreibsperren): Fokusmerker
   `stepTaken`/`nextPressed` erst setzen oder löschen, wenn der nachgelesene Stand gerendert ist (nach 412 fällt der
   Fokus sonst auf BODY); Fehler eines älteren Schreibens gibt nur die eigene Sperre frei; `deliver` ohne Schreiben
   löscht `nextPressed`. Je Punkt ein Test (Fehler-Patch über das In-Process-`HvApi`).

## Nicht-Ziele

Keine Änderung an Kern, Vertrag, Dienst, Rechten; keine neue Komponente, kein neues Token; kein gemeinsamer Ordner
außerhalb der Features.

## Files allowed

- `apps/web/src/features/{speakers,capture,answers,stage,history}/**`
- `apps/web/e2e/010c-lesezustand.spec.ts` (neu)
- `docs/slices/010c-lesezustand-je-ladevorgang.md`

## Akzeptanzkriterium

1. Je Ziel ein e2e, das vor der Änderung rot ist: verweigerte Rolle → berechtigte Rolle, erster Abruf mit 500 (Fehler-Patch
   über das In-Process-`HvApi` wie in 010b); danach kein „keine Leseberechtigung", genau ein Toast. Für Ziel 3: kein
   ungefilterter Abruf (Aufrufzähler).
2. Unit-Tabelle je Feature für den Schlüsselvergleich (überholter Ladevorgang meldet nicht).
3. Alle Playwright-Szenarien grün, axe ohne serious/critical; `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).

## Arbeitsweise

- Worktree `/home/user/wt/takt` nach takt-008, Branch `claude/slice-010c-lesezustand` vom Integrationsbranch.
- Playwright mit eigenem Port, Chromium unter `/opt/pw-browsers`; danach `git checkout -- docs/evidence`.
- Logdateien nur über `mktemp`. Jeder Commit nennt „Scheibe 010c" und endet mit `[skip netlify]`. Nicht pushen.

## Bericht

(vom Implementierer)

## Review findings

(vom Reviewer)
