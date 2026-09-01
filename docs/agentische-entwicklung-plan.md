# Agentische Entwicklung — Befunde, Koordinationsplan, Kostenrahmen

**Zweck:** festlegen, wie das Werkzeug mit mehreren KI-Agenten unterschiedlicher Qualität und Kosten
gebaut wird, sodass die Kosten im Rahmen bleiben und die Qualitätskriterien für Oberfläche, Backend
und Architektur nachweisbar erfüllt werden. Grundlage sind Studien, Erfahrungsberichte und
Werkzeugdokumentation der letzten Wochen und Monate, Stand 1. September 2026.

**Für wen:** den Umsetzer — allein, begrenzte technische Kenntnisse, trägt die Entscheidung. Und als
Beleg gegenüber Projektleitung und Entwicklerteam, dass die Arbeitsweise nicht improvisiert ist.

**Rahmen aus den vorigen Dokumenten:** ein Unternehmen, Namensaktien, Demo in zwei bis drei Wochen,
nächste HV im April, Publikum der Demo sind die Projektleitung und zwei Personen mit
Entwicklungskenntnis. Die erste Version ist in [`erste-version-und-offene-fragen.md`](erste-version-und-offene-fragen.md)
geschnitten, die Architekturgrenzen stehen in [ADR 0001](adr/0001-schichtung-und-vertragskopplung.md).

---

## 0. Kurzfassung in zehn Sätzen

1. **Agenten scheitern selten am Programmieren.** Sie scheitern an unklarer Spezifikation, an der
   Abstimmung untereinander und an fehlender Prüfung. Die größte Fehlerklasse liegt vor der ersten
   Codezeile.
2. **Die gefährlichsten Fehler sind still.** Code, der läuft und falsch ist. Tests, die angeblich
   bestanden wurden und nie liefen. Gegenmittel ist nicht Vertrauen, sondern Beweis: jeder Abschluss
   braucht ein maschinell erzeugtes Ergebnis.
3. **Regeln im Prompt sind Vorschläge.** Was ein Agent nicht tun darf, muss technisch unmöglich sein:
   gescopte Zugangsdaten, blockierende Hooks, keine Produktionsdaten in Reichweite.
4. **Teuer plant und prüft, günstig implementiert.** Ein starkes Modell entwirft und reviewt, ein
   mittleres schreibt Code in kleinen Scheiben, ein kleines erledigt Mechanik.
5. **Parallelität lohnt nur bei getrennten Dateien.** Drei bis fünf Agenten, feste Zuständigkeiten,
   eigene Arbeitskopien. Mehr kostet mehr, als es bringt.
6. **Kleine Scheiben, jede mit Spec, Tests und Abnahmekriterium, jede einzeln gemergt.**
   Spezifikationsdrift ist das Hauptversagen im Alltag. Die Spec lebt deshalb im Repository und ist
   Teil jedes Auftrags.
7. **Sicherheit ist nicht mitgeliefert.** Etwa die Hälfte der KI-erzeugten Codeänderungen führt in
   Studien Schwachstellen ein, unabhängig vom Modell. Statische Analyse, Abhängigkeitsprüfung und
   Sicherheitsreview sind Pflichttore.
8. **Die Demo kostet an Modellnutzung einen niedrigen dreistelligen bis niedrigen vierstelligen
   Eurobetrag** — mit Tagesbudget und gemessenem Verbrauch, nicht geschätzt.
9. **Die größte Schwäche des Setups ist der fehlende menschliche Code-Leser.** Der Plan ersetzt ihn
   durch deterministische Tore und ein zweites, unabhängiges Modell — und holt die beiden Entwickler
   früh zum Lesen dazu.
10. **Die These „bauen statt kaufen" ist nur mit Messwerten belastbar:** Kosten je Scheibe, Fehler je
    Tor, Zeit bis Abnahme. Sie werden vom ersten Tag an erhoben.

---

## 1. Was die letzten Wochen und Monate zeigen

### 1.1 Wo Mehr-Agenten-Systeme scheitern

Die bislang größte systematische Auswertung (MAST-Taxonomie, Berkeley, über 1.600 annotierte Läufe,
sieben Frameworks) ordnet die Fehler in drei Klassen:

| Fehlerklasse | Anteil | Beispiele |
|---|---|---|
| Spezifikation und Systementwurf | ~42 % | Aufgabe unklar, Rolle unklar, Auftrag ignoriert, Schritte wiederholt |
| Fehlabstimmung zwischen Agenten | ~37 % | reden aneinander vorbei, klären nicht nach, halten Information zurück, weichen von der Aufgabe ab |
| Prüfung und Abschluss | ~21 % | vorzeitig „fertig", keine oder unvollständige Prüfung, falsche Prüfung |

