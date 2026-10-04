# Übergabe 2026-10-04

Für die nächste Orchestrator-Sitzung. Tagesbericht: `docs/bautage/2026-10-04.md`.

## Stand

- Integrationsbranch `claude/dax-shareholder-meeting-workflow-0s934z`, Kopf bei Redaktionsschluss des Vormittags `7405efb` (Scheibe 048, #142); Stand am Abend im Abschnitt „Abend 04.10.2026“.
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

## Abend 04.10.2026

**Stand:** Integrationsbranch Kopf `cc97005` (Scheibe 054, #149). Spec 054 gemergt als #147 (`4f37d07`), Scheibe 053 als #145
(`d73f8fa`). Die Specs 053 und 054 stehen auf „angenommen“.

- **054 gebaut und geprüft:** Das Review fand ein Major (Testumfang von 010d); behoben, vom Orchestrator in der Spec
  nachgetragen. Minor und Nit gingen auf die Folgeliste (Abschnitt „Fokusansicht (aus 054)“).
- **#148 geschlossen:** Gitleaks meldete in einem Commit einen Fehlalarm (ein Speichername als Zuweisung in einer
  JSX-Zeile). Ein Force-Push ist gesperrt, deshalb wurde der Zweig zu einem Commit zusammengefasst und als #149 neu eröffnet.
- **CI `e2e-http` fand einen Fokus-Wettlauf in F4:** Der Strom war dem Schreibvorgang voraus; das Muster aus 053 wurde
  übernommen (`42ea09c`). Danach grün und gemergt als `cc97005` (#149).
- **Codex P1 auf #149** (Gates-Ausgabe fehlte in der Spec) behoben.
- **Laufzeit `e2e-http`** nach 054: 5:30 (Lauf 37223187826) und 4:45 (Lauf 37225467013) gegen die Harness-Grenze 8:00. Der
  Takt (Grenze anheben oder Job teilen) ist fällig, bevor der Schritt etwa 6:30 erreicht.
- **Folgeliste ergänzt:** 037a-Sonde `postgres-restart` (Neustart 0,4 s, Watcher sah nichts; Lauf 37222611650, PR #148) für
  037b; H13 ein zweites Mal rot (PR #149, Lauf 37224478746); Fokus-Fix in 054 (`queueMicrotask`); Vorschlag lokaler
  Gitleaks-Lauf vor dem Push. Die Aussage in Spec 048 „expert im Demo-Rollenwechsel nicht gebunden“ ist seit 054 überholt
  (Vermerk dort).

**Nächster Schritt:** Spec 055, dann 059, 046, 060, 061, 041 (Plan Abschnitt 11, Register E57). Betrieb: 037b, 038, 070, 071.
Entwickler: 064, 065, 066, 075.

**Offene Eigentümerfragen (unverändert):** E5 inhaltlich, E58 (Undo nach Weiterleiten, 054c), 048b (Auskunftsschuldner
als Funktion), Aufbewahrungsklasse für den DSB, 053 Fragen 1 bis 8, 054 Fragen 1 bis 10, Kontrast Grau 300 (053 D4).

**Umgebung und Lehren:**

- Der lokale Postgres fällt bei Neustarts des Containers aus: `pg_ctlcluster 16 main start`, vorher `pg_lsclusters` prüfen.
- Gitleaks-Lehre: Speichernamen als Modulkonstanten führen, nie als JSX-Literal; lokal steht kein Gitleaks bereit.
- Fokus-Lehre: Wer Muster aus 053 wiederverwendet, übernimmt `armFocus` und `settleFocus` mit. Ein grüner Lauf `e2e-http`
  beweist nicht, dass kein Wettlauf besteht.

## Nacht 04.10.2026

**Stand:** Integrationsbranch Kopf `4da0165` (Scheibe 055, #152). Gemergt in der Nacht: Spec 055 (#151 `ea3eb9a`), takt-043
(#153 `6fbd2a0`), takt-044 (#154 `d7020da`), Scheibe 055 (#152 `4da0165`). Die Specs stehen auf „angenommen“.

- **Spec 055 (Klasse hoch, geteilt in 055 und 055b):** Der Plan führte 055 als mittel; die Spec stuft wegen Vertrag,
  Ereignisform und Freigabebindung hoch ein (Hochstufung, kein Fall für `downgrade-check`). Lesebefund vor dem Bau mit einem
  Blocker (B1) und Majors M1 bis M4, darunter zwei Sicherheitsmajors; eingearbeitet, Nachprüfung, Codex P1 und P2 auf #151
  ebenfalls eingearbeitet. Teil a (Vertrag 0.4.4, Kern, Dienst) ist 055, Renderer und Editor sind 055b (Entwurf in der Spec 055).
- **055 gebaut (Opus), geprüft und gemergt:** Das Review lief in frischem Kontext. Codex P1 auf #152 (das projizierte `body`
  und die `sources` waren dasselbe Objekt wie in der Projektion) behoben in `514b564`; die Voraussetzung für 055b ist damit
  erledigt. Plan, Register und Spec-Berichte sind nachgezogen (Plan: 055 hoch, neuer Eintrag 055b, E57-Kette 055 → 055b → 059;
  056, 059 und 081 hängen an 055b, 066 an 055). Weil 055b vor 056 liegen muss, steht 055b im Plan am 18.11.2026 und 060 am
  23.11.2026, sonst schlägt `plan-graph --strict` an (Spurkonflikt).
- **F4-Fokus-Wettlauf trat erneut auf:** Diagnose mit zwei Ursachen (die Übergabe zählte, bevor die Liste sie hielt; der
  Fokus wurde nach einer Ablehnung nicht entschärft) → takt-043 (#153 `6fbd2a0`). CI `e2e-http` auf `91e3129` grün
  (56 passed, 4,8 min), auf `89ff15d` erneut grün.
- **H13 war dreimal rot:** Diagnose: Zeitabhängigkeit des Tests (ein später Lesezugriff aus dem Erfassungsschritt fiel in das
  Klassifizierungsfenster) → takt-044 (#154 `d7020da`). Review-Minor (die 5-s-Frist beginnt bei der Registrierung) steht auf
  der Folgeliste.
- **Trojan-Source-Lehre:** Steuer- und Formatzeichen (Bidi, Zeichen der Klasse Cf) gehören in Quelldateien nur als
  `\u`-Escapes, nie als sichtbare oder unsichtbare Rohzeichen. Kandidat für ein Gate (nicht beauftragt).
- **Lokaler Postgres war nach den Neustarts aus:** vor jedem Gates-Lauf `pg_lsclusters` prüfen, dann
  `pg_ctlcluster 16 main start`. Die Stack-Sonde `postgres-restart` (stack-037a) war zum zweiten Mal rot (PR #154,
  Lauf 37239065778); eigener Takt vor 037b (Folgeliste).

**Nächster Schritt:** Spec 055b (Voraussetzung Aliasing erledigt), dann 059, 046, 060, 061, 041 (Plan Abschnitt 11,
Register E57); Takt für die Stack-Sonde. Betrieb: 037b, 038, 070, 071. Entwickler: 064, 065, 066, 075.

**Offene Eigentümerfragen:** E5 inhaltlich, E58 (Undo nach Weiterleiten, 054c), 048b (Auskunftsschuldner als Funktion),
Aufbewahrungsklasse für den DSB, 053 Fragen 1 bis 8, 054 Fragen 1 bis 10, Kontrast Grau 300 (053 D4), 055 Fragen 1 bis 6
(E6-Umfang und nummerierte Listen; behält eine reine Formatänderung die Freigabe; 422 bei Abweichung zwischen `text` und
`body`; E21; Teilung und Budget; Risikoklasse), Vorschlag `minimumReleaseAge` (Sicherheit, takt-041).
