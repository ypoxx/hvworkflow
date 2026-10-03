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
- **Stand 03.10.2026:** 040a ist gebaut und gemergt (#118, `c000567`) und vom Eigentümer am 03.10.2026 nachträglich
  angenommen. Die Specs 040a bis 040d, 043a und 044a sind gemergt (044a: #120, `82ee43b`). Das nächste Ziel ist die
  Freigabe-Demo (`docs/produktplan-beta.md` Abschnitt 11, Register E57).
- **Abweichung 040a (erledigt):** Die Spec 040a verlangte zu Frage 1 vor dem ersten Bau ein ausdrückliches Go; der
  Orchestrator hatte 040a ohne dieses Go gebaut. Der Eigentümer hat am 03.10.2026 nachträglich angenommen (nach Erklärung;
  kein Superadmin, der Rollenwechsler der Demo deckt Vorführungen ab). Ein Revert von `c000567` entfällt.
- **Go zum Bau auf Standard (Eigentümer, 03.10.2026):** 043a, 040b und 044a (mit 044b) ohne Warten auf Recht; Vermerk
  „auf Standard gebaut (Go des Eigentümers 03.10.2026)"; Rechtsprüfung vor jeder echten Nutzung. 043a Fragen 1, 2, 5 und
  044a Fragen 1, 2, 3b mit dem Standard (3b = Go, 044c folgt vor jedem Pilot). 040c und 040d sind zurückgestellt.
- **Nächste Schritte:**
  - Bau 043a (läuft), dann 040b, dann 044a und 044b (044a seriell direkt nach 040b in der Lane core; 040c/d setzen später
    auf 044a auf), dann die Kette der Oberfläche: 045, 048, 053, 054, 055, 059, 046, 060, 061, 041.
  - 041 ist für die Freigabe-Demo zugeschnitten: ohne Jahrgang anlegen und Freeze (kommen mit 040c/d); Jahrgang aus dem Seed.
  - Parallel: eine Infra-Spec für das lokale Paket (Kern von 037) und die Partnerscheiben 064 bis 066.
  - Danach 038, 070, 071 und 075 samt Demoszenario „Beispieltranskript über die Schnittstelle".
  - Ablauf: Oberflächenscheiben mittleren Risikos ohne gesonderten Lesebefund der Spec, ein Review nach dem Bau (AGENTS.md Regel 3).
- **Offene Eigentümerentscheidungen:** Frage 6 (Doku ohne Spec); 040a Fragen 2a bis 2c; der vorgeschlagene Schutz
  „minimumReleaseAge" bleibt offen.
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
