# DSFA-Vorentwurf — HV-Tool (Beta)

**Status: VORENTWURF, ungeprüft.** Technischer Entwurf aus der Umsetzung (Scheibe 014), Stand 23.09.2026.
**Adressat:** die oder der Datenschutzbeauftragte (DSB); Übergabe durch den Eigentümer bis 13.11.2026
(Plan 8.4, Register E14). **Endfassung:** Scheiben 083 (Schutzmaßnahmenkatalog, Beschreibung der
Testidentitäten, DSFA-Endfassung) und 073 (Schlüsselverwahrer), Übergabe an Betriebsrat und DSB spätestens
18.12.2026.

> **Keine Rechtsaussage.** Dieses Dokument beschreibt, was das Tool tut und tun wird. Jede genannte
> Rechtsgrundlage ist eine **zu prüfende Annahme** der Umsetzung, keine geprüfte Bewertung; sie steht in der
> Matrix ausdrücklich mit dem Vermerk „zu prüfen" (Register E14, E15). Ob überhaupt eine
> Datenschutz-Folgenabschätzung nach Art. 35 DSGVO erforderlich ist, ist selbst Teil der Prüfung
> (Schwellwertanalyse durch den DSB). Der Vorentwurf geht vorsorglich davon aus, weil Daten von
> Aktionärinnen und Aktionären und von Beschäftigten in einem Verfahren mit Nachweischarakter verarbeitet
> werden und weil Beschäftigtendaten mitbestimmungsrelevant sind (E13).

**Drei Teile:** 1 Systembeschreibung · 2 Datenflüsse · 3 Rechtsgrundlagen-Matrix je Verarbeitungsschritt.
Dazu 4 Risiken und Schutzmaßnahmen (Kurzfassung, Vollfassung in 083), 5 offene Punkte für den DSB,
6 Abgrenzung, 7 Quellen.

---

## 1. Systembeschreibung

### 1.1 Zweck der Verarbeitung

Das HV-Tool unterstützt die Beantwortung von Aktionärsfragen in der Hauptversammlung (HV) einer deutschen
börsennotierten Gesellschaft: Wortmeldeliste, Erfassung der Redebeiträge, Zerlegung in Einzelfragen,
Klassifizierung in Antwortpfade, Antwortentwurf, Rechtsprüfung, Freigabe, Anzeige auf der Bühne (Podium),
Vorgangshistorie. Der Zweck ist die ordnungsgemäße und nachweisbare Erteilung der Auskunft an die
Aktionärinnen und Aktionäre in der Versammlung sowie die Dokumentation dieses Vorgangs für Niederschrift
und etwaige Anfechtungsverfahren. Eine Leistungsbewertung von Beschäftigten ist kein Zweck und wird
technisch ausgeschlossen (keine Kennzahl je Person, Abschnitt 4).

### 1.2 Verantwortlicher, Auftragsverarbeiter, Beteiligte

| Rolle im Datenschutz | Wer (Annahme, zu bestätigen) | Anmerkung |
|---|---|---|
| Verantwortlicher | die Gesellschaft (HV-Projektleitung als fachliche Stelle) | Formale Benennung durch den Eigentümer mit dem DSB zu klären |
| Auftragsverarbeiter Plattform | Konzern-IT (souveräne Cloud, managed Postgres) mit AVV; im Rückfall ein vom Umsetzer gemieteter Container-Host mit AVV des Umsetzers | Register E10, E10b, E39; bis zur AVV nur synthetische Daten und Testidentitäten ohne Personenbezug |
| Auftragsverarbeiter Identität | Konzern-IdP (OIDC); im Rückfall Keycloak-Container auf der Plattform | Register E11, E38 |
| Umsetzer (Entwicklung und Betrieb der Beta) | externer Umsetzer mit KI-Agenten | Arbeitet in der Beta nur mit synthetischen Daten; Zugriff auf Staging und Übungsmandant nach AVV zu regeln |
| Betroffene Vertretung | Betriebsrat (Beschäftigtendaten), DSB (Aufsicht) | Register E13, E14 |
| Nachbarsysteme | Transkriptionstool (inhouse), KI-Wissensbasis (inhouse), Aktienregister (eigene Instanz) | Nur als geplante Anschlüsse; in der Beta ist keiner mit Personendaten verbunden (Abschnitt 2.4) |

Alle Angaben sind Funktionsbezeichnungen; Personen werden erst in der Endfassung benannt.

### 1.3 Betroffene Personengruppen und Datenkategorien