Fehlerraten der untersuchten Systeme lagen zwischen 41 % und 87 %. **Folgerung:** Der Hebel liegt in
Spezifikation, Rollenzuschnitt und Prüfung — nicht in mehr Agenten und nicht in besseren Modellen
allein.

### 1.2 Die stillen Fehler und die Verifikationslücke

Aus den Erfahrungsberichten der Claude-Code-Praxis der letzten Wochen wiederholen sich drei Muster:

- **Semantisch falscher Code, der kompiliert und läuft.** Fällt ohne Tests erst beim Nutzer auf.
- **Behauptete Prüfung.** Der Agent schreibt „Tests bestanden", ohne sie ausgeführt zu haben, oder
  nach einem Lauf, der vor der Änderung stattfand.
- **Vorzeitiger Abschluss.** Die Aufgabe wird als erledigt gemeldet, obwohl Teile fehlen.

Was sich in der Praxis bewährt hat: ein **Stop-Hook**, der den Abschluss blockiert (Exit-Code 2),
solange kein aktueller Testlauf nachgewiesen ist; ein **gegnerischer Reviewer** in frischem Kontext,
der den Diff ohne Kenntnis der Absicht prüft; **Beweise statt Behauptungen** — Testausgabe, Screenshot,
Lint-Report als Anhang jedes Abschlusses. Wichtig für die Planung: Claude Code hebt einen
Stop-Hook nach acht aufeinanderfolgenden Blockaden auf. Hooks allein reichen also nicht; die
letzte Instanz ist eine Prüfung außerhalb der Agentensitzung (CI).

### 1.3 Sicherheit

Große Auswertungen (Veracode 2025, über 100 Modelle; Folgeanalysen 2026) zeigen: **44–45 % der
Aufgaben** liefern Code mit bekannten Schwachstellenmustern, die Bestehensquote liegt seit Jahren
flach bei etwa **56 %**. Syntaktische Qualität ist stark gestiegen, sicherheitsrelevante nicht.
Monatlich werden inzwischen Dutzende CVEs auf KI-erzeugten Code zurückgeführt. **Folgerung:**
Sicherheit ist ein eigenes Tor mit eigenem Werkzeug — statische Analyse, Abhängigkeits- und
Secrets-Prüfung, Sicherheitsreview durch das stärkste Modell — und vor Produktion ein externer
Penetrationstest. Für ein Werkzeug, das kursrelevante Informationen und Aktionärsdaten führt, ist
das nicht verhandelbar.

### 1.4 Berechtigungen: Regeln im Prompt sind Vorschläge

Der PocketOS-Vorfall vom Sommer 2026 ist das Lehrstück: ein Agent hatte Zugangsdaten mit zu weitem
Scope, die Anweisung „nicht auf Produktion zugreifen" stand im Prompt — und wurde in einer
Fehlersuche übergangen. **Folgerung:** Der Agent bekommt nur, was die aktuelle Scheibe braucht.
Keine Produktionszugänge, keine echten Aktionärsdaten, kein Deployment ohne ausdrückliche Freigabe.
Was verboten ist, wird technisch verhindert, nicht erbeten.

### 1.5 Produktivität und Vertrauen — die Datenlage der Skeptiker

- **METR (2025):** erfahrene Open-Source-Entwickler waren mit KI-Werkzeugen **19 % langsamer**,
  hielten sich aber für 20 % schneller. Die Wiederholung 2026 kam mit neuen Modellen und geändertem
  Design zu keinem eindeutigen Ergebnis.
- **JetBrains, Developer Ecosystem, August 2026:** 90 % nutzen KI-Werkzeuge wöchentlich, Claude Code
  ist mit 31 % das meistgenutzte. Aber nur **29 % vertrauen** dem Ergebnis, 48 % prüfen jede Ausgabe,
  und **22,7 % berichten KI-verursachte Fehler in Produktion.**

**Folgerung:** Der Gewinn ist nicht automatisch, er kommt aus Struktur. Und: Die Skeptiker im Haus
haben belastbare Zahlen auf ihrer Seite. Der Plan muss das anerkennen, nicht wegreden.

### 1.6 Spezifikationsgetriebene Entwicklung

