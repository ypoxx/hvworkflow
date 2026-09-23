# Produktreife — Qualitätsleitplanken und Reviewkatalog

**Status:** Prüfhilfe für Spec-Autoren und Reviewer · **Stand:** 23. September 2026 (Scheibe 009,
konsolidiert aus Scheibe 008)

## 1. Zweck und Rang

**AGENTS.md ist die einzige Arbeitsordnung**, docs/produktplan-beta.md der Plan. Dieses Dokument führt
keine Regel, kein Tor, keine Rolle und keine Freigabe ein. Es hilft beim Schreiben und Prüfen einer
Slice-Spec bei drei Fragen:

1. Welche Qualitätsbereiche berührt eine Scheibe, und welche Risikoklasse hat sie?
2. Welche Perspektive prüft sie, welche Rolle trägt diese Perspektive, welche Nachweise folgen daraus?
3. Hängt sie an einer offenen Entscheidung, und wenn ja, mit welcher Standardannahme wird trotzdem gebaut?

Ein Punkt aus diesem Katalog wird für eine Scheibe erst verbindlich, wenn die Spec ihn als
Akzeptanzkriterium übernimmt; ohne Übernahme verbindlich sind nur die beiden Festlegungen in 1.3. Das Dokument
kopiert weder Operationen, Rollenmatrix, Übergänge noch Rechtsanforderungen, wählt weder Plattform, IdP,
Datenbanktopologie noch KI-Anbieter und erteilt keine Rechts-, Sicherheits- oder Produktionsfreigabe.

### 1.1 Quellen und ihr Status

| Gegenstand | Quelle | Status |
|---|---|---|
| Arbeitsordnung | `AGENTS.md` (Regeln 1–12) | verbindlich |
| Plan, Scheiben, Standardannahmen | `docs/produktplan-beta.md` | verbindlich für Reihenfolge und Umfang |
| Umfang einer Scheibe | `docs/slices/NNN-*.md` | verbindlich für diese Scheibe |
| Vertrag | `packages/contract/openapi.yaml`, generierte Typen | verbindlich |
| Übergänge, Rechte, Ereignisse | `transitions.ts`, `permissions.ts` (`ROLE_PERMISSIONS`), `can()` in `api.ts`, `events.ts`/`state.ts` | verbindlich (Stand des Codes) |
| Schichtung | ADR 0001 | vorgeschlagen, **operativ bindend** (1.3); Annahme an Prüfpunkt 1 (E42) |
| Weitere Architektur | ADR 0002 angenommen; ab 015 ADR 0003–0016 | nur angenommene ADRs entscheiden; gegen vorgeschlagene wird mit Vermerk „auf Standard gebaut" gebaut |
| Offene Entscheidungen | Plan Abschnitt 10; ab 014 `docs/entscheidungsregister.md` | Standardannahme gilt, bis der Entscheider antwortet |
| Recherche, Ist-Analyse, Rechtekonzept | `docs/anforderungen-recherche.md`, `docs/ist-analyse-und-schnittstellen.md`, `docs/rollen-und-rechtekonzept.md` | Kandidaten und Zielbild; Normzitate ungeprüft (E15) |
| Hausvokabular | `docs/glossar.md` | verbindlich |

Bei Widerspruch nennt die Spec Quelle und Auswirkung und gibt die Frage an den Architekten zurück; ein neuerer
Text ersetzt eine Entscheidung nur mit ausdrücklich dokumentierter Ablösung.

### 1.2 Kennzeichnung

**Verbindlich** ist eine bestehende Regel, der aktuelle Vertrag, eine angenommene Entscheidung oder 1.3;
eine **Leitplanke** ist eine Prüfhilfe, verbindlich sobald die Spec sie übernimmt; **offen** ist die Entscheidung
eines Menschen, gebaut wird dann auf der Standardannahme aus dem Register (Abschnitt 11).

### 1.3 Zwei Festlegungen, die nicht zur Wahl stehen

**ADR 0001 ist operativ bindend.** Die drei Grenzen gelten ab sofort für jede Scheibe, obwohl der ADR formal
„vorgeschlagen" ist; die Annahme folgt an Prüfpunkt 1 (`docs/adr/0001-vorlage-annahme.md`). Eine Verletzung
ist im Review ein Blocker:

