# Übergabe 2026-09-30

Für die nächste Orchestrator-Sitzung. Tagesbericht: `docs/bautage/2026-09-30.md`.

## Stand

- Integrationsbranch `claude/dax-shareholder-meeting-workflow-0s934z`, Kopf `c000567` (040a; zuvor `ca94899`, 036b). **Etappe A und Etappe B
  sind fertig:**
  - 031 (031a, 031b, takt-030 bis takt-037);
  - 035a (#102), 035b (#107), 036a (#106), 036b (#111);
  - takt-038 (#109), takt-039 (#104), takt-040 (#108, Vertrag 0.3.12).

  E56 gilt.
- **Offen aus B:**
  - Lasttest 071 (B11-Nachweis in der ungünstigsten Phase);
  - Produktionsweg für `text/event-stream` (035b Frage 3, Standard: Polling-Rückfall aus 036b, Prüfung beim ersten
    Staging-Deploy).
- **Stand 01.10.2026:** 040a ist gebaut und gemergt (#118, `c000567`); die Specs 040a bis 040d und 043a sind gemergt;
  die Spec 044 ist in Arbeit, danach 045 und 041. Der Bau von 043a und 040b bis 040d wartet auf das Go des Eigentümers.
  Offene Eigentümerentscheidungen unverändert: 043a Fragen 1, 2 und 5; 040 Teilung und Budget für den Bau von 040b bis
  040d; Frage 6 (Doku ohne Spec); 040a Fragen 1 und 2a bis 2c.
- **Zielpfad C beginnt mit 043** (Vertragspaket 0.4.0).
  - Die Spec schreibt der Architekt (Opus) in `/home/user/wt/spec043`, Branch `claude/spec-043-vertrag-040`, mit einem
    Vorschlag zur Teilung.
  - 043 kommt vor der Feedback-Runde 2 (09.10.) und der Entscheidungsstunde (16.10.). Unbeantwortete Punkte werden auf
    Standard gebaut und mit Datum vermerkt, wie der Plan es vorsieht; spätere Antworten kosten eine Enum-, Tabellen-
    oder Vertragsänderung.
  - D (064–066) darf nach 043 parallel zum Rest von C laufen.
- takt-033 ist mit Vorschlag (b) gemergt; die Eigentümerfrage bleibt offen und ist umkehrbar.

## Eigentümerentscheidungen (offen)

1. ~~**Bildnachweis für Keycloak-Tests**~~ — **beantwortet am 30.09.2026 (E56):** Das CI-Artefakt genügt, wenn der
   Nachweis Artefaktname, Lauf-ID, Artefakt-ID und Digest nennt (AGENTS.md R2 ergänzt). Löst die Codex-P1 auf #82 und #87.
2. **E41 Leistungsziel D9:** vorläufig gilt die bestehende e2e-Grenze 1500 ms für `/stage` und die Antwortliste.
3. **`e2e-http` als Pflicht-Check** (danach 029b aus `gates` verlegen).
4. Aus früheren Berichten weiter offen: E55 (Patch-Stufe strengerer Anfrageschemas), ADR-0015-Nachtrag, Netlify Deploy
   Previews und Branch Deploys auf „None“ (nur vorgeschlagen, nichts geändert), Admin-Selbstzuweisung im
   Entscheidungsregister, Token-Abrechnung, 031b-Frage zum ADR-0002-Umfang (Standard: fünf gemeinsame Dateien).
5. Aus den Specs 035/036 (Standards in den Specs festgelegt, umkehrbar; mit 035b und 036a sind alle Standards bis auf
   den Polling-Rückfall aus 036b gebaut): 035a Frage 1 Freigabe der Sichtbarkeitstabelle R-PERM-04;
   035b Frage 1 der Neuaufbau des Stroms alle 25 min verlängert das Leerlauffenster der Sitzung (Standard: hinnehmen);
   035b Frage 2 Aktivitätsvolumen über `id`-Sprünge und Zeitpunkte (Standard: hinnehmen wie die Zähler); 035b Frage 3
   Produktionsweg für `text/event-stream` über Netlify bzw. Konzern-Proxy und HTTP/2 (Standard: Polling-Rückfall aus
   036b, Prüfung beim ersten Staging-Deploy); 036a Frage 1 ADR 0014 gezieltes Ungültigmachen statt Deltasichten
   (Standard: Ungültigmachen).
6. **Brauchen Tagesberichte eine Spec?** Codex hielt das auf #105 als P1 fest. Ich habe es abgelehnt: R1 („no slice
   without a spec“) betrifft Scheiben mit Code, Tagesberichte und Übergaben sind Orchestrator-Doku ohne Scope. Das ist
   meine Auslegung und umkehrbar; eine Entscheidung des Eigentümers würde die Frage für Codex beenden.

## Betrieb der Bauumgebung

- Postgres-16-Cluster `/var/tmp/pgtest/data`; nach Container-Neustart
  `rm -f /var/tmp/pgtest/data/postmaster.pid` und
  `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pgtest/data -l /var/tmp/pgtest/log start"`. Rollen `hv_owner`/`hv_runtime` (Passwörter nur lokal, Testwerte).
- Kein Docker lokal: Keycloak-Tests (H4–H9, 029b, das `http`-Projekt der gemeinsamen Dateien) laufen nur in der PR-CI.
- Harness-Port 18091: belegt → abbrechen, nie fremde Prozesse beenden; Implementierer und Reviewer nicht gleichzeitig
  e2e fahren lassen.
- Nach e2e nie `git add -A`; Screenshots mit `git restore docs/evidence` zurücksetzen.
