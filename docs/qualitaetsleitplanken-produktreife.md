# Produktreife — Qualitätsleitplanken und Reviewkatalog

**Status:** Arbeitsgrundlage für die Produktisierung · **Stand:** 22. September 2026

## 1. Zweck und Verwendung

Dieses Dokument ergänzt die bestehenden Anforderungen, Architekturentscheidungen und Arbeitsregeln.
Es ist **keine zweite Quelle fachlicher Wahrheit**. Es hilft Planungs- und Review-Agenten bei drei
Fragen:

1. Welche Qualitätsbereiche berührt eine geplante Änderung?
2. Welche Prüfungen, Nachweise und Gegenlesen folgen daraus?
3. Muss vor der Implementierung eine offene Entscheidung durch Menschen oder die zuständige
   Fachrolle getroffen werden?

Die Leitplanken helfen auf dem Weg von der heutigen Demo zum betriebenen Produkt. Der Planer wählt
die für eine Scheibe relevanten Punkte aus und übernimmt sie als konkrete Akzeptanzkriterien in die
Slice-Spec. Erst dadurch werden sie für diese Scheibe prüfbar. Dieses Dokument führt selbst keine
neuen Gates, Rollen oder Freigaben ein und ändert nicht die Arbeitsordnung aus `AGENTS.md` und
`docs/agentische-entwicklung-plan.md`.

### 1.1 Was dieses Dokument nicht tut

Es enthält bewusst keine Kopie von API-Operationen, Rollenmatrizen, Statusübergängen oder
Rechtsanforderungen. Es entscheidet weder Hostingplattform noch Identity Provider, Datenbanktopologie
oder KI-Anbieter. Es behauptet keine Rechts-, Sicherheits- oder Produktionsfreigabe.

### 1.2 Quellen und ihr Status

| Gegenstand | Quelle | Status und Verwendung |
|---|---|---|
| Recherche zu Produkt und Recht | `docs/anforderungen-recherche.md` | Kandidaten und Prüfaufträge; **keine freigegebene Spezifikation**. Rechtlich begründete Aussagen erst nach Legal-Verifikation übernehmen. |
| Ist-Prozess und Schnittstellenziel | `docs/ist-analyse-und-schnittstellen.md` | Analyse und Zielbild; offene Fragen nicht als Entscheidung behandeln. |
| Rollen- und Rechteprinzipien | `docs/rollen-und-rechtekonzept.md` | Zielkonzept; konkrete Produktänderung erst über freigegebene Spec und Regeltabelle. |
| Tragende Architekturentscheidungen | `docs/adr/` | Nur angenommene ADRs sind Entscheidungen; vorgeschlagene ADRs bleiben offen. |
| Externer und UI-Anwendungsvertrag | `packages/contract/openapi.yaml` und generierte Typen | Verbindlicher Vertrag des aktuellen Implementierungsstands. |
| Statusübergänge | `packages/domain/src/transitions.ts` | Verbindliche Implementierungsquelle des aktuellen Stands. |
| Berechtigungsbündel und Entscheidung | `packages/domain/src/permissions.ts`, `can()` in `packages/domain/src/api.ts` | Verbindliche Implementierungsquelle des aktuellen Stands. |
| Ereignisse und Projektion | `packages/domain/src/events.ts`, `packages/domain/src/state.ts` | Verbindliche Implementierungsquelle des aktuellen Stands. |
| Hausvokabular | `docs/glossar.md` | Verbindliches Vokabular. |
| Arbeitsweise und Repositoryregeln | `AGENTS.md`, `docs/agentische-entwicklung-plan.md` | Verbindliche Arbeitsordnung; dieses Dokument ergänzt sie nicht normativ. |
| Umfang einer konkreten Änderung | zugehörige Spec in `docs/slices/` | Verbindlicher Umfang und Abnahmegegenstand der Scheibe. |

Bei einem Widerspruch oder unklaren Status dokumentiert der Agent Quelle und Auswirkung in der Spec
und gibt die Entscheidung an Planung beziehungsweise Architektur zurück. Ein neuerer Text ersetzt
eine bestehende Entscheidung nur, wenn Status und Ablösung ausdrücklich dokumentiert sind.

### 1.3 Kennzeichnung von Aussagen

- **Verbindlich** verweist auf eine bestehende Regel, einen aktuellen Vertrag oder eine angenommene Entscheidung.
- **Leitplanke** ist eine Prüfhilfe. Sie wird verbindlich, wenn die Slice-Spec sie als Kriterium übernimmt.
- **Offen** bezeichnet eine Entscheidung, die nicht durch einen Implementierungsagenten getroffen wird.

## 2. Reifestufen

Qualität ist relativ zum zugesagten Betriebszustand. Für Produktisierungsscheiben empfiehlt sich die
Angabe, für welche Reifestufe sie arbeiten.

### 2.1 Demo

