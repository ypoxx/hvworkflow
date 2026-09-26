# Folgeliste — gesammelte Kleinbefunde

**Zweck:** Minor- und Nit-Befunde aus Reviews und Codex (P2 und kleiner), die nach dem schlanken Review-Modus
(AGENTS.md Regel 3, Entscheidung des Eigentümers vom 25.09.2026) nicht in der Scheibe nachgearbeitet werden. Ein
gebündelter Debug- und Review-Durchgang arbeitet die Liste später ab. Blocker, Major, P0/P1 sowie jeder Befund zu
Sicherheit, Recht oder Datenschutz gehören **nicht** hierher, sie werden in der Scheibe behoben.

**Format:** eine Zeile je Punkt: Herkunft (Scheibe, Runde) · Datei:Zeile · Befund in einem Satz · Vorschlag.

## Oberfläche: Lade- und Schreibränder (Kandidat 010e)

- 010d R1 Befund 5 · `features/history/Page.tsx` · Historie zeigt nach erstem Ladefehler „Kein Treffer“ / „Noch keine
  Ereignisse“ und nutzt `answers.list.loading` · gestalteter Ladefehler mit eigenen `history.*`-Schlüsseln.
- 010d R2 N3 · `features/answers/WorkList.tsx` · kein Beschäftigt-Signal beim erneuten Versuch; Zähler „0 von 0“ im
  Fehlerzustand · `aria-busy` am Knopf, Zähler ausblenden.
- 010d R3 minor · `features/answers/Page.tsx:150-166` · verlässt man eine Frage während einer langsamen
  Speicherantwort und kehrt zurück, leert der späte Erfolg den neu getippten Text · nur leeren, wenn der Editor noch
  den gespeicherten Text enthält.
- 010d R3 nit · `features/answers/WorkList.tsx:339-353` · Wiederholungsmarke `retriedAt` überlebt einen
  Rollenwechsel · Marke an den Akteur binden.
- 010d Bericht · `features/answers/Page.tsx` · andere Ablehnungen (403/409/5xx) für eine nicht mehr gezeigte Frage
  zeigen den Servertext · i18n-Text mit Fragennummer wie beim 412.
- 010d Bericht · `features/stage/Page.tsx:515` · Skelett `stage-deciding` trägt `aria-label` ohne Rolle (axe serious,
  sobald der Ladezustand geprüft wird) · `role="status"` wie in 010d.
- 010c · `features/history/Page.tsx` · zwei Toasts, wenn beide Hauptabrufe scheitern · einen Toast je Durchgang.
- takt-008 Bericht offen 2 · `features/answers/`, `features/stage/` · Knöpfe außerhalb der sechs Aktionen nutzen noch
  `disabled={busy}` (Fokus fällt nach Aktion auf BODY) · Muster aus takt-008 übernehmen.
- takt-008 Bericht offen 3 · `features/capture/ContributionPane.tsx` · `capture-submit` hat zwei gesperrte Erscheinungen
  (leer: nativ gesperrt; beim Schreiben: `aria-disabled`) · vereinheitlichen.
- 090 Bau · `apps/web/src/app/RoleSwitcher.tsx` · nach der Wahl eines Eintrags fällt der Fokus auf `BODY` (der
  gewählte Menüpunkt wird ausgehängt) · Fokus auf den Auslöser des Umschalters zurückgeben, e2e dazu.

## Tests

- 010c CI-Korrektur minor · `apps/web/e2e/010c-lesezustand.spec.ts:118` · ein `import()` mit `await` bleibt in
  `installHarness` (in 010d auf Abfrage umgestellt, prüfen ob erledigt) · ggf. streichen.
- 090 R2 nit · `apps/web/e2e/090-eingaben-je-akteur.spec.ts` (`expectCleared`) · Prüfung von `#main` per
  `not.toContainText` sieht keine Feldwerte und fügt nichts hinzu · streichen oder auf Feldwerte umstellen.

## Dienst: Anmeldung (vor oder mit 029)

- 029a R1 minor 3 · `apps/api/src/actor.ts:1-5` · Dateikopf nennt die Datei noch „demo authentication adapter“, sie
  enthält jetzt Port und Adapterwahl · Kommentar anpassen.
- 029a R1 minor 4 · `apps/api/src/server.ts:17` · Log-Hinweis wertet `HV_DEMO` selbst aus statt die Wahl aus
  `createApp` zu übernehmen · gewählten Adapternamen zurückgeben und loggen (spätestens mit 029).
- 029a R1 nit 6 · `packages/contract/openapi.yaml` · 401 für `seedDemo`, `getMeeting`, `registerSpeaker` nicht
  dokumentiert (Ausnahme `UNDOCUMENTED_STATUS_EXCEPTIONS`) · 043.

## Sprecher und Zustandstabelle (aus 080)

R1 minor 3, 4, 5 und nit 6 (leerer PATCH, legalRef R-SPK-01, Tests 412-vor-409 und Wiederholung, EN-Spaltenkopf):
erledigt in takt-015.

- 080 Spec Nicht-Ziel · `apps/web/src/features/speakers/SpeakerRow.tsx` · Knopfwahl nach Status statt aus `_actions`
  (Regel 4/5) · je Wortmeldung erlaubte Übergänge als Aktionen ausgeben.
- 080 Spec Nicht-Ziel · `packages/domain/src/transitions.ts` · kein Guard „nur ein Mikrofon offen“ auf R-SPK-01 (die
  Oberfläche beendet die laufende Rede zuerst) · Guard mit Regel-id.
- 080 → 043 · `packages/contract/openapi.yaml` · `SpeakerUpdate.reason` und 409 für `updateSpeaker` aufnehmen, Ausnahme
  in `apps/api/src/__tests__/helpers.ts` streichen, `kind`/`requestedMinutes` löschen.
- 080b R1 minor · `apps/web/src/api/index.ts` (`STORAGE_KEY` `hv-demo-events-v1`) · ein Browser mit gespeichertem
  Alt-Korpus (800) behält ihn bis „Demo zurücksetzen“ · Schlüssel versionieren (`-v2`).
- 080b R1 nit · `apps/web/e2e/abnahme.spec.ts:7` · Zitat „bei 800 Fragen im Bestand“ neben CORPUS_DEMO verwirrt ·
  als Zitat kennzeichnen oder Abnahmesatz in `docs/erste-version-und-offene-fragen.md` nachziehen.

## Rollen (aus 021a/021b)

- 021b R1 minor 2 · `apps/web/src/features/capture/Page.tsx` · Koordination sieht „In dieser Rolle nur lesen“ neben
  „Klassifizieren“ (Hinweis nur aus `question.capture` abgeleitet) · Hinweis aus allen `_actions` der Seite ableiten.
- 021b Spec · `packages/domain/src/seed.ts` · historische Klassifizierungen im Demo-Korpus tragen die Erfassung als
  Akteur · mit dem nächsten Seed-Umbau auf die Koordination umstellen (Fingerabdruck neu begründen).
- 021a Bau · `packages/domain/src/api.ts` (Schreibweg) · `actor()` wird für Rechteprüfung, Guard und `append` getrennt
  gelesen · Akteur einmal je Aufruf binden.
- 021a R1 nit · `packages/domain/src/transitions.ts` · Erstellerin, die eine ältere fremde Version freigibt, erhält
  R-GUARD-04 statt R-GUARD-06 · nur zur Kenntnis.
