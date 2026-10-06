# Übergabe 2026-10-06

Für die nächste Orchestrator-Sitzung. Vorgänger: `docs/bautage/uebergabe-2026-10-05.md`. Nur Dokumentation; kein Code.

## Stand

- Integrationsbranch `claude/dax-shareholder-meeting-workflow-0s934z`, Kopf am Abend `bf1b3bb` (takt-054, #174).
- Die Oberflächenkette der Freigabe-Demo (Register E57: 045 → 048 → 053 → 054 → 055 → 055b → 059 → 046 → 060 → 061 → 041)
  ist mit diesem Tag gebaut; 046, 060 und 041 jeweils als erster Teil, die Folgeteile stehen als eigene Planzeilen im Plan.
- Vertrag: 0.4.5 (061 Teil A), 0.4.6 (046). 055c braucht die nächste Vertragsversion.

## Gemergt am 06.10.2026

Alle als Squash auf dem Integrationsbranch, in dieser Reihenfolge:

- #165 `924266a` takt-050 (kurz nach Mitternacht): 010b Runde 4 lädt die App-Module ohne wartendes Evaluate.
- #167 `adde77b` takt-051: Audit-Ausnahme für `source-map-js` (GHSA-68fv-2mgg-jv7q) bis 14.10.2026.
- #166 `c68f781` 041: Verwaltung `/admin`, erster Schnitt für die Freigabe-Demo (Fachbereiche, Tagesordnung, Bühnenplätze,
  Rollenzuordnungen mit Fachbereich und Ablauf, Rollenkarten, Anleitung v1). Anlegen, Freeze, Override, Start und
  Vertretungen gehen an 041b.
- #168 `68c87d9` 061 Teil A: Leitstand-Kern (`getMeetingCockpit`, Recht `cockpit.read`, Bericht „leitstand“; Vertrag 0.4.5).
- #169 `fd6ebd7` 046: Nachfragen als Threads (Bezug zur Ausgangsfrage und zur gehörten Antwortversion, „Nachfrage zu F-n“ mit
  Alt+B in der Erfassung, Thread in der Historie; R-LINK-01/02; Vertrag 0.4.6).
- #171 `84fbfe3` takt-053: das Demo-Protokoll wird beim Verlassen der Seite sofort geschrieben (der Befund aus 060 ist damit erledigt).
- #172 `6441faa` 061 Teil B: Leitstand-Seite `/cockpit` mit Hauptwert, Stationen, Rückstand je Fachbereich, Zulauf und Faden.
- #170 `f05f4b6` 060: Entwurfspuffer der Fokusansicht und der Beantwortung, Wiederherstellen nach Neuladen,
  „Fassungen vergleichen“.
- #174 `bf1b3bb` takt-054: die Erfassung zeigt kein leeres Formular, solange der Redebeitrag lädt; `e2e-http` grün auf
  `54e84ad` (Lauf 37480797979, Job 112328786290), der neue Fall lief im Projekt http.

**Offen als PR:** takt-052 (Seed-Zeiten über die 90 min vor Demostart verteilt) in PR #173, wird gesondert gemergt. Erst danach
zeigt der Leitstand in der Demo einen verteilten Zulauf und unterschiedliche Alter.

Review-Befunde (Minor, Nit) stehen in `docs/folgeliste.md`, Abschnitte „Nachfragen-Threads (aus 046)“, „Verwaltung (aus 041)“,
„Leitstand (aus 061)“, „Entwurfspuffer und Fassungsvergleich (aus 060 Bau)“, „Seed-Zeiten (aus takt-052, PR #173 offen)“ und
neu oben „Vor Rollout“.

## Demo-Stand

Die Browser-Demo zeigt jetzt zusätzlich (Zusatzszenen in `docs/demo-skript.md`):

- **Verwaltung** `/admin` in der Rolle Administration.
- **Nachfragen:** Alt+B in der Erfassung, Dialog „Bezug setzen“, danach der Thread in der Historie.
- **Entwurf:** ungespeicherter Text übersteht ein Neuladen („Ungespeicherter Entwurf von HH:MM wiederhergestellt“).
  „Fassungen vergleichen“ braucht zwei Personen mit gemeinsamem Stand, also das lokale Dienstpaket; in der Browser-Demo hat
  jedes Fenster seinen eigenen Stand.
- **Leitstand** `/cockpit` in den Rollen Koordination, Versammlungsbüro oder Administration; vom Hauptwert „Älteste offene
  Einzelfrage“ über „Faden öffnen“ zu den Stationen dieser Einzelfrage.

Bis PR #173 gemergt ist, liegen die Zeiten des Demo-Korpus fast alle auf dem Zeitpunkt des Zurücksetzens (eine Zulauf-Säule,
gleiche Uhrzeiten im Faden). Deployment weiter nur aus der Pipeline und nur auf ausdrückliches Go des Eigentümers.