- synthetische Daten und sichtbare Kennzeichnung der Demo-Betriebsart;
- lokaler Stand je Browser ist zulässig;
- keine Zusage für Mehrbenutzerbetrieb, Verfügbarkeit oder Wiederanlauf;
- keine produktiven Identitäten, Zugangsdaten oder externen Empfänger.

### 2.2 Pilot

- gemeinsame dauerhafte Persistenz und benannte reale Identitäten;
- kontrollierter Nutzerkreis, Rollen und zeitlich begrenzte Zugriffe;
- Mehrbenutzerkonflikte werden erkannt, nichts wird still überschrieben;
- Monitoring, Alarmierung, Backup und erfolgreich erprobte Wiederherstellung;
- benannter fachlicher und technischer Betreiber mit Supportweg;
- freigegebene Datenschutz- und Sicherheitsbasis sowie geprobter Rückfallpfad;
- Pilot auf begrenztem Risiko, nicht ungeprüft als führendes System der Konzern-HV.

### 2.3 Produktion

- fachliche, rechtliche, Datenschutz-, Sicherheits- und Betriebsabnahme;
- Last-, Wiederanlauf-, Restore-, Failover- und Sicherheitstests mit Nachweisen;
- produktionsgleiche Generalprobe und dokumentierter Notbetrieb;
- freigegebene und eingefrorene Konfiguration des Jahrgangs;
- betriebene Schnittstellen mit Kompatibilitäts- und Supportzusagen;
- vollständige Betriebs-, Admin-, Integrations- und Entwicklerdokumentation.

Eine Funktion gilt nicht als produktionsreif, nur weil ihr Happy Path in der Demo funktioniert.

### 2.4 Orientierungstiefe je Reifestufe

| Bereich | Demo | Pilot | Produktion |
|---|---|---|---|
| Daten | synthetisch, lokal zulässig | dauerhafte gemeinsame Daten, Konflikte, Backup/Restore | freigegebene Aufbewahrung, RPO/RTO und getesteter Failover |
| Identität | simulierte Rollen zulässig | reale benannte Identitäten und zeitlich begrenzte Rechte | Rezertifizierung, Gäste und Break-Glass abgenommen |
| Betrieb | reproduzierbarer Build und Tests | Metriken, Alarm, Runbooks und Betreiber | SLOs, Bereitschaft, Generalprobe und Notbetrieb |
| Schnittstellen | Contract Tests der Demo | Sandbox, Idempotenz und Teilausfälle | Kompatibilitätszusage, Replay und Supportweg |
| Security/Datenschutz | keine Echt- oder Zugangsdaten | freigegebene Basis und Bedrohungsmodell | Pentest/Nachtest, DSFA- und Security-Abnahme |
| Dokumentation | Entwicklerstart und Demoablauf | Admin-, Integrations- und Betriebsanleitung | vollständige Übergabe und menschlicher Drill |

Diese Tabelle ist eine Auswahlhilfe, kein zusätzliches Gate. Verbindlich wird ein Punkt erst durch
eine freigegebene Spec, ADR oder Produktentscheidung.

### 2.5 Antwortwerte für übernommene Checks

Wenn eine Spec Punkte aus diesem Katalog übernimmt, dokumentiert Planung ihren Status:

- `ja`: Kriterium ist erfüllt und der Nachweis ist benannt;
- `nein`: Kriterium ist relevant, aber nicht erfüllt — die Spec ist noch nicht abnahmefähig;
- `nicht anwendbar`: Reifestufe oder Änderung löst das Kriterium nicht aus; ein kurzer Grund genügt;
- `blockiert`: Eine fremde Entscheidung oder Voraussetzung fehlt; die betroffene Implementierung ruht.

Eine Abweichung wird nicht hier genehmigt. Der in der kanonischen Quelle beziehungsweise Slice-Spec
benannte Entscheider muss sie mit Grund, Geltungsbereich und Ablaufdatum akzeptieren.

## 3. Kompakter Planungsblock

Dieser Block ist eine Vorlage für Produktisierungsscheiben. Planung darf ihn verkürzen. Die bestehende
Slice-Vorlage und die Arbeitsregeln bleiben maßgeblich.

```markdown
## Qualitätswirkung

Reifestufe: demo | pilot | production
Risikoklasse: niedrig | mittel | hoch

- [ ] Fachregel oder Statusübergang
- [ ] API, Ereignis, Webhook oder Konfigurationsvertrag
- [ ] Persistenz, Migration oder konkurrierender Zugriff
- [ ] Rolle, Berechtigung, Identität oder Schutzklasse
- [ ] Personenbezogene oder vertrauliche Daten
- [ ] Betrieb, Verfügbarkeit, Kapazität oder Wiederherstellung
- [ ] Administrations- oder Konfigurationsfunktion
- [ ] Sichtbare Oberfläche oder Barrierefreiheit
- [ ] Externes System
- [ ] KI- oder Agentenfunktion
- [ ] Dokumentation oder Schulung

Erforderliche Gegenlesen:
Erforderliche Nachweise:
Offene Entscheidung:
```

Nur ausgelöste Punkte werden in konkrete Akzeptanzkriterien übersetzt.