| Gruppe | Daten im Tool | Herkunft |
|---|---|---|
| Aktionärinnen, Aktionäre, Bevollmächtigte (Redende) | Name, Organisation, Runde, Fragewortlaut, Redebeitrag (Wortlaut), Antwort, Verweigerungsgrund | Aufnahme der Wortmeldung durch das Versammlungsbüro; Erfassung des Redebeitrags; später Import aus dem Transkriptionstool |
| Beschäftigte der Gesellschaft (Nutzerinnen und Nutzer des Tools) | Anmeldeidentität (IdP-Subject, Anzeigename, ggf. E-Mail als Claim), Rollenzuordnung je Jahrgang mit Ablauf, Handlungen in der Vorgangshistorie (wer hat wann erfasst, zugewiesen, entworfen, freigegeben), technisches Zugriffslog | Anmeldung über den Konzern-IdP; jede Handlung im Tool |
| Podiumsmitglieder (Vorstand, Aufsichtsratsvorsitz) | Bühnenplatz, Vorgelesen-Ereignisse je Frage, Geräteeinstellungen (nur im Gerät) | Bühnenplatzliste je Jahrgang; Bedienung des eigenen Geräts |
| Externe mit Lesezugang (Notar, Kanzlei, Revision) | in der Beta keine Konten; Übergabe an den Notar als Export | Register E19, E24 |
| Dritte, die in Fragen genannt werden | Freitext in Frage und Antwort kann Dritte nennen | Inhalt der Frage; keine gesonderte Erfassung |

### 1.4 Rollen im Tool

Rechte sind Daten (Rechtekonzept `docs/rollen-und-rechtekonzept.md`, AGENTS.md Regel 4): Eine Rolle ist ein
Bündel von Berechtigungen, genau eine Funktion `can()` entscheidet über jeden Zugriff, deny by default. Die
Rollen der Beta in Hausvokabular (Glossar) mit ihrem Bezug zu personenbezogenen Daten:

| Rolle | Sieht | Darf mit Personenbezug |
|---|---|---|
| Versammlungsbüro (`moderation`) | Wortmeldeliste mit Klarnamen | Wortmeldung aufnehmen, Runden ordnen, Klarnamen sehen |
| Erfassung (`capture`) | Redebeiträge, Einzelfragen | Erfassen und zerlegen; Klarname der redenden Person zur Zuordnung |
| Koordination (`coordination`, Register E1) | Steuerungsansicht, Verteilung | Klassifizieren, zuweisen, Bündel zusammenstellen; Klarnamen sehen |
| Fachbereich (`expert`) | nur zugewiesene Fragen, **pseudonymisiert** | Antwortentwurf; kein Klarname (Pseudonymisierung Standard an, Register S4) |
| Recht (`legal`) | alle Fragen, Rechtsprüfung | Rechtsempfehlung, Vertraulichkeitsstufe setzen, Klarnamen sehen |
| Freigabe (`approver`) | alle Fragen | Freigabe (Vier-Augen), Klarnamen sehen |
| Podium (`podium`) | eigene Bühne | Vorgelesen markieren; Klarname der fragenden Person auf der Bühne |
| Administration (`admin`) | Rechteverwaltung | Rollen zuordnen; jede inhaltliche Handlung ist ein herausgehobener Eintrag der Historie |
| Beobachter (`observer`) | lesend | kein Schreibrecht |
| Systemakteure (geplant) | Ingest-Endpunkt | nur Segmente schreiben, nichts lesen |

Die personenbezogene Historie (Ereignisse mit Bezug auf eine Person) ist nur mit einer zweiten Freigabe
lesbar (`event.read.personal`, AuditAccessGranted; Plan 3).

### 1.5 Betriebsarten und Umgebungen

