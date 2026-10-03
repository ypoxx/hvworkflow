# Übergabe 2026-10-03

Für die nächste Orchestrator-Sitzung. Tagesbericht: `docs/bautage/2026-10-03.md`.

## Stand

- Integrationsbranch `claude/dax-shareholder-meeting-workflow-0s934z`, Kopf `799cca5` (044b).
- **Gebaut und gemergt heute, alle auf Standard (Go des Eigentümers 03.10.2026):**
  - 043a (#125 `88fa9be`, Vertrag 0.4.0);
  - 040b (#130 `6146251`, Vertrag 0.4.1);
  - 044a (#131 `83bc7e2`, Vertrag 0.4.2);
  - 044b (#134 `799cca5`).

  Die Specs stehen auf „angenommen“. Vor jeder echten Nutzung folgt die Rechtsprüfung (ADR 0012, Katalog, alle `legalRef`
  ungeprüft).
- **Specs gemergt, Bau offen:** 064a (#126), 064b (#127), 065a (#128), takt-042 (#132).
- **Offene PRs:**
  - **#129 Scheibe 037a** (lokales Betriebspaket), Branch `claude/slice-037a-betriebspaket`: grün, Review und Nachprüfung
    durch, Codex fertig. Der Merge wartet auf die S17-Entscheidung (siehe unten).
  - **#135 takt-042**, Branch `claude/takt-042-zeitkritische-tests`: CI grün, Review durch, Codex läuft. Mergen, sobald
    Codex kein P0/P1 und keinen Sicherheits-, Rechts- oder Datenschutzbefund meldet.

## Nächste Schritte

1. **takt-042 mergen** (#135), nach Codex.
2. **037a** nach der S17-Entscheidung mergen oder S17 mit erreichbarer Registry wiederholen.
3. **Kette der Oberfläche für die Freigabe-Demo:** 045, 048, 053, 054, 055, 059, 046, 060, 061 und 041 in der
   zugeschnittenen Form (ohne Jahrgang anlegen und ohne Freeze; der Jahrgang kommt aus dem Seed). Für Oberflächenscheiben
   mittleren Risikos gibt es keinen gesonderten Lesebefund der Spec, nur ein Review nach dem Bau (Entscheidung D vom
   03.10.2026). Sicherheits-, Rechts- und Datenschutzbefunde bleiben Pflicht.
4. **Entwicklerstrang und Betrieb:** 066, 075 (mit dem Demoszenario „Beispieltranskript über die Schnittstelle“), 038, 070
   und 071.
5. **064 und 065 bauen**, sobald die Eigentümerentscheidungen dazu vorliegen (064a/064b, 065a).
6. **Doku-Nachträge des Orchestrators:**
   - Produktplan: die Zeile „Stand 03.10.2026“ in Abschnitt 11 nachführen; dazu Teilungsvermerk, Lanes und Kalender für
     044 sowie die Verschiebung „Export markiert Verweigerungen“ nach 051 (Spec 044a, Files allowed; Go zu
     Eigentümerfrage 2 liegt seit 03.10.2026 vor);
   - Register: E14, E15, E25 und S6 sind in diesem Doku-PR nachgezogen.

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

- **Aktiver Postgres ist der System-Cluster** `/var/lib/postgresql/16/main` auf Port 5432, nicht `/var/tmp/pgtest`. Rollen
  `hv_owner`/`hv_runtime` (Passwörter nur lokal, Testwerte). Lokal gilt `GRANT pg_read_all_stats TO hv_owner`, damit
  `postgres-takt024`/`027` wartende Locks sehen. In der CI ist `hv_owner` Superuser.
- **Eine Datenbank je parallelem Agenten:** Jeder Agent bekommt eine eigene `TEST_DATABASE_URL`. Der Schreib-Lock
  `27027/1` gilt datenbankweit, gemeinsame Gates-Läufe erzeugen sonst Sperrrennen (takt-042).
- **Scratchpad und Prozesse:** ein Unterverzeichnis je Agent, markierte Prozessnamen, nie `pkill` nach Muster.
- **Zustand gehört in Commits und PRs:** Der Container kann auf einen älteren Stand zurückfallen; Worktrees und Scratchpad
  gehen dabei verloren.
- **quay.io ist gesperrt:** Keycloak-Images lassen sich lokal nicht ziehen. Kein Docker-Daemon lokal; Keycloak-Tests (H4–H9,
  029b, das `http`-Projekt, nach dem Merge von 037a auch `stack-037a`) laufen nur in der PR-CI, Nachweis nach E56.
- Harness-Port 18091: Ist er belegt, abbrechen und nie fremde Prozesse beenden. Nach e2e nie `git add -A`; Screenshots
  mit `git restore docs/evidence` zurücksetzen.