## 4. Risikoklassen und Auswahl der Gegenlese

Es gilt immer die höchste ausgelöste Klasse. **Hoch** ist jede Änderung aus 4.3. **Mittel** ist eine
Verhaltens-, Vertrags- oder persistierte Datenänderung, die keinen Hoch-Trigger erfüllt. **Niedrig**
ist nur eine Änderung ohne Verhalten, Vertrag, persistierte Daten, Rechte, Personenbezug oder Betrieb.
Ist die Zuordnung unklar, gilt hoch und Planung entscheidet vor der Implementierung über eine
Herabstufung.

### 4.1 Niedrig

Beispiele sind Textkorrekturen, rein visuelle Anpassungen und interne Vereinfachungen ohne
Verhaltensänderung.

Es gelten die vorhandenen Standardgates und das unabhängige Review; bei sichtbaren Änderungen der
vorhandene Screenshot-Nachweis.

### 4.2 Mittel

Beispiele sind ein neuer Use Case, ein rückwärtskompatibles API-Feld, eine Abfrage, eine fachliche
Metrik oder eine nichtkritische Konfiguration.

Mindestnachweis ist ein Test des geänderten Verhaltens oder Vertrags sowie die dokumentierte
Bewertung von Dokumentations- und Betriebswirkung in der Spec.

### 4.3 Hoch

Hoch sind Änderungen an:

- Identität, Rollen, Rechten, Schutzklassen oder Sitzungsentzug;
- Freigabe, Verweigerung, Audit oder rechtlich relevanter Zeit;
- personenbezogenen Daten, Exporten oder Auswertungen;
- Produktivpersistenz, Migrationen, Backup oder Restore;
- externem Datentransfer, Webhooks oder Agentenzugriff;
- Administration, Konfigurationsfreigabe oder Freeze;
- Deployment, Secrets, Netzgrenzen oder Notbetrieb.

Mindestnachweis ist je nach Trigger der betroffene Positiv- und Negativtest sowie ein Fehler- oder
Wiederherstellungsfall. Die Auswahlmatrix in Abschnitt 7 konkretisiert Perspektive und Nachweis.

Planung holt vor der Implementierung die einschlägige Fachperspektive ein und schreibt deren Kriterien
in die Spec. Das unabhängige Review bleibt gemäß Arbeitsordnung auf **Spec und Diff** beschränkt. Die
Bezeichnungen Architektur, Security, Datenschutz, Legal, Betrieb und UX in diesem Dokument sind
Prüfperspektiven, keine neuen Agentenrollen. Eine Hochrisikoscheibe wird nicht allein durch Agenten zur
Produktion freigegeben.

## 5. Planungshilfe vor Implementierung

Planung nutzt diese Kurzliste, um die vorhandene Slice-Spec ausführbar zu machen:

- [ ] Nutzer, Nutzen und beobachtbares Ziel sind klar.
- [ ] Nicht-Ziele verhindern naheliegende Überimplementierung.
- [ ] Betroffene kanonische Regeln, ADRs, Module und Verträge sind benannt.
- [ ] Fachliche Invarianten und Fehlerfälle sind beschrieben.
- [ ] Die ausgelösten Qualitätsbereiche aus Abschnitt 3 sind bewertet.
- [ ] Gleichzeitige Bearbeitung, Wiederholung und Teilausfall sind berücksichtigt, soweit ausgelöst.
- [ ] Akzeptanzkriterien sind unabhängig vom Implementierer überprüfbar.
- [ ] Notwendige Testarten, Nachweise und Gegenlesen sind benannt.
- [ ] Dokumentations- und Migrationsbedarf ist benannt.
- [ ] Die Scheibe ist höchstens ein Agententag groß oder weiter zerlegt.
- [ ] Keine offene Grundsatzentscheidung wird still der Implementierung überlassen.

Eine noch offene Grundsatzentscheidung wird in Abschnitt 11 vermerkt und an Planung oder Architektur
zurückgegeben; der Implementierer entscheidet sie nicht im Code.

## 6. Qualitätschecks

Die folgenden Listen sind ein nichtnormativer Auswahlkatalog. Die Slice-Spec übernimmt nur durch
Änderungsart und Reifestufe ausgelöste Checks und macht sie zu konkreten Akzeptanzkriterien.

Für eine **Demo** werden grundsätzlich 6.1, 6.2, 6.9, 6.11 und 6.12 betrachtet; weitere Abschnitte
nur bei entsprechender Änderung. Für einen **Pilot** werden alle von der Änderung berührten Abschnitte
betrachtet; Zielwerte für RPO, RTO und SLO dürfen noch als freizugebende Pilotwerte markiert sein. Für
**Produktion** werden alle berührten Abschnitte mit freigegebenen Zielwerten und realen Betriebsnachweisen
betrachtet. Event-Replay, Dead Letter und Webhook-Nachweise gelten nur, wenn die Änderung asynchrone
Auslieferung berührt. Migration gilt nur bei persistierter Schema- oder Bedeutungsänderung. Die
Antwort `nicht anwendbar` hält diese Auswahl sichtbar, ohne unnötige Nachweise zu erzeugen.

