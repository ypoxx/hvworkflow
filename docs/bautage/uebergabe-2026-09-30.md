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
  die Spec 044a ist gemergt (#120, `82ee43b`; Teilung 044a/044b vorgeschlagen). Der Bau von 043a und 040b bis 040d wartet auf das Go des Eigentümers.
  Offene Eigentümerentscheidungen unverändert: 043a Fragen 1, 2 und 5; 040 Teilung und Budget für den Bau von 040b bis
  040d; Frage 6 (Doku ohne Spec); 040a Fragen 1 und 2a bis 2c; 044a Fragen 1, 2 und 3b vor dem Bau.
- **Abweichung 040a (offen beim Eigentümer):** Die Spec 040a verlangt zu Frage 1 vor dem ersten Bau ein ausdrückliches Go
  (`docs/slices/040a-admin-ohne-inhaltsrechte.md`, „Offene Eigentümerfragen“). Der Orchestrator hat 040a ohne dieses Go
  gebaut und gemergt; er hatte es dem Eigentümer vorher angekündigt (Begründung: Inhalt folgt aus Rechtekonzept §4,
  schließt eine Sicherheitslücke, 1,5 AStd im Planbudget von 2,5), eine Zustimmung lag aber nicht vor. Der Eigentümer
  entscheidet nachträglich: annehmen, oder Revert des Squash-Commits `c000567` (ein Commit, nicht ausgeliefert).
- **Nächste Schritte Zielpfad C:**
  - Spec 044a ist gemergt. Bau 044a erst nach dem Bau von 043a **und von 040b bis 040d** (gleiche Kern-Lane, die
    Wahrheitstabelle ist ein Snapshot; 044a baut seriell danach) und nach den Eigentümerfragen 1, 2 und 3b; ADR 0012 und
    der Verweigerungskatalog gehen vorher an Recht. Die Spec 044b schreibt der Architekt nach dem Go zur Teilung.
  - **044c (Untergründe für Pfad A, Rechtekonzept §4, Recherche Z.63)** je nach Frage 3b: bei Go eine eigene Scheibe 044c
    nach der Antwort von Recht und vor dem Pilot (rund 0,75 AStd, additiver Vertragsschritt); bei No-go wartet 044a, bis
    Recht die Untergründe benennt, dann werden 044a und 044c zusammen gebaut (+0,75 AStd in 044a, Vertragsschritt als
    erster Commit). In keinem Fall bleibt die Lücke offen (044a, Eigentümerfrage 3b).
  - Danach die Specs 045 und 041; beide hängen an offenen Antworten (044a, 040) und werden erst danach geschrieben.
  - Bau 043a und 040b bis 040d erst nach dem Go des Eigentümers. Unbeantwortete Punkte werden auf Standard gebaut und mit
    Datum vermerkt; spätere Antworten kosten eine Enum-, Tabellen- oder Vertragsänderung.
  - D (064–066) darf nach dem Bau von 043a parallel zum Rest von C laufen.
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