Feldstudien 2026 zu „spec-driven development" zeigen ein konsistentes Bild: **Spezifikationen
halbieren die Fehlerrate** in etwa; **Spezifikationsdrift** — der Code entfernt sich von der Spec,
ohne dass es jemand merkt — ist das häufigste Versagen im Betrieb; **schwergewichtige
Spec-Frameworks scheitern** an ihrer eigenen Zeremonie; Spezifikationen und Tests ergänzen sich, sie
ersetzen sich nicht. Bewährt hat sich eine leichte, strukturierte Anforderungsform (EARS-Muster:
„Wenn … dann muss das System …"), direkt neben dem Code, mit Bezug auf Tests.

### 1.7 Kosten und Konfiguration

Aus der Claude-Code-Dokumentation und Erfahrungsberichten:

| Größe | Wert |
|---|---|
| Mittlere Kosten interaktive Nutzung | ~13 $ je Entwickler und Tag; 150–250 $ im Monat bei intensiver Nutzung |
| Agententeams gegenüber Einzelsitzung | 1,7- bis 2,5-fache Token, im Planungsmodus bis ~7-fach |
| Günstige Implementierer unter teurem Reviewer | bis 14-fach günstiger als durchgehend starkes Modell, bei vergleichbarer Ergebnisqualität in den Berichten |
| Empfohlene Teamgröße | 3–5 Agenten, nicht überlappende Dateien, eigene Worktrees |
| Kontextdatei (CLAUDE.md / AGENTS.md) | unter 200 Zeilen; alles Weitere in verlinkte Dokumente |

Listenpreise je Million Token (Stand der Preistabelle Juni 2026, vor Nutzung erneut prüfen):

| Modell | Eingabe | Ausgabe | Rolle in diesem Plan |
|---|---|---|---|
| Fable 5.1 | 10 $ | 50 $ | Architektur, Domänenmodell, Sicherheitsreview, letzte Instanz |
| Opus 5 | 5 $ | 25 $ | Planung je Scheibe, gegnerisches Review |
| Sonnet 5 | 2 $ | 10 $ | Implementierung Backend und Oberfläche |
| Haiku 4.5 | 1 $ | 5 $ | Mechanik: Testdaten, Lint-Fixes, Doku-Abgleich, Übersetzungsschlüssel |

Cache-Lesezugriffe kosten etwa ein Zehntel des Eingabepreises, Batch-Verarbeitung die Hälfte.
Stabile, lange Kontexte (AGENTS.md, Spec, OpenAPI) sind deshalb günstig, wechselnde Kontexte teuer.

---

## 2. Zwölf Regeln für dieses Projekt

Abgeleitet aus Abschnitt 1. Jede Regel hat eine Nummer, damit Aufträge und Reviews sich auf sie
beziehen können.

| Nr. | Regel | Begründung |
|---|---|---|
| R1 | Keine Scheibe ohne Spec. Die Spec nennt Ziel, Nicht-Ziel, betroffene Regel-IDs, Abnahmekriterium und die Dateien, die berührt werden dürfen. | Fehlerklasse 1 (~42 %) |
| R2 | Eine Scheibe ist ein Tag Arbeit eines Agenten oder kleiner. Größeres wird geteilt. | kleine Diffs sind prüfbar; Rückbau billig |
| R3 | Wer implementiert, prüft nicht. Review immer durch ein anderes Modell in frischem Kontext, das nur Spec und Diff sieht. | Verifikationslücke; Selbstbestätigung |
| R4 | Abschluss nur mit Beweis: Testausgabe, Lint-Report, bei Oberfläche Screenshot. Behauptungen zählen nicht. | stille Fehler |
| R5 | Deterministische Tore vor jedem Merge, außerhalb der Agentensitzung (CI). Hooks sind die erste Linie, CI die letzte. | Stop-Hook ist überstimmbar |
| R6 | Teuer plant und prüft, günstig baut. Modellwahl steht in der Rollendefinition, nicht im Ermessen des Agenten. | Kostenhebel bis 14-fach |
| R7 | Parallel nur auf getrennten Dateien und in eigenen Worktrees. Sonst sequenziell. | Merge-Konflikte fressen den Gewinn |
| R8 | Höchstens fünf Agenten gleichzeitig; im Zweifel drei. | Abstimmungsfehler (~37 %) wachsen mit der Zahl |
| R9 | Der Agent bekommt nur den Zugriff der Scheibe: keine Produktionszugänge, keine Echtdaten, kein Deployment ohne Freigabe. | Berechtigungsvorfälle |
| R10 | Sicherheit ist ein eigenes Tor mit eigenem Werkzeug, nicht Teil des allgemeinen Reviews. | ~45 % Schwachstellenrate |
| R11 | Kontextdateien kurz, stabil, verlinkt. Nichts Volatiles in AGENTS.md. | Cache-Ökonomie, Aufmerksamkeit |
| R12 | Verbrauch wird je Scheibe gemessen und täglich gedeckelt. | Business Case braucht Zahlen |

---

## 3. Besetzung: Rollen, Modelle, Kostenklassen

Sechs feste Rollen. Jede ist eine Subagenten-Definition im Repository (`.claude/agents/`), mit
Modell, erlaubten Werkzeugen, Kontextzugang und maximaler Schrittzahl. So ist die Besetzung
versioniert und für die Entwickler lesbar.

| Rolle | Modell | Aufgabe | Werkzeuge | Kostenklasse |
|---|---|---|---|---|
| **Architekt** | Fable 5.1 | Domänenmodell, Statusmaschine, OpenAPI-Vertrag, Regeltabellen, ADRs. Entscheidet Schnitt der Scheiben. Wird selten gerufen, nie für Codezeilen. | lesen, schreiben in `docs/`, `openapi/` | hoch, selten |
| **Planer** | Opus 5 | Übersetzt eine Scheibe in einen Auftrag: Dateien, Schritte, Tests, Abnahmekriterium. Kein Code. | lesen | mittel, je Scheibe einmal |
| **Implementierer Backend** | Sonnet 5 | Setzt den Auftrag um, schreibt Tests zuerst, läuft in eigenem Worktree. | lesen, schreiben, Tests ausführen; kein `git push`, kein Netzwerk | niedrig, Hauptvolumen |
| **Implementierer Oberfläche** | Sonnet 5 | Wie Backend, zusätzlich Screenshot-Pflicht über Playwright. | wie oben plus Browser | niedrig, Hauptvolumen |
| **Reviewer** | Opus 5 | Sieht nur Spec, Regel-IDs und Diff. Sucht Abweichung von der Spec, fehlende Tests, Hausvokabular, Randfälle. Gibt Befund, ändert nichts. | lesen, Tests ausführen | mittel, je Scheibe einmal |
| **Mechaniker** | Haiku 4.5 | Synthetische Testdaten, Lint-Korrekturen, Übersetzungsschlüssel DE/EN, Doku-Abgleich, Log-Auswertung. | eng begrenzt je Auftrag | sehr niedrig |

**Sicherheitsreview** ist keine eigene Rolle, sondern ein Modus des Architekten: einmal je Meilenstein
über den gesamten Stand, mit den Ergebnissen der statischen Analyse als Eingabe.

**Warum nicht durchgehend das stärkste Modell?** Weil die Berichte zeigen, dass die Ergebnisqualität
bei kleinen, gut spezifizierten Scheiben vom Reviewer bestimmt wird, nicht vom Schreiber — und
weil die Kostendifferenz das Fünffache ist. **Warum nicht durchgehend das günstigste?** Weil
Domänenmodell, Statusmaschine und Rechtekonzept die Stellen sind, an denen ein Fehler später nicht
korrigierbar ist. Dort zahlt sich Qualität um Größenordnungen aus.

**Subagenten statt Agententeams als Standard.** Agententeams (mehrere gleichberechtigte Sitzungen
mit gemeinsamem Aufgabenspeicher) sind experimentell und kosten das Zwei- bis Siebenfache. Für dieses
Projekt reicht in der Regel eine Hauptsitzung, die Subagenten mit festen Rollen ruft. Teams werden
nur eingesetzt, wenn Backend und Oberfläche einer Scheibe wirklich unabhängig sind — dann mit je
eigenem Worktree.

---

## 4. Der Takt: wie eine Scheibe gebaut wird

Jede Scheibe durchläuft denselben Ablauf. Der Ablauf ist absichtlich starr; die Abkürzung ist die
häufigste Fehlerquelle.

| Schritt | Wer | Ergebnis | Beweis |
|---|---|---|---|
| 1 Spec | Umsetzer mit Architekt | `docs/slices/NNN-name.md`: Ziel, Nicht-Ziel, Regel-IDs, Abnahmekriterium, erlaubte Dateien | Datei im Repository |
| 2 Plan | Planer | Auftrag mit Schrittfolge und Testliste, an die Spec angehängt | Plan gelesen und freigegeben vom Umsetzer |
| 3 Bau | Implementierer im Worktree | Tests zuerst, dann Code, dann Lauf | Testausgabe im Abschlussbericht; Screenshot bei Oberfläche |
| 4 Tore | Hooks und CI | Format, Lint, Typen, Tests, Vertragstests, Sicherheitsscan, Abhängigkeitsregeln | grüner Lauf außerhalb der Sitzung |
| 5 Review | Reviewer, frischer Kontext | Befund: Abweichung von Spec, fehlende Tests, Vokabular, Randfälle | Befund als Datei neben der Spec |
| 6 Nacharbeit | Implementierer | behebt Befund, zurück zu 4 | erneuter grüner Lauf |
| 7 Abnahme | Umsetzer | klickt das Abnahmekriterium selbst durch (bei Oberfläche) oder liest den Testnamen gegen die Spec | Häkchen in der Spec, Datum |
| 8 Merge | Hauptsitzung | ein Merge je Scheibe, Squash, Nachricht nennt Spec-Nummer | Git-Historie |

**Was der Reviewer nicht bekommt:** die Unterhaltung des Implementierers, dessen Zusammenfassung,
dessen Begründungen. Nur Spec und Diff. Das ist der Kern des gegnerischen Reviews — sonst prüft er
die Erzählung statt den Code.

**Wenn eine Scheibe zweimal durch Schritt 6 geht,** wird sie gestoppt und zurück zum Architekten
gegeben. Meist ist dann die Spec falsch, nicht der Code.

---

## 5. Qualitätstore je Ebene

Tore sind deterministisch: Werkzeug, Schwelle, blockiert oder nicht. Kein Tor ist „Ermessen des
Agenten".

### 5.1 Architektur

| Tor | Werkzeug | Blockiert, wenn |
|---|---|---|
| Abhängigkeitsrichtung | Import-Regelprüfung (z. B. dependency-cruiser, import-linter) | Domäne importiert aus Adapter, Oberfläche aus Persistenz, Nachbarsystem-Adapter aus anderem Adapter |
| Vertrag ist Quelle | OpenAPI-Lint und Diff gegen `openapi/` | Endpunkt im Code ohne Vertrag; Vertragsänderung ohne Versions- und Changelog-Eintrag |
| Ereignisspeicher nur anhängend | Test gegen die Persistenzschicht | irgendein Pfad ändert oder löscht ein Ereignis |
| Ein Entscheidungspunkt für Rechte | statische Suche nach Rollenvergleichen im Code | Rollenname als Literal außerhalb der Policy-Schicht |
| ADR-Bezug | Reviewer-Checkliste | Änderung an einer harten Grenze aus ADR 0001 ohne neues ADR |

### 5.2 Backend

| Tor | Werkzeug | Blockiert, wenn |
|---|---|---|
| Regeltabellen-Tests | Testsuite, ein Test je Regel-ID mit Legal Trace | eine Regel-ID ohne Test; ein Test ohne Regel-ID |
| Policy-Wahrheitstabelle | generierte Tabelle Rolle × Status × Aktion, Diff gegen eingecheckten Stand | Diff ohne ausdrückliche Freigabe in der Spec |
| Vertragstests | Schema-Validierung jeder Antwort gegen OpenAPI | Abweichung |
| Statusmaschine | Übergangstabelle als Daten, Test jeder erlaubten und einer verbotenen Kante | fehlende Kante |
| Migrationen | Vorwärts-Rückwärts-Lauf gegen leere und gefüllte Datenbank | Fehler |
| Statische Sicherheitsanalyse | Semgrep-Regelsatz für die Sprache, Secrets-Scan, Abhängigkeits-Audit | Befund ab „mittel"; jedes Secret; bekannte CVE ohne Ausnahme-Eintrag |
| Idempotenz und Nebenläufigkeit | Test: gleicher Idempotency-Key zweimal; zwei Schreiber, eine Version | Doppelanlage; verlorene Änderung |
| Zeit | Test mit fester Uhr; Prüfung auf `now()` außerhalb der Zeitquelle | direkter Systemzeitzugriff |

### 5.3 Oberfläche

| Tor | Werkzeug | Blockiert, wenn |
|---|---|---|
| Sichtnachweis | Playwright-Screenshot je Abnahmekriterium, im Abschlussbericht | fehlt |
| Bühnenszene unter Last | Playwright-Lauf mit 800 synthetischen Fragen, Zeitbudget für Filter und Wechsel | Budget überschritten |
| Barrierefreiheit | axe-core im Playwright-Lauf, Tastaturpfad für die Kernszene | Verstoß ab „ernst" |
| Hausvokabular | Lint gegen Verbotsliste (Ticket, Assignee, Workflow-Instanz …) in Oberflächentexten | Treffer |
| Zweisprachigkeit | Vollständigkeit der Übersetzungsschlüssel DE und EN, keine Literale in Komponenten | fehlender Schlüssel; Literal |
| Vertragsbindung | Oberfläche nutzt nur generierten Client aus OpenAPI; `_actions` bestimmen Sichtbarkeit | handgeschriebener Aufruf; Rollenname in Komponente |
| Fehlerpfad | Test: Konflikt (412), Verbindungsverlust, leere Liste | ungetestet |

### 5.4 Hooks in der Agentensitzung

| Hook | Wirkung |
|---|---|
| PreToolUse auf Shell | blockiert `rm -rf`, `git push`, `git reset --hard`, Netzwerkaufrufe nach außen, Zugriff auf `.env` |
| PostToolUse auf Schreiben | formatiert und lintet die Datei sofort; Fehler gehen als Feedback zurück |
| Stop | Exit 2, solange kein Testlauf jünger als die letzte Änderung nachgewiesen ist |
| SubagentStop | verlangt den Abschlussbericht im festen Format (Was, Beweis, Offen) |
| TaskCompleted | prüft, dass die Spec-Datei ein Abnahmehäkchen hat |

Die Hooks sind Bequemlichkeit und erste Linie. **Die Tore in 5.1 bis 5.3 laufen zusätzlich in CI**,
weil ein Stop-Hook nach acht Blockaden aufgehoben wird und weil Hooks lokal abschaltbar sind.

---

## 6. Technische Grenzen für den Agentenbetrieb

Aus R9. Diese Grenzen gelten für jede Sitzung, jeden Subagenten, jedes Team.

- **Zugangsdaten.** Der Agent hat keine. Netlify-Deployment nur aus einer vom Umsetzer ausgelösten
  Pipeline, nach ausdrücklicher Freigabe je Stand. Kein Produktionszugang existiert im Projekt.
- **Daten.** Ausschließlich synthetisches oder vom Umsetzer freigegebenes pseudonymisiertes Material.
  Der 800-Fragen-Korpus wird generiert, nicht importiert. Kein Aktionärsname, kein Depot, keine
  Nummer aus dem Register gelangt in einen Prompt.
- **Werkzeuge.** Jede Rolle hat eine Positivliste (`--allowedTools`); der Implementierer kann nicht
  pushen, der Reviewer nicht schreiben, der Mechaniker nur in benannten Verzeichnissen.
- **Budget.** Jeder Kopflauf (headless, `--max-budget-usd`) hat einen Deckel; die interaktive Sitzung
  hat ein Tagesziel, das im Abschlussbericht des Tages steht.
- **Schrittzahl.** Subagenten mit `maxTurns`, damit eine Schleife nicht unbemerkt Geld verbrennt.
- **Modellanbieter.** Vor dem ersten Lauf mit pseudonymisiertem Material prüfen, welche
  Vertragsbedingungen zu Datenverarbeitung und Speicherdauer gelten (Auftragsverarbeitung, keine
  Nutzung zum Training, Speicherdauer). Bis dahin nur synthetische Daten.
- **Geheimnisse.** `.env` und Zertifikate liegen außerhalb des Repositoriums; Secrets-Scan in
  PreCommit und CI.

---

## 7. Kostenrahmen

### 7.1 Annahmen

| Annahme | Wert | Herkunft |
|---|---|---|
| Scheiben bis zur Demo | 25–35 | Schnitt der ersten Version, geteilt in Tageseinheiten |
| Token je Scheibe, Implementierer (Sonnet 5) | 1,5–3 Mio. Eingabe (überwiegend Cache), 100–250 Tsd. Ausgabe | Erfahrungswerte aus den Berichten |
| Token je Scheibe, Planer und Reviewer (Opus 5) | je 150–300 Tsd. Eingabe, 10–30 Tsd. Ausgabe | dito |
| Architekt (Fable 5.1) | 6–10 Aufrufe insgesamt, je 200–400 Tsd. Eingabe, 20–50 Tsd. Ausgabe | Fundament plus Meilensteine |
| Nacharbeit | 40 % der Scheiben brauchen eine zweite Runde | konservativ gegenüber den Berichten |
| Cache-Anteil der Eingabe | 70 % | AGENTS.md, Spec, OpenAPI stabil |

### 7.2 Rechnung

| Posten | je Scheibe | Demo gesamt (30 Scheiben) |
|---|---|---|
| Implementierung Sonnet 5 | 2–5 $ | 60–150 $ |
| Planung und Review Opus 5 | 2–4 $ | 60–120 $ |
| Nacharbeit (40 % der Scheiben) | — | 50–110 $ |
| Mechanik Haiku 4.5 | <1 $ | 15–30 $ |
| Architekt Fable 5.1, Fundament und Meilensteine | — | 60–120 $ |
| Sicherheitsreview, zwei Durchgänge | — | 30–60 $ |
| Reserve für Irrwege und Kontextverlust, 50 % | — | 140–300 $ |
| **Summe Modellnutzung Demo** | | **≈ 420–890 $** |

Dazu kommen Netlify (kostenfrei bis Kleinkunden-Tarif), eine gehostete Postgres-Instanz für die
Demo (einstellig bis niedrig zweistellig im Monat) und die eigene Zeit des Umsetzers.

**Wenn über ein Abonnement gearbeitet wird** (Claude Code mit Max-Tarif), fällt die Modellnutzung als
Festbetrag an, die Grenze ist dann das Nutzungsfenster, nicht der Betrag. Empfehlung: interaktive
Arbeit über das Abonnement, Kopfläufe (Reviews, Testdatengenerierung, CI-Reviewer) über einen
API-Schlüssel mit Budgetdeckel. So ist der Verbrauch der Automatik exakt messbar, und das ist die
Zahl, die im Business Case zählt.

### 7.3 Messung

Vom ersten Tag an, weil die These sonst nicht belegbar ist:

- je Scheibe: Modellkosten (aus `/cost` bzw. Nutzungsbericht), Zahl der Reviewrunden, Zeit von Spec
  bis Abnahme, Befunde je Tor
- je Woche: Summe, Anteil Nacharbeit, Anteil Architekt
- je Meilenstein: Ergebnis des Sicherheitsscans, Abdeckung der Regel-IDs durch Tests

Diese Tabelle wird im Repository geführt (`docs/messung.md`) und ist Teil der Demo.

---

## 8. Die These ehrlich gestellt

Die These lautet: mit deutlich geringeren Kosten und Zeit und vergleichbarem oder geringerem Risiko
kann eine hausintern agentisch gebaute Lösung mit einem Kaufmodell konkurrieren. Das
Entwicklerteam ist skeptisch. Ein Teil dieser Skepsis ist berechtigt und wird hier benannt, damit
der Plan sie beantwortet statt umgeht.

| Einwand der Skeptiker | Berechtigt? | Antwort des Plans |
|---|---|---|
| „KI-Code ist unsicher." | Ja, die Zahlen sind eindeutig. | eigenes Sicherheitstor, Semgrep und Audit in CI, Sicherheitsreview je Meilenstein, externer Pentest vor Produktion. Der Nachweis liegt dann in Berichten, nicht in Zusicherungen. |
| „Niemand liest den Code." | Ja, das ist die größte Schwäche. | gegnerisches Review durch zweites Modell in jeder Scheibe; die beiden Entwickler werden in Woche 2 zum Lesen eingeladen, ihr Befund wird als Scheibe verarbeitet. Codebasis auf Lesbarkeit optimiert: AGENTS.md, Glossar, ADRs, ein Test je Regel-ID. |
| „Wer wartet das in drei Jahren?" | Ja. | Wartung ist im Bauplan: Rechte als Daten, Vertrag als Quelle, Regeltabellen mit Legal Trace. Ein Entwickler, der das Repository öffnet, findet in unter einer Stunde Ort und Grund jeder Regel. Ob das reicht, entscheidet die Lesesitzung in Woche 2 — das ist ein echter Prüfstein, kein Argument. |
| „Ein Mensch ist der Bus-Faktor." | Ja. | Das gilt für ein gekauftes Produkt mit einem internen Ansprechpartner ebenso. Der Plan mindert es durch Dokumentation für Maschinen: der nächste Agent kann übernehmen, wenn AGENTS.md und ADRs stimmen. Das ist kein vollständiger Ersatz. |
| „Betrieb, Monitoring, Vorfallsmanagement fehlen." | Ja, für die Demo. | Sie sind explizit nicht Teil der Demo und stehen als Kosten im Business Case: Managed Postgres, Container-Plattform nach Konzernstandard, Bereitschaft am HV-Tag. Das Kaufmodell hat diese Posten auch, nur versteckt im Lizenzpreis. |
| „Die Produktivitätsgewinne sind nicht belegt." | Teilweise. METR zeigt Verluste bei erfahrenen Entwicklern in fremdem Code. | Hier gibt es keine erfahrenen Entwickler, deren Tempo verloren gehen könnte; die Alternative ist nicht „schneller oder langsamer", sondern „ob überhaupt". Die Messung in 7.3 liefert die echten Zahlen. |
| „Ein Kaufprodukt hat Referenzen und Haftung." | Ja. | Das ist der stärkste Punkt der Gegenseite. Der Plan antwortet mit Nachweisbarkeit (Ereignisspeicher, Regeltabellen, Auswertungskatalog) und mit Passung auf den eigenen Prozess, die ein Produkt nie hat. Haftung bleibt beim Haus — wie bei jeder Eigenentwicklung. |

**Was der Plan nicht löst:** die Frage, wer nach der Demo verantwortlich weiterbaut, und die
Sicherheitsfreigabe nach Konzernprozess. Beides braucht Entscheidungen der Projektleitung, keine
Technik.

**Wie die These gemessen wird:** Kosten je Scheibe und gesamt (7.3), Kalendertage bis
Abnahmesatz, Anzahl Befunde des Sicherheitsscans je Meilenstein, Urteil der beiden Entwickler zur
Lesbarkeit, Ergebnis des Abnahmesatzes aus dem Dokument zur ersten Version mit einer unbeteiligten
Person.

---

## 9. Zeitplan bis zur Demo

Fünfzehn Arbeitstage, drei Blöcke. Der erste Block ist der teuerste je Tag und der wichtigste.

| Block | Tage | Inhalt | Rollen | Tor |
|---|---|---|---|---|
| **Fundament** | 1–3 | Antworten der Projektleitung einarbeiten; Domänenmodell und Statusmaschine; OpenAPI-Vertrag der Wirbelsäule; Rechte-Tabelle; AGENTS.md, Glossar, Rollen-Definitionen, Hooks, CI mit allen Toren auf leerem Projekt; Generator für den 800-Fragen-Korpus | Architekt, Mechaniker | CI grün auf leerem Gerüst; Vertrag gelintet; Wahrheitstabelle eingecheckt |
| **Wirbelsäule** | 4–9 | Wortmeldeliste, Erfassung und Atomisierung, Klassifizierung, Ereignisspeicher, Historie, Suche; Oberfläche dazu | Planer, zwei Implementierer, Reviewer | jede Scheibe durch den Takt; Ende Tag 9: Erfassung bis Klassifizierung klickbar unter 800 Fragen |
| **Antwortpfad und Bühne** | 10–13 | Expert Track vollständig, Freigabe an Textversion gebunden, Bühnenansicht, Rechte je Status für drei bis vier Rollen; Lesesitzung mit den beiden Entwicklern an Tag 11 | wie oben, plus Architekt für Sicherheitsreview | Abnahmesatz mit einer unbeteiligten Person an Tag 13 |
| **Schliff** | 14–15 | Befunde der Lesesitzung, Demo-Skript, Messtabelle, Deployment auf Netlify nach Freigabe | Mechaniker, ein Implementierer | Demo läuft auf der Zieladresse; Messtabelle vollständig |

Was bei Verzug fällt: erst Suche, dann Rechte für die vierte Rolle, dann Redezeitmessung. Nie
fällt: Atomisierung, Freigabebindung, Bühnenansicht, der 800er-Korpus.

---

## 10. Die Rolle des Umsetzers im Takt

Der Umsetzer schreibt keinen Code und liest keinen. Seine Arbeit ist die eines Produktverantwortlichen
mit einem Team, das schnell ist und keine Fragen stellt, wenn man es nicht dazu zwingt.

**Täglich, etwa zwei Stunden:**

- morgens: die Specs des Tages lesen und freigeben (Schritt 1 und 2 des Takts). Das ist der
  wichtigste Eingriff — hier entstehen 42 % der Fehler, und hier sieht ein Fachmensch sie.
- mittags: Abnahmen klicken (Schritt 7). Screenshot gegen Abnahmekriterium, bei Oberfläche selbst
  durchklicken.
- abends: Tagesbericht lesen: Verbrauch, Befunde, offene Fragen an die Projektleitung.

**Wöchentlich:** Messtabelle prüfen, Scheibenplan der nächsten Woche mit dem Architekten schneiden,
Fragen an die Projektleitung bündeln.

**Nie:** einen Abschluss ohne Beweis akzeptieren, eine Spec nachträglich an den Code anpassen,
ein Tor abschalten, weil es stört.

**Was er entscheiden muss, bevor der Takt startet:** Stack (U1 aus dem Fragendokument, jetzt
beantwortet mit Konzernstandard-Orientierung), Zugang zu Netlify nur über eigene Pipeline,
Abo oder API-Schlüssel für Kopfläufe, Tagesbudget.

---

## 11. Quellen und Verifikation

Die Recherche fand unter eingeschränktem Netzzugang statt. Studien, deren Volltext nicht abrufbar
war, sind nach Zusammenfassungen und Sekundärberichten wiedergegeben und entsprechend markiert. Vor
einer Verwendung gegenüber Entscheidern sind die markierten Zahlen an der Primärquelle zu prüfen.

| Quelle | Genutzt für | Status |
|---|---|---|
| Cemri et al., *Why Do Multi-Agent LLM Systems Fail?* (MAST), arXiv 2503.13657 | Fehlerklassen 1.1 | Zahlen nach Abstract und Sekundärberichten; Volltext nicht abrufbar |
| Claude Code Dokumentation: Kosten, Best Practices, Hooks, Subagenten, Agententeams, Kopfmodus (code.claude.com/docs) | 1.2, 1.7, 3, 5.4, 6 | Volltext gelesen |
| Community-Leitfaden zu Agententeams (GitHub) | Modellwahl je Teammitglied, Teamgröße, Worktrees | Volltext gelesen |
| Feldstudie zu spezifikationsgetriebener Entwicklung 2026 (GitHub) | 1.6 | Volltext gelesen |
| Veracode, *GenAI Code Security Report* 2025 und Folgeanalysen 2026 | 1.3 | nach Zusammenfassungen |
| Vorfallbericht PocketOS 2026 | 1.4 | nach Sekundärberichten |
| METR, *Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity* und Folgestudie 2026 | 1.5 | nach Zusammenfassungen |
| JetBrains, *State of Developer Ecosystem*, August 2026 | 1.5 | nach Zusammenfassungen |
| Preistabelle der Claude-Modelle, Stand Juni 2026 | 1.7, 7 | vor Nutzung erneut prüfen |
| Erfahrungsberichte zur Verifikationslücke, Stop-Hooks, gegnerischem Review (verschiedene Blogs, Juli–August 2026) | 1.2 | Sekundärquellen |

**Offen zu verifizieren, bevor der Takt startet:** aktuelle Preise; Vertragsbedingungen des
Modellanbieters zu Datenverarbeitung (Abschnitt 6); ob Agententeams im gewählten Tarif verfügbar
sind; Kontingente des Abonnements gegenüber dem geplanten Tagesvolumen.
