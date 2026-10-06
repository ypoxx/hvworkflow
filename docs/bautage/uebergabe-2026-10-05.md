# Übergabe 2026-10-05

Für die nächste Orchestrator-Sitzung. Vorgänger: `docs/bautage/uebergabe-2026-10-04.md`. Nur Dokumentation; kein Code.

## Stand

- Integrationsbranch `claude/dax-shareholder-meeting-workflow-0s934z`, Kopf bei Beginn `f4e0278` (Scheibe 055b, #157).
- Der Eigentümer schrieb am 05.10.2026: „Alles ok. Und ich folge alle deinen Empfehlungen.“ Alle gebauten Standards sind angenommen.

## Entscheidungen 05.10.2026

1. **Rollout 055/055b** in eine geteilte Umgebung erst nach einer CSP der Webseite (037b). Deployment weiter nur auf ausdrückliches Go.
2. **Formatänderung** erzeugt eine neue Version und hebt die Freigabe auf (055, Frage 2). Ein kurzer Rechtsblick ist empfohlen und **nicht erfolgt**.
3. **E58:** kein Undo nach dem Weiterleiten; **054c entfällt** (Plan: kein Knoten, aus den Abhängigkeitslisten entfernt).
4. **E5:** Bedeutung wie gebaut; geschlossen.
5. **minimumReleaseAge:** ja, 7 Tage, Ausnahme für Sicherheitspatches; neuer Takt **takt-047**.
6. **E6:** Whitelist bleibt; nummerierte Listen ja (rund 0,75 AStd) im Umfang von **055c**. Voraussichtlich Vertrags- und Kernänderung, daher Klasse hoch; Spec-Entscheidung nötig.
7. **048b:** Auskunftsschuldner ist eine Funktion (Bühnenplatz), keine Person.
8. **Aufbewahrungsklasse `QuestionForwarded`:** der Eigentümer trägt den Standard `working` mit; die Entscheidung bleibt beim DSB (zusammen mit `QuestionAssigned`), der Widerspruch zur DSFA-Zeile V4 bleibt bis dahin offen.
9. **053 D4:** Nullzähler von Grau 300 auf Grau 600; **takt-048** zusammen mit Punkt 11.
10. **053 Frage 3:** Option A (Rechtemenge an `GET /auth/me`) als eigene Scheibe **089b**, niedrige Priorität, nach 041.
11. **055b Frage 4:** Beantwortung mit der letzten Version vorbelegen (in takt-048).
12. Alle übrigen Fragen (053: 1 bis 8, 054: 1 bis 10, 055: 3 bis 6, 055b: 2, 3, 5 bis 8) wie gebaut angenommen.

## Nächste Schritte (Reihenfolge)

takt-046 (`e2e-http`-Laufzeit: Grenze anheben oder Job teilen), takt-045 (Sonde `postgres-restart` des Stack-Jobs), takt-047 (pnpm minimumReleaseAge), takt-048 (Grau 600, Vorbelegung), dann 059, 046, 060, 061, 041. 055c nach 055b (Spec zuerst, mit der Entscheidung zur Form der nummerierten Liste). 089b nach 041 und nach der Freigabe-Demo.

## Offen

- Rechtsblick zur Formatänderung (empfohlen, nicht erfolgt).
- Frage an den DSB zur Aufbewahrungsklasse (`working` oder `record`) für `QuestionForwarded` und `QuestionAssigned`; offen bis zur Antwort.
- CSP der Webseite (037b) vor jedem Rollout von 055/055b.
- E21 unverändert (Nach-Beta).

## Abend 05.10.2026

Stand: Integrationsbranch bei `c5990c8`. Gemergt an diesem Tag, in dieser Reihenfolge:

- #158 `4e38512` Eigentümerentscheidungen in den Docs.
- #159 `11bbdf7` takt-046: Grenzen von `e2e-http` auf 12, 14 und 20 Minuten, Laufzeitzeile je Lauf.
- #161 `3136bf0` takt-047: pnpm `minimumReleaseAge` 10080 mit Ausnahmeweg für Sicherheitspatches.
- #160 `d17bcbf` takt-045: Sonde `postgres-restart` mit stop, DOWN gesehen, start.
- #163 `8215bc0` takt-049: 054 F6, `waitForMine` liest atomar.
- #162 `c5990c8` takt-048: Nullzähler Grau 600, Beantwortung mit der letzten Version vorbelegt; Risikoklasse mittel, 1,0 AStd, weil die Vorbelegung den Pfad berührt, der Antwortversionen anlegt.

Review-Befunde und Folgepunkte stehen in `docs/folgeliste.md` (Abschnitte Tests, Betriebspaket, Antwortformat in der Oberfläche, Skripte).

### Offen

- **takt-050** (010b Runde 4, `page.evaluate` beim Rollenwechsel; `010b-lesepfade.spec.ts:802`): in Arbeit.
- **055c** (nummerierte Listen): Spec zuerst, Klasse hoch, Entscheidung zur Form der Liste nötig.
- Rechtsblick zur Formatänderung, die die Freigabe aufhebt: empfohlen, nicht erfolgt.
- Frage an den DSB zur Aufbewahrungsklasse für `QuestionForwarded` und `QuestionAssigned`: offen.
- CSP der Webseite (037b) vor jeder geteilten Umgebung.
- Rollout nur mit ausdrücklichem Go des Eigentümers.
- Danach die Kette 059, 046, 060, 061, 041; 089b nach 041.

### Lehren

- Parallele `pnpm gates`-Läufe brauchen getrennte Datenbanken (`hv_test_<takt>`); die Postgres-Tests teilen sonst einen datenbankweiten Advisory-Lock und werden rot.
- `slice-scope` liest Pfade in Backticks unter „Dateien“ als erlaubt, auch in Verneinungen („nicht …“); gesperrte Pfade dort ohne Backticks nennen.
- e2e-Abfragen müssen das DOM atomar lesen (ein `evaluate`), nicht Zeile für Zeile mit wartenden Locator-Aktionen innerhalb von `expect.poll` (takt-049).
