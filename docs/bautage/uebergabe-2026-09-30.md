# Übergabe 2026-09-30

Für die nächste Orchestrator-Sitzung. Tagesbericht: `docs/bautage/2026-09-30.md`.

## Stand

- Integrationsbranch `claude/dax-shareholder-meeting-workflow-0s934z`, Kopf `bdcfb9e` (takt-034). Etappe A fertig; 031a gemergt.
- **#82 takt-030** — mergefertig bis auf Codex P1 (Screenshot H9 nur im Artefakt `evidence-031-http`, zuletzt ID
  11074530002 aus Lauf 36660269666). Thread offen, kein Merge ohne Eigentümerentscheidung.
- **#83 031b** — Entwurf, Basis vorläufig `claude/takt-030-eigene-schreibvorgaenge`. `gates` dort rot nur durch
  `slice-scope` (gestapelt). Nach Merge von #82: Basis auf den Integrationszweig umstellen, Basis einmergen, Gates auf
  dem integrierten Commit. Fachlich wartet 031b auf takt-032 und takt-033; danach warten die Tests auf das Busy-Signal
  aus takt-032 statt auf Netzantworten. ADR-0002-Ergänzung schreibt der Architekt nach grüner CI.
- **takt-032 / takt-033 / takt-033b** — Specs fertig; takt-033 (Dienst, hoch) im Bau mit Opus, takt-032 (Web, mittel,
  gestapelt auf takt-030) im Bau; takt-033b (kein Doppelabruf beim Einhängen, mittel) folgt. Offene Eigentümerfrage aus
  takt-033: Verhalten bei geänderter oder gekürzter, aber gültiger Kette (gebaut wird Vorschlag b: annehmen und feste
  Logzeile).

## Eigentümerentscheidungen (offen)

1. **Bildnachweis für Keycloak-Tests:** PNG aus dem CI-Artefakt übernehmen (Eigentümer lädt herunter und committet) oder
   Regel „Artefakt mit Lauf-ID und Digest genügt für Tests, die nur mit Keycloak laufen“. Hält #82 (Codex P1).
2. **E41 Leistungsziel D9:** vorläufig gilt die bestehende e2e-Grenze 1500 ms für `/stage` und die Antwortliste.
3. **`e2e-http` als Pflicht-Check** (danach 029b aus `gates` verlegen).
4. Aus früheren Berichten weiter offen: E55 (Patch-Stufe strengerer Anfrageschemas), ADR-0015-Nachtrag, Netlify Deploy
   Previews und Branch Deploys auf „None“ (nur vorgeschlagen, nichts geändert), Admin-Selbstzuweisung im
   Entscheidungsregister, Token-Abrechnung, 031b-Frage zum ADR-0002-Umfang (Standard: fünf gemeinsame Dateien).

## Betrieb der Bauumgebung

- Postgres-16-Cluster `/var/tmp/pgtest/data`; nach Container-Neustart `postmaster.pid` löschen und mit
  `pg_ctl -l /var/tmp/pgtest/log start` starten. Rollen `hv_owner`/`hv_runtime` (Passwörter nur lokal, Testwerte).
- Kein Docker lokal: Keycloak-Tests (H4–H9, 029b, das `http`-Projekt der gemeinsamen Dateien) laufen nur in der PR-CI.
- Harness-Port 18091: belegt → abbrechen, nie fremde Prozesse beenden; Implementierer und Reviewer nicht gleichzeitig
  e2e fahren lassen.
- Nach e2e nie `git add -A`; Screenshots mit `git restore docs/evidence` zurücksetzen.
