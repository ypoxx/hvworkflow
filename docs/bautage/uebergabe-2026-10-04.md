# Übergabe 2026-10-04

Für die nächste Orchestrator-Sitzung. Tagesbericht: `docs/bautage/2026-10-04.md`.

## Stand

- Integrationsbranch `claude/dax-shareholder-meeting-workflow-0s934z`, Kopf `7405efb` (Scheibe 048, #142).
- **Gemergt heute:** Spec 048 (#141 `e2e1432`), Scheibe 037a (#129 `5d89ad7`, S17 vom Eigentümer so angenommen),
  Scheibe 048 (#142 `7405efb`, auf Standard, Go des Eigentümers 04.10.2026). Die Specs stehen auf „angenommen“.
- **Specs gemergt, Bau offen:** 064a (#126), 064b (#127), 065a (#128).
- Offene PRs außer der Spec-Arbeit zu 053: keine bekannte.

## Nächster Schritt

**Scheibe 053** (Steuerungsansicht der Koordination): Die Spec läuft. Danach in dieser Reihenfolge 054, 055, 059, 046, 060,
061 und 041 (Plan Abschnitt 11, Register E57). 048b (Auskunftsschuldner) ist nur eine Skizze; die Inhaltssprache gehört zu
055 (E21).

## Eigentümerentscheidungen (offen)

1. **E5 inhaltlich:** Bedeutung von „Weiterleiten“. Gebaut ist der Standard (beides: Anzeige aus 020 und Weiterleiten an
   einen anderen Fachbereich aus 048). Das Register behält E5 offen.
2. **Aufbewahrungsklasse für den DSB** bei `QuestionForwarded` und `QuestionAssigned`: Welche Klasse gilt, solange die
   Ereignisse Einheiten, aber keine Personen nennen?
3. **048b:** Semantik des Auskunftsschuldners (genau eine Person oder Funktion, getrennt vom Bühnenplatz).
4. Aus der Übergabe vom 03.10. weiter offen: 064 (E3a, Teilung, Budget), 065 (Teilung, Budget, Partnertexte, `HV_MODE`),
   044b Fragen 1 und 2 (Standards gebaut), `minimumReleaseAge`, Frage 6 (Doku ohne Spec), 040a Fragen 2a bis 2c, E41,
   `e2e-http` als Pflicht-Check, E55. 037a S17 ist erledigt.

## Offene Reste im Remote

- Veraltete Remote-Branches `claude/slice-045` und `claude/slice-045-verweigerung-oberflaeche` (beide identisch auf
  `42fc573`, enthalten den alten Gitleaks-Befund). Das Löschen ist durch den Hook gesperrt; der Eigentümer kann sie von
  Hand löschen.

## Betrieb der Bauumgebung

- **Neustart der Maschine über Nacht:** Danach war der System-Cluster aus. Vor jedem Gates-Lauf `pg_lsclusters` prüfen und
  bei Bedarf `pg_ctlcluster 16 main start`. Es gibt zwei mögliche Cluster auf Port 5432 (System-Cluster
  `/var/lib/postgresql/16/main` und `/var/tmp/pgtest/data`); nur einer darf laufen.
- Weiter wie in `docs/bautage/uebergabe-2026-10-03.md`: je paralleler Agent eine eigene `TEST_DATABASE_URL`, ein
  Scratchpad-Unterverzeichnis je Agent, Testkonstanten nie `SECRET`, `TOKEN`, `KEY` oder `PASSWORD` nennen, nach e2e nie
  `git add -A`, quay.io ist gesperrt (Keycloak-Tests nur in der PR-CI, Nachweis nach E56).