### 6.1 Fachliche Korrektheit

- [ ] Jeder neue Zustand und Übergang hat eine Regel-ID und einen Positiv- und Negativtest.
- [ ] Pflichtdaten werden in der Domäne erzwungen, nicht nur in der Oberfläche.
- [ ] Eine Freigabe bezeichnet genau die freigegebene Textversion.
- [ ] Rückgabe, Wiederholung und nachträgliche Änderung haben eindeutige Folgen.
- [ ] Fachlich maßgebliche und lediglich abgeleitete Daten sind getrennt.
- [ ] Tatsächlich Gesagtes und vorbereiteter Entwurf werden nicht gleichgesetzt.
- [ ] Die verantwortliche Person oder Rolle ist eindeutig; Beratung und Entscheidung sind getrennt.
- [ ] Die Rechtsabteilung hat rechtlich begründete neue Regeln beziehungsweise Legal Traces geprüft.

**Blocker:** Eine Regel wird in UI, Server und Hintergrundprozess unabhängig nachgebaut; eine
ungeklärte Rechtsfrage wird durch einen technischen Default entschieden.

### 6.2 Architektur und Modulgrenzen

- [ ] Fachlogik bleibt frei von HTTP-, Datenbank-, Cloud-, Datei- und KI-SDKs.
- [ ] Die UI leitet weder Rechte noch Statuslogik aus Rollenbezeichnungen ab.
- [ ] Ein Modul greift nur über eine benannte öffentliche Schnittstelle auf ein anderes Modul zu.
- [ ] Eine Änderung an einer harten Grenze ist durch eine neue oder aktualisierte ADR gedeckt.
- [ ] Ein neuer Dienst hat einen belegten unabhängigen Skalierungs-, Sicherheits- oder Ownershipgrund.
- [ ] Die Abhängigkeitsrichtung ist automatisiert prüfbar.
- [ ] Der lokale Entwicklungsweg bleibt einfach und produktionsnah genug, um Fehler nachzustellen.

**Leitplanke:** Ein modularer Monolith ist der Standard. Ein Microservice ist eine zu begründende
Ausnahme, kein Reifezeichen.

### 6.3 Daten, Konsistenz und Migration

- [ ] Quelle der Wahrheit und Transaktionsgrenze sind benannt.
- [ ] Gleichzeitige Änderungen führen zu einem sichtbaren Konflikt statt stillem Überschreiben.
- [ ] Wiederholte Schreibaufrufe sind idempotent und an Akteur und Operation gebunden.
- [ ] Zustandsänderung und auszulieferndes Ereignis können nicht auseinanderfallen.
- [ ] Ereignisse und persistierte Verträge besitzen eine Evolutionsstrategie.
- [ ] Migrationen laufen gegen realistischen Vollbestand und werden bei Neustart sicher fortgesetzt.
- [ ] Roll-forward und, soweit möglich, Rollback sind beschrieben.
- [ ] Backup umfasst Daten, Anhänge, Konfiguration, Schlüsselbezug und notwendige Metadaten.
- [ ] Restore wurde ausgeführt und fachlich verifiziert, nicht nur technisch gestartet.
- [ ] Aufbewahrung, Archivierung, Export und Löschung sind für neue Daten geklärt.

**Offen:** Vor der Produktivpersistenz ist per ADR zu entscheiden, ob vollständiges Event Sourcing
oder transaktionaler Zustand mit unveränderlichem Auditlog und Outbox verwendet wird.

### 6.4 API, Events und Integrationen

- [ ] Der Vertrag wurde vor Implementierung geändert und generierte Artefakte sind aktuell.
- [ ] Die Änderung ist rückwärtskompatibel oder besitzt einen freigegebenen Migrationspfad.
- [ ] Erfolg, Validierungsfehler, fehlendes Recht, Konflikt, Nichtfinden und interner Fehler sind
      konsistent modelliert.
- [ ] Limits, Pagination, Filtersemantik, Idempotenz und Konkurrenzverhalten sind dokumentiert.
- [ ] Contract Tests prüfen Anfrage und Antwort gegen das veröffentlichte Schema.
- [ ] Webhooks tragen Ereignis-ID, Typ, Schemaversion, Zeitpunkt, Jahrgang und Korrelations-ID.
- [ ] Signatur, Wiederholung, Reihenfolge, Deduplizierung, Dead Letter und Replay sind definiert.
- [ ] Timeouts und Teilausfälle eines Nachbarsystems blockieren keine unbeteiligten Kernprozesse.
- [ ] Sandbox, synthetische Beispieldaten und mindestens ein ausführbares Beispiel sind vorhanden.
- [ ] Deprecation und unterstützter Kompatibilitätszeitraum sind sichtbar.

### 6.5 Sicherheit