| Betriebsart | Was läuft | Personenbezug | Datenhaltung | Zugang |
|---|---|---|---|---|
| **Demo** (Netlify, In-Process, ADR 0002) | Anwendungskern im Browser der betrachtenden Person; Rollenschalter statt Anmeldung | **keiner**: nur der synthetische Korpus aus `packages/domain/src/seed.ts`; keine Anmeldung; Änderungen bleiben im Browser der betrachtenden Person (localStorage) und verlassen ihn nicht | keine Serverdatenbank | öffentlich erreichbare Demo; der Hoster protokolliert Zugriffe nach seinem Standard (zu prüfen, Abschnitt 5) |
| **Staging-synthetisch** (ab M2) | HTTP-Dienst mit Postgres; Agenten, e2e, Last- und Chaostests | bis zum DSB-Review **keiner**: synthetische Fragen, Testidentitäten ohne Personenbezug aus einem Keycloak-Container; danach Anbindung des Konzern-IdP, deren Subjects personenbezogen sind (E14) | eigene Datenbank; Ereignislog nur anhängend | Umsetzer, Agenten, Konzern-IT; OIDC |
| **Übungsmandant** (Generalprobe 01.–05.03.2027) | von Menschen betrieben, Banner „Generalprobe", `HV_MODE=shadow` | geplanter Weg: **gepoolte Stationsidentitäten** ohne Personenbezug (E13); synthetische Fragen; Beschäftigte handeln unter Stationskonten | eigene Datenbank; nach der Probe **Löschung durch Entfernen der Datenbank** mit Löschprotokoll (ADR 0010) | Beteiligte der Generalprobe, MFA im Rückfall (E38) |
| **Produktion** | außerhalb dieses Plans (Leitplanken 9.3) | echte Aktionärs- und Beschäftigtendaten | wie Staging plus Krypto-Umschlag eingeschaltet | nur nach DSFA-Endfassung, Betriebsvereinbarung, Pentest-Retest |

**Grundsatz der Beta:** Bis zum Abschluss von Betriebsrat- und DSFA-Prozess läuft die Beta nur mit
synthetischen Fragen (Plan 3, Betriebsrat und DSFA). Personenbezug entsteht frühestens durch die
Anmeldeidentitäten der Beschäftigten auf Staging, und das erst nach dem DSB-Review dieses Vorentwurfs
(E14). Die Software wird unabhängig vom Verhandlungsstand BV-verträglich geschnitten: zwei Protokollebenen,
30 Tage Zugriffslog, Auswertung personenbezogener Felder nur zu zweit, keine Kennzahl je Person.

---

## 2. Datenflüsse

### 2.1 Hauptfluss: Erfassung → Einzelfrage → Beantwortung → Freigabe → Bühne → Historie

```
Wortmeldung ─► Redebeitrag ─► Erfassung ─► Einzelfrage ─► Klassifizierung ─► Antwortentwurf
(Name,          (Wortlaut)     (Erfassung)  (Atomisierung)  (Pfad, Fachbereich,   (Versionen,
 Organisation,                                               Bühnenplatz,          Autor als personId)
 Runde)                                                      Vertraulichkeit)
                                                                                        │
      Historie ◄── Vorgelesen ◄── Bühne ◄── Freigabe ◄── Rechtsprüfung ◄─────────────────┘
      (alle Ereignisse,  (Bühnenplatz,  (je Gerät,    (approver,     (legal empfiehlt,
       nur anhängend)     Zeit)          nur eigene)   Vier-Augen)    Rechtstor vor der Bühne)
```

| Schritt | Was entsteht | Wer sieht es | Personenbezug |
|---|---|---|---|
| Wortmeldung | Datensatz Wortmeldung mit Name, Organisation, Runde; `personId` verweist auf die Personentabelle | Versammlungsbüro, Koordination, Recht, Freigabe, Podium (Klarname); Fachbereich (Pseudonym) | Aktionär |
| Redebeitrag | Wortlaut als Text; künftig Segmente aus dem Transkriptionstool (unveränderlich) | Erfassung, Koordination | Aktionär; ggf. genannte Dritte |
| Einzelfrage | Fragewortlaut, Bezug auf Wortmeldung, Nummer | wie Wortmeldung; Fachbereich pseudonymisiert | Aktionär |
| Klassifizierung | Antwortpfad, Fachbereich, Bühnenplatz, Vertraulichkeitsstufe; handelnde Person als personId | Koordination, Recht, Freigabe | Beschäftigte (Handlung) |
| Antwortentwurf | Antwortversionen mit Autor (personId) und Zeit; Formatierung als Blockdokument | zugewiesener Fachbereich, Recht, Freigabe, Koordination | Beschäftigte |
| Rechtsprüfung, Freigabe | Empfehlungs- und Freigabeereignis mit personId; Vier-Augen erzwungen (Ersteller ≠ Freigeber) | Recht, Freigabe | Beschäftigte |
| Bühne | Freigegebener Text auf dem Gerät des Podiumsmitglieds; Anzeigeeinstellungen nur im Gerät | Podium (nur eigener Bühnenplatz, Standard `own`, E7) | Aktionär (Frage), Podiumsmitglied (Zuordnung) |
| Vorgelesen | Ereignis mit Bühnenplatz und Zeit; Soll-Ist-Vermerk (E29) | alle lesenden Rollen | Podiumsmitglied |
| Historie | Alle Ereignisse, nur anhängend, mit `personId` statt Klarname | Recht, Freigabe, Revision (lesend); personenbezogene Auswertung nur mit zweiter Freigabe | Aktionär und Beschäftigte |
| Export | HTML und JSON für Niederschrift und Notar; Exportereignis | Inhaber von `export.dossier` | Aktionär und Beschäftigte |

