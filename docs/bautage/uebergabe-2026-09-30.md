# Übergabe 2026-09-30

Für die nächste Orchestrator-Sitzung. Tagesbericht: `docs/bautage/2026-09-30.md`.

## Stand

- Integrationsbranch `claude/dax-shareholder-meeting-workflow-0s934z`, Kopf `a8ad326` (takt-032). Etappe A fertig;
  aus B gemergt: 031a, takt-030 bis takt-036 (ohne takt-034 als B-Takt: Sicherheitstakt), E56.
- **#83 031b** — Basis auf den Integrationszweig umgestellt, Bau läuft: Netz-Warteschritte durch Busy-Signale aus takt-032
  ersetzen, Halteregel unverändert. Danach PR-CI (Keycloak nur dort), Review in frischem Kontext, ADR-0002-Ergänzung durch
  den Architekten, ready, Codex, Merge.
- takt-033 ist mit Vorschlag (b) gemergt (geänderte gültige Kette: annehmen, feste Logzeile); die Eigentümerfrage bleibt
  offen und ist umkehrbar.
- Nach 031b: Zielpfad C (043 zuerst).

## Eigentümerentscheidungen (offen)

1. ~~**Bildnachweis für Keycloak-Tests**~~ — **beantwortet am 30.09.2026 (E56):** Das CI-Artefakt genügt, wenn der
   Nachweis Artefaktname, Lauf-ID, Artefakt-ID und Digest nennt (AGENTS.md R2 ergänzt). Löst die Codex-P1 auf #82 und #87.
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