1. *Oberfläche gegen Anwendung:* Die Oberfläche spricht nur `HvApi` bzw. den generierten Client, rendert
   nur `_actions` und enthält keine Geschäftsregel, keine Rechtelogik, keine Statusmaschine (Regeln 4–6).
2. *Fachlichkeit gegen Technik:* `packages/domain` kennt weder HTTP noch Datenbank noch Dateisystem und keine
   eigene Uhr, nur den injizierten Clock-Port (Regel 8); alles Technische hängt an Ports, die der Kern definiert.
3. *Eigenes gegen Fremdes:* ein Adapter je Nachbarsystem hinter einem kanonischen Vertrag; kein
   Fremdformat erreicht den Kern.

Wer eine Grenze verschieben will, schreibt einen neuen ADR; eine Scheibe tut es nie beiläufig.
**Regel 7 ist nicht verhandelbar.** Ereignisse werden nur angehängt, Zustand ist eine Projektion. Es gibt
keine offene Entscheidung „Event Sourcing oder Zustand mit Auditlog und Outbox". Offen ist nur die
Speicherform des Logs (Plan Abschnitt 3, ADR 0003); Umkodieren ist ein Export in eine neue Datenbank, nie
eine Änderung am Log.

## 2. Reifestufen

Qualität ist relativ zum zugesagten Betriebszustand. Die Beta des Plans entspricht der Stufe Pilot
(Schattenbetrieb, nie führend). Die Spec kann ihre Stufe im Planungsblock (3) nennen; die Tabelle ist Auswahlhilfe, kein Tor. Eine Funktion
ist nicht produktionsreif, nur weil ihr Happy Path in der Demo läuft.

| Bereich | Demo | Pilot (Beta) | Produktion |
|---|---|---|---|
| Daten | synthetisch, lokal je Browser | gemeinsame dauerhafte Daten, sichtbare Konflikte, Backup und erprobter Restore | freigegebene Aufbewahrung, RPO/RTO, getesteter Failover |
| Identität | simulierte Rollen | reale benannte Identitäten, befristete Rechte, Notfallkonten | Rezertifizierung, Gäste, Break-Glass abgenommen |
| Betrieb | reproduzierbarer Build und Tests | Kennzahlen, Alarm, Runbook, benannter Betreiber | SLOs, Bereitschaft, Generalprobe, Notbetrieb |
| Schnittstellen | Vertragstests | Sandbox, Idempotenz, Teilausfälle | Kompatibilitätszusage, Replay, Supportweg |
| Security, Datenschutz | keine Echt- oder Zugangsdaten | Bedrohungsmodell, BV-verträglicher Schnitt | Pentest und Nachtest, DSFA- und Security-Abnahme |
| Dokumentation | Entwicklerstart, Demo-Skript | Admin-, Integrations-, Betriebsanleitung | vollständige Übergabe, menschlicher Drill |