### 2.2 Zwei Protokollebenen (ADR 0013)

| Ebene | Inhalt | Aufbewahrung | Auswertung |
|---|---|---|---|
| Fachliche Vorgangshistorie | Ereignisse des Vorgangs (wer hat was wann getan, als personId), nicht abschaltbar | unbegrenzt bis zur Fristentscheidung (E16); Aufbewahrungsklasse `record` | Vorgangsbezogen; personenbezogene Felder nur mit zweiter Freigabe |
| Technisches Zugriffslog | Korrelations-ID, Zeit, Endpunkt, Subject-ID, Ergebnis; **keine Nutzdaten** | 30 Tage; Klasse `technical`; getrennte Senke | nur zu zweit; keine personenbezogene Leistungsauswertung; Rate-Limit-Zähler flüchtig |

Betriebskennzahlen laufen über eine Kennzahlen-Allowlist mit Aggregationsstufe und Mindestfallzahl; der
Auswertungskatalog wird aus dem System generiert (Rechtekonzept Abschnitt 6) und liegt der
Betriebsvereinbarung als Anlage bei (083).

### 2.3 Personentabelle, Pseudonymisierung, Krypto-Umschlag (ADR 0009, 0011)

- Ereignisse tragen `personId`, nie einen Klarnamen. Klarnamen liegen in einer **getrennten Personentabelle**.
- Personenbezogene Felder im Ereignis liegen im markierten Teil `pii` mit `keyId` je Jahrgang hinter einer
  Codec-Schicht. In der Beta ist der Codec ein Identitäts-Codec (kein Schlüssel), aber `keyId` steht ab dem
  ersten Ereignis; Einschalten der Verschlüsselung ändert weder Domäne noch Vertrag. Jeder Bestand vor
  eingeschaltetem Codec gilt als wegwerfbar.
- Jedes Ereignis trägt `retentionClass` (`record`, `working`, `technical`) und `legalHold:false`. Keine
  Löschlogik in der Beta; Löschung des Übungsbestands durch Entfernen der getrennten Datenbank mit Protokoll.
- **Pseudonymisierung gegenüber Fachbereichen** ist Standard an; die Klarnamenauflösung ist ein eigenes,
  protokolliertes Recht (`question.identity.reveal`).
- Vertraulichkeitsstufen `internal`, `restricted`, `protected` mit deny by default (E17); geschützte Fragen
  sieht das Podium erst auf der Bühne.

### 2.4 Nachbarsysteme als geplante Adapter (ADR 0008)

Kein Fremdformat erreicht den Kern; je Nachbarsystem ein Adapter hinter einem kanonischen Vertrag mit
Systemakteur und eigenem Recht. In der Beta ist **kein** Nachbarsystem mit Personendaten verbunden.