- [ ] Authentifizierung und Autorisierung werden serverseitig erzwungen.
- [ ] Rolle, Zuweisung, Jahrgang, Schutzklasse und Zeitfenster werden soweit erforderlich gemeinsam
      bewertet.
- [ ] Nichtberechtigte erkennen weder Inhalt noch Existenz, Zählerlücke oder ableitbare ID geschützter
      Vorgänge.
- [ ] Neue Aktionen sind für niemanden erlaubt, bis sie ausdrücklich vergeben und getestet wurden.
- [ ] Massenlesen, Export, Druck, Kopieren und Rechteerhöhung sind begrenzt und auditiert.
- [ ] Secrets liegen in keinem Repository, Buildartefakt, Log, Screenshot oder Agentenkontext.
- [ ] Abhängigkeiten, Quellcode, Container und Secrets werden automatisiert geprüft.
- [ ] Ein Missbrauchsfall und seine Erkennung wurden für jede Hochrisikoänderung ergänzt.
- [ ] Sitzungsentzug und Break-Glass funktionieren unabhängig vom normalen Happy Path.
- [ ] Sicherheitsrelevante Ausnahmen haben Owner, Ablaufdatum und nachvollziehbare Risikoakzeptanz.

### 6.6 Datenschutz und Betriebsrat

- [ ] Zweck, Rechtsgrundlage, Quelle, Empfänger und Schutzklasse neuer personenbezogener Daten sind
      dokumentiert.
- [ ] Jede Rolle sieht nur die für ihren Zweck erforderlichen Felder.
- [ ] Identitätsdaten sind von Fachinhalten getrennt oder die Nichttrennung ist begründet.
- [ ] Logs, Traces, Fehlermeldungen und Testartefakte enthalten keine unnötigen Personen- oder
      Inhaltsdaten.
- [ ] Aufbewahrung und Löschung gelten getrennt für Nachweis, Entwurf, Zugriff, Export und KI-Verarbeitung.
- [ ] Betroffenenexport und Berichtigung bleiben möglich, ohne Nachweise unbemerkt umzuschreiben.
- [ ] Neue personenbezogene Auswertungen aktualisieren den maschinell erzeugten Auswertungskatalog.
- [ ] Die Änderung wurde auf DSFA- und Mitbestimmungsrelevanz geprüft.

### 6.7 Betrieb und Resilienz

- [ ] Ein fachliches und ein technisches Signal zeigen Erfolg beziehungsweise Rückstau.
- [ ] Strukturierte Logs, Metriken und Traces teilen eine Korrelations-ID und Deploymentversion.
- [ ] Erwartete Fehler sind von Defekten und Sicherheitsereignissen unterscheidbar.
- [ ] Alarm, Schwelle, Empfänger, Reaktionszeit und sichere Sofortmaßnahme sind benannt.
- [ ] Ein Runbook deckt Diagnose, Begrenzung, Wiederherstellung und Nachprüfung ab.
- [ ] Abhängigkeitenausfall hat einen definierten Timeout, Fallback oder degradierten Modus.
- [ ] Kapazität wurde mit wachsendem Vollbestand und realistischem Tagesprofil geprüft.
- [ ] RPO und RTO passen zur fachlichen Kritikalitätsklasse und zum HV-Zeitfenster.
- [ ] Zertifikate, Schlüssel, Quoten, Speicher und Hintergrundwarteschlangen werden überwacht.
- [ ] Der manuelle Rückfallpfad und die Rückkehr in das System sind geprobt.

### 6.8 Administration und Konfiguration

- [ ] Fachadministration, Rechteadministration, Plattformbetrieb, Security und Revision sind getrennt.
- [ ] Eine Einstellung ist tatsächlich variabel und keine unveränderliche Fach- oder Sicherheitsregel.
- [ ] Name, Hilfe, Standardwert und Auswirkung sind fachlich verständlich.
- [ ] Kritische Änderungen zeigen einen lesbaren Diff und eine Auswirkungsanalyse.
- [ ] Änderungen können im Testjahrgang simuliert und als betroffene Rolle betrachtet werden.
- [ ] Vorbereitung und Freigabe sind bei kritischer Konfiguration personell getrennt.
- [ ] Version, Autor, Grund, Zeitpunkt, Freigabe und Aktivierung werden auditiert.
- [ ] Geplante Aktivierung, Freeze und definierte Notfallparameter werden erzwungen.
- [ ] Rollback stellt einen bekannten Konfigurationsstand wieder her, ohne Audit zu entfernen.
- [ ] Der Admin kann die Aufgabe ohne Datei-, SQL- oder Kommandozeilenzugriff erledigen.

### 6.9 UX und Barrierefreiheit

