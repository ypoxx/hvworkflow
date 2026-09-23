# ADR 0003 — Persistenz des Ereignislogs: Postgres, nur anhängend

**Status:** vorgeschlagen · **Datum:** 23.09.2026 · **Entscheider:** Umsetzer (Konzernstandard als Orientierung; Plan 3), Eigentümer und Konzern-IT für die Datenbanktopologie (E27) · **Annahme:** Prüfpunkt 3 (Plan 4)

## Kontext

Heute hält der Dev-Adapter das Ereignislog als JSONL-Datei, die Demo im `localStorage` des Geräts
(ADR 0002). Beide sind Wegwerf- bzw. Entwicklungsstände. B3 verlangt einen Ereignisspeicher als
System of Record: Hash-Kette über alle Ereignisse, global lückenlose `seq` wie im Vertrag,
`meetingId` auf jedem Ereignis, Rebuild der Projektion aus 10 000 Ereignissen in unter fünf Minuten,
Backup und Restore einmal als Drill protokolliert.

Der Persistence-Port (`store.ts`) existiert; die Domäne sieht nur `append` und `readAfter`
(ADR 0001, Grenze 2). Regel 7 (Ereignisse werden nur angehängt, Zustand ist eine Projektion) ist
nicht verhandelbar; offen war laut Leitplanken 1.3 allein die Speicherform des Logs. Dieser ADR
legt die Speicherform vor.

## Entscheidung

Standardannahme aus Plan 3 („Persistenzform des Ereignislogs") und Plan 4 (Zeile 0003):

- **Managed Postgres, eine Tabelle `events`** mit den Spalten `seq, id, meeting_id, type,
  occurred_at, occurred_at_source, recorded_at, actor, subject_id, payload jsonb, prev_hash, hash,
  schema_version, retention_class, legal_hold`. Die Feldbedeutung legt der Ereignis-Umschlag v2
  fest (ADR 0011).
- **`seq` ist global lückenlos** wie im Vertrag und wird unter einem Advisory-Lock vergeben; Index
  auf `meeting_id`.
- **Die Dienstrolle hat nur INSERT und SELECT.** Kein UPDATE, kein DELETE — append-only wird auf
  Datenbankebene erzwungen, nicht nur im Code.
- **Projektionen entstehen beim Start aus dem Log**; ein Snapshot ist optional. Der Rebuild von
  10 000 Ereignissen in unter fünf Minuten ist eine Pflicht der Generalprobe, kein Komfortziel.
- **Hash-Kette über alle Ereignisse**, Kettenprüfung beim Laden und nach jedem Neustart.
- **JSONL bleibt Dev-Adapter.** Die Personentabelle liegt getrennt vom Ereignislog (ADR 0009).
- **Eine Datenhaltung mit PITR, keine zweite Zone in der Beta** (E27). Backup und Restore werden
  einmal als Drill protokolliert (B3).
- **Bestände werden nie durch die Dienstrolle gelöscht.** Der Übungsbestand verschwindet, indem der
  Plattformbetreiber die getrennte Datenbank entfernt, mit Löschprotokoll (ADR 0010). Abgrenzung:
  Der Übungsbestand ist synthetisch und wird als Ganzes außerhalb der Anwendung entfernt (Plan 3,
  B15, 042); dass Rechtekonzept Abschnitt 4 (keine physische Löschung) diesen Bestand nicht
  erfasst, bestätigen Recht und DSB mit dem Rechtekonzept in 052.

## Konsequenzen

**Positiv.** Die Ereignisse sind speicherunabhängig; der Adapter ist austauschbar, ohne dass die
Domäne etwas merkt. Append-only ist mit einem Test belegbar (UPDATE/DELETE als Dienstrolle →
Berechtigungsfehler), nicht nur behauptet. Die Projektion ist jederzeit aus dem Log rekonstruierbar;
Umkodieren oder Plattformwechsel sind Dump und Restore des Logs.

**Negativ.** Ein Migrationswerkzeug mit Vorwärts- und Rückwärtslauf gegen leere und gefüllte
Datenbank, ein Service-Container in der CI und ein Drill kommen hinzu. `/readyz` prüft ab 027
Datenbank und Migrationsstand. Zwei Adapter (Postgres, JSONL) sind zu pflegen.

**Risiko.** Die Rebuild-Grenze von fünf Minuten wird in 027 als Test gemessen und im Bericht
festgehalten (Plan 5). Dass der optionale Snapshot bei Wachstum die Rebuild-Zeit trägt, ist ein
Vorschlag, nicht im Plan.

## Kosten bei Änderung

- Anderer Speicher: ein Adapter, ca. 1,5 AStd plus Migrationslauf; die Ereignisse selbst sind
  speicherunabhängig (Plan 3).
- Plattformwechsel: Datenmigration ist Dump/Restore des Ereignislogs (Plan 3, „Hosting-Plattform").
- Zweite Zone oder Hochverfügbarkeit: außerhalb dieses Plans (Leitplanken 9.3, E27).

## Verworfene Alternativen

- **Zustandsspeicher mit Auditlog und Outbox statt Ereignislog.** Entfällt: Regel 7 ist nicht
  verhandelbar; es gibt keine offene Entscheidung „Event Sourcing oder Zustand" (Leitplanken 1.3).
- **JSONL als Produktionsspeicher.** Verworfen: B3 verlangt einen Grant-gesicherten Speicher mit
  PITR und Restore-Drill; JSONL bleibt Entwicklungsadapter.
- **UPDATE- oder DELETE-Recht für die Dienstrolle** (etwa für Snapshots oder Korrekturen).
  Verworfen: Regel 7 und B3 — die Dienstrolle hat nur INSERT/SELECT (Plan 3); eine Korrektur ist ein
  neues Ereignis. Wo ein optionaler Snapshot liegt, legt der Plan nicht fest (offen).
- **Zweite Zone in der Beta.** Verworfen für die Beta: eine managed Postgres mit PITR genügt dem
  Probebetrieb (E27); die zweite Zone steht in der Restliste zu 9.3.
- **Gehostete Postgres schon für die Demo.** In ADR 0002 verworfen (Betriebsaufwand,
  Zugangsdatenrisiko); die Demo bleibt In-Process (Ergänzung zu ADR 0002).

## Nachweis

Scheibe **027** (Plan 4, Spalte „Nachweis in"): Test UPDATE/DELETE als Dienstrolle →
Berechtigungsfehler; CI-Schritt Migrationslauf grün; Rebuild-Zeit im Bericht; Hash-Kette nach
Neustart verifiziert; `curl /readyz` bei gestoppter Datenbank → 503. Dazu aus B3: Append-only-Test,
Migrationstor, Drill-Protokoll mit Zeiten (RPO/RTO-Annahme E22, Scheibe 038).

## Offene Registerzeilen

- **E27** Datenbanktopologie und Hochverfügbarkeit — Standard: eine managed Postgres mit PITR.
- **E22** RPO/RTO/SLO — Standard: RPO 0, RTO 15 min.
- **E10** Hosting-Plattform — bestimmt, wo die managed Postgres läuft (Konzernkonto oder
  gemieteter Host als Rückfall).
- **E16** Aufbewahrung und Löschung — die Spalten `retention_class` und `legal_hold` existieren;
  Fristen je Klasse und Löschverfahren sind offen, Register E16.