| Nachbarsystem | Richtung | Daten | Stand in der Beta | Register |
|---|---|---|---|---|
| Transkriptionstool (inhouse) | eingehend, `POST /v1/ingest/speech-segments` | Wortlaut je Segment, Anfang, Ende, Sprecherhinweis optional, Quelle; Segmente unveränderlich | erster Adapter: Datei- oder Zwischenablage-Import durch die Erfassung; Push-Adapter später | E3a, E3b |
| KI-Wissensbasis (inhouse) | ausgehend, `POST /v1/questions/{id}/answer-suggestions` | Fragewortlaut und Kontext; Vorschlag mit Quellen, Modell, Version, Konfidenz | Adapter `none` (503 „nicht konfiguriert"); kein Anbieter, kein Statuswechsel durch KI | E18 |
| Aktienregister (eigene Instanz) | eingehend, nur lesend | Legitimationsstatus zu einer Referenz; kein Replikat | nicht in der Beta; Wortmeldung wird von Hand aufgenommen | E28 |
| Ausgänge (Notarpaket, Archiv, Veröffentlichung) | ausgehend | Export HTML/JSON | nur Export durch `export.dossier`; keine Veröffentlichung, keine Aktionärsstrecke | E19, E29 |
| Ereignisstrom, Webhooks | ausgehend | fachliche Ereignisse mit personId | HMAC-signiert, Sandbox-Mandant; Empfänger in der Beta nur eigene Clients | ADR 0008, 0014 |

### 2.5 Identität, Anmeldung, Sitzung (ADR 0004)

- OIDC über einen BFF im Dienst: Authorization Code serverseitig, vertraulicher Client, HttpOnly-Sitzungscookie,
  JWKS-Prüfung; das Web hält nie ein Token. Sitzung 14 h mit stillem Refresh, Leerlauf-Timeout, Abmelden,
  Sperrliste ohne Neustart.
- Rollenzuordnung als Ereignisse `RoleAssigned` / `RoleRevoked` je Jahrgang mit **Ablauf am Jahrgangsende**;
  IdP-Gruppen nur als Vorschlag (E8).
- Zwei versiegelte Notfallkonten, nur bei gemeldetem IdP-Ausfall aktivierbar, befristet, jede Nutzung ein
  Alarmereignis (E11).
- Welche Claims der IdP liefert (Subject, Anzeigename, E-Mail, Gruppen) und welche das Tool speichert, ist mit
  der Konzern-IT festzulegen; Ziel ist Datenminimierung: Subject und Anzeigename, Gruppen nur transient.
- Demo: keine Anmeldung. `X-Actor`-Kopfzeile nur bei `HV_DEMO=1` und nie mit OIDC-Issuer.

---

## 3. Rechtsgrundlagen-Matrix je Verarbeitungsschritt

**Lesart.** Jede Zeile beschreibt einen Verarbeitungsschritt. Die Spalte „Mögliche Rechtsgrundlage" ist in
**jeder** Zeile eine **zu prüfende Annahme** der Umsetzung, keine Bewertung; Normzitate stehen im Tool
ohnehin mit `verified:false` (E15). Aufbewahrungsklassen sind die drei Klassen aus Plan 3
(`record` Nachweis, `working` Arbeitsstand, `technical` Betrieb); die Fristen je Klasse entscheidet E16. Die
Spalte „Schutzmaßnahme" nennt die technische Maßnahme und, in Klammern, die Scheibe, die sie baut.

| Nr. | Verarbeitungsschritt | Datum (Felder) | Kategorie Betroffener | Zweck | Mögliche Rechtsgrundlage (Annahme) | Empfänger | Aufbewahrungsklasse | Schutzmaßnahme |
|---|---|---|---|---|---|---|---|---|
| V1 | Wortmeldung aufnehmen | Name, Organisation, Runde, Bühnenreihenfolge | Aktionär, Bevollmächtigte | Ordnung der Generaldebatte, Rednerfolge | Art. 6 Abs. 1 lit. c DSGVO i. V. m. §§ 118 ff., 129, 131 AktG (Durchführung der HV) oder lit. f (berechtigtes Interesse an geordnetem Ablauf) — **zu prüfen** | Versammlungsbüro, Koordination, Recht, Freigabe, Podium | record | Klarname in der Personentabelle, Ereignis trägt personId (024, 026); Klarname nur mit `question.identity.reveal` |
| V2 | Redebeitrag erfassen (Wortlaut) | Wortlaut, Zeitmarken, Bezug auf Wortmeldung | Aktionär; ggf. genannte Dritte | Grundlage der Beantwortung; Nachweis des Fragewortlauts | Art. 6 Abs. 1 lit. c i. V. m. § 131 AktG (Auskunftspflicht) — **zu prüfen** | Erfassung, Koordination | record | Segmente unveränderlich, Sprecher nur als Referenz (064); Übernahme-Sperre je Erfassender (028) |
| V3 | Einzelfrage bilden (Atomisierung) | Fragewortlaut, Nummer, Bezug | Aktionär | Auskunftserteilung je Frage | wie V2 — **zu prüfen** | wie V2; Fachbereich pseudonymisiert | record | Pseudonymisierung gegenüber Fachbereichen Standard an (026) |
| V4 | Klassifizieren und zuweisen | Antwortpfad, Fachbereich, Bühnenplatz, Vertraulichkeitsstufe; handelnde personId | Aktionär (Frage), Beschäftigte (Handlung) | Steuerung der Beantwortung | Inhalt: wie V2; Handlungsdaten Beschäftigter: § 26 BDSG bzw. Nachfolgeregelung oder Art. 6 Abs. 1 lit. b/f DSGVO — **zu prüfen** | Koordination, Recht, Freigabe | record | Zuweisung an den Fachbereich, nicht an Personen (E36, 028); keine Kennzahl je Person (033) |
| V5 | Antwortentwurf und Versionen | Antworttext (Blockdokument), Autor als personId, Zeit | Beschäftigte (Autor); Aktionär (Inhalt) | Vorbereitung der Auskunft | Inhalt: wie V2; Autorendaten: wie V4 — **zu prüfen** | zugewiesener Fachbereich, Koordination, Recht, Freigabe | record (Version), working (Entwurfsspeicherung) | Versionen unveränderlich; Entwurfsspeicherung ohne Personenauswertung (060) |
| V6 | Rechtsprüfung und Freigabe | Empfehlungs- und Freigabeereignis mit personId, Freigabevermerk, Rechtstor | Beschäftigte | Vier-Augen-Prinzip, Rechtstor vor der Bühne | wie V4 — **zu prüfen** | Recht, Freigabe | record | Ersteller ≠ Freigeber technisch erzwungen; Rechtstor als Datentabelle, nicht abschaltbar (021) |
| V7 | Verweigerung | Antwortart, Grund aus Katalog, Begründung, Freigabe | Aktionär | Bewusste Nichtbeantwortung mit Grund | Art. 6 Abs. 1 lit. c i. V. m. § 131 Abs. 3 AktG — **zu prüfen** | Recht, Freigabe, Podium (auf der Bühne) | record | Kein Zustand ohne Grund speicherbar; Katalog mit `verified:false` bis zur Rechtsprüfung (044, 076) |
| V8 | Bühne und Vorgelesen | Anzeige des freigegebenen Textes je Gerät; Vorgelesen-Ereignis mit Bühnenplatz und Zeit; Anzeigeeinstellungen nur im Gerät | Aktionär (Frage), Podiumsmitglied | Erteilung der Auskunft; Nachweis, wo und wann | Art. 6 Abs. 1 lit. c i. V. m. § 131 AktG; Nachweis § 130 AktG — **zu prüfen** | Podium (nur eigener Bühnenplatz), Versammlungsbüro | record | `podiumVisibility=own` (047); geschützte Fragen erst auf der Bühne sichtbar; offline nur Absichtswarteschlange ohne Nutzdaten außer der Anzeige (058) |
| V9 | Vorgangshistorie führen | Alle Ereignisse mit personId, Zeit, Hash-Kette | Aktionär und Beschäftigte | Nachweis für Niederschrift und Anfechtungsverfahren; Revisionssicherheit | Art. 6 Abs. 1 lit. c i. V. m. §§ 130, 243 ff. AktG; ggf. lit. f (Rechtsverteidigung) — **zu prüfen** | Recht, Freigabe, Revision (lesend), Notar (Export) | record; unbegrenzt bis E16 | Nur anhängend (Regel 7); personenbezogene Auswertung nur mit zweiter Freigabe (047); Legal Hold als Attribut (024) |
| V10 | Technisches Zugriffslog | Korrelations-ID, Zeit, Endpunkt, Subject-ID, Ergebnis; keine Nutzdaten | Beschäftigte | Sicherheit, Störungsanalyse, Missbrauchserkennung | Art. 6 Abs. 1 lit. f DSGVO; § 26 BDSG bzw. Nachfolgeregelung — **zu prüfen** | Betrieb (nur zu zweit) | technical; 30 Tage | Getrennte Senke, keine Nutzdaten, Auswertung zu zweit, keine Leistungsauswertung (033) |
| V11 | Anmeldung und Sitzung | IdP-Subject, Anzeigename, ggf. E-Mail als Claim; Sitzungscookie; Sperrliste | Beschäftigte | Zugriffskontrolle, Zurechenbarkeit | § 26 BDSG bzw. Nachfolgeregelung; Art. 6 Abs. 1 lit. f (IT-Sicherheit) — **zu prüfen** | Dienst; Konzern-IdP als Auftragsverarbeiter oder gemeinsam Verantwortlicher (zu klären) | technical (Sitzung), record (Rollenzuordnung als Ereignis) | HttpOnly-Cookie, 14 h, Leerlauf-Timeout, Sperrliste; Claims minimiert; Notfallkonten mit Alarm (029, 088) |
| V12 | Rollenzuordnung je Jahrgang | subject → Rollen, optional Einheit, Ablaufdatum; Ereignisse RoleAssigned/RoleRevoked | Beschäftigte | Berechtigungsverwaltung, Nachweis „wer durfte was am HV-Tag" | wie V11 — **zu prüfen** | Administration, Revision | record | Ablauf am Jahrgangsende; eingefrorener Rechte-Snapshot je Jahrgang (026, 077) |
| V13 | Klarnamen auflösen | Ereignis: wer hat wann welchen Klarnamen zu welcher Frage aufgelöst | Aktionär und Beschäftigte | Beantwortung durch berechtigte Rollen; Bühne | wie V1; Protokollierung: Art. 6 Abs. 1 lit. f (Nachweis) — **zu prüfen** | Inhaber von `question.identity.reveal` | record | Eigenes Recht, jede Auflösung protokolliert (026) |
| V14 | Export für Niederschrift und Notar | Fragen, Antworten, Historie als HTML und JSON; Exportereignis | Aktionär und Beschäftigte | Anlage zur Niederschrift, Übergabe an den Notar | Art. 6 Abs. 1 lit. c i. V. m. § 130 AktG — **zu prüfen** | Notar, Recht | record | Nur `export.dossier`; Exportereignis; kein Notar-Login (051, E19) |
| V15 | Betriebsauswertung und Kennzahlen | Aggregierte Zähler je Status, Pfad, Bühnenplatz; Kennzahlen-Allowlist | keine Person (aggregiert) | Steuerung am HV-Tag, Go/No-Go | kein Personenbezug angestrebt; Restrisiko kleiner Gruppen — **zu prüfen** | Koordination, Betrieb | technical | Keine Kennzahl je Person, Mindestfallzahl im Code, generierter Auswertungskatalog (033, 037) |
| V16 | Import aus dem Transkriptionstool (geplant) | Segmente wie V2; Quelle; ggf. Sprecherhinweis | Aktionär | wie V2 | wie V2 — **zu prüfen** | Erfassung | record | Systemakteur nur mit `ingest.write`; Segmente unveränderlich, Status unconfirmed bis menschliche Bestätigung (064) |
| V17 | Notiz je Frage (ausgeschaltet, E4) | Freitext | Beschäftigte; ggf. Aktionär oder Dritte im Text | Interne Rückfrage | nur mit Schalter; dann wie V4 — **zu prüfen, bevor eingeschaltet wird** | zugewiesene Rollen | working | `notes=off` Standard; nie Export, nie Bühne, kein Chat (046) |
| V18 | Löschung des Übungsbestands | gesamte Datenbank des Übungsmandanten | alle Gruppen der Probe | Zweckwegfall nach der Generalprobe | Art. 17 DSGVO; Nachweispflicht des Löschprotokolls — **zu prüfen** | Plattformbetreiber | — (Löschung) | Entfernen der getrennten Datenbank, nie der Dienstrolle; Löschprotokoll; Nachweis in der Go/No-Go-Liste (042, 078) |
| V19 | Demo-Betriebsart | keine Personendaten im Tool; Hoster-Zugriffsprotokoll (IP-Adresse, Zeit) nach Standard des Hosters | Betrachtende der Demo | Vorführung, Taktfläche für Kleinänderungen | Zugriffsprotokoll des Hosters: Art. 6 Abs. 1 lit. f — **zu prüfen** (Hoster-Bedingungen) | Hoster | — | Kein Konto, keine Anmeldung, nur Seed; Daten bleiben im Browser der betrachtenden Person (ADR 0002) |

---

## 4. Risiken und Schutzmaßnahmen (Kurzfassung)

Vollständiger Schutzmaßnahmenkatalog in 083; Bedrohungsmodell in 039; Sicherheitsprüfung in 074.

| Risiko | Schutzmaßnahme | Wo (Scheibe, Register) |
|---|---|---|
| Fachbereiche sehen, wer gefragt hat | Pseudonymisierung Standard an; Klarnamenauflösung als eigenes, protokolliertes Recht | 026; S4 |
| Vorgangshistorie wird zur Leistungskontrolle | Zwei Protokollebenen; keine Kennzahl je Person als Tor; Auswertung personenbezogener Felder nur zu zweit; generierter Auswertungskatalog | 033, 047; E13; ADR 0013 |
| Klarnamen in einem unveränderlichen Log | Personentabelle getrennt; personId in Ereignissen; PII-Teil mit keyId je Jahrgang hinter Codec | 024, 026; ADR 0009, 0011 |
| Zu breite Rechte, stille Vererbung | Deny by default; Rechte als Daten; Wahrheitstabelle mit Diff bei jeder Änderung; Rechte-Snapshot je Jahrgang | 010, 021, 077 |
| Freigabe ohne Kontrolle | Ersteller ≠ Freigeber technisch erzwungen; Rechtstor vor der Bühne, zur Laufzeit nicht abschaltbar | 021; E25 |
| Zugriff nach dem Ausscheiden oder nach der HV | Rollenzuordnung mit Ablauf am Jahrgangsende; Sitzung 14 h; Sperrliste ohne Neustart | 026, 029 |
| Notfallzugang wird Dauerzugang | Zwei versiegelte Konten, nur bei gemeldetem IdP-Ausfall, befristet, jede Nutzung ein Alarm | 029, 088; E11 |
| Übungsdaten bleiben liegen | Eigene Datenbank; Löschung durch Entfernen mit Protokoll; Bestand vor Codec wegwerfbar | 042, 078; ADR 0010 |
| Podiumsgerät verliert oder zeigt Fremdes | Nur eigener Bühnenplatz; geschützte Fragen erst auf der Bühne; offline nur Absichtswarteschlange; Kiosk-Modus | 047, 058; E7, E33 |
| Personenbezug entsteht vor der Prüfung | Beta nur synthetische Fragen; Testidentitäten ohne Personenbezug bis zum DSB-Review; gepoolte Stationsidentitäten in der Probe | E13, E14, E39 |
| Nachbarsystem schleust Personendaten ein | Ein Adapter je System mit Systemakteur und eigenem Recht; Segmente unveränderlich; KI ohne Statuswechsel und ohne Anbieter | 064, 066; ADR 0008; E18 |
| Rechtsgrundlage oder Zitat falsch | Alles `verified:false` und „ungeprüft" bis zur Freigabe durch Recht; dieser Vorentwurf trägt keine geprüfte Aussage | 076; E15 |

---

## 5. Offene Punkte für den DSB

Fragen, die nur der DSB, Recht oder der Eigentümer beantworten können. Keine davon blockiert die Beta mit
synthetischen Daten; die ersten drei blockieren Personenidentitäten auf Staging (E14).

1. **Erforderlichkeit der DSFA** (Schwellwertanalyse) und, falls ja, Zuschnitt der Endfassung (083).
2. **Verantwortlicher und Auftragsverarbeiter:** formale Benennung; AVV mit Plattformbetreiber (Konzern-IT
   oder gemieteter Host, E10, E39); Rolle des Konzern-IdP (Auftragsverarbeiter oder gemeinsam
   Verantwortlicher).
3. **Rechtsgrundlagen** der Matrix in Abschnitt 3, je Zeile; insbesondere Beschäftigtendaten in Historie und
   Zugriffslog (V4–V6, V10–V12) im Zusammenspiel mit der Betriebsvereinbarung (E13).
4. **Aufbewahrungsfristen je Klasse** (`record`, `working`, `technical`) und Umgang mit Legal Hold (E16);
   Schlüsselverwahrer (073).
5. **Betroffenenrechte:** Auskunft, Berichtigung und Löschung gegenüber einem nur anhängenden Log mit
   Nachweispflicht; geplanter Weg ist Krypto-Shredding je Jahrgang (E16) statt physischer Löschung.
6. **Datenminimierung der IdP-Claims:** welche Claims das Tool speichert (Subject, Anzeigename; E-Mail?), ob
   Gruppen transient bleiben (E8, E11).
7. **Übungsmandant:** gepoolte Stationsidentitäten ohne Personenbezug als geplanter Weg; Löschkonzept und
   Löschprotokoll (V18); Interimsvereinbarung als Chance (E13).
8. **Drittlandbezug:** keiner geplant (souveräne Cloud, inhouse-Nachbarsysteme); Hoster der Demo und
   Rückfall-Host zu bestätigen (V19, E39).
9. **KI-Wissensbasis:** außerhalb der Beta (E18); vor einer Anbindung eigene Prüfung (Anbieter, Vertragsbedingungen,
   Korpusgrenze).
10. **Veröffentlichung nach der HV:** außerhalb der Beta (E29); Namensnennung ist eine spätere Entscheidung.

---

## 6. Abgrenzung

Nicht Teil dieses Vorentwurfs: Produktivbetrieb (Leitplanken 9.3), Veröffentlichung und Aktionärskanal,
KI-Anbieter, Aktienregisterabgleich, Ergebnisse von Pentest und Sicherheitsprüfung (039, 074), die
Betriebsvereinbarung selbst. Diese Punkte kommen mit der Endfassung (083) oder nach der Beta.

## 7. Quellen

`docs/produktplan-beta.md` Abschnitte 3, 4, 8.4, 10 · `docs/qualitaetsleitplanken-produktreife.md`
Abschnitt 11 · `docs/rollen-und-rechtekonzept.md` · `docs/ist-analyse-und-schnittstellen.md` Abschnitte 2,
4, 6 · `docs/glossar.md` · `docs/entscheidungsregister.md` (E4, E7, E8, E10–E19, E24, E25, E28, E29, E33,
E36, E38, E39; S4) · ADR 0002 sowie die in 015 entstehenden ADR 0003–0016 (Dateinamen im Register,
Abschnitt 4).