- [ ] Die Ansicht ist auf Aufgabe und Rolle zugeschnitten, nicht auf das Datenmodell.
- [ ] Primäraktion, aktueller Stand, nächste Folge und Fehlerbehebung sind ohne Anleitung erkennbar.
- [ ] Komplexität wird schrittweise gezeigt; seltene Administration belastet den operativen Fokus nicht.
- [ ] Tastatur, Fokus, Screenreader, Kontrast, Zoom und reduzierte Bewegung sind geprüft.
- [ ] Live-Aktualisierung verschiebt keinen Fokus und überflutet keine Assistenztechnik.
- [ ] Lade-, Leer-, Fehler-, Konflikt-, Offline- und Nur-Lesen-Zustände sind gestaltet.
- [ ] Kritische Aktionen sind eindeutig, aber nicht durch wiederholte Bestätigungen unbenutzbar.
- [ ] Die Oberfläche wurde unter realistischem Bestand und Zeitdruck geprüft.
- [ ] Deutsche und amerikanisch-englische Texte stammen vollständig aus der i18n-Quelle.

### 6.10 KI- und Agentenfunktionen

- [ ] Jede Agentenfunktion besitzt eine eigene technische Identität und minimalen Scope.
- [ ] Der Agent nutzt ausschließlich freigegebene Ports oder APIs und nie direkten Datenbankzugriff.
- [ ] Ein Vorschlag ist sichtbar von einer menschlichen Entscheidung und Freigabe getrennt.
- [ ] Modell, Anbieter, Modellversion, Promptversion, Quellen und Zeitpunkt sind nachvollziehbar.
- [ ] Personenbezogene oder vertrauliche Daten werden vor Übermittlung minimiert oder redigiert.
- [ ] Prompt Injection, manipulierte Quellen, Datenabfluss und überbreite Werkzeugrechte sind getestet.
- [ ] Timeout, Rate-, Kosten- und Größenlimit sind technisch erzwungen.
- [ ] Ein regelbasierter oder manueller Fallback hält den kritischen Prozess ohne KI funktionsfähig.
- [ ] Modell- und Promptwechsel durchlaufen ein versioniertes Evaluationsset und Regressionstor.
- [ ] Kill Switch und Widerruf laufender Agentenzugriffe sind vorhanden und auditiert.

### 6.11 Dokumentation und Developer Experience

- [ ] README und Repositorykarte beantworten Zweck, Start, Tests und Einstiegspunkte korrekt.
- [ ] Eine tragende Entscheidung ist als ADR mit Kontext, Alternativen und Folgen dokumentiert.
- [ ] Daten-, Event-, Konfigurations- und API-Verträge sind maschinenlesbar und mit Beispielen versehen.
- [ ] Kommentare erklären das Warum und referenzieren bei Bedarf Regel-ID oder ADR.
- [ ] Ein „How to change“-Weg erklärt neue Use Cases, Endpunkte, Ereignisse, Rechte und Migrationen.
- [ ] Betrieb, Administration und Integration haben getrennte zielgruppengerechte Anleitungen.
- [ ] Dokumentationslinks und generierte Artefakte werden in CI geprüft.
- [ ] Ein neuer Entwickler kann lokal ohne geheime mündliche Schritte starten und debuggen.

### 6.12 Einfachheit und Wartbarkeit

- [ ] Die Lösung verwendet vorhandene Konzepte, bevor sie neue einführt.
- [ ] Eine neue Abstraktion löst mindestens zwei reale heutige Fälle oder schützt eine harte Grenze.
- [ ] Öffentliche Moduloberflächen sind kleiner als ihre interne Implementierung.
- [ ] Eine neue Abhängigkeit hat klaren Nutzen, gepflegten Lebenszyklus und akzeptable Lizenz.
- [ ] Feature Flags und Übergangspfade haben Owner und Entferndatum.
- [ ] Toter Code, alte Adapter und abgelöste Konfiguration werden in derselben oder benannter Folgescheibe
      entfernt.
- [ ] Der Diff ist die kleinste vollständige Lösung des spezifizierten Problems.

**Blocker:** generische Plattformfunktion „für später“, neuer Dienst ohne belegten Grund, zweite Kopie
einer Regel, manuell synchronisierte Vertragstypen oder zusätzliche Infrastruktur ohne Betriebsmodell.

## 7. Auswahlmatrix für Prüfperspektiven und Nachweise

| Änderung | Prüfperspektive | Mindestnachweis in der Spec |
|---|---|---|
| Fachregel, Status, Freigabe, Verweigerung | Domänenarchitektur; bei Rechtsbezug Legal | Regel-ID, Positiv-/Negativtest, fachliche Entscheidung |
| Rolle, Recht, Identität, Schutzklasse | Security und Policy | Policy-Diff, erlaubter und verweigerter Zugriff |
| personenbezogenes Feld oder Auswertung | Datenschutz; bei Auswertung Mitbestimmung | Zweck/Sichtbarkeit/Aufbewahrung; Auswertungskatalog-Diff |
| Datenmodell oder Migration | Datenarchitektur und Betrieb | Migration mit realistischem Bestand und Wiederanlauf |
| Audit, Aufbewahrung, Export | Legal, Datenschutz und Security | Manipulations-/Berechtigungstest und Exportnachweis |
| API, Event, Webhook | Integration und Vertrag | Schema-/Contract-Test; bei Zustellung Wiederholung und Deduplizierung |
| Admin- oder Konfigurationsfunktion | Fachadmin-UX und Security | Auswirkungs-Diff, Berechtigungstest und Rückkehr zum Vorzustand |
| Deployment, Secret, Netz- oder Laufzeitänderung | Betrieb und Security | Deployment-/Fehlerfall; Secret- und Abhängigkeitsscan |
| KI- oder Agentenfunktion | Security, Datenschutz und Evaluation | Scope-Test, Datenfluss, Regressionsevaluation und Fallback |
| Podium oder anderer kritischer Arbeitsbildschirm | UX, Accessibility und Betrieb | E2E, Tastatur-/Fokusprüfung, Screenshot und Fehlerzustand |

