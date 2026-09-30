# Übergabe 2026-09-30

Für die nächste Orchestrator-Sitzung. Tagesbericht: `docs/bautage/2026-09-30.md`.

## Stand

- Integrationsbranch `claude/dax-shareholder-meeting-workflow-0s934z`, Kopf `eb6d7c3` (035b). Etappe A ist fertig.
  Aus Etappe B sind fertig:
  - Scheibe 031 (031a, 031b, takt-030 bis takt-037);
  - 035a (#102);
  - takt-039 (#104);
  - 036a (#106, Live-Store);
  - takt-040 (#108, Vertrag 0.3.12);
  - takt-038 (#109, Historie paginiert);
  - 035b (#107, SSE-Dienst `GET /v1/stream`, ADR-0014-Nachtrag).
  E56 gilt.
- **Berichtigung (bleibt):** Die Takte takt-035 und takt-036 sind nicht die Plan-Scheiben 035 und 036.
- **Offen in Zielpfad B: nur 036b** (Strom-Client, Verbindungsanzeige, zweiter Browser; Risiko hoch). Der Bau läuft mit
  Opus in `/home/user/wt/s036b`, Branch `claude/slice-036b-strom-client`, Basis `eb6d7c3`.
  - Danach: Review in frischem Kontext (Security und Resilienz), PR, CI mit H11/H12 im Projekt `http`, ready, Codex,
    Merge.
  - Der Bericht-Abschnitt der Spec muss vor ready ausgefüllt sein.
- **Danach Zielpfad C** (043 zuerst). D (064–066) darf nach 043 parallel zum Rest von C laufen
  (`docs/produktplan-beta.md`, Abschnitt Zielpfad).
- **Offene Punkte aus 035b auf der Folgeliste (nicht sicherheitsrelevant):**
  - Worst-Phase-Latenznachweis (gehört zu Lasttest 071);
  - der ungetestete `hub.loaded()`-Zweig;
  - eine Stichprobe von Test 28 unter Last;
  - 034a-Zeitfenster unter Last.
- takt-033 ist mit Vorschlag (b) gemergt (geänderte gültige Kette: annehmen, feste Logzeile). Die Eigentümerfrage bleibt
  offen und ist umkehrbar.

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
