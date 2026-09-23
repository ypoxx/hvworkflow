# ADR 0010 — Pilotmodus und Übungsbetrieb

**Status:** vorgeschlagen · **Datum:** 23.09.2026 · **Entscheider:** Projektleitung (Pilotmodus, E12); Eigentümer und DSB (Plattform des Übungsmandanten, E10b); Projektleitung und Eigentümer (Vorprobe, E49) · **Annahme:** Prüfpunkt 3 (Plan 4)

## Kontext

Die Beta wird in einer Generalprobe mit echten Personen geübt (B15), aber sie darf nicht führend
sein: das bisherige Verfahren bleibt maßgeblich, bis Mitbestimmung, DSFA und Rechtsprüfung
abgeschlossen sind (E13, E14, E15). Übungsbestände müssen danach nachweislich verschwinden, ohne
dass die Dienstrolle je löscht (Regel 7). Frage an die Projektleitung: Bestätigung, dass die Beta in
der Generalprobe im Schatten läuft (E12).

## Entscheidung

Standardannahme aus Plan 3 („Pilotmodus") und Plan 4 (Zeile 0010):

- **`HV_MODE = training | shadow | live`** als Konfiguration. Alle drei Modi laufen auf derselben
  Software.
- **Banner je Modus**, eigene Datenbank je Modus, **Podium-Push nur in `live`**, **Seed nur in
  `training`**; in `shadow` steht „nicht führend" im Kopf.
- **Die Beta ist Schattenbetrieb** in der Generalprobe und nie führend. Tochter-HV oder „führend mit
  Papier-Fallback" bleiben der Produktionsstufe vorbehalten.
- **Übungsmandant:** menschlich betrieben, Banner „Generalprobe", ausschließlich synthetische
  Fragen, ohne Podium-Push.
- **Löschung des Übungsbestands:** der Plattformbetreiber entfernt die getrennte Datenbank, ein
  Skript erzeugt das Löschprotokoll; nie Löschen durch die Dienstrolle. Abgrenzung: der
  Übungsbestand ist synthetisch und wird als Ganzes außerhalb der Anwendung entfernt (Plan 3, B15,
  042); ob Rechtekonzept Abschnitt 4 (keine physische Löschung) diesen Bestand erfasst, legt
  der Plan nicht fest: offen (E16), Frage an Recht und DSB mit dem Rechtekonzept aus 052.
- **Sandbox für Partner** ist der Modus `training` mit synthetischem Korpus (ADR 0008).
- Kleinänderungen erreichen den Übungsmandanten nur außerhalb des Freeze (Plan 3, „Taktfläche").

## Konsequenzen

**Positiv.** Der Modus ist Konfiguration; die organisatorische Vorbereitung ist der eigentliche
Aufwand. Die Generalprobe erzeugt keinen führenden Bestand, der Aufbewahrungsfragen aufwirft; das
Löschprotokoll ist ein Nachweis für B15 und den DSB.

**Negativ.** Drei Datenbanken; Trainingsdaten und Probebestand dürfen sich nie mischen. Der
Übungsmandant hängt an der Plattformentscheidung (E10b) und am Identitätsmodell der Probe (E13);
im Rückfall gelten B1, B6, B9 und B15 nur mit Einschränkung (B18).

**Risiko.** Ein Podium-Push aus einem Nicht-live-Modus. Plan 3 und Plan 4 legen „Podium-Push nur in
live" fest; 042 weist Banner, Seed-Sperre und Löschprotokoll nach. Vorschlag (nicht im Plan): ein
eigener Test der Push-Sperre.

## Kosten bei Änderung

- Moduswechsel: Konfiguration; die organisatorische Vorbereitung ist der Aufwand (Plan 3).
- Rückfall des Übungsmandanten: gemieteter Host plus Keycloak-Realm mit gepoolten
  Stationsidentitäten, AVV vom Umsetzer, DSB informiert (E10b, E13).

## Verworfene Alternativen

- **Beta als führendes System** (Tochter-HV oder führend mit Papier-Fallback). Verworfen: der
  Produktionsstufe vorbehalten; der Termin der Mitbestimmung blockiert den Produktivstart, nicht die
  Beta (Plan 3).
- **Eine Datenbank mit Modus-Kennzeichen.** Verworfen: eigene Datenbank je Modus, damit Löschung
  das Entfernen der Datenbank ist und kein Löschen im Log.
- **Löschung durch die Dienstrolle.** Verworfen: Regel 7; die Dienstrolle hat nur INSERT/SELECT
  (ADR 0003).
- **Podium-Push im Übungs- oder Schattenmodus.** Verworfen: B15 (ohne Podium-Push in den
  Übungsmodus).
- **Vorprobe im Januar.** Keine; Option mit fünf bis zehn Personen nur bei Klarheit zu E13 (E49).

## Nachweis

Scheibe **042** (Plan 4): Test „seed im Modus live → 403"; Screenshot Banner je Modus;
Löschprotokoll-Trockenlauf. Aus B15: Löschprotokoll des Übungsbestands nach der Generalprobe,
Generalprobe-Protokoll.

## Offene Registerzeilen

- **E12** Pilotmodus — Bestätigung des Schattenbetriebs.
- **E10b** Plattform des Übungsmandanten.
- **E13** Mitbestimmung und Identitäten in der Probe.
- **E49** Vorprobe im Januar.