Der unabhängige Reviewer ändert den Code nicht und sieht gemäß Arbeitsordnung nur Spec und Diff. Die
Planung sollte deshalb relevante Regeln, Fachentscheidungen und überprüfbare Kriterien in die Spec
übernehmen. Implementierernarrativ ersetzt keine Prüfung. Nach zweimaliger erfolgloser Nacharbeit
geht die Scheibe gemäß bestehendem Takt zurück an Architektur beziehungsweise Fachplanung.
Ist für eine Perspektive keine benannte Fachperson oder Agentenrolle vorhanden, markiert Planung den
Punkt `blockiert` und eskaliert an die Projektleitung; sie erfindet keine neue Zuständigkeit.

## 8. Abnahmehilfe für die Slice-Spec

Die Spec wählt daraus die zutreffenden Abnahmepunkte. Die verbindliche Definition des Abschlusses und
das Berichtsformat bleiben in `AGENTS.md`:

- [ ] Ziel und alle Akzeptanzkriterien sind nachweislich erfüllt.
- [ ] Nicht-Ziele und erlaubter Dateiumfang wurden eingehalten.
- [ ] Kein kanonischer Vertrag driftet von Code, generierten Artefakten oder Dokumentation ab.
- [ ] Happy Path, Berechtigungsfehler, Validierung, Konflikt und relevanter Teilausfall sind getestet.
- [ ] Alle automatischen Tore sind grün und neue Warnungen sind behoben oder befristet akzeptiert.
- [ ] Security-, Datenschutz-, Legal-, Operations- und UX-Befunde sind geschlossen, soweit ausgelöst.
- [ ] Migration, Roll-forward und Wiederanlauf wurden nachgewiesen, soweit betroffen.
- [ ] Logs, Metriken, Traces, Alarm und Runbook wurden ergänzt, soweit betroffen.
- [ ] Nutzer-, Admin-, Integrations-, Betriebs- und Entwicklerdokumentation ist aktuell.
- [ ] UI-Änderungen besitzen aktuelle Screenshots; kritische Abläufe einen End-to-End-Nachweis.
- [ ] Unabhängiges Review ist akzeptiert und offene Punkte sind mit Owner und Termin dokumentiert.
- [ ] Der Abschlussbericht enthält reale Ausgaben, nicht nur die Aussage „Tests bestanden“.

## 9. Kandidaten für Meilensteinabnahmen

Die folgenden Listen sind Vorschläge für spätere freigegebene Meilenstein-Specs. Sie sind nicht durch
dieses Dokument allein verbindlich.

### 9.1 Produktionsfundament

- angenommene ADRs für Zielarchitektur, Persistenz, Identität, Audit, Konfiguration und Deployment;
- transaktionale Produktivpersistenz, Migrationen und Mehrbenutzer-Konfliktmodell;
- OIDC beziehungsweise freigegebener Identitätsadapter und technische Systemidentitäten;
- Observability-Grundlage, automatisiertes Deployment, Backup und bestandener Restore;
- ein vollständiger vertikaler Referenzpfad von UI über API und Domäne bis Persistenz, Audit und Betrieb;
- menschliches Architektur- und Entwicklererfahrungsreview dieses Referenzpfads.

### 9.2 Pilotbereit

- gemeinsame Umgebung mit realen Identitäten und begrenztem, rezertifiziertem Nutzerkreis;
- freigegebene Rollen-, Datenschutz- und Security-Basis;
- realistische Last- und Konkurrenztests;
- Support, Alarmierung, Runbooks und Rückfallentscheidung benannt;
- Betreiber hat Deployment, Diagnose, Restore und Rückfallpfad selbst ausgeführt;
- Pilotumfang, Erfolgskriterien und bekannte Risiken sind freigegeben.

### 9.3 Produktionsbereit

- fachliche und rechtliche Baseline des Jahrgangs ist versioniert und freigegeben;
- Security Review, externer Pentest und Nachtest ohne offene unakzeptierte kritische Befunde;
- Last-, Restore-, Failover- und Degradationstests auf produktionsgleicher Umgebung;
- vollständige Generalprobe mit realen Rollen und Störszenarien;
- eingefrorene Konfiguration, Rechte-Snapshot, Betriebsfreigabe und Exkulpationsnachweise;
- unabhängiges menschliches Abschlussreview von Code, Architektur, Betrieb und Dokumentation.

