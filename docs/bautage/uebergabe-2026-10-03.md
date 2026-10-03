# Übergabe 2026-10-03

Für die nächste Orchestrator-Sitzung. Tagesbericht: `docs/bautage/2026-10-03.md`.

## Stand

- Integrationsbranch `claude/dax-shareholder-meeting-workflow-0s934z`, Kopf `c0db7f5` (Scheibe 045, #139).
- **Gebaut und gemergt heute, alle auf Standard (Go des Eigentümers 03.10.2026):**
  - 043a (#125 `88fa9be`, Vertrag 0.4.0);
  - 040b (#130 `6146251`, Vertrag 0.4.1);
  - 044a (#131 `83bc7e2`, Vertrag 0.4.2);
  - 044b (#134 `799cca5`);
  - 045 (#139 `c0db7f5`, ersetzt #138; Spec #137 `5cbe438`).

  Die Specs stehen auf „angenommen“. Vor jeder echten Nutzung folgt die Rechtsprüfung (ADR 0012, Katalog, alle `legalRef`
  ungeprüft).
- **takt-042** (Spec #132, Bau #135 `8705a1c`): zeitkritische Postgres-Tests deterministisch, gemergt.
- **Specs gemergt, Bau offen:** 064a (#126), 064b (#127), 065a (#128).
- **Offene PRs:**
  - **#129 Scheibe 037a** (lokales Betriebspaket), Branch `claude/slice-037a-betriebspaket`: grün, Review und Nachprüfung
    durch, Codex fertig. Der Merge wartet auf die S17-Entscheidung (siehe unten).

## Nächste Schritte

1. **037a** nach der S17-Entscheidung mergen oder S17 mit erreichbarer Registry wiederholen.
2. **Kette der Oberfläche für die Freigabe-Demo:** 045 ist gemergt, als Nächstes **048**, dann 053, 054, 055, 059, 046, 060, 061 und 041 in der
   zugeschnittenen Form (ohne Jahrgang anlegen und ohne Freeze; der Jahrgang kommt aus dem Seed). Für Oberflächenscheiben
   mittleren Risikos gibt es keinen gesonderten Lesebefund der Spec, nur ein Review nach dem Bau (Entscheidung D vom
   03.10.2026). Sicherheits-, Rechts- und Datenschutzbefunde bleiben Pflicht.
3. **Entwicklerstrang und Betrieb:** 066, 075 (mit dem Demoszenario „Beispieltranskript über die Schnittstelle“), 038, 070
   und 071.
4. **064 und 065 bauen**, sobald die Eigentümerentscheidungen dazu vorliegen (064a/064b, 065a).
5. **Doku-Nachträge des Orchestrators:**
   - Produktplan: die Zeile „Stand 03.10.2026“ in Abschnitt 11 nachführen; dazu Teilungsvermerk, Lanes und Kalender für
     044 sowie die Verschiebung „Export markiert Verweigerungen“ nach 051 (Spec 044a, Files allowed; Go zu
     Eigentümerfrage 2 liegt seit 03.10.2026 vor);
   - Register: E14, E15, E25 und S6 sind in diesem Doku-PR nachgezogen.

## Offene Reste im Remote

- Zwei veraltete Remote-Branches: `claude/slice-045` und `claude/slice-045-verweigerung-oberflaeche` (beide identisch auf
  `42fc573`, enthalten den alten Gitleaks-Befund). Das Löschen ist durch den Hook gesperrt; der Eigentümer kann sie von
  Hand löschen.

## Eigentümerentscheidungen (offen)

1. **037a S17:** quay.io ist in der Sitzungsumgebung gesperrt. Der frische Agent kam deshalb beim Befolgen der
   Installationsseite nicht bis zur Anmeldung. Die CI belegt die Anmeldung. Frage: Reicht der CI-Nachweis für den Merge,
   oder wird S17 mit erreichbarer Registry wiederholt?
2. **064:** Bau auf Standard vor der Antwort zu E3a (Pfad und Ingest-Form), Teilung in 064a/064b und Budget.
3. **065:** Teilung und Budget; welche synthetischen Texte an Partner gehen; `HV_MODE` aus 042 in 065b vorziehen.
4. **044b Eigentümerfrage 1:** `ruleId` im Zugriffslog. Standard (gebaut): kein neuer Schlüssel. Die Option kostet rund
   0,35 AStd und braucht DSB und Betriebsrat.
5. **044b Eigentümerfrage 2:** `draftAnswer` mit `answerKind`. Standard (gebaut): 200, die Felder werden verworfen.
   Alternative: 422 mit Vertragsschritt, rund 0,35 AStd.
6. **minimumReleaseAge:** Vorschlag weiter offen.
7. Aus der Übergabe vom 30.09. weiter offen: Frage 6 (Doku ohne Spec), 040a Fragen 2a bis 2c, E41, `e2e-http` als
   Pflicht-Check, E55 und die übrigen dort genannten Punkte.

## Betrieb der Bauumgebung (berichtigt)

- **Weiterer Neustart der Maschine gegen 21:22:** Der System-Cluster war aus, die Gates liefen rot (32 Fehler in
  `postgres-takt033`). Vor jedem Gates-Lauf `pg_lsclusters` prüfen und bei Bedarf `pg_ctlcluster 16 main start`.
- **Bauauftrag an Implementierer:** Testkonstanten nie `SECRET`, `TOKEN`, `KEY` oder `PASSWORD` nennen, wenn ein Literal
  zugewiesen wird (Gitleaks scannt jeden Commit, Korrekturcommits helfen nicht).

- **Welcher Postgres läuft, ist vor jedem Gates-Lauf zu prüfen** (`ps aux | grep postgres` oder `pg_ctl status` für beide
  Datenverzeichnisse): Es gibt zwei Cluster, den System-Cluster `/var/lib/postgresql/16/main` und `/var/tmp/pgtest/data`,
  beide auf Port 5432. Bis zum Neustart der Maschine gegen 18:24 lief der System-Cluster (mit `hv_t042*`, `hv_t044b`
  und dem lokalen `GRANT pg_read_all_stats TO hv_owner`); nach dem Neustart lief keiner, der takt-042-Bau startete
  `/var/tmp/pgtest` und legte dort `hv_t042*` an; gegen 19:20 lief keiner. Datenbanken und der GRANT gibt es je Cluster
  getrennt. Rollen `hv_owner`/`hv_runtime` (Testwerte, nur lokal). In der CI ist `hv_owner` Superuser.
- **Eine Datenbank je parallelem Agenten:** Jeder Agent bekommt eine eigene `TEST_DATABASE_URL`. Der Schreib-Lock
  `27027/1` gilt datenbankweit, gemeinsame Gates-Läufe erzeugen sonst Sperrrennen (takt-042).
- **Scratchpad und Prozesse:** ein Unterverzeichnis je Agent, markierte Prozessnamen, nie `pkill` nach Muster.
- **Zustand gehört in Commits und PRs:** Der Container kann auf einen älteren Stand zurückfallen; Worktrees und Scratchpad
  gehen dabei verloren.
- **quay.io ist gesperrt:** Keycloak-Images lassen sich lokal nicht ziehen. Kein Docker-Daemon lokal; Keycloak-Tests (H4–H9,
  029b, das `http`-Projekt, nach dem Merge von 037a auch `stack-037a`) laufen nur in der PR-CI, Nachweis nach E56.
- Harness-Port 18091: Ist er belegt, abbrechen und nie fremde Prozesse beenden. Nach e2e nie `git add -A`; Screenshots
  mit `git restore docs/evidence` zurücksetzen.
