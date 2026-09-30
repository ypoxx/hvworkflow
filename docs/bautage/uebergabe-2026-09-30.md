# Übergabe 2026-09-30

Für die nächste Orchestrator-Sitzung. Tagesbericht: `docs/bautage/2026-09-30.md`.

## Stand

- Integrationsbranch `claude/dax-shareholder-meeting-workflow-0s934z`, Kopf `f702822` (Spec 036b). Etappe A fertig;
  Scheibe 031 fertig (031a, 031b, alle Takte aus der 031b-Diagnose: takt-030 bis takt-037). E56 gilt.
- **Berichtigung:** Die früheren Takte takt-035 (Produktions-Build) und takt-036 (Katalog-Rennen) sind **nicht** die
  Plan-Scheiben 035 (SSE-Strom) und 036 (Live-Store und Strom-Client). Zielpfad B endet erst mit den Plan-Scheiben 035
  und 036; die frühere Zeile „Nach 031b: Zielpfad C“ war falsch.
- Plan-Scheiben 035/036 sind in vier Specs geteilt, alle gemergt: 035a Domäne und Vertrag (#96), 035b Dienst (#97),
  036a Live-Store (#98), 036b Strom-Client (#99); dazu takt-038 Historie paginiert (#100). Alle Risiko hoch außer
  takt-038 (mittel).
- **Bau 035a läuft** auf `claude/slice-035a-sse-domaene-vertrag`: zuerst Vertrag 0.3.11 (Architekt), dann Domänenteil
  (Opus-Implementierer, Tests zuerst), Review in frischem Kontext (Opus), Entwurfs-PR, CI, ready, Codex, Merge.
- Reihenfolge danach: 035b und 036a (036a braucht nur 035a) → 036b; takt-038 nach 036a. Danach Zielpfad C (043 zuerst),
  dann D (064–066).
- takt-033 ist mit Vorschlag (b) gemergt (geänderte gültige Kette: annehmen, feste Logzeile); die Eigentümerfrage bleibt
  offen und ist umkehrbar.

## Eigentümerentscheidungen (offen)

1. ~~**Bildnachweis für Keycloak-Tests**~~ — **beantwortet am 30.09.2026 (E56):** Das CI-Artefakt genügt, wenn der
   Nachweis Artefaktname, Lauf-ID, Artefakt-ID und Digest nennt (AGENTS.md R2 ergänzt). Löst die Codex-P1 auf #82 und #87.
2. **E41 Leistungsziel D9:** vorläufig gilt die bestehende e2e-Grenze 1500 ms für `/stage` und die Antwortliste.
3. **`e2e-http` als Pflicht-Check** (danach 029b aus `gates` verlegen).
4. Aus früheren Berichten weiter offen: E55 (Patch-Stufe strengerer Anfrageschemas), ADR-0015-Nachtrag, Netlify Deploy
   Previews und Branch Deploys auf „None“ (nur vorgeschlagen, nichts geändert), Admin-Selbstzuweisung im
   Entscheidungsregister, Token-Abrechnung, 031b-Frage zum ADR-0002-Umfang (Standard: fünf gemeinsame Dateien).
5. Aus den Specs 035/036 (Standards in den Specs festgelegt, noch nicht gebaut, umkehrbar): 035a Frage 1 Freigabe der Sichtbarkeitstabelle R-PERM-04;
   035b Frage 1 der Neuaufbau des Stroms alle 25 min verlängert das Leerlauffenster der Sitzung (Standard: hinnehmen);
   035b Frage 2 Aktivitätsvolumen über `id`-Sprünge und Zeitpunkte (Standard: hinnehmen wie die Zähler); 035b Frage 3
   Produktionsweg für `text/event-stream` über Netlify bzw. Konzern-Proxy und HTTP/2 (Standard: Polling-Rückfall aus
   036b, Prüfung beim ersten Staging-Deploy); 036a Frage 1 ADR 0014 gezieltes Ungültigmachen statt Deltasichten
   (Standard: Ungültigmachen).

## Betrieb der Bauumgebung

- Postgres-16-Cluster `/var/tmp/pgtest/data`; nach Container-Neustart
  `rm -f /var/tmp/pgtest/data/postmaster.pid` und
  `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pgtest/data -l /var/tmp/pgtest/log start"`. Rollen `hv_owner`/`hv_runtime` (Passwörter nur lokal, Testwerte).
- Kein Docker lokal: Keycloak-Tests (H4–H9, 029b, das `http`-Projekt der gemeinsamen Dateien) laufen nur in der PR-CI.
- Harness-Port 18091: belegt → abbrechen, nie fremde Prozesse beenden; Implementierer und Reviewer nicht gleichzeitig
  e2e fahren lassen.
- Nach e2e nie `git add -A`; Screenshots mit `git restore docs/evidence` zurücksetzen.