## Fragen an den Eigentümer

Gesammelt; alle Scheiben sind auf Standard gebaut, keine Frage hält einen Merge auf.

1. **Präsenz und Übernahmen (060b, E13/E36).** Eine Präsenzanzeige über Übernahmen schreibt bei jeder Übernahme, Verlängerung
   und Rückgabe ein Ereignis, das die Historie mit Akteur und Zeit zeigt: ein benanntes Tätigkeitsprotokoll. Optionen aus
   Spec 060, Frage 1: (a) Übernahmen nicht in der Historie zeigen (das Ereignis bleibt, Regel 7), (b) hinnehmen und so dem
   Betriebsrat vorlegen, (c) Präsenz nicht bauen. **060b startet erst nach der Antwort.**
2. **E4 Notizfeld** je Einzelfrage: bleibt Standard „aus“; 046d wird erst nach Antwort oder ausdrücklichem Go gebaut, mit
   Vermerk zur DSFA-Zeile V17.
3. **Schwellen und Zulauf-Fenster des Leitstands (061):** Stufen „erhöht“/„kritisch“ für das Alter der ältesten offenen
   Einzelfrage (15/45 min), für „Legal Clearing über 10 min“ (3/10 Einzelfragen) und für den Rückstand je Fachbereich (20/40);
   Zulauf in Fünf-Minuten-Säulen über die letzte Stunde (`COCKPIT_THRESHOLDS` in `packages/domain/src/cockpit.ts`). Gebaut auf
   Standard; passen die Werte und die Säulenbreite?
4. **Rechtsblick „Formatänderung hebt die Freigabe auf“** (055, Entscheidung 05.10.2026): empfohlen, weiter nicht erfolgt.
5. **Aufbewahrungsklasse an die DSB:** `QuestionForwarded`, `QuestionAssigned` (seit 05.10. offen) und neu
   `QuestionCaptured`/`QuestionLinked` (046): `working` im Code, `record` in DSFA-Zeile V3.
6. **CSP der Webseite (037b) und Rollout-Go:** vor jeder geteilten Umgebung die CSP; danach ein ausdrückliches Go für den Rollout.

## Vor Rollout (Sicherheit und Leistung)

- **`listEvents` ohne Akteurschutz** (`apps/web/src/api/liveStore.ts:526`): eine vor einem Personenwechsel angeforderte
  Ereignisseite kann die neue Person erreichen, gleiches Muster wie Codex P1 auf #168. Eigener Takt: über `guarded()` leiten,
  die Schleife in `history/lib.ts` beachten.
- **Zwischenspeicher des Leitstands:** W10 auf dem CI-Läufer 57,7 ms gegen das Ziel 50 ms (Lauf 37468958219); der
  Stolperdraht warnt nur. Zwischenspeicher nach Vor-dem-Bau-Punkt 5 der Spec 061 bauen, danach die Warnung wieder als Fehler.
- **`source-map-js` 1.2.2:** nach 2026-10-07T14:08Z anheben und die Ausnahme 1241209 entfernen, bevor sie am 2026-10-14 abläuft.

## Offen

- **`e2e-http`-Laufzeit:** mit 060 und 061 7:24–7:35, über der Warnschwelle 6:30, unter der Grenze 12:00. Die Entscheidung
  „Job teilen“ aus takt-046 ist fällig, vor der nächsten Scheibe mit neuer `e2e-http`-Datei.
- Statuszeilen der Specs 041, 046, 061 (noch „spec“), 060 („Design-Kritik und Review offen“) und takt-051 („spec“) sind
  nicht nachgezogen; Statuswechsel auf „angenommen“ macht der Orchestrator.
- Register: Eigentümerfragen aus 046 (Q1–10) und 060 (Q1–6) sowie die Kette E57 mit 046b sind noch nicht im
  `docs/entscheidungsregister.md` eingetragen.
- Spec 033b: Statuszeile steht noch auf „spec“ (gemergt `115c28b`).
- 055c (nummerierte Listen): Spec zuerst, Klasse hoch.

## Nächste Schritte (Reihenfolge)

1. PR #173 (takt-052) mergen, sobald CI grün ist.
2. Takt `listEvents` mit Akteurschutz (Sicherheit, vor Rollout).
3. Ab 2026-10-07T14:08Z: `source-map-js` 1.2.2, Ausnahme entfernen.
4. Takt `e2e-http` teilen (Entscheidung aus takt-046).
5. Takt Zwischenspeicher des Leitstands (W10).
6. Danach nach Antworten des Eigentümers: 046b, 046c, 061b, 060c; 060b nach Frage 1, 046d nach E4; 041b nach 040c/040d;
   055c; 089b nach 041.