**Antwortwerte** für übernommene Checks: `ja` (erfüllt, Nachweis benannt) · `nein` (relevant, nicht erfüllt,
Spec nicht abnahmefähig) · `nicht anwendbar` (kurzer Grund) · `blockiert` (nur wenn eine Voraussetzung fehlt,
für die das Register **keine** Standardannahme hat; sonst Bau auf Standard mit Vermerk „auf Standard gebaut
am <Datum>"). Abweichungen genehmigt der in Spec oder Register benannte Entscheider mit Eigentümer, Grund, Geltungsbereich
und Ablaufdatum, nicht dieses Dokument.

## 3. Planungsblock für die Spec

Ergänzt die Slice-Vorlage (docs/slices/README.md); der Spec-Autor darf kürzen.

```markdown
## Qualitätswirkung
Reifestufe: demo | pilot | production · Risikoklasse: niedrig | mittel | hoch
Herabstufung freigegeben von: <Mensch> am <Datum>   (nur bei Herabstufung, Abschnitt 4)
Ausgelöst: [ ] Fachregel, Status [ ] Vertrag, Ereignis, Konfiguration [ ] Persistenz, Migration, Nebenläufigkeit
[ ] Rolle, Recht, Identität, Schutzklasse [ ] personenbezogene oder vertrauliche Daten [ ] Betrieb, Wiederherstellung
[ ] Administration [ ] Oberfläche, Barrierefreiheit [ ] Nachbarsystem [ ] KI, Agenten [ ] Dokumentation, Schulung
Perspektive(n) und Rolle (Abschnitt 5): …   Nachweise: …   Offene Entscheidung (E-Nr., Standard): …
```

Vor dem Bau prüft der Spec-Autor: Ziel und Nutzen beobachtbar; Nicht-Ziele verhindern Überbau; kanonische
Regeln, ADRs, Module benannt; Invarianten und Fehlerfälle beschrieben; Nebenläufigkeit, Wiederholung und
Teilausfall bedacht, soweit ausgelöst; Akzeptanzkriterien ohne den Implementierer prüfbar; Scheibe höchstens
einen Agententag groß; keine Grundsatzentscheidung still dem Implementierer überlassen.

## 4. Risikoklassen und Herabstufung

Es gilt die höchste ausgelöste Klasse. **Ist die Zuordnung unklar, gilt hoch.**

- **Hoch** ist jede Änderung an Identität, Rollen, Rechten, Schutzklassen oder Sitzungsentzug; Freigabe,
  Verweigerung, Audit oder rechtlich relevanter Zeit; personenbezogenen Daten, Exporten, Auswertungen;
  Produktivpersistenz, Migration, Backup, Restore; externem Datentransfer, Webhooks, Agentenzugriff;
  Administration, Konfigurationsfreeze; Deployment, Secrets, Netzgrenzen, Notbetrieb.
- **Mittel** ist eine Verhaltens-, Vertrags- oder persistierte Datenänderung ohne Hoch-Auslöser.
- **Niedrig** ist nur eine Änderung ohne Verhalten, Vertrag, persistierte Daten, Rechte, Personenbezug
  oder Betrieb (Text, reine Optik, interne Vereinfachung, Dokumentation).

Was aus der Klasse folgt, steht im Plan (6.1, 6.3) und wird hier nur zusammengefasst:

| Klasse | Mindestnachweis | Review |
|---|---|---|
| hoch | Positiv- und Negativtest je Auslöser, ein Fehler- oder Wiederherstellungsfall; bei Rechten und Übergängen der Wahrheitstabellen-Diff **vor** dem Bau in der Spec | anderes Modell mit benannter Perspektive; Lesebefund der Spec vor dem Bau; nie gebündelt |
| mittel | Test des geänderten Verhaltens oder Vertrags; Doku- und Betriebswirkung in der Spec bewertet | anderes Modell |
| niedrig | vorhandene Tore; bei sichtbarer Änderung Screenshot | anderes Modell; Bündelung derselben Lane erlaubt |

**Herabstufen entscheidet der Mensch.** Ein Agent stuft nie herab. Die Spec trägt dann die Zeile
„Herabstufung freigegeben von <Mensch> am <Datum>"; ab Scheibe 016 blockiert `scripts/downgrade-check.mjs`
eine Herabstufung ohne diese Zeile. Eine Hochrisikoscheibe wird nie allein durch Agenten in Produktion gebracht.

## 5. Perspektiven und wer sie trägt

Security, Datenschutz, Legal, Betrieb und UX sind **Checklisten, keine Agentenrollen**. Sie werden auf die
Rollen abgebildet, die es heute gibt:

| Perspektive | Checkliste | Trägt heute | Ausgelöst durch |
|---|---|---|---|
| Domäne, Legal | 6.1 | Reviewer (Opus) mit Perspektive Legal; Normzitate bleiben `verified:false` bis Recht antwortet (E15) | Regel, Status, Freigabe, Verweigerung, Frist |
| Architektur | 1.3, 6.2 | Architekt beim Spec-Schreiben; Reviewer prüft die Grenzen | neue Module, Ports, Abhängigkeiten |
| Security | 6.5 | Reviewer mit Perspektive Security; Sicherheitsreview des Architekten an den Prüfpunkten 3, 4 und 7 | Rechte, Identität, Sitzung, Secrets, Export |
| Datenschutz | 6.6 | Reviewer mit Perspektive Datenschutz; Zulieferung an DSB und Betriebsrat über den Eigentümer (E13, E14) | Personenbezug, Auswertung, Aufbewahrung |
| Betrieb | 6.7, 6.8 | Reviewer mit Perspektive Betrieb; privilegierte Schritte führt der Eigentümer nach Checkliste aus | Persistenz, Deploy, Konfiguration, Notbetrieb |
| UX, Barrierefreiheit | 6.9 | Design-Kritik (Fable, D1–D10) vor dem Review | sichtbare Oberfläche |
| Integration, KI | 6.4, 6.10 | Reviewer; Anbieterfragen über das Register (E3a, E3b, E18) | Nachbarsysteme, Agentenfunktionen |

Reviewt immer ein anderes Modell als das bauende (Regel 3). Fehlt für eine Perspektive eine menschliche Fachperson,
wird daraus eine Registerzeile mit Standardannahme, kein „blockiert" und keine neue Zuständigkeit.

## 6. Qualitätschecks

Auswahlkatalog, nicht normativ. Die Spec übernimmt nur, was Änderungsart und Reifestufe auslösen. Für eine
Demo-Scheibe genügen meist 6.1, 6.2, 6.9, 6.11, 6.12.

### 6.1 Fachliche Korrektheit
- [ ] Jeder neue Zustand, Übergang oder Guard hat Regel-ID, `legalRef` (auch `verified:false`) und je einen Positiv- und Negativtest.
- [ ] Pflichtdaten werden in der Domäne erzwungen, nicht nur in der Oberfläche.
- [ ] Eine Freigabe bezeichnet genau die freigegebene Version; Rückgabe, Wiederholung und Änderung haben eindeutige Folgen.
- [ ] Maßgebliche und abgeleitete Daten sind getrennt; tatsächlich Gesagtes wird nicht mit dem Entwurf gleichgesetzt.
- [ ] Verantwortung ist eindeutig; Beratung (z. B. Rechtsfreigabe) und Entscheidung (Freigabe) sind getrennt.

**Blocker:** eine Regel in Oberfläche, Dienst und Hintergrundprozess je eigens nachgebaut; eine offene
Rechtsfrage still durch einen technischen Standard entschieden, statt ihn als Registerzeile auszuweisen.

### 6.2 Architektur und Modulgrenzen
- [ ] Die Grenzen aus ADR 0001 (1.3) sind eingehalten; die Abhängigkeitsrichtung ist automatisch prüfbar (ab 012).
- [ ] Module greifen nur über benannte Schnittstellen aufeinander zu; der lokale Entwicklungsweg bleibt einfach genug, um Fehler nachzustellen.
- [ ] Ein neuer Dienst hat einen belegten Skalierungs-, Sicherheits- oder Zuständigkeitsgrund; Standard ist der modulare Monolith.

### 6.3 Daten, Konsistenz und Migration
- [ ] Transaktionsgrenze benannt; Gleichzeitiges führt zu sichtbarem Konflikt (412); Wiederholungen sind idempotent je Akteur und Operation.
- [ ] Ereignisse haben eine Evolutionsstrategie (Schema-Version, Upcaster nur für Dev-Bestände; Demo: Reset-Banner statt Upcaster, Ergänzung zu ADR 0002 in 015).
- [ ] Migrationen laufen gegen realistischen Bestand, vorwärts und rückwärts, und setzen nach Neustart sicher fort.
- [ ] Backup umfasst Daten, Konfiguration, Schlüsselbezug (keyId) und Metadaten; Restore wurde ausgeführt und fachlich verifiziert (Hash-Kette, Projektion identisch), nicht nur gestartet.
- [ ] Aufbewahrungsklasse und Legal Hold sind für neue Daten gesetzt; Löschung ist nicht Teil der Beta.

### 6.4 Vertrag, Ereignisse, Integrationen
- [ ] Vertrag zuerst geändert, Typen regeneriert (Regel 6); Changelog-Eintrag, rückwärtskompatibel oder mit Ablauf in der Allowlist (019, ADR 0015).
- [ ] Erfolg, 400/422, 403, 404, 409, 412, 428 und 500 sind konsistent als Problem-Details mit Regel-ID modelliert.
- [ ] Limits, Paginierung, Filtersemantik, Idempotenz und Nebenläufigkeit sind dokumentiert und vertragsgetestet.
- [ ] Webhooks tragen Ereignis-ID, Typ, Schemaversion, Zeit, Jahrgang, Korrelations-ID; Signatur, Wiederholung, Deduplizierung sind definiert.
- [ ] Teilausfall eines Nachbarsystems blockiert keinen unbeteiligten Kernprozess; Sandbox mit synthetischen Daten.

### 6.5 Sicherheit
- [ ] Authentifizierung und Autorisierung werden im Dienst erzwungen; der Kontext (Einheit, Bühnenplatz, Vertraulichkeit) kommt nie vom Client.
- [ ] Neue Aktionen sind für niemanden erlaubt, bis sie in `ROLE_PERMISSIONS` vergeben und getestet sind (deny by default).
- [ ] Nichtberechtigte erkennen weder Inhalt noch ableitbare IDs geschützter Vorgänge (Zähler bleiben lückenlos); Massenlesen, Export und Rechteerhöhung sind begrenzt und als Ereignis nachvollziehbar.
- [ ] Keine Secrets in Repositorium, Artefakt, Log, Screenshot oder Agentenkontext (Regel 11); Sitzungsentzug, Sperrliste und Notfallkonten funktionieren unabhängig vom Happy Path.
- [ ] Für jede Hochrisikoänderung ist ein Missbrauchsfall mit Erkennung beschrieben; Ausnahmen haben Eigentümer und Ablauf.

### 6.6 Datenschutz und Mitbestimmung
- [ ] Zweck, Rechtsgrundlage, Empfänger und Schutzklasse neuer personenbezogener Felder stehen in der Rechtsgrundlagen-Matrix (ab 014).
- [ ] Jede Rolle sieht nur die Felder, die ihr Zweck braucht; Identitätsdaten liegen getrennt von Fachinhalten (Personentabelle); Betroffenenauskunft und Berichtigung bleiben möglich, ohne Nachweise umzuschreiben (Regel 7).
- [ ] Logs, Fehlermeldungen und Testartefakte enthalten keine Fragetexte oder Personendaten; eine neue Auswertung erscheint im generierten Auswertungskatalog, eine Kennzahl je Person gibt es nicht.

Ob der Betriebsrat zustimmt und der DSB die DSFA annimmt, ist **keine Merge-Bedingung je Scheibe**, sondern
Registerzeile E13/E14 (Abschnitt 11): Die Scheibe baut BV-verträglich und liefert Dokumentation zu.

### 6.7 Betrieb und Resilienz
- [ ] Ein fachliches und ein technisches Signal zeigen Erfolg bzw. Rückstau; Logs und Kennzahlen teilen eine Korrelations-ID; erwartete Fehler sind von Defekten und Sicherheitsereignissen unterscheidbar.
- [ ] Alarm mit Schwelle, Empfänger, Reaktionszeit und sicherer Sofortmaßnahme; Runbook-Abschnitt für Diagnose, Begrenzung, Rückweg.
- [ ] Ausfall einer Abhängigkeit hat Timeout, Rückfall oder degradierten Modus; der manuelle Rückfallpfad ist geprobt.
- [ ] Kapazität wurde mit Vollbestand (800 Fragen) und realistischem Tagesprofil geprüft, soweit betroffen.

### 6.8 Administration und Konfiguration
- [ ] Die Einstellung ist wirklich variabel und keine Fach- oder Sicherheitsregel (Rechtstor, Vier-Augen sind nie Schalter).
- [ ] Name, Hilfe, Standardwert und Auswirkung sind verständlich; kritische Änderungen zeigen einen Diff; die Aufgabe gelingt ohne Datei-, SQL- oder Kommandozeilenzugriff.
- [ ] Jede Änderung ist ein Ereignis mit Autor, Grund und Zeit; Freeze wird erzwungen; Rückkehr zum Vorzustand ohne Auditverlust.

### 6.9 Oberfläche und Barrierefreiheit
- [ ] Die Ansicht folgt Aufgabe und Rolle, nicht dem Datenmodell; Primäraktion, Stand und nächste Folge sind ohne Anleitung erkennbar.
- [ ] Tastatur, Fokus, Screenreader, Kontrast, 200 % Zoom und reduzierte Bewegung sind geprüft (axe ab 013).
- [ ] Lade-, Leer-, Fehler-, Konflikt-, Offline- und Nur-Lesen-Zustände sind gestaltet; Live-Aktualisierung verschiebt keinen Fokus.
- [ ] Alle Texte kommen aus dem i18n-Modul des Features, DE und en-US (Regel 10); Hausvokabular (Regel 9).

### 6.10 KI- und Agentenfunktionen
- [ ] Eigene technische Identität mit minimalem Recht; Zugriff nur über Ports, nie direkt auf die Datenbank.
- [ ] Ein Vorschlag ist sichtbar von menschlicher Entscheidung getrennt und löst nie einen Statuswechsel aus.
- [ ] Modell, Version, Quellen, Zeit nachvollziehbar; Personendaten minimiert; Prompt Injection, Datenabfluss und Limits getestet; ohne KI bleibt der Prozess voll funktionsfähig.

### 6.11 Dokumentation
- [ ] README und AGENTS.md stimmen mit dem Stand; tragende Entscheidungen stehen als ADR; Kommentare erklären das Warum mit Regel-ID oder ADR.
- [ ] Betrieb, Administration und Integration haben getrennte Anleitungen; jede wird einmal von einem fremden Modell befolgt.

### 6.12 Einfachheit
- [ ] Vorhandene Konzepte vor neuen; eine neue Abstraktion löst mindestens zwei heutige Fälle oder schützt eine Grenze aus 1.3.
- [ ] Neue Abhängigkeiten haben Nutzen, Pflege und passende Lizenz; Schalter und Übergangspfade haben Eigentümer und Entferndatum.
- [ ] Der Diff ist die kleinste vollständige Lösung der Spec.

**Blocker:** Plattformfunktion „für später", zweite Kopie einer Regel, handgepflegte Vertragstypen,
Infrastruktur ohne Betriebsmodell.

## 7. Auswahlmatrix

| Änderung | Perspektive · Rolle (Abschnitt 5) | Mindestnachweis in der Spec |
|---|---|---|
| Regel, Status, Freigabe, Verweigerung | Domäne, Legal · Reviewer | Regel-ID mit `legalRef`, Positiv-/Negativtest, Wahrheitstabellen-Diff |
| Rolle, Recht, Identität, Schutzklasse | Security · Reviewer | Wahrheitstabellen-Diff, erlaubter und verweigerter Zugriff |
| personenbezogenes Feld, Auswertung | Datenschutz · Reviewer, Eigentümer (E13/E14) | Zweck, Sichtbarkeit, Aufbewahrung; Auswertungskatalog-Diff |
| Datenmodell, Migration | Betrieb · Reviewer | Migration gegen Bestand, Wiederanlauf |
| Audit, Aufbewahrung, Export | Legal, Datenschutz, Security · Reviewer | Manipulations- und Berechtigungstest, Exportereignis |
| Vertrag, Ereignis, Webhook | Integration · Reviewer | Vertragstest; bei Zustellung Wiederholung und Deduplizierung |
| Administration, Konfiguration | Security, UX · Reviewer, Design-Kritik | Auswirkungs-Diff, Berechtigungstest, Rückkehr zum Vorzustand |
| Deploy, Secret, Netz, Laufzeit | Betrieb, Security · Reviewer, Eigentümer | Fehlerfall des Deploys; Secret- und Abhängigkeitsscan |
| KI- oder Agentenfunktion | Security, Datenschutz · Reviewer | Rechteumfang-Test, Datenfluss, Rückfall ohne KI |
| Bühne oder anderer kritischer Arbeitsbildschirm | UX, Betrieb · Design-Kritik, Reviewer | e2e, Tastatur- und Fokusprüfung, Screenshot DE/EN, Fehlerzustand |

Der Reviewer sieht nur Spec und Diff, also muss die Spec die Kriterien enthalten. Mehr als drei Hauptbefunde
schärfen die Spec; nach einer Nacharbeitsrunde geht die Scheibe an den Planer zurück (meist ist die Spec falsch),
nach zwei Runden wird sie gestoppt und an den Architekten zurückgegeben (Plan 6.3).

## 8. Abnahmehilfe

Abschluss und Berichtsformat regelt AGENTS.md. Die Spec wählt zusätzlich aus: Dateiumfang eingehalten; kein
Vertrag driftet; Happy Path, 403, Validierung, Konflikt und Teilausfall getestet; neue Warnungen behoben oder
befristet; Perspektiven-Befunde, Migration, Runbook und Screenshots DE/EN erledigt, soweit ausgelöst; offene
Punkte mit Eigentümer und Termin.

## 9. Meilensteine

Der Produktplan ordnet seine Beta-Kriterien diesen drei Stufen zu; die Nachweise stehen dort, nicht hier.

### 9.1 Produktionsfundament

Plan B1–B5, B9, B10, B13 (M2, Prüfpunkt 3): angenommene ADRs für Persistenz, Identität, Umschlag, Deployment;
nur anhängende Persistenz mit Migrationstor und Konfliktmodell; OIDC mit Notfallkonten; Betriebsauswertung,
Pipeline, bestandener Restore; ein Referenzpfad Oberfläche → Vertrag → Domäne → Persistenz, von einem Menschen verfolgt.

### 9.2 Pilotbereit

Plan B6–B8, B11, B12, B14–B18 (M3–M6, Prüfpunkt 7): gemeinsame Umgebung mit realen oder gepoolten Identitäten;
Rechte-, Datenschutz- und Security-Basis; Last- und Konkurrenztests; Support, Alarm, Runbook, Rückfall benannt;
Betreiber hat Deploy, Diagnose, Restore selbst ausgeführt; Generalprobe im Schatten mit synthetischen Fragen.

### 9.3 Produktionsbereit

Außerhalb des Beta-Plans (Restliste in docs/beta-abnahme.md, 079): freigegebene fachliche und rechtliche
Baseline; Pentest und Nachtest ohne offene kritische Befunde; Löschung und Krypto-Codec eingeschaltet; Tests auf
produktionsgleicher Umgebung; Betriebsvereinbarung; eingefrorene Konfiguration; menschliches Abschlussreview.

## 10. Menschliche Prüfpunkte

Die Prüfpunkte des Plans (Abschnitt 7) tragen die empfohlenen Gespräche: Zielarchitektur an 1 und 3, Referenzpfad
und Administration an 3, Sicherheitsreview des Architekten an 3, 4 und 7, Abschluss in der Abnahme (079). Der
Zwei-Stunden-Test einer neuen Entwicklerin läuft in 075; Stolperstellen sind Produktbefunde.

## 11. Offene Entscheidungen

Offene Entscheidungen führt das Register (Plan Abschnitt 10, ab 014 `docs/entscheidungsregister.md`), nicht
dieses Dokument. Agenten liefern Optionen, Folgen und ADR-Entwürfe; sie nehmen keine Entscheidung durch eine
beiläufige Implementierung vorweg. Gebaut wird auf der Standardannahme mit Vermerk „auf Standard gebaut am <Datum>".

**Zwei Registerzeilen aus der Konsolidierung (Übernahme durch 014):**

| Nr. | Entscheidung | Standardannahme | Blockiert | Eigentümer |
|---|---|---|---|---|
| E13/E14 | Betriebsrat/DSFA: Mitbestimmung, DSFA als Vorbedingung für Personenidentitäten | Beta nur mit synthetischen Fragen und Testidentitäten; BV-verträglicher Schnitt (zwei Protokollebenen, 30 Tage Zugriffslog, Auswertung nur zu zweit, keine Kennzahl je Person); DSFA-Vorentwurf aus 014 bis 13.11.2026 beim DSB; Zulieferungen 083 | keine Scheibe; Personenidentitäten auf Staging (E14) und den Produktivstart | Eigentümer, HR, Betriebsrat, DSB |
| E15 | Rechtsprüfung: Normzitate, Regelregister, Verweigerungskatalog | `legalRef {…, verified:false}` an jeder Regel, Kataloge als Daten, Oberfläche zeigt „ungeprüft"; Rückmeldung erbeten bis 15.01.2027, Frist 29.01.2027; 076 trägt ein | keine Scheibe; ein Zitat wird nie als geprüft ausgegeben | Eigentümer, Recht |

**Abbildung der früheren Liste auf das Register:** Hosting und Laufzeit → E10, E10b · Event Sourcing oder
Zustand → entfällt (1.3, Regel 7); Speicherform → Plan 3, ADR 0003 · Datenbanktopologie → E27 · Jahrgang,
Mandant → Plan 3 (meetingId; zweiter Rechtsträger B-Liste) · IdP, Gäste, Break-Glass → E11, E24 · RPO/RTO/SLO → E22 ·
Schutzklassen, Aufbewahrung, Löschung → E16, E17 · Rollenzuschnitt, Vertretungen → E1, E8, E25 · Transkript →
E3a, E3b · KI → E18 · Product Owner, Betreiber → E26, E43 · menschliche Freigabe von Hochrisiko → E48 (Merge
nach Review), Deploy nur nach Go, Herabstufung nur durch den Menschen (4) · ADR 0001 → entfällt als offene
Frage (1.3), formale Annahme E42 · HV-Format, Vorabfragen → E20 · Satzung, Geschäftsordnung, Einberufung → E15 ·
Legitimation, Aktienmodell → E28 · Letztfreigabe, Eilpfad → E25 · Notarzugang → E19 · Veröffentlichung,
gegebene Antwort → E29 · Last und Pilotumfang → E12, E49 (Last selbst: B11, 071).

## 12. Durchgerechnetes Beispiel: Scheibe 021

*021 · Koordinationsrolle, Vier-Augen-Guard R-GUARD-06, Rechtstor vor der Bühne R-GUARD-07* (Plan 5.3).

- **Qualitätswirkung (3).** Reifestufe pilot. Ausgelöst: Fachregel (R-GUARD-06 „Ersteller der letzten Version ≠
  Freigeber" auf R-TRANS-05; R-GUARD-07 „Rechtsfreigabe liegt vor" auf R-TRANS-07/08); Rolle und Recht (neue Rolle
  `coordination`, capture verliert classify/assign, legal erhält `question.legal.clear` statt approve); Oberfläche
  nur über e2e-Personas; Doku. Nicht ausgelöst: Vertrag (kam mit 019), Persistenz, Personenbezug, Betrieb, KI.
- **Risikoklasse (4).** Hoch, zwei Auslöser (Rechte, Freigabe); herabstufen dürfte nur ein Mensch, hier zu Unrecht.
- **Perspektiven (5, 7).** Legal und Security → Reviewer (Opus) mit dieser Perspektive; Lesebefund der Spec vor dem
  Bau; Wahrheitstabellen-Diff in der Spec; kein gebündeltes Review.
- **Checks, die die Spec übernimmt:**

| Check | Kriterium in der Spec | Wert |
|---|---|---|
| 6.1 Regel-ID, `legalRef`, Tests | R-GUARD-06/07 mit `legalRef` (verified:false) und je Positiv-/Negativtest | ja |
| 6.1 Beratung ≠ Entscheidung | legal gibt Rechtsfreigabe, approver gibt frei (E25 Standard) | ja |
| 6.5 deny by default | `coordination` nur mit den genannten Rechten; Test „capture klassifiziert → 403" | ja |
| 6.8 Regel ist kein Schalter | `LEGAL_GATE_BY_TRACK` ist Datentabelle in transitions.ts; Test „keine Konfiguration schaltet den Guard ab" | ja |
| 6.9 Oberfläche | nur e2e-Personas; Abnahmesatz „… die Koordination klassifiziert …" grün | ja |
| 6.3, 6.4, 6.6, 6.7, 6.10 | kein Datenmodell, Vertrag, Personenfeld, Betrieb, KI berührt | nicht anwendbar |

- **Nachweise.** Wahrheitstabellen-Diff vor dem Bau freigegeben; legal entwirft und versucht Freigabe → 409
  R-GUARD-06; Bühne ohne Rechtsfreigabe → 409 R-GUARD-07 je Pfad; Test „kein Schalter"; `pnpm gates` und
  `abnahme.spec.ts` mit Koordinations-Persona grün.
- **Offene Entscheidungen (11).** E1 Rollenname (Standard `coordination`), E25 Letztverantwortung (approver), E37
  Freigabetiefe (alle drei Pfade). Keine blockiert, weil alle drei eine Standardannahme haben; die Scheibe setzt
  „auf Standard gebaut am 09.10.2026". Vier-Augen ist personengenau nur mit Einzelidentitäten; im Rückfall
  gepoolter Stationsidentitäten (E13) steht die Einschränkung in der Restliste (Plan B18).

## 13. Pflege

Kanonische Regeln werden verlinkt, nicht kopiert; eine neue Frage nennt den Fehler, den sie verhindert. Vor jedem
Meilenstein streicht der Architekt veraltete Pfade und Punkte, die wiederholt „nicht anwendbar" oder doppelt
sind. Änderungen laufen als kleine Scheibe mit Spec und unabhängigem Review.