## 10. Empfohlene menschliche Prüfpunkte

Für frühes Feedback statt teurer Endnacharbeit bieten sich diese Prüfpunkte an:

1. **Zielarchitektur:** Modulgrenzen, Persistenz, Identity, Deployment und Betriebsmodell vor dem Bau.
2. **Vertikaler Referenzpfad:** Verständlichkeit, Transaktionen, Tests, lokale Entwicklung und Diagnose.
3. **Administration:** Konfigurationsmodell, Rechte und Bedienbarkeit gemeinsam mit einem Fachadmin.
4. **Betrieb und Sicherheit:** Bedrohungsmodell, Wiederherstellung, Runbooks und Zugriffstrennung.
5. **Abschluss:** Gesamtcode, offene Risiken, Dokumentationsqualität und Übergabefähigkeit.

Als praktische Abnahme soll ein neuer Entwickler innerhalb von zwei Stunden das System starten, einen
Request durch UI, API, Domäne und Persistenz verfolgen, Tests ausführen und den richtigen Ort für eine
kleine Änderung finden können. Abweichungen werden als Produktbefund behandelt, nicht als persönliches
Onboardingproblem.

## 11. Offene Entscheidungen vor dem Produktbau

| Entscheidung | Blockiert spätestens | Entscheider / Gegenlese |
|---|---|---|
| Ziel-Hosting- und Laufzeitplattform | Deploymentfundament | Konzern-IT, Betrieb, Architektur |
| Event Sourcing oder Zustand + Audit/Outbox | Produktivpersistenz | Architektur, Daten, Betrieb, Legal |
| Datenbanktopologie und Hochverfügbarkeit | Pilotpersistenz | Betrieb, Architektur |
| Jahrgangs- und mögliche Mandantentrennung | Schema und Schlüsselmodell | Fachseite, Datenschutz, Architektur |
| IdP, Gastzugänge und Break-Glass | reale Identitäten | IAM, Security, Betrieb |
| verbindliche RPO-, RTO- und SLO-Werte | Betriebsabnahme | Fachseite, Betrieb, Legal |
| Schutzklassen sowie Aufbewahrung und Löschung | Echtdaten | Legal, Datenschutz, Security |
| endgültiger Rollenzuschnitt und Vertretungen | Rechte-Migration | Fachseite, Legal, Security |
| Transkriptionsformat und Zustellweg | Ingest-Schnittstelle | Fachseite, Anbieter, Integration |
| erlaubte KI-/Agentenfunktionen und Datenräume | erste Agentenfunktion | Product Owner, Legal, Datenschutz, Security |
| Product Owner, fachlicher und technischer Betreiber | Pilotplanung | Projektleitung |
| menschliche Freigabe für Hochrisikoänderungen | erster Produktivmerge | Projektleitung, Engineering |
| Annahme, Ablösung oder Anpassung der vorgeschlagenen ADR 0001 | Zielarchitektur | Architektur, Engineering |
| HV-Format und aktiviertes Vorabfragenregime | fachliches Zielmodell und Fristen | Projektleitung, Legal |
| verbindlicher Wortlaut aus Satzung, Geschäftsordnung, Einberufung und Anordnung | rechtliche Regeltabellen | Legal, Projektleitung |
| Legitimation sowie Aktien- und Teilnehmermodell | Identitäts- und Eingangsmodell | Legal, Fachseite, Anbieter |
| formale Letztfreigabe und Eilpfad | Freigabestatus und Rechte | Vorstand, Legal, Fachseite |
| Notarzugang und Protokollübergabe | Notar- und Verweigerungspfad | Legal, Notar, Integration |
| Veröffentlichungsumfang und tatsächlich gegebene Antwort | Publikations- und Nachweismodell | Legal, IR |
| Lastbaseline und konkreter Pilot | Kapazitäts- und Einführungsplanung | Projektleitung, Betrieb |

Agenten dürfen zu diesen Punkten Optionen, Konsequenzen und ADR-Entwürfe liefern. Sie dürfen die
Entscheidung nicht durch eine beiläufige Implementierung vorwegnehmen.

## 12. Pflege dieses Dokuments

- Neue kanonische Regeln werden verlinkt, nicht hier kopiert.
- Eine neue Qualitätsfrage benennt den beobachtbaren Fehler, den sie verhindern soll.
- Bei jedem Produktmeilenstein werden unklare, wiederholt nicht anwendbare oder doppelte Punkte
  vereinfacht oder entfernt.
- Jede akzeptierte Ausnahme hat Owner, Grund, Geltungsbereich und Ablaufdatum.
- Vor jedem Produktmeilenstein prüft Architektur dieses Dokument auf veraltete Pfade und offene
  Entscheidungen.
- Für Änderungen an diesen Leitplanken empfiehlt sich eine kleine dokumentierte Scheibe mit dem in
  der bestehenden Arbeitsordnung vorgesehenen unabhängigen Review.
