# Übergabe 2026-09-30

Für die nächste Orchestrator-Sitzung. Tagesbericht: `docs/bautage/2026-09-30.md`.

## Stand

- Integrationsbranch `claude/dax-shareholder-meeting-workflow-0s934z`, Kopf `7180da3` (takt-033). Etappe A fertig;
  aus B gemergt: 031a, takt-031, takt-033, takt-034, takt-035, takt-036.
- **#82 takt-030** und **#87 takt-033b** — mergefertig bis auf Codex P1 (Screenshot nur im Artefakt). Threads offen, kein
  Merge ohne Eigentümerentscheidung 1. Beide mergen konfliktfrei auf `7180da3`; vor dem Merge Basis einbringen und Gates
  auf dem integrierten Commit. In #87 kann der Dev-Zweig von H10 entfallen, seit takt-035 gemergt ist.
- **#86 takt-032** — Nachprüfung bestanden, gestapelt auf takt-030. Nach #82: Basis auf den Integrationszweig, Gates auf dem
  integrierten Commit, ready, Codex, Merge.
- **#83 031b** — Entwurf, Basis vorläufig takt-030. Wartet auf takt-032 und takt-033b; danach warten die Tests auf das
  Busy-Signal aus takt-032, `/stage` < 1500 ms bleibt. ADR-0002-Ergänzung schreibt der Architekt nach grüner CI.
- takt-033 ist mit Vorschlag (b) gemergt (geänderte gültige Kette: annehmen, feste Logzeile); die Eigentümerfrage bleibt
  offen und ist umkehrbar.

## Eigentümerentscheidungen (offen)

1. **Bildnachweis für Keycloak-Tests:** PNG aus dem CI-Artefakt übernehmen (Eigentümer lädt herunter und committet) oder
   Regel „Artefakt mit Lauf-ID und Digest genügt für Tests, die nur mit Keycloak laufen“. Hält #82 (Codex P1).
2. **E41 Leistungsziel D9:** vorläufig gilt die bestehende e2e-Grenze 1500 ms für `/stage` und die Antwortliste.
3. **`e2e-http` als Pflicht-Check** (danach 029b aus `gates` verlegen).
4. Aus früheren Berichten weiter offen: E55 (Patch-Stufe strengerer Anfrageschemas), ADR-0015-Nachtrag, Netlify Deploy
   Previews und Branch Deploys auf „None“ (nur vorgeschlagen, nichts geändert), Admin-Selbstzuweisung im
   Entscheidungsregister, Token-Abrechnung, 031b-Frage zum ADR-0002-Umfang (Standard: fünf gemeinsame Dateien).

## Betrieb der Bauumgebung

- Postgres-16-Cluster `/var/tmp/pgtest/data`; nach Container-Neustart
  `rm -f /var/tmp/pgtest/data/postmaster.pid` und
  `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pgtest/data -l /var/tmp/pgtest/log start"`. Rollen `hv_owner`/`hv_runtime` (Passwörter nur lokal, Testwerte).
- Kein Docker lokal: Keycloak-Tests (H4–H9, 029b, das `http`-Projekt der gemeinsamen Dateien) laufen nur in der PR-CI.
- Harness-Port 18091: belegt → abbrechen, nie fremde Prozesse beenden; Implementierer und Reviewer nicht gleichzeitig
  e2e fahren lassen.
- Nach e2e nie `git add -A`; Screenshots mit `git restore docs/evidence` zurücksetzen.
