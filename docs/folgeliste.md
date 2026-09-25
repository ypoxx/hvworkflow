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
- 010d Bericht · `features/capture/` · eingegebener Text ist nicht an den Akteur gebunden (Formular behält Text über
  einen Rollenwechsel) · beim Akteurwechsel leeren oder bewusst behalten und dokumentieren.
- takt-008 Bericht offen 2 · `features/answers/`, `features/stage/` · Knöpfe außerhalb der sechs Aktionen nutzen noch
  `disabled={busy}` (Fokus fällt nach Aktion auf BODY) · Muster aus takt-008 übernehmen.
- takt-008 Bericht offen 3 · `features/capture/ContributionPane.tsx` · `capture-submit` hat zwei gesperrte Erscheinungen
  (leer: nativ gesperrt; beim Schreiben: `aria-disabled`) · vereinheitlichen.

## Tests

- 010c CI-Korrektur minor · `apps/web/e2e/010c-lesezustand.spec.ts:118` · ein `import()` mit `await` bleibt in
  `installHarness` (in 010d auf Abfrage umgestellt, prüfen ob erledigt) · ggf. streichen.
