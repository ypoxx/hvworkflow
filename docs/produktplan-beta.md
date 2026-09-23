# Produktplan Beta — vom MVP zur soliden Beta

**Zweck.** Dieser Plan führt das HV-Tool von der Entscheidungsdemo (hvtool.netlify.app, Stand `1aa49f3`) zu einer soliden Beta: ein schattenfähiges System, das echte Personen mit echten Anmeldungen in einer Generalprobe vor der Hauptversammlung im April 2027 benutzen können, ohne dass es das führende System ist. Er ist die Arbeitsgrundlage für die nächsten 24 Wochen: Scheibenschnitt, Reihenfolge, Nachweise, Entscheidungen mit Standardannahme. Er baut nichts; jede Scheibe bekommt vor dem Bau ihre eigene Spec nach Regel 1. Gebaut wird von KI-Agenten; der Kalender ist deshalb in Agentenzeit gerechnet, und begrenzend sind äußere Termine (Antworten, Recht, Betriebsrat, Konzern-IT, Pentest, Generalprobe) und die Nutzungsgrenzen der Modelle, nicht die Arbeitszeit eines Menschen.

**Stand am 23. September 2026.** MVP-Demo mit In-Browser-Kern (ADR 0002), 29 Operationen im Vertrag, ereignisbasierter Kern mit 20 Regel-IDs (R-TRANS-00..12, R-GUARD-01..05, R-PERM-01, R-IDEM-01), Rechte als Daten für 8 Rollen, Hono-Dienst mit 25 Vertragstests und X-Actor-Header statt Anmeldung, 39 Kern-Tests, 9 Web-Unit-Tests, 5 Playwright-Szenarien mit Abnahmesatz. Gemessen (docs/messung.md): rund 280 Tsd. Subagenten-Token je Auftrag, eine Demo-Scheibe mit Bau, Review und Nacharbeit im Median rund 0,65 Mio. Token; die Demo mit acht Scheiben brauchte zwei Bautage mit je rund 2 h 40 min unbeaufsichtigter Orchestrierung, also rund eine Stunde Wandzeit je Scheibe einschließlich Review und Nacharbeit. Die Projektleitung hat die Demo gesehen und 33 Aussagen hinterlassen (docs/feedback/2026-09-quickview-projektleitung.md); vier Audit-Befunde sind offen.

**Zielgruppe.** Die KI-Agenten, die bauen, prüfen und dokumentieren (Fable als Architekt und Design-Kritik, Opus als Planer und Reviewer, Sonnet als Implementierer, Haiku als Mechaniker), und der Umsetzer, der Bautage startet, den Tagesbericht liest, an den Prüfpunkten entscheidet, Deployments freigibt (Regel 11) und die wenigen privilegierten Schritte nach Checkliste ausführt. Die Projektleitung liest die Abschnitte 1, 8, 10 und 11.

**Verbindliche Rahmen.** AGENTS.md Regeln 1 bis 12, ADR 0001 (Vertrag, Ports und Adapter, ein Adapter je Nachbarsystem; Status „vorgeschlagen", Annahme an Prüfpunkt 1), ADR 0002 (Demo-Betriebsart), docs/glossar.md (Hausvokabular), docs/design-prinzipien.md (Design-Kritik D1–D10). Kein Produktentscheid wird hier getroffen; jede offene Frage bekommt eine Standardannahme mit begrenzten Änderungskosten (Abschnitte 3 und 10). Wo eine Scheibe vor der Antwort auf einem Standard baut, steht im Register „auf Standard gebaut" mit Datum.

**Begriffe dieses Plans.**
- *Scheibe* ist eine Arbeitseinheit mit Spec in `docs/slices/NNN-name.md` (Regel 1); Nummern 009–079 stammen aus dem Entwurf, 080–088 kamen in der Gegenlese dazu und werden nicht umnummeriert.
- *Agentenstunde (AStd)* ist eine Stunde Wandzeit einer Scheibe in einer unbeaufsichtigten Orchestrierungssitzung, einschließlich Spec, Bau, unabhängigem Review und einer Nacharbeitsrunde. Sie ist keine Personenstunde. Angesetzt ist das Zwei- bis Dreifache der Demo-Messung, weil Beta-Scheiben Postgres, Keycloak und CI-Dienste berühren.
- *Bautag* ist ein Arbeitstag, an dem der Umsetzer eine Orchestrierungssitzung startet. Planannahme: drei Stunden Orchestrierung mit bis zu drei parallelen Worktrees und rund 1,5 Mio. Subagenten-Token je Bautag. Die Demo lag bei rund dem Doppelten; die Annahme wird in Woche 1 gemessen (Prüfpunkt 1).
- *Lane* ist ein Dateibereich mit exklusivem Besitz; zwei gleichzeitig laufende Scheiben teilen nie eine Lane (Abschnitt 5.1).
- *Prüfpunkt* ist ein Termin, an dem der Umsetzer mit den genannten Personen Nachweise ansieht und Entscheidungen unterschreibt (Abschnitt 7). Er ist kein Merge-Tor für einzelne Scheiben.
- *Hoch, mittel, niedrig* ist die Risikoklasse einer Scheibe; sie bestimmt Review-Tiefe und Plandauer (Abschnitte 6.3 und 8.1).

## 1. Definition „solide Beta"

Die Beta ist erreicht, wenn jedes Kriterium B1 bis B18 mit dem genannten Nachweis in `docs/evidence/beta/README.md` belegt ist. Jeder Nachweis ist eine Testausgabe, ein Protokoll oder ein Screenshot — keine Behauptung (Regel 2). Die Exit-Kriterien der Meilensteine in Abschnitt 5 sagen, wann welches Kriterium geschlossen wird; B13 und B18 schließen erst in 079.

- **B1 Echte Anmeldung.** Jede Person meldet sich über OIDC am Dienst an (Authorization Code serverseitig im Dienst, HttpOnly-Sitzung; das Web hält kein Token); der X-Actor-Header ist außerhalb `HV_DEMO=1` abgeschaltet und `HV_DEMO=1` wird bei gesetztem OIDC-Issuer beim Start verweigert. Fällt der IdP aus, gibt es zwei versiegelte Notfallkonten, die nur bei gemeldetem IdP-Ausfall aktivierbar sind und bei jeder Nutzung ein Alarmereignis erzeugen. Nachweis: Negativtests (X-Actor ohne Demo → 401, abgelaufene Sitzung → 401, Start mit beiden Schaltern → Abbruch, Notfallkonto bei laufendem IdP → 403), Screenshot der Anmeldeseite.
- **B2 Deny by default auf Lese- und Schreibpfaden.** Alle 13 Lesemethoden in `packages/domain/src/api.ts` laufen durch `can()`. Lesebereiche sind Rechte in `ROLE_PERMISSIONS`, nie Rollennamen im Code: `speaker.read`, `contribution.read`, `question.read`, `stage.read`, `history.read`, `event.read`. Standard: `event.read` nur für admin, Zähler und Vorgelesenes für observer. Die Attributebene (Einheit, Bühnenplatz, Vertraulichkeit) kommt mit 047. Nachweis: Wahrheitstabellen-Diff Rolle × Aktion und Attribut × Aktion, Negativtests je Recht.
- **B3 Ereignisspeicher als System of Record.** Postgres-Tabelle mit reinem INSERT/SELECT-Recht für die Dienstrolle, global lückenlose `seq` wie im Vertrag, `meetingId` auf jedem Ereignis, Hash-Kette über alle Ereignisse, Rebuild der Projektion aus 10 000 Ereignissen in unter 5 Minuten, Backup und Restore einmal als Drill protokolliert. Nachweis: Append-only-Test, Migrationstor, Drill-Protokoll mit Zeiten.
- **B4 Eine Referenzuhr.** `recordedAt` kommt immer aus der Server-Uhr und ist die maßgebliche Zeit. `occurredAt` ist eine Angabe des Absenders mit Quellenkennzeichen (`server`, `device`, `paper`, `transcript`); nur `server` ist vertrauenswürdig, alle anderen werden im Export als Angabe ausgewiesen. Der Browser rechnet mit Server-Offset und warnt ab 30 s Drift; der statische now()-Check läuft über domain, api und web. Nachweis: Tor-Ausgabe, Test mit gefälschter Client-Uhr, Test „Gerätezeit wird nie zu recordedAt".
- **B5 Zwei Protokollebenen.** Fachliche Vorgangshistorie (Ereignislog, unbegrenzt) und technisches Zugriffslog (strukturiert, ohne Fragetext, mit Korrelations-ID, 30 Tage, getrennte Senke). Das Zugriffslog und personenbezogene Felder der Historie sind nur im Vier-Augen-Verfahren auswertbar (Ereignis `AuditAccessGranted` mit Zweck und Frist). Keine Kennzahl je Person existiert; Rate-Limit-Zähler sind flüchtig und nicht auswertbar; der Auswertungskatalog wird generiert. Nachweis: Zugriffslog-Tor, Kennzahlen-Allowlist-Tor, Test „personId-Auswertung ohne zweite Freigabe → 403", Katalog als CI-Artefakt.
- **B6 Rechtlicher Kern.** Verweigerungspfad A (kein Anspruch) und B (Verweigerung mit Grundkatalog als Daten) laufen durch Rechtsfreigabe und Vier-Augen. Kein Übergang auf die Bühne ohne Rechtsfreigabe (R-GUARD-07); der Geltungsbereich ist eine Tabellenzeile je Antwortpfad (`LEGAL_GATE_BY_TRACK`, Standard: alle drei Pfade), nie zur Laufzeit abschaltbar, es gibt keinen Eilpfad an der Freigabe vorbei. Ersteller ≠ Freigeber ist erzwungen (R-GUARD-06, personengenau nur mit Einzelidentitäten). Nachfragen sind Threads. Vor dem Schluss der Generaldebatte wird die Restantenliste bestätigt (087). Grundpflicht und Prüfliste der Rechtsfreigabe sind Guards im Kern, nicht Sperren in der Oberfläche. Jede Regel-ID trägt `legalRef` (verified:false erlaubt) und einen Test. Nachweis: Test je Regel-ID, Wahrheitstabellen-Diff, generiertes `docs/legal-trace.md`.
- **B7 Bühne je Person und Gerät.** Jedes Podiumsmitglied hat einen Bühnenplatz und sieht seine eigene Warteschlange (Filter über den Bühnenplatz, Sortierstrategie als Daten), kann vorblättern ohne „Vorgelesen" auszulösen, stellt Schrift, Zeilenabstand und Gewicht je Gerät ein. Die Ansicht überlebt 20 s Verbindungsverlust mit lokal gepufferten nächsten 20 freigegebenen Antworten und Hinweisstreifen „Stand HH:MM:SS". „Vorgelesen" wird offline nur als Absicht gepuffert; der Status bleibt `staged`, bis der Dienst die Absicht angewendet hat, und die Ansicht zeigt bis dahin „nicht bestätigt". Einmal auf der realen Geräteklasse geprüft. Nachweis: Playwright mit abgetrenntem Netz, Screenshot vom Podiumsgerät.
- **B8 Zwei Beantwortungsansichten.** Fokusansicht (nur eigene Zuweisungen, Doppelklick, Vollbild, begrenztes Format beim Speichern normalisiert, Lesehinweis in fremden Rollen) und Steuerungsansicht (Klassifizierung, Zuweisung, Weiterleiten, Verteilung je Fachbereich und Bühnenplatz); Klassifizierung liegt bei der Koordinationsrolle, nicht bei der Erfassung. Nachweis: Screenshots DE/EN, Playwright Doppelklick → Vollbild → speichern, Abnahmesatz in neuer Fassung grün.
- **B9 Nebenläufigkeit.** If-Match ist Pflicht auf allen mutierenden Operationen außer „Vorgelesen" (Redebeitrag trägt `version`); „Vorgelesen" prüft stattdessen den Hash der vorgelesenen Antwortversion. Idempotenzschlüssel überleben einen Neustart, Übernahme-Sperre (Claim/Lease) auf Redebeitrag und Einzelfrage, Zwei-Schreiber-Test beweist keine verlorene Änderung, Entwürfe werden lokal gepuffert (060). Nachweis: Testausgaben, Playwright Reload ohne Entwurfsverlust.
- **B10 Betrieb.** Container-Image mit typisiertem Konfigurationsschema, `/healthz` und `/readyz` (DB und Migrationsstand ab 027, NTP), strukturiertes Zugriffslog, fünf fachliche Kennzahlen mit Auswertung und Alarmversand je Umgebung, SSE-Strom `/v1/stream` mit Last-Event-ID, In-App-Alarme mit Quittung (085), drei Umgebungen (Demo, Staging-synthetisch, Übungsmandant), Deploy nur aus der Pipeline nach Go des Eigentümers, kein Deploy im Freeze-Fenster. Nachweis: Pipeline-Protokoll mit Approval-Schritt, `curl /readyz` bei gestoppter DB → 503, Screenshot der Auswertung mit ausgelöstem Testalarm.
- **B11 Last.** Lasttest mit 50 Backoffice- und 15 Erfassungsnutzern über HTTP gegen 800 Fragen über 30 Minuten; p90 Schreiben < 300 ms am Dienst, SSE-Latenz < 2 s; Vielfrager-Szenario. Im Browser gilt für Filter- und Bühnenwechsel D9 (p90 < 100 ms) als Ziel; das harte e2e-Tor steht bei 150 ms, bis E41 entschieden ist (heute gemessen 129–145 ms). Nachweis: `docs/evidence/071-last.md` mit p50/p90/p99, nightly Lauf.
- **B12 Niederschrift-Anlage.** Notar-/Auskunftsliste je HV (alle Einzelfragen mit Wortlaut, Redner, Antwortstand, verwendeter Version, Vorgelesen-Quittung mit Soll-Ist-Vermerk, Verweigerungen mit Grund, Verfahrensereignisse, bestätigte Restantenliste) als druckbares HTML und JSON mit Hash-Liste; Export nur mit `export.dossier`, jeder Export ein Ereignis, Notizen nie enthalten. Gerüst in 051, vollständig in 081. Nachweis: Snapshot-Test gegen Seed, Test „Export ohne Recht → 403".
- **B13 Tore ehrlich.** docs/agentische-entwicklung-plan.md Abschnitt 5 nennt nur Tore, die in `.github/workflows/gates.yml` laufen, und führt geplante Tore in einer Spalte „geplant in Scheibe". Am Ende laufen dependency-cruiser, gitleaks, pnpm audit, Semgrep, axe-core, Rollenliteral-Scan über domain und api, now()-Check, Legal-Trace-Test, Antwort-Schema-Validierung, Migrationstor, Zeitbudget, Hash-Ketten-Prüfung, Scheibenumfang-Tor, Plan-Graph-Prüfung, Zugriffslog-Tor; Branch-Schutz erzwingt sie. M0 schließt nur B13a (Inventar ehrlich, Plan-Ehrlichkeits-Tor grün); B13 vollständig schließt 079. Nachweis: Plan-Ehrlichkeits-Tor grün, Screenshot des Branch-Schutzes.
- **B14 Dokumentation geprüft.** Runbook v1 (Degradationsstufen, Notfallkonten, Papierpfad mit Nummernkreisen, Offline-Podium, Datenpanne mit Meldekette, Eskalation, Alarmregeln, Freeze-Kalender), Admin-Anleitung, Integrationsleitfaden, Entwickler-Einstieg in zwei Stunden, Rollenkarten je Rolle; jede Anleitung einmal von einem fremden Modell befolgt. Nachweis: Protokolle der Befolgung mit Stolperstellen.
- **B15 Generalprobe bestanden.** Drehbuch mit Login-Check (> 95 % der eingeladenen Personen angemeldet), Kanarienfrage über alle Schritte (086), Failover-Drill (Dienst-Neustart ohne Verlust, Rebuild aus Backup), 20 s Podium-Partition, Papierpfad einmal geübt, ein Datenpannen-Szenario (verlorenes Podiumsgerät → Sitzung sperren), Support-Rota, Go/No-Go-Liste vom Eigentümer unterschrieben; Übungsmandant mit Banner, ohne Podium-Push in den Übungsmodus; ausschließlich synthetische Fragen; Löschprotokoll des Übungsbestands danach. Nachweis: `docs/betrieb/generalprobe-2027-03-protokoll.md`.
- **B16 Änderungstakt bewiesen.** Für die letzten zehn S-Punkte der Projektleitung ist jede Änderung spätestens am nächsten Bautag live; der Median von Nachricht bis sichtbarer Änderung wird mit `scripts/takt.mjs` in Uhrzeit gemessen. Rollen-, Rechte- und Übergangsänderungen sind nachweislich Tabellenänderungen mit Wahrheitstabellen-Diff. Nachweis: Takt-Tabelle in docs/messung.md.
- **B17 Demo-Kontinuität.** Die Netlify-Demo (In-Process-Betriebsart) baut weiter und besteht dieselbe e2e-Suite wie die HTTP-Betriebsart. ADR 0002 bleibt gültig: der localStorage-Adapter ist Wegwerfcode, bei Schemawechsel erscheint ein Reset-Banner, es gibt keinen Upcaster. Nachweis: Dual-Mode-e2e-Matrix grün, Test „altes Protokoll → Reset-Banner".
- **B18 Restliste mit Eigentümern.** Der Abnahmebericht listet jeden Nach-Beta-Punkt (B-Liste, Abschnitt 5.10) mit Eigentümer, frühestem Zeitfenster und dem in der Beta reservierten Attribut. Jedes Kriterium, das nur „mit Einschränkung" erfüllt ist, steht dort mit Bedingung. Im Rückfall gepoolter Stationsidentitäten (E13) sind das B1 (keine Einzelanmeldung), B6 (Vier-Augen nur auf Stationsebene, personengenauer Nachweis stammt aus Staging mit Keycloak-Testpersonen), B9 (Präsenzanzeige je Station) und B15 (Login-Check je Station). Nachweis: `docs/beta-abnahme.md`.

Leitplanken-Bezug (docs/qualitaetsleitplanken-produktreife.md nach Konsolidierung in 009): B1–B5, B9, B10, B13 entsprechen Meilenstein 9.1 „Produktionsfundament"; B6–B8, B11, B12, B14–B18 entsprechen 9.2 „Pilotbereit". 9.3 „Produktionsbereit" liegt außerhalb dieses Plans.

## 2. Ausgangslage

Quelle sind sechs unabhängige Inventuren des Repositoriums (Stand `1aa49f3`, Branch `claude/dax-shareholder-meeting-workflow-0s934z`). Zeilenangaben beziehen sich auf diesen Stand.

### 2.1 Die vier offenen Audit-Befunde — erste Arbeitspakete

| Nr. | Befund | Beleg | Scheibe |
|---|---|---|---|
| A1 | Lesepfade umgehen die Rechteprüfung: 13 von 13 Lesemethoden (getMeeting :263, listSpeakers :274, listContributions :329, listQuestions :383, getQuestion :389, getQuestionHistory :392, getStage :495, listEvents :509, subscribe :522) rufen weder `requirePermission` noch `can()`; `question.read` wird nur für `_actions` benutzt (api.ts:144-147). GET /v1/events liefert das volle Protokoll an jede gültige X-Actor-Kennung (apps/api/src/app.ts:285-288). | packages/domain/src/api.ts:263-395, :495-511 | 010 |
| A2 | Tor-Inventar überzeichnet: Plan Abschnitt 5 nennt dependency-cruiser (:235), Legal Trace je Regel (:245), Antwort-Schema-Validierung (:247), Migrationen (:249), Semgrep/Secrets/Audit (:250), now()-Check (:252), Lastbudget (:259), axe-core (:260) und fünf Hooks (:270-277); in `.github/workflows/gates.yml:17-34` laufen nur Vertragstypen-Diff, `pnpm gates`, Wahrheitstabellen-Diff und Playwright; `.claude/settings.json` hat einen PreToolUse-Hook. @axe-core/playwright ist installiert (apps/web/package.json:39), nirgends importiert. | docs/agentische-entwicklung-plan.md:226-279 | 012, 013, 016, 018 |
| A3 | Kein Legal-Trace-Feld: `Transition` und `Guard` tragen `ruleId` und `description` (transitions.ts:10-24); openapi.yaml:21-23 (`x-legal-notice`) behauptet Normverweise in den Regeltabellen, die es nicht gibt. Zitate der Recherche sind unverifiziert (anforderungen-recherche.md:11). | packages/domain/src/transitions.ts:17-24 | 011 |
| A4 | Scheibe 008 (docs/qualitaetsleitplanken-produktreife.md, 506 Zeilen) liegt nur auf `origin/codex/bewertungsbericht-zum-hv-tool-erstellen` (e4ef4e1); sieben Befunde offen: ADR 0001 operativ bindend, Regel 7 nicht verhandelbar, Perspektiven auf heutige Rollen, Mensch entscheidet Herabstufung, Betriebsrat und Rechtsprüfung im Register, um ein Drittel kürzen, ein durchgerechnetes Beispiel. Zwei veraltete Worktrees (`.claude/worktrees/agent-*`) verdoppeln Doku bei repo-weiten Suchen. | git branch -a; qualitaetsleitplanken:148-149, :468-491 | 009 |

### 2.2 Kern und Vertrag (`packages/domain`, `packages/contract`)

**Vorhanden.**
- Wortmeldeliste mit Runden und Reihenfolge (api.ts:283-327).
- Redebeitrag mit Quelle manual|transcript (:339-348).
- Atomisierung mit Spans und Restabdeckung (:349-381, coverage.ts).
- Klassifizierung in drei Antwortpfade (R-TRANS-01), Zuweisung (R-TRANS-02), Antwortversionen mit versionsgebundener Freigabe (R-TRANS-03/05, R-GUARD-04), Zurückgeben (R-TRANS-06), Bühne als globale Warteschlange (R-TRANS-07/08, state.ts:27), Vorgelesen und Abgeschlossen (R-TRANS-09/10), Zurückziehen und Zusammenführen (R-TRANS-11/12, R-GUARD-05).
- Terminalzustände (R-TRANS-00). Rechte als Daten mit `ROLE_PERMISSIONS` als einzigem Ort für Rollennamen (permissions.ts:12-44), `can()` als einzigem Entscheidungspunkt (api.ts:128-141), generierte Wahrheitstabelle Rolle × Status × Aktion mit 176 Zeilen und Diff-Tor (transitions.test.ts:87-117). Append-only-Speicher (store.ts:27-37), Idempotenz je Akteur, Operation und Ressource (R-IDEM-01, api.ts:204-216), ETag/If-Match (:195-203), injizierte Uhr (:108-109, :153), RFC 9457 mit Regel-ID (:42-63). Vertrag 0.1.0 mit 29 operationIds (openapi.yaml:41-455), Sicherheitsschemata demoActor und oidc-Platzhalter (:470-481). Synthetischer Seed mit allen Zuständen (seed.ts). 39 Kern-Tests, ein Test je Übergangszeile.

**Teilweise.**
- If-Match ist `required: false` (openapi.yaml:488-492).
- RegisterSpeaker, reorderSpeakers, captureContribution, captureQuestions prüfen keine Version, `Contribution` hat kein `version`-Feld (types.ts:131-139). Idempotenzschlüssel liegen in einer In-Memory-Map (api.ts:157) und gehen beim Neustart verloren.
- Der Ereignis-Umschlag hat sieben Felder ohne idempotencyKey, causationId, schemaVersion oder Hash (events.ts:16-24). Vier-Augen-Prinzip fehlt: legal hält `answer.draft` und `question.approve` (permissions.ts:33), R-TRANS-05 hat keinen Guard Ersteller ≠ Freigeber (rechtekonzept:109). Sprecherstatus ohne Übergangstabelle (api.ts:319-327, state.ts:137-149). Bühne je Person nur halb modelliert: `stageAssignment` je Frage (types.ts:71-72), aber eine globale `stagePosition` (state.ts:27, api.ts:495-508). Weiterleiten an eine andere Einheit nach Entwurf unmöglich (R-TRANS-02 nur aus classified|assigned). Meeting ist ein Singleton mit Status immer `running` (state.ts:20, :100).
- Fragennummern `F-<n>` würden über HVs kollidieren (api.ts:361-370). Rechtekonzept und Code sprechen verschiedene Vokabulare (rechtekonzept:40-56 vs. types.ts:26-60: question.refuse.*, export.dossier, admin.roles.manage, Status refused fehlen). Vertrag: `seedDemo` sagt „Replace all data" (openapi.yaml:456), der Kern verweigert Seed auf nicht-leerem Log (api.ts:515-517).

**Fehlend.**
- Verweigerungspfad A/B mit Grundkatalog (grep `refus|Verweiger` = 0 Treffer; Recherche Z.63-64, Ist-Delta Nr. 1).
- Nachfragen-Threads (kein parentQuestionId, Ist-Delta Nr. 5).
- Rechtstor vor der Bühne für Pfad podium (R-TRANS-08 classified→staged ohne Rechtsprüfung, transitions.ts:119-126; Ist-Delta Nr. 7, Recherche Z.422).
- Vorabfragen.
- Antwortrunde als Bündel.
- Antwortformat (AnswerVersion.text ist ein String, openapi.yaml:701-712).
- Vorgelesen als Entität mit Soll-Ist (Ist-Delta Nr. 6).
- Zurückstellen und Korrektur nach Vorlesen (Ist-Delta Nr. 8).
- Auskunftsschuldner ≠ Sprecher (Ist-Delta Nr. 11).
- Verfahrensereignisse (Widerspruch, Protokollierungsverlangen, Anordnungen; Recherche Z.74/259).
- Export für Notar und Niederschrift (kein Export-Endpunkt).
- Jahrgang (`meetingId`) auf Vorgängen und Ereignissen; TOP-Fortschritt und Restanten-Feststellung.
- Notiz, Vertraulichkeitsstufe, Aufbewahrungsklasse, Legal Hold.
- Benachrichtigungen mit Quittung; Kanarienfrage.
- Personentabelle (Speaker.displayName im Klartext in jeder Frage, types.ts:161).
- Löschung und Krypto-Umschlag.
- OIDC.
- SSE.
- Ingest.
- KI-Vorschläge.
- Aktienregister-Lookup.

### 2.3 Oberfläche (`apps/web`)

**Vorhanden.**
- Fünf Phasenansichten (/speakers, /capture, /answers, /stage, /history; routes.tsx:31-74) mit Alt+1..5, Kurzbefehl-Dialog, Skip-Link.
- Kopfzeile mit Prozessbalken und Popover-Legende, Rollenumschalter, Sprachumschalter (Header.tsx, HeaderStrip.tsx).
- Wortmeldeliste mit Drag-and-drop über dnd-kit inkl. Tastatursensor (speakers/Page.tsx:197-273).
- Erfassung mit Markieren-und-Erfassen, Alt+Q, Satzvorschlag, Restabdeckung (capture/ContributionText.tsx, SuggestDialog.tsx, CoverageBar.tsx).
- Beantwortung mit virtualisierter Liste, Wort-Diff, Freigabesiegel, 412-Hinweis (answers/WorkList.tsx, QuestionDetail.tsx, StaleBanner).
- Bühne mit 28-px-Frage, zwei Tasten, „Nur Bühne", Kontrastmodus (stage/Podium.tsx).
- Historie mit Zeitleiste und Ereignisstrom (history/Page.tsx). Bausatz mit 20 Komponenten, Dialog mit Fokusfalle, Toast aria-live. i18n mit 437 Schlüsseln DE/EN, Englisch gegen Deutsch typisiert (i18n/types.ts:8-10).
- Rollen nur in actor.ts und RoleSwitcher.tsx.
- Vokabular-Tor (scripts/vocabulary-check.mjs). Fünf Playwright-Szenarien inkl. Abnahmesatz mit weichen Zeitmessungen (< 1500 ms; gemessen 129–145 ms Filter, 130–137 ms Bühne bei 800 Fragen). 21 Screenshots in docs/evidence, alle vom 3. September.

**Teilweise (Feedback-Bezug in Klammern).**
- Bühne zeigt globale Warteschlange statt Ansicht je Bühnenzuordnung (#7).
- Warteschlange nicht anklickbar, keine Vorschau ohne Vorgelesen, kein „noch n" (#10).
- Anzeigeeinstellungen nur „Nur Bühne" und Kontrast, keine Schrift, kein Zeilenabstand (#6).
- „Nur Bühne" nicht Standard für podium (#9).
- Verteilung nur je Status, nicht je Fachbereich und Bühnenzuordnung (#11).
- Griff blass, Hinweis nur über der Liste (#17).
- Antwortfeld ist ein Textarea ohne Format (#27, #30, #31).
- Aktion heißt „Zur Prüfung geben" statt „Weiterleiten" (de.ts:289, :309; #32).
- Uhr mit Sekunden, viermal je Sekunde (Clock.tsx:16-35; #13).
- Kein Lesehinweis in fremden Rollen (#26).
- Korpus 800 Fragen und 118 Wortmeldungen mit SEEDED_QUESTIONS = 800 in vier e2e-Dateien und MAX_STAGE_ROUNDS = 130 (#14).

**Fehlend.**
- Fokusansicht (kein onDoubleClick in apps/web/src; #24, #29).
- Steuerungsansicht mit Klassifizierung in der Beantwortung (Klassifizierung sitzt auf der Erfassungskarte, capture/QuestionCard.tsx:129-212; #22).
- Entfernen von Redezeit, Ring, Timer, Spalte „Art" (SpeakerRow.tsx:140-186, RegisterDialog.tsx:108-149, SpeakingTimer.tsx; #15).
- Schlanke Erfassungskarte und TOP ausgeblendet (#21, #23).
- TOP und Erfassungszeit aus der Fokusansicht (QuestionDetail.tsx:386-404; #28).
- Echte Anmeldung (actor.ts:8-35).
- HTTP-Client für HvApi (kein `fetch(`, kein EventSource in apps/web); Realtime über Geräte hinweg (useApiVersion.ts:10-16 refetcht alles je Ereignis); Notiz- und Weiterleiten-Dialog; Ingest-Einstieg; axe-core im Lauf, Tastaturpfad-Tor, prefers-reduced-motion (styles/index.css ohne Regel); Sichtbarkeit je Einheit, Bühnenzuordnung, Vertraulichkeit; Onboarding (Rollenkarte, Kontexthilfe).

### 2.4 Dienst und Tore (`apps/api`, CI, Hooks, Agenten)

**Vorhanden.** Hono-Dienst mit allen 29 Pfaden (app.ts:127-282), Anfrage-Validierung gegen die Vertragsschemata (validate.ts, contractSchema.ts), Problem-Details ohne Stacktrace (problem.ts), X-Actor-Adapter mit 401 bei unbekannter Rolle (actor.ts:11-29), optionaler JSONL-Speicher (eventLog.ts:9-33), ETag/If-Match/Idempotency-Key-Durchreichung, Seed nur bei HV_DEMO=1; 25 Tests (jede operationId ausgeübt, 16 Negativfälle, Abnahmesatz über HTTP). `pnpm gates` = Vertragslint, Typen, oxlint, Tests, Vokabular, Web-Build; CI zusätzlich Typen-Diff, Wahrheitstabellen-Diff, Playwright, Evidence-Upload. Vier Agentenrollen (implementierer-backend, implementierer-oberflaeche, mechaniker, reviewer ohne Write/Edit). Netlify-Build nur für das statische Web mit drei Sicherheitsheadern.

**Teilweise oder fehlend.**
- JSONL-Log ist prozesslokal, synchron, ohne fsync und Hash (eventLog.ts:34).
- Kein Postgres, keine Migration. Kein Health-, Ready- oder Metrik-Endpunkt.
- Nur console.log.
- Keine Korrelations-ID.
- Kein Rate-Limit, kein Body-Limit, kein Timeout.
- CORS fest auf localhost:5173 (app.ts:103-111).
- Nur drei Umgebungsvariablen ohne Schema.
- Kein Dockerfile, keine Pipeline für den Dienst, kein Staging.
- Keine CSP. Literal `'admin'` als Seed-Akteur (app.ts:85). Vokabular-Tor scannt nur apps/web/src (vocabulary-check.mjs:8, :28). Antworten werden nicht gegen das Schema validiert. Hooks: nur PreToolUse mit vier Mustern.
- Kein Stop-, SubagentStop-, PostToolUse-Hook. Keine Agentendefinition für Architekt, Planer, Design-Kritik oder Sicherheitsperspektive. Branch-Schutz nicht aus dem Repositorium erkennbar.
- Rote Merges sind möglich. CI installiert Chromium bei jedem Push, auch bei Doku-Änderungen.

### 2.5 Dokumentation

**Vorhanden.** AGENTS.md (12 Regeln, Berichtsformat), README mit Dokumentenindex, ADR 0001 (Status „vorgeschlagen", Datum offen), ADR 0002 (angenommen für die Demo), Recherche mit 279 MUSS-Items und Zeitachse T-300..T+30, Ist-Analyse mit 14 Delta-Punkten und Schnittstellenarchitektur, Rechtekonzept mit Attributen und Auswertungskatalog-Anforderung, Designprinzipien mit Checkliste D1–D10, Glossar, agentischer Plan mit Rollen, Takt, Toren, Kostenrahmen, Messtabelle für zwei Bautage, Feedback-Auswertung mit 33 Aussagen und neun Fragen, sieben Slice-Specs mit Review-Befunden.

**Fehlend.**
- ADRs 0003 ff. (Persistenz, Identität, Antwortformat, Bühne je Gerät, Deployment, Integrationen, Aufbewahrung, Pilotmodus, Umschlag, Zustandsmodell, Protokollebenen, Realtime, Vertragsversionierung, Arbeitsmodell).
- Entscheidungsregister mit Eigentümer und Fälligkeit (rund 38 verschiedene offene Entscheidungen aus sechs Quellen).
- Admin-Anleitung.
- Runbook.
- Integrationsleitfaden.
- Entwickler-Einstieg in zwei Stunden.
- Paket-READMEs.
- Vertrags-Changelog.
- Glossar-Zeilen für Koordination, Verweigerung, Antwortrunde, Weiterleiten, Vertraulichkeitsstufe, Fokus-/Steuerungsansicht („Versammlungsbüro" ist noch auf `moderation` abgebildet).
- Änderungsprotokoll je Feedback-Runde.
- Abdeckungsmatrix Quelle → Scheibe. Der agentische Plan ist in den Abschnitten 7–9 (15-Tage-Demo, Kostentabelle) auf die Demo geschrieben und nach M0 intern widersprüchlich, wenn nur Abschnitt 5 korrigiert wird.

### 2.6 Betrieb und Sicherheit

**Vorhanden.** Append-only im Port, injizierte Uhr, Validierung vor der Domäne, Seed hinter HV_DEMO, .gitignore für .env, Netlify-Header, deterministische CI, ein PreToolUse-Hook. Anforderungen an Freeze-Kalender, Runbook, Degradationsstufen, NTP, Break-Glass, Monitoring, RPO 0, zwei Generalproben sind in Recherche und Ist-Analyse beschrieben (anforderungen-recherche.md:263-264, :295-299, :312-318, :365-374; ist-analyse:281).

**Fehlend.**
- Identität ist selbst erklärt (jeder Client kann admin behaupten).
- Sitzung, Token-Lebensdauer, Abmeldung, Kill-Switch fehlen.
- Keine dauerhafte Mehrnutzer-Persistenz.
- Kein Backup, kein Restore, kein Rebuild-Test.
- Kein Health, keine Kennzahlen, keine Kanarienfrage.
- Kein Zugriffslog getrennt von der Vorgangshistorie.
- Keine Secrets-Verwaltung, kein Container, kein TLS-Konzept.
- Keine NTP-Prüfung, kein Server-Zeit-Echo (rund zehn Date.now()-Stellen im Web treiben Dringlichkeitsanzeigen).
- Kein Offline-Podium (0 IndexedDB, 0 onLine-Prüfungen) trotz ADR 0001:68-70.
- Kein Freeze-Kalender, kein Übungsmandant.
- Keine Lastmessung mit 50+15 Nutzern.
- Kein Bedrohungsmodell, kein SBOM, kein Pentest-Auftrag.
- Keine Endgeräte- und Browser-Richtlinie für die Podiumsgeräte.

### 2.7 Anforderungsdelta

Von 279 MUSS-Items der Recherche sind rund 12 im Kern vorhanden, rund 33 teilweise, rund 234 fehlend (davon etwa 90 organisatorisch ohne Codeanteil). Von den acht hohen Ist-Delta-Punkten ist einer erfüllt (Atomisierung), einer halb (TOP), sechs fehlen (Verweigerung, Clustering mit Rückverfolgbarkeit, Nachfragen, Ist-Antwort, Rechtstor vor Bühne, Korrekturschleife). Die Projektleitung bestätigt mit ihren Fakten den Kern (Atomisierung, Wortlaut, Bühne, Vier-Augen) und verlangt drei Umbauten (Klassifizierung zur Koordination, zwei Beantwortungsansichten, Bühne je Person) sowie sieben Rückbauten (Uhr, Korpus, Redezeit, Art, Erfassungskarte, TOP, Begriff). Alle Normzitate der Recherche stehen unter dem Rechtsstandsvorbehalt aus deren Abschnitt 0; die genaue Zahl der betroffenen Regeln leiten 011 und 014 aus den `legalRef`-Einträgen mit `verified:false` ab. Sie werden als Daten gebaut (Kataloge, Fristen, Zitate), nicht als Code, damit die Rechtsprüfung nur Datenpflege auslöst. Die Beta beschränkt sich auf den rechtlich tragenden Kern plus das, was die Generalprobe braucht; Vorbereitung (§7), Aktionärskanal, Nebenstränge, MAR-Ampel, PDF/A, KI-Anbieter sind Nach-Beta (Abschnitt 5.10).


## 3. Entscheidungen jetzt, Annahmen und Änderungskosten

Keine dieser Zeilen ist eine Entscheidung. Jede ist eine Standardannahme, die der Plan so baut, dass die spätere Antwort eine Tabellen-, Enum-, Konfigurations- oder Adapteränderung kostet — nie einen Umbau. Die Regel dahinter: Rollen und Übergänge sind Daten (Regel 4, 5), Persistenz und Identität sind Adapter (ADR 0001), Formatumfang ist eine Whitelist, Bühnensicht ist ein Filter in `getStage`, Kataloge und Zitate sind Daten. Wo ein Standard gebaut wird, bevor die Antwort da ist, trägt das Register (Abschnitt 10) den Vermerk „auf Standard gebaut" mit Datum. Kosten stehen in Agentenstunden (AStd, Definition in der Einleitung); sie sind Agentenzeit, keine Personenzeit.

| Entscheidung | Standardannahme | Warum nicht blockierend | Kosten bei späterer Änderung | Entscheider |
|---|---|---|---|---|
| Wer klassifiziert (Rollenname, Frage 2) | Arbeitsname `coordination` in ROLE_PERMISSIONS mit question.classify, question.assign, question.forward, round.assemble; capture verliert classify/assign; Anzeige „Koordination" per i18n | Rollen sind Daten; die Steuerungsansicht rendert nur `_actions` | Umbenennen: < 1 h (Haiku: Schlüssel, zwei i18n-Einträge, Tabelle). Zuordnung zu bestehender Rolle (z. B. Versammlungsbüro): 0,5 AStd (ROLE_PERMISSIONS, Wahrheitstabellen-Snapshot, zwei e2e-Personas, Abnahmesatz) | Projektleitung |
| Zusammenstellung der Antwortrunde (Frage 3) | Die bestehende Runde (`Speaker.round`, Wechsel Fragesteller-Runde und Beantwortungs-Runde) bleibt unverändert. Neu ist ein eigenes Antwortbündel `AnswerBundle` (meetingId, number, questionIds[], strategy, assembledBy, closedAt), manuell durch die Koordination, Zielgröße 20; Standardreihenfolge nach Bühnenplatz, dann Nummer; `strategy` ist ein Datenfeld. Glossarzeile „Antwortbündel" in 018 | Das Bündel referenziert Fragen-IDs und berührt die Zustandsmaschine nicht; die Bühne je Gerät sortiert über eine Strategiefunktion (Standard: stagePosition), das Bündel liefert nur eine zweite Strategie | Neue Strategiefunktion < 1 AStd; Bündel = bestehende Runde: Bündel wird ein Filter auf `round`, 1 AStd; Wegfall: Ansicht ausblenden, Entität bleibt | Projektleitung |
| Exportpfad des Transkriptionstools (Frage 4) | Zwei getrennte Fragen. E3a Vertragsform: `POST /v1/ingest/speech-segments` (segmentId, text, startedAt, endedAt, speakerId optional, source), Segmente unveränderlich, Status unconfirmed, eingefroren in 043. E3b Adapter: erster Adapter ist ein Datei-/Zwischenablage-Import im Browser, der die Datei zerlegt und den Ingest-Endpunkt mit der Sitzung der erfassenden Person aufruft; `ingest.write` erhält capture als Zeile in ROLE_PERMISSIONS, Systemakteure erhalten es für Push-Adapter | ADR 0001 Grenze 3: ein Adapter je Nachbarsystem hinter dem kanonischen Vertrag; der Erfassungsfluss bleibt identisch | Form später ändern: ein Vertragszyklus 1 AStd plus Allowlist-Eintrag; Push-Adapter 1,5–3 AStd plus Partnerleitfaden; der Vertrag bleibt zwei Vertragszyklen kompatibel (Ist-Analyse §6.1) | Projektleitung, Tool-Team |
| Notiz-/Rückfragefeld je Frage (Frage 5) | Feld `note` mit Ereignis QuestionNoteAdded im Vertrag, hinter Meeting-Konfiguration `notes=off` bis zur Antwort; nie im Export, nie auf der Bühne, kein Chat | Additives Vertragsfeld; Sichtbarkeit über `can()`-Attribut; ohne Schalter entsteht kein personenbezogener Freitext im Log | Einschalten: Konfiguration; Ausbau zu Thread: additiv < 1,5 AStd; endgültiger Verzicht: Feld bleibt leer | Projektleitung |
| Bedeutung „Weiterleiten" (Frage 6) | 020 ändert nur die Anzeige (i18n „Weiterleiten" für submitForReview), Ereignis und Operation bleiben. 048 baut nach der Antwort zusätzlich das Weiterleiten an eine andere Einheit (neuer Übergang R-TRANS-13 forward mit Grund); eine Umbenennung von Ereignis oder Operation geschieht, wenn überhaupt, in 048 | Anzeige ist ein i18n-Schlüssel; das Weiterleiten an eine Einheit ist eine Tabellenzeile | Anzeige zurück: Minuten; Zeile entfernen: 0,5 AStd plus Wahrheitstabellen-Diff | Projektleitung |
| Formatierungsumfang (Frage 7) | Whitelist: Absatz, Aufzählung, fett, kursiv, Hervorhebung; gespeichert als kleines Blockdokument plus Klartextprojektion für Suche und Diff; Normalisierung in der Domäne; ein Renderer für Bühne, Historie, Export; keine Schriftwahl | Der Markensatz ist ein Enum im Vertrag; erweitern ist additiv | Marke ergänzen < 1 AStd. Marke entfernen: Renderer-Whitelist verengen (unbekannte Marke wird Klartext), keine neuen Versionen (eine neue Version würde Freigaben löschen, R-TRANS-03) | Projektleitung |
| Sieht das Podium nur eigene Fragen (Frage 8) | `stageAssignment` wird eine Bühnenplatzliste je Jahrgang (Bühnenplatz {id, label, personId?, deviceId?}), administriert in 040; die vier heutigen Enum-Werte werden die Standardplätze im Seed. Meeting-Konfiguration `podiumVisibility = own \| all_marked`, Standard `own`, als Attributfilter in `can()` und `getStage`; der Kontext wird im Dienst aus Rollenzuordnung und Bühnenplatz aufgelöst, nie aus einer Angabe des Clients | 010 erzwingt nur Rechte; der Filter kommt mit Personentabelle (026), Bühnenplätzen (040) und Attributrechten (047) | Konfigurationswert umstellen: Minuten; Recht auf „nur eigene" einschränken: eine Wahrheitstabellenzeile | Projektleitung, Vorstand |
| Rollenzuweisungspfad (Frage 9) | Administrierte Zuordnungstabelle im Tool (subject → Rollen je Jahrgang, optional `unitId` je Zuordnung) als Ereignisse RoleAssigned/RoleRevoked mit Ablauf am Jahrgangsende; IdP-Gruppen werden als Vorschlag gelesen, nie automatisch zur Rolle | Beide Pfade münden im selben Actor-Objekt; die Tabelle ist die eine Wahrheit | Sync-Adapter „IdP führt" < 1,5 AStd; `can()` unverändert | Konzern-IT, Projektleitung |
| Hosting-Plattform | Zwei Artefakte (statisches Web, OCI-Container für apps/api), managed Postgres, Orientierung Telekom-Großkundenstandard (souveräne Cloud). Staging-synthetisch läuft bis zum Konzernkonto auf einem vom Umsetzer gemieteten Container-Host, dort bis zur AVV nur synthetische Testidentitäten ohne Personenbezug (E39). Übungsmandant: Standard dieselbe Plattform wie Staging; Rückfall wird mit E13 am 29.01.2027 entschieden: gemieteter Host plus Keycloak-Realm mit gepoolten Stationsidentitäten, AVV vom Umsetzer unterschrieben, DSB informiert (E10b) | Container, Konfigurationsschema, Health-Endpunkte sind plattformneutral; die Plattform bestimmt nur Secrets-Bezug und Netzgrenze | Pipeline-Ziel und Secrets-Bindung < 3 AStd; Datenmigration ist Dump/Restore des Ereignislogs | Eigentümer, Konzern-IT, DSB |
| Identity Provider und Client-Typ | OIDC über BFF im Dienst: Authorization Code serverseitig, vertraulicher Client, HttpOnly-Sitzungscookie, JWKS-Prüfung, Issuer/Audience als Konfiguration; Staging gegen Keycloak-Container; Produktion gegen Konzern-IdP; Sitzung 14 h mit stillem Refresh, Leerlauf-Timeout, Abmelden, Sperrliste ohne Neustart (Kill-Switch, Recherche SOLL). Zweiter Adapter `localBreakGlass`: zwei versiegelte Notfallkonten mit langem Einmalgeheimnis, nur bei gemeldetem IdP-Ausfall aktivierbar, zeitlich befristet, jede Nutzung ein Alarmereignis | `apps/api/src/actor.ts` ist der einzige Ort, der Identität herstellt; ein BFF funktioniert mit öffentlichen und vertraulichen Clients; das Web hält nie ein Token | IdP-Wechsel: Konfiguration plus Claim-Mapping (Stunden); SAML statt OIDC: zweiter Auth-Adapter ca. 3 AStd ohne Domänenberührung | Konzern-IT |
| Persistenzform des Ereignislogs | Managed Postgres, eine Tabelle `events` (seq, id, meeting_id, type, occurred_at, occurred_at_source, recorded_at, actor, subject_id, payload jsonb, prev_hash, hash, schema_version, retention_class, legal_hold), `seq` global lückenlos wie im Vertrag, Index auf meeting_id, Dienstrolle nur INSERT/SELECT; Projektionen beim Start aus dem Log, Snapshot optional; JSONL bleibt Dev-Adapter; Personentabelle getrennt | Der Persistence-Port (store.ts) existiert; die Domäne sieht nur append/readAfter; append-only bleibt (Regel 7, nicht verhandelbar) | Anderer Speicher: ein Adapter ca. 1,5 AStd plus Migrationslauf; die Ereignisse sind speicherunabhängig | Umsetzer (Konzernstandard als Orientierung) |
| Realtime-Kanal | Server-Sent Events `GET /v1/stream?after=seq` mit Last-Event-ID und Heartbeat; Polling `/events` bleibt Fallback; kein WebSocket, kein Broker | `store.subscribe` existiert; SSE ist ein Endpunkt ohne Domänenänderung; Clients brauchen ohnehin `after=seq` | WebSocket-Adapter zusätzlich < 1,5 AStd, Client-Port identisch | Umsetzer |
| Jahrgang und Tagesordnung | Modelliert wird nur der Jahrgang (`meetingId` auf Wortmeldung, Redebeitrag, Einzelfrage, Bündel und jedem Ereignis, vor dem ersten Postgres-Schreibvorgang). Ein zweiter Rechtsträger wird nicht gebaut, sondern steht als Registerzeile. `/v1/meetings/{id}/…` kanonisch, `/v1/meeting` als Alias für „aktuelle HV" bis Vertrag 0.5. Lebenszyklus preparation→running→closed plus Tagesordnungsfortschritt (AgendaItemOpened, VotingOpened, VotingClosed) als Tabelle R-MTG | Einbau vor der ersten echten Persistenz ist billig, danach ein Log-Neuaufbau | Zweiter Rechtsträger: Feld `legalEntityId` additiv plus Filter, rund 1,5 AStd; Jahrgangs-Klonen: Admin-Aktion | Umsetzer |
| Pilotmodus | Schattenbetrieb in der Generalprobe (die Beta ist nie führend); Tochter-HV oder „führend mit Papier-Fallback" bleiben der Produktionsstufe vorbehalten; `HV_MODE = training \| shadow \| live` als Konfiguration mit Banner, eigener Datenbank, Podium-Push nur in live | Alle drei Modi laufen auf derselben Software | Konfiguration; die organisatorische Vorbereitung ist der Aufwand | Projektleitung |
| Betriebsrat und DSFA | Prozess startet am 25.09.2026 (Eigentümer); bis zum Abschluss läuft die Beta nur mit synthetischen Fragen; zwei Protokollebenen, 30 Tage Zugriffslog, Auswertung personenbezogener Felder nur zu zweit, keine Kennzahl je Person; DSFA-Vorentwurf und Rechtsgrundlagen-Matrix aus 014 bis 13.11. beim DSB; Zulieferungen 083 (Schutzmaßnahmenkatalog, Beschreibung der Testidentitäten, DSFA-Endfassung) fertig Mitte November, Übergabe spätestens 18.12.; Interimsvereinbarung bis 29.01.2027 als Chance, gepoolte Stationsidentitäten als geplanter Weg | Die Software wird BV-verträglich geschnitten, unabhängig vom Verhandlungsstand; der Termin blockiert den Produktivstart, nicht die Beta | Zusätzliche Schutzmaßnahmen aus der Vereinbarung sind Konfiguration (Aufbewahrung) oder das Entfernen von Kennzahlen; der Rückfall schränkt B1, B6, B9 und B15 ein (B18) | Eigentümer, HR, Betriebsrat, DSB |
| Rechtsprüfung der Normzitate und des Verweigerungskatalogs | `legalRef {source, citation, docVersion, docHash, verified:false}` an jeder Regel; Grundkatalog als Daten mit verified-Flag; Oberfläche zeigt „ungeprüft", bis Recht freigibt. Vorabzug des Regelregisters und ADR 0012 an Recht nach 011 (Anfang Oktober), umbasiertes Rechtekonzept mit 052 (Mitte November); Rückmeldung erbeten bis 15.01.2027, Satzung und Geschäftsordnung bis 09.10.; Rückmeldefrist 29.01.2027, Eskalation 05.02.2027, Einberufungspassagen bis 14.02.2027 | Struktur und Tests entstehen jetzt, Inhalte werden nachgetragen; ein falsches Zitat wird nie als geprüft ausgegeben | Datenpflege (076 und Kleinänderungsspur), kein Code | Eigentümer, Recht |
| Aufbewahrung, Löschung, Krypto-Umschlag | Jedes Ereignis trägt `retentionClass (record \| working \| technical)` und `legalHold:false`; personenbezogene Felder liegen nur in der Personentabelle (personId in Ereignissen) und im markierten Payload-Teil `pii` mit `keyId` je Jahrgang hinter einer Codec-Schicht (Beta: Identitäts-Codec, aber keyId ab dem ersten Ereignis); keine Löschlogik in der Beta; jeder Bestand vor eingeschaltetem Codec gilt als wegwerfbar; Schlüsselverwahrer wird in 073 benannt. Umkodieren erzeugt nie eine Änderung am Log: es ist ein Export in eine neue Datenbank. Der Übungsbestand wird gelöscht, indem der Plattformbetreiber die getrennte Datenbank entfernt (nie die Dienstrolle), mit Löschprotokoll | Der Umschlag ist billig, bevor das erste echte Ereignis existiert; Verschlüsselung später einschalten ändert weder Domäne noch Vertrag; Regel 7 bleibt unberührt | Ohne Umschlag: Neuaufbau des Logs. Mit Umschlag: Schlüssel einschalten und Bestand einmal in eine neue Datenbank exportieren < 3 AStd | Recht, DSB |
| Vertraulichkeitsstufe und geschützte Fragen | Attribut `confidentiality (internal \| restricted \| protected)` auf QuestionRecord, Standard internal; `can()` erhält Kontext {unit, seat, confidentiality, timeWindow}. Setzen: legal, approver, admin. `protected` lesen: legal, approver, admin und die Fachkräfte der zugewiesenen Einheit; das Podium sieht geschützte Fragen erst, wenn sie auf der Bühne stehen. Personenbezogene Historie (`event.read.personal`) nur mit zweiter Freigabe (AuditAccessGranted). Zähler bleiben lückenlos (Existenz sichtbar, Inhalt nicht); verdeckter Bestand (Ethical Wall, Recherche Z.332) ist Nach-Beta | Deny by default; Stufen sind ein Enum und eine zweite generierte Wahrheitstabelle Attribut × Aktion | Stufe ergänzen: Enum plus Tabellenzeilen; verdeckter Bestand: eigene Scheibe nach der Beta | Recht |
| Pseudonymisierung gegenüber Fachbereichen | Standard an (`pseudonymiseForUnits = true`, Recherche Z.116 MUSS, Rechtekonzept §6); Klarnamen sieht, wer `question.identity.reveal` hält (Standard: coordination, moderation, legal, approver, podium) | Recht, kein Rollenname; Umschalten ist Konfiguration | Abschalten: Konfiguration plus Registerzeile | Projektleitung, DSB |
| Benachrichtigungen und Alarme | In-App-Alarm als Ereignis `NotificationRaised {severity, targetPermission, subjectId, ruleId}` mit Quittung, zugestellt über den SSE-Strom an angemeldete Sitzungen mit dem Zielrecht (085); kein Push, keine E-Mail in der Beta; die Betriebsauswertung (037) alarmiert außerhalb des Tools | Ein Ereignistyp und eine Ansicht; Empfänger sind Rechte, keine Rollennamen | Zusätzlicher Kanal (E-Mail, Push): ein Adapter 1,5 AStd | Umsetzer, Projektleitung |
| KI-Funktionen und Anbieter | Nur ein Port: `POST /v1/questions/{id}/answer-suggestions` mit Pflichtfeldern sources, model, version, confidence; kein Statuswechsel durch KI; Adapter `none` (503 „nicht konfiguriert"); kein Anbieter in der Beta | Recherche Z.160: Vollbetrieb ohne KI ist Pflicht; der Port sichert die Vertragsform | Ein Adapter je Anbieter, Modell-Pinning als Konfiguration | Projektleitung, Recht, DSB |
| Zustandsmodell und Verweigerung | Keine Reform in der Beta: 11 Zustände bleiben; Verweigerung ist eine Antwortart (`answerKind: answer \| refusal_no_claim \| refusal_with_ground`, `refusalGroundId`), die durch in_review → approved → staged → delivered läuft (Vier-Augen und Rechtstor gelten automatisch); Zurückstellen, Korrektur offen, Nachfrage sind Kennzeichen, und jedes Kennzeichen ist ein Guard oder eine Zeile in transitions.ts mit Regel-ID und Test; ADR 0012 geht mit dem Regelregister an Recht, bevor 044 baut, sonst trägt 044 den Vermerk „auf Standard gebaut" | Kennzeichen sind additiv und brechen keine Tests; die Übergangstabelle bleibt Daten | Zustandsreform nach der Beta über Projektion 3–6 AStd; Wechsel auf zwei Hauptzustände refusal_proposed/refused 2,5 AStd | Umsetzer, Recht |
| Letztverantwortung Freigabe und Rechtstor | Rolle approver trägt die Freigabe; Recht empfiehlt (`question.legal.clear` als eigenes Ereignis), gibt nicht frei; zwei benannte Vertretungen je Rolle über die Zuordnungstabelle. Rechtstor vor der Bühne R-GUARD-07 mit Geltungsbereich als Datentabelle `LEGAL_GATE_BY_TRACK` (Standard: alle drei Pfade), zur Laufzeit nicht abschaltbar; kein Eilpfad an der Freigabe vorbei. Die Kapazität kommt aus zwei Hebeln: wer `question.legal.clear` hält (z. B. Mitglieder des Fast-Track-Teams über Rollenzuordnung) und die Prüflistentiefe je Pfad als Daten (E37) | Alles Zeilen in ROLE_PERMISSIONS und Datentabellen | ROLE_PERMISSIONS-Zeilen plus Tabellenzeile 0,5 AStd mit Wahrheitstabellen-Diff | Projektleitung, Vorstand, Recht |
| HV-Datum und Formatprofil | Planungsannahme: Präsenz-HV am 15.04.2027. Profilfeld `format: presence \| hybrid \| virtual` auf Meeting (023), Standard presence. Bestätigung bis 02.10.2026 | Alle T-Werte hängen am Datum; die Software kennt ein Profilfeld | Datum: Neuberechnung der T-Werte mit dem Plan-Graph-Skript. Hybrid: Präsenzregeln plus Vorabfragen (068 rückt vor, +2,5 AStd). Virtuell: Vorabfragen-Modul wird der Eingang, Live-Erfassung bleibt für Videobeiträge; M4/M5 werden neu geschnitten | Projektleitung |
| Taktfläche für Kleinänderungen | Die Netlify-Demo (In-Process) bleibt Taktfläche bis beta-1 (Ergänzung zu ADR 0002, Annahme an Prüfpunkt 1); der Merge des Eigentümers ist das Go, die Pipeline baut die Demo (Regel 11 gewahrt); Staging-synthetisch bekommt Kleinänderungen mit dem nächsten Approval-Deploy; der Übungsmandant nur außerhalb des Freeze | Demo und HTTP teilen Kern, Vertrag und e2e-Suite (B17) | Taktfläche auf Staging umstellen: Pipeline-Regel | Umsetzer |
| Veröffentlichung und Aktionärskanal | Nach-Beta: keine Veröffentlichung, keine Aktionärsstrecke; `publicationVersion` und Kennzeichen `internal \| external` sind reservierte Attributnamen | Berührt nur Aufbewahrungsklasse und ein reserviertes Feld | Publikations-Workflow mit PII-Tor: eigene Scheiben nach der Beta | Projektleitung, Recht |
| Fragen an den Aufsichtsratsvorsitz | Einheit „AR-Büro" als Stammdatum (040) plus Attributregel „Vorstands-Einheiten lesen AR-Fragen nicht" (047) mit Test; der Bühnenplatz des AR-Vorsitzes existiert bereits im Seed | Einheit und Regel sind Daten | Eigener Strang mit getrennter Freigabe: Nach-Beta, rund 3 AStd | Projektleitung, Recht |

## 4. Zielarchitektur der Beta

Die Beta behält die drei Grenzen aus ADR 0001 und füllt sie mit Adaptern: Die Oberfläche (React, zwei Betriebsarten) spricht nur den aus dem Vertrag generierten `HvApi`-Client; der Dienst (Hono, Container) implementiert den Vertrag über demselben Kern; der Kern kennt weder Postgres noch OIDC. Neu sind fünf Bausteine:

1. Der Ereignis-Umschlag v2 mit Jahrgang, Hash-Kette, zwei Zeiten (maßgebliches `recordedAt`, `occurredAt` als Angabe mit Quelle), Aufbewahrungsklasse und PII-Codec, gespeichert in einer nur anhängenden Postgres-Tabelle mit getrennter Personentabelle.
2. Identität über einen OIDC-BFF hinter dem bestehenden Actor-Port, mit Rollenzuordnung als Ereignisdaten und zwei versiegelten Notfallkonten für den IdP-Ausfall.
3. Realtime über SSE mit inkrementellem Client-Zustand statt Vollabruf; In-App-Alarme mit Quittung laufen über denselben Strom.
4. Attributbasierte Rechte (Einheit, Bühnenplatz, Vertraulichkeit, Zeitfenster) im selben `can()`, dokumentiert in einer zweiten generierten Wahrheitstabelle; der Kontext wird im Dienst aufgelöst, nie vom Client behauptet.
5. Die Bühne als eigenes, minimal gebündeltes Client-Modul je Gerät, das offline liest und „Vorgelesen" nur als Absicht puffert; der Zustandswechsel geschieht immer im Dienst.

Drei Umgebungen: Demo (Netlify, In-Process, Taktfläche), Staging-synthetisch (Agenten, e2e, Last, Chaos; nur synthetische Daten und Testidentitäten), Übungsmandant (menschlich betrieben, Banner „Generalprobe", eigene Datenbank, nach der Probe durch den Plattformbetreiber gelöscht). Jede Umgebung hat eine Betriebsauswertung mit Alarmversand. Nachbarsysteme erreichen den Kern nur über je einen Adapter hinter kanonischen Verträgen (Ingest, Vorschläge, Aktienregister-Lookup, Ereignisstrom/Webhooks) mit Systemakteuren und eigenen Rechten.

**Regel für den ADR-Status.** Der Architekt schreibt jeden ADR in 015 mit Status „vorgeschlagen"; Opus liest gegen Recherche und Rechtekonzept. „Angenommen" wird ein ADR nur durch eine benannte Person an einem Prüfpunkt (Abschnitt 7), mit Datum und Namen im ADR. Scheiben bauen gegen „vorgeschlagen" und tragen im Register den Vermerk „auf Standard gebaut". Die Spalte „Annahme" nennt den Prüfpunkt, an dem die Nachweise der genannten Scheibe vorliegen.

| ADR | Inhalt | Nachweis in | Annahme |
|---|---|---|---|
| 0001 | Keine inhaltliche Änderung; operativ bindend über die Leitplanken. 009 bereitet die Vorlage vor | 009 | Prüfpunkt 1, Umsetzer und Projektleitung (E42) |
| 0002 | Ergänzung: Demo-Betriebsart bleibt bis beta-1 Taktfläche, besteht dieselbe e2e-Suite, Reset-Banner statt Upcaster, localStorage-Adapter bleibt Wegwerfcode; Ende nach beta-1 durch Eigentümerentscheid | 015, 031 | Prüfpunkt 1 (Ergänzung), Eigentümer |
| 0003 Persistenz | Postgres-Ereignistabelle nur anhängend (INSERT/SELECT-Grant, `seq` global mit Advisory-Lock), Projektion rebuildbar, Snapshot optional, JSONL als Dev-Adapter, Rebuild < 5 min als Generalprobe-Pflicht, eine Datenhaltung mit PITR, keine zweite Zone in der Beta | 027 | Prüfpunkt 3 |
| 0004 Identität | OIDC-BFF im Dienst (Authorization Code serverseitig, HttpOnly-Sitzung, JWKS), Rollenzuordnung als Ereignisse je Jahrgang mit Ablauf und optionaler Einheit, IdP-Gruppen als Vorschlag, Sitzungsrichtlinie 14 h, Sperrliste, Notfallkonten nur bei IdP-Ausfall mit Alarmereignis, X-Actor nur bei HV_DEMO=1 und nie mit OIDC-Issuer | 029 | Prüfpunkt 3 |
| 0005 Antwortformat | Blockdokument mit Whitelist (paragraph, list; bold, italic, highlight), Normalisierung in der Domäne, Klartextprojektion für Suche und Diff, ein Renderer für Bühne, Historie, Export, reserviertes Feld `language` | 055 | Prüfpunkt 5 |
| 0006 Bühne je Gerät und Antwortbündel | Warteschlange je Bühnenplatz als Filter in `getStage`, Sortierstrategie als Daten, Vorblättern ohne Zustandswechsel, Geräteeinstellungen im Browser (legitime Per-Viewer-Bequemlichkeit), Einfrieren beim Öffnen mit Hinweisstreifen, eigenes Podium-Bundle; offline nur Absichtswarteschlange für „Vorgelesen", Status bleibt staged bis zur Anwendung im Dienst; Antwortbündel als Entität mit `strategy`, getrennt von `Speaker.round` | 056, 058 | Prüfpunkt 5 |
| 0007 Deployment, Hosting, Umgebungen | Zwei Artefakte, managed Postgres, Konfigurationsschema, Secrets nur aus der Plattform, Deploy nur aus der Pipeline nach Go, drei Umgebungen mit Betriebsauswertung, Freeze-Regel in der Pipeline, Orientierung Telekom-Großkundenstandard, gemieteter Host als Rückfall mit Härtungs-Checkliste | 037 | Prüfpunkt 3 |
| 0008 Integrationen | Ein kanonischer Vertrag je Nachbarsystem, ein Adapter je Fremdsystem, Systemakteure mit eigenem Recht, Segmente unveränderlich mit `speakerId` optional, KI löst nie einen Statuswechsel aus, HMAC-Webhooks, Sandbox-Mandant, /v1-Kompatibilität über zwei Vertragszyklen | 064, 065 | Prüfpunkt 5 |
| 0009 Aufbewahrung, Vertraulichkeit, Krypto-Umschlag, Personentabelle | retentionClass und legalHold je Ereignis, PII-Teil mit keyId je Jahrgang hinter Codec-Schicht, Personentabelle statt Klarnamen in Ereignissen, Vertraulichkeitsstufe mit deny by default, keine Löschlogik in der Beta, Bestand vor Codec wegwerfbar, Umkodieren nur als Export in eine neue Datenbank, Schlüsselverwahrer benannt | 047, 073 | Prüfpunkt 4, ergänzt nach 073 |
| 0010 Pilotmodus und Übungsbetrieb | HV_MODE training\|shadow\|live, Beta ist Schattenbetrieb, Übungsmandant mit Banner und ohne Podium-Push, Seed nur in training, Löschung durch Entfernen der getrennten Datenbank mit Protokoll | 042 | Prüfpunkt 3 |
| 0011 Ereignis-Umschlag v2 | schemaVersion, idempotencyKey, causationId, prevHash/hash (SHA-256 kanonisch), recordedAt maßgeblich, occurredAt mit Quellenkennzeichen, retentionClass, legalHold, meetingId, personId statt Klarname; kein Upcaster für Demo-Protokolle (Reset-Banner); Kettenprüfung beim Laden | 024 | Prüfpunkt 3 |
| 0012 Zustandsmodell | 11 Zustände bleiben; Verweigerung als Antwortart durch die bestehende Kette; Nebenaspekte als Kennzeichen (deferred, correctionOpen, followUp), jedes als Guard oder Tabellenzeile mit Regel-ID; fünf Anzeigegruppen; Alternative zwei Hauptzustände mit Kosten; Reform erst nach der Beta; geht vor 044 an Recht | 044 | Prüfpunkt 4, Umsetzer und Recht |
| 0013 Zwei Protokollebenen | Fachliche Vorgangshistorie (unbegrenzt, nicht abschaltbar) und technisches Zugriffslog (ohne Nutzdaten, Korrelations-ID, 30 Tage, getrennte Senke); Auswertung personenbezogener Felder nur zu zweit; Rate-Limit-Zähler flüchtig; keine personenbezogene Leistungsauswertung; Kennzahlen-Allowlist | 033, 047 | Prüfpunkt 4 |
| 0014 Realtime | SSE mit after=seq und Last-Event-ID, Polling als Fallback, kein Broker, Client wendet Ereignisse auf gepufferte Listen an | 035, 036 | Prüfpunkt 3 |
| 0015 Vertragsversionierung | Semver, CHANGELOG-Tor, brechende Änderung nur mit ADR-Verweis, neue Pflichtfelder erst optional mit Ablaufdatum und dann in einem Folgezyklus Pflicht, vorab deklarierte Operationen in einer Allowlist mit Ablaufdatum (damit das Tor „jede operationId wird ausgeübt" bestehen bleibt), Vertragsfreeze vor der Generalprobe, /v1-Kompatibilität für Partner über zwei Zyklen | 019 | Prüfpunkt 1 |
| 0016 Agenten-Arbeitsmodell | Lanes mit exklusivem Dateibesitz, berechneter Kalender statt Handplanung, Scheibenumfang-Tor, Plan-Graph-Prüfung, i18n je Feature-Modul, Feature-Register für Routen, e2e-Dateien je Scheibe plus geteilte Altdateien, Review-Paarung nach Regel 3, Merge durch den Orchestrator nach grünen Toren und Review (E48), Herabstufung nur mit menschlicher Unterschrift, Token-Regelkreis | 016 | Prüfpunkt 1 |

## 5. Meilensteine und Scheiben

Meilensteine sind thematische Bündel, keine Zeitabschnitte; sie überlappen, weil der Kalender aus dem Abhängigkeitsgraphen berechnet ist (Abschnitt 8.3). Jede Scheibe nennt Risikoklasse, Aufwand, berechnetes Kalenderfenster und Lanes in der Kopfzeile. Innerhalb eines Meilensteins stehen die Scheiben in der Reihenfolge ihres Starts. „Abhängigkeiten" nennen nur Scheibennummern; äußere Termine stehen im Kalender und im Register.

### 5.0 Abdeckungsmatrix — jede Quelle hat genau einen Ort

Jede Zeile löst sich in eine Scheibe, einen Nach-Beta-Eintrag (B-Liste, 5.10, mit Eigentümer) oder ein bewusstes Nein auf. Die Spec einer Scheibe nennt die Quellen-IDs in ihrem Ziel, damit der Reviewer (der nur Spec und Diff sieht) die Abdeckung prüfen kann.

| Quelle | Punkte | Scheibe(n) |
|---|---|---|
| Audit-Befunde A1–A4 | Lesepfade, Tor-Inventar, Legal-Trace, Leitplanken 008 | 010 · 012/013/016/018/084 · 011 · 009 |
| Feedback S-Punkte | #3, #9, #10, #13, #15, #17, #21, #23, #26, #32, #14 (Korpus) | 020 (Oberfläche), 080 (Redezeit, Art, Korpus) |
| Feedback Umbauten | #22 Klassifizierung zur Koordination · #24 zwei Ansichten · #7 Bühne je Person · #6 Anzeigeeinstellungen · #8 Antwortbündel · #11 Übersicht je Einheit/Bühnenplatz · #27/#30/#31 Format · #28 TOP/Zeit aus Fokus · #29 Doppelklick · #2 Anmeldung · #19 Ingest · #5 Notiz · #4 KI | 021 · 053/054 · 056 · 056 · 057 · 053 (counts aus 040) · 055 · 054 · 054 · 029/030 · 064 · 046 · 066 |
| Feedback Fragen 1–9 | Screenshot, Rolle, Runde, Transkript, Notiz, Weiterleiten, Format, Sichtbarkeit, Personen/IdP | 014 (Fragenpaket) → Register E1–E9 |
| Ist-Delta hoch 1–8 | Verweigerung · TOP-Zuordnung · Atomisierung (erfüllt) · Clustering rückverfolgbar · Nachfragen · Ist-Antwort · Rechtstor vor Bühne · Korrekturschleife | 044/045 · 020 (Feld optional, bleibt im Modell) · — · 069 · 046 · 049 · 021 · 046 |
| Ist-Delta mittel 9–14 | Versionierung (erfüllt) · zwei Datenbereiche · Auskunftsschuldner · Drehbuch-Kopplung · Vorabfragen · Taxonomie | — · 046 (Notiz getrennt) · 048 · 025 (R-MTG, Tagesordnung, Nachtragsregel) · 068 (light) · B-Liste |
| Ist-Analyse offene Fragen 1–9 | Fragenpaket Woche 1; Frage 5 (Rechtsrollen) eigene Zeile | 014 → Register E31, E40 |
| Leitplanken-Register (20 Zeilen) | Persistenz, IdP/Gast/Notfallkonten, Rollenzuschnitt/Vertretungen, DB-Topologie/HA, Betreiber, Legitimation, Veröffentlichung, Letztfreigabe/Rechtstor, ADR 0001, BR, Rechtsprüfung u. a. | 009 (konsolidiert), Register E10–E29, E42 |
| Recherche MUSS Betrieb/Sicherheit (tragend für die Generalprobe) | Z.263 Offline-Podium · Z.295/296 Hash-Kette, Rebuild · Z.299/205 Referenzuhr · Z.312 IAM · Z.330/344 Bedrohungsmodell, SBOM · Z.340 Rate-Limit · Z.362 Lasttest · Z.365 Entwurfsspeicherung · Z.367 Generalprobe · Z.370/371 Monitoring, Kanarienfrage · Z.373/374 Papier, Katalogkopie · Z.378 Login-Check | 058 · 024/027/038 · 032/033 · 029 · 039/074 · 034 · 071 · 060 · 078 · 037/086 · 068/070 · 062/078 |
| Recherche SOLL, bewusst mitgenommen | Z.351 Kill-Switch (Sperrliste, billig mit 029) | 029 |
| Recherche MUSS Recht (tragend) | Z.63/64 Verweigerung · Z.70 Nachfragen · Z.74/259 Verfahrensereignisse · Z.78 Restanten-Feststellung · Z.80 Korrektur · Z.91/422 Rechtstor · Z.103 Soll-Ist · Z.104/126 Legal Hold · Z.116 Pseudonymisierung · Z.129/130 zwei Protokollebenen mit Auswertung zu zweit · Z.231 Vier-Augen · Z.277 Delivery-Entität · Z.449 Auskunftsschuldner, Aufsichtsrat | 044 · 046 · 050 · 087 · 046 · 021 · 049 · 024 · 026 (Standard an)/067 · 033/047 · 021 · 049 · 048, 040/047 |
| Kritik der Gegenlese (fünf Linsen) | Blocker und Hauptbefunde zu Kalender, Rechtstor, Papierpfad, Vertrag zuerst, Kapazität, Token, Governance | 080–088 neu; Änderungen in 019, 021, 023, 025, 051, 058, 076 u. a.; Abschnitte 3, 4, 6, 8, 10 |
| Recherche MUSS übrig (§7, §8 Aktionärskanal, MAR-Ampel, PDF/A, Publikation, KI-Anbieter, Nebenstränge, Ethical Wall, Suche, SAML …) | — | B-Liste 5.10 |

### 5.1 Lanes — Dateibesitz für parallele Arbeit

Eine Scheibe darf nur ihre Lane(s), ihre eigene Datei `docs/slices/NNN-*.md`, ihr Feature-i18n-Modul (`apps/web/src/i18n/<feature>.{de,en}.ts` ab 017), ihre Zeile im Feature-Register (ab 082) und ihre eigene e2e-Datei `apps/web/e2e/NNN-*.spec.ts` berühren. Das Scheibenumfang-Tor (016) weist Pull Requests mit Dateien außerhalb der „Files allowed"-Liste ab. Zwei gleichzeitig laufende Scheiben besitzen disjunkte Lanes; `scripts/plan-graph.mjs` (016) prüft das gegen den Kalender.

| Lane | Dateien | Bemerkung |
|---|---|---|
| contract | `packages/contract/**` | seriell; der Architekt schreibt die Vertragspakete (019, 023, 043) vor den Implementierern; 028 und 080 ändern den Vertrag in engem Rahmen |
| core | `packages/domain/src/**` außer `store.ts`, `packages/domain/policy-*.md` | seriell (Wahrheitstabelle ist ein Snapshot); eine aktive Scheibe zur Zeit |
| persist | `packages/domain/src/store.ts`, `apps/api/src/persistence/**`, `apps/api/migrations/**` | |
| service | `apps/api/src/**` außer persistence | 027 darf `apps/api/src/server.ts` zum Verdrahten berühren |
| web-shell | `apps/web/src/app/**` (inkl. `featureRegistry.ts`), `apps/web/src/i18n/index*`, `apps/web/src/styles/**`, `apps/web/index.html`, `apps/web/public/**` | |
| web-api | `apps/web/src/api/**` | |
| web-components | `apps/web/src/components/**` | |
| web-<feature> | `apps/web/src/features/<feature>/**` je Feature: speakers, capture, answers, focus (neu), steering (neu), clearing (neu), cockpit (neu), stage, history, admin (neu) | |
| e2e | `apps/web/e2e/**` gemeinsame Konfiguration, `playwright.config.ts`, die vier Alt-Specs (001–003, abnahme) als geteilte Dateien | eine Scheibe nennt eine Alt-Spec nur, wenn ihre Spec es verlangt |
| infra | `.github/**`, `scripts/**`, `docker/**`, `netlify.toml`, `.claude/**`, `apps/web/vite.config.ts` | |
| manifests | `package.json`, `apps/*/package.json`, `packages/*/package.json`, `pnpm-lock.yaml` | additiv für jede Scheibe, die das Paket in der Spec nennt; das Lockfile regeneriert der Mechaniker beim Merge |
| docs-plan | `AGENTS.md`, `README.md`, `docs/agentische-entwicklung-plan.md`, `docs/glossar.md`, `docs/slices/README.md`, dieser Plan | |
| docs-<bereich> | `docs/entscheidungsregister.md` (register), `docs/adr/**` (adr, nur Architekt), `docs/betrieb/**`, `docs/sicherheit/**`, `docs/datenschutz/**`, `docs/legal*` und Rechtekonzept (legal), `docs/feedback/**` und `docs/messung.md` (feedback), `docs/entwicklung/**`, `docs/integration/**`, `docs/admin/**` (entwicklung) | je Bereich eine Lane |

Höchstens drei Scheiben laufen gleichzeitig (drei Worktrees je Bautag). Die Grenze kommt aus der Übersicht des Orchestrators und den Nutzungsgrenzen der Modelle, nicht aus der Zeit eines Menschen. Ausgenommen sind 074 (Pentest-Begleitung) und 078 (Generalprobe), die an feste Termine gebunden sind.

### 5.2 M0 · Fundament ehrlich machen — Kalender 28.09.–07.10.2026 (W1–W2)

**Ziel.** Die vier Audit-Befunde und die Konsolidierung von 008 sind erledigt, bevor neue Fläche gebaut wird; das Tor-Inventar entspricht der Wahrheit; alle Standardannahmen stehen als vorgeschlagene ADRs und im Entscheidungsregister; das Arbeitsmodell (Lanes, Hooks, Scheibenumfang-Tor, Plan-Graph-Prüfung, Branch-Schutz) trägt die Parallelität.

**Exit-Kriterien.**
- B13a: Tor-Inventar ehrlich, Plan-Ehrlichkeits-Tor grün mit Spalte „geplant in Scheibe"; `scripts/plan-graph.mjs` grün.
- B2 auf Rechteebene für alle Lesepfade; B6 teilweise (legalRef an jeder Regel-ID).
- Register mit rund 50 Zeilen; ADR 0003–0016 vorgeschlagen; i18n je Feature.
- Fragenpaket an die Projektleitung; erste Takt-Zeile in docs/messung.md; gemessener Tagesdurchsatz der ersten Bautage.
- Prüfpunkt 1 am 09.10.2026.

- **009 · Leitplanken 008 konsolidieren, ADR 0001 zur Annahme vorlegen, Repositorium aufräumen** — niedrig · 1,5 AStd · Kalender 28.09.2026 (W1) · Lanes: docs-plan
  - *Ziel:* docs/qualitaetsleitplanken-produktreife.md vom Codex-Branch übernehmen, um ein Drittel kürzen (≤ 340 Zeilen), die sieben Befunde einarbeiten (ADR 0001 bindend, Regel 7 nicht verhandelbar, Perspektiven auf heutige Rollen statt neuer Agenten, Mensch entscheidet Herabstufung, Betriebsrat und Rechtsprüfung als Registerzeilen, ein durchgerechnetes Beispiel), Vorlage zur Annahme von ADR 0001 an Prüfpunkt 1 (E42); Codex-Branch nach Merge löschen, `.claude/worktrees/agent-*` entfernen; AGENTS.md bleibt einzige Arbeitsordnung.
  - *Abhängigkeiten:* —
  - *Rolle/Modell:* Architekt · Fable; Review Opus
  - *Nachweise:* Zeilenzahl-Diff, Register mit Zeilen „Betriebsrat/DSFA" und „Rechtsprüfung", ADR-0001-Vorlage, `git branch -a` ohne Codex-Branch, pnpm gates
  - *Offene Entscheidung:* —
- **017 · i18n-Wörterbuch in Feature-Module teilen** — niedrig · 1 AStd · Kalender 28.09.2026 (W1) · Lanes: web-shell
  - *Ziel:* de.ts/en.ts werden Indexdateien, die Module (shell, speakers, capture, answers, stage, history; später focus, steering, clearing, cockpit, admin) zusammenführen; Englisch bleibt gegen Deutsch typisiert; Paritäts-Tor je Modul; 437 Schlüssel vorher und nachher identisch; Vorbereitung für parallele Oberflächenscheiben.
  - *Abhängigkeiten:* —
  - *Rolle/Modell:* Mechaniker · Haiku; Review Sonnet
  - *Nachweise:* Schlüsselzählung 437/437, Vokabular-Tor grün, pnpm gates
  - *Offene Entscheidung:* —
- **012 · Architektur- und Sicherheitstore, Tor-Inventar ehrlich** — mittel · 2 AStd · Kalender 29.09.2026 (W1) · Lanes: infra
  - *Ziel:* dependency-cruiser (Domäne importiert nichts aus apps/*, web nichts aus api/persistence, Adapter nicht aus Adaptern), gitleaks über Repositorium und Diff, Semgrep mit kleinem TypeScript-Regelsatz (Befund ab mittel blockiert, Vollauf nightly), pnpm audit mit Ausnahmeliste und Ablaufdatum je Ausnahme, Rollenliteral-Scan über apps/api und packages/domain (app.ts:85 `'admin'` wird Konfiguration `HV_SEED_ACTOR`), statischer now()-Check für domain und api, Antwort-Schema-Validierung in contract.test.ts, CI-Pfadfilter für Doku-Commits, Plan-Ehrlichkeits-Tor (jede „läuft"-Zeile in Plan Abschnitt 5 braucht einen CI-Schritt; geplante Tore stehen in der Spalte „geplant in Scheibe").
  - *Abhängigkeiten:* 009
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Mechaniker · Haiku (Konfigdateien); Review Opus
  - *Nachweise:* gates.yml-Diff; CI-Lauf grün mit allen Schritten und ein absichtlicher Verstoß rot (Screenshot); Plan Abschnitt 5 ohne unerfüllte Behauptung
  - *Offene Entscheidung:* —
- **014 · Entscheidungsregister, Abdeckungsmatrix, Fragenpaket, DSFA-Vorentwurf, Takt-Skript** — niedrig · 2,5 AStd · Kalender 29.09.2026 (W1) · Lanes: docs-register
  - *Ziel:* docs/entscheidungsregister.md mit rund 50 Zeilen (Abschnitt 10) (Entscheidung, Standardannahme, Eigentümer, Fällig, Rückfalltrigger, Kosten bei Änderung, betroffene Scheibe, Status „auf Standard gebaut"); Abdeckungsmatrix 5.0 als Datei; Fragenpaket Woche 1 an die Projektleitung mit nummeriertem Screenshot der Wortmeldeliste (Fragen 1–9 plus Ist-Analyse-Fragen 1–6, 8, 9, plus Letztverantwortung und Rechtstor, zwei Rechtsrollen, HV-Datum), Fragen 3, 7, 8 ausdrücklich für Feedback-Runde 2; DSFA-Vorentwurf mit Systembeschreibung, Datenflüssen und Rechtsgrundlagen-Matrix je Verarbeitungsschritt; Anfragen der Woche 0 als Registerzeilen mit Fälligkeit (Konzern-IT, Ansprechperson Tool-Team bis 16.10. für E3a, Pentest-Beschaffung, Geräte); docs/changelog-projektleitung.md eröffnet; scripts/takt.mjs berechnet den Median aus der Takt-Tabelle in docs/messung.md.
  - *Abhängigkeiten:* 009
  - *Rolle/Modell:* Architekt · Fable; Mechaniker · Haiku (Skript, Screenshot); Review Opus
  - *Nachweise:* Register, Matrix, Fragenpaket als Datei, DSFA-Vorentwurf, `node scripts/takt.mjs` Ausgabe
  - *Offene Entscheidung:* alle E-Zeilen (Abschnitt 10)
- **015 · ADR-Paket 0003–0016 als vorgeschlagen** — niedrig · 2,5 AStd · Kalender 30.09.2026 (W1) · Lanes: docs-adr
  - *Ziel:* Vierzehn ADR-Dateien nach Abschnitt 4 mit Status „vorgeschlagen", Kontext, Entscheidung (Standardannahme), Konsequenzen, Kosten bei Änderung, verworfenen Alternativen; ADR 0012 mit beiden Verweigerungsmodellen und Preisen; Ergänzung zu ADR 0002 (Demo-Betriebsart bis beta-1, Reset-Banner statt Upcaster); README-Index um ADRs, Register, Plan ergänzt.
  - *Abhängigkeiten:* 009
  - *Rolle/Modell:* Architekt · Fable; Review Opus (Konsistenz mit Recherche, Rechtekonzept, ADR 0001)
  - *Nachweise:* 14 Dateien plus Ergänzung 0002, Register verweist auf jede ADR, Opus-Lesebefund ohne Blocker
  - *Offene Entscheidung:* —
- **016 · Agentenrollen, Hooks, Scheibenumfang-Tor, Plan-Graph-Prüfung, Branch-Schutz** — niedrig · 1,5 AStd · Kalender 30.09.2026 (W1) · Lanes: infra
  - *Ziel:* .claude/agents: architekt.md (Fable), planer.md (Opus), design-kritiker.md (Fable, Read/Glob/Grep/Bash, Checkliste D1–D10), reviewer.md mit Perspektiven-Checkliste (Security, Datenschutz, Legal, Betrieb) und den sieben Sicherheitspunkten (Demo-Seed, Limits, Sitzung, CSP, Secrets, Bedrohungsmodell, Kill-Switch), reviewer-sonnet.md für Opus-gebaute Scheiben; Hooks: Stop (Exit 2 ohne Testlauf jünger als letzte Änderung), SubagentStop (Berichtsformat), PostToolUse (oxlint auf geschriebene Datei), PreToolUse erweitert (plain `git push`, `.env`-Zugriff, ausgehende Netzaufrufe); scripts/plan-graph.mjs prüft den Scheibengraphen dieses Plans (jede Abhängigkeit existiert, keine Zyklen, jede Abhängigkeit endet vor dem Start, gleichzeitig laufende Scheiben teilen keine Lane) und rechnet den Kalender aus Abschnitt 8.3 neu; scripts/slice-scope.mjs weist PRs mit Dateien außerhalb „Files allowed" ab; scripts/downgrade-check.mjs blockiert eine Risikoklassen-Herabstufung in einer Spec ohne Zeile „Herabstufung freigegeben von <Mensch> am <Datum>"; docs/betrieb/branch-schutz.md als Checkliste (< 30 min) für den Eigentümer: Pflicht-Statuschecks, kein Merge bei rot, keine Force-Pushes.
  - *Abhängigkeiten:* 012
  - *Rolle/Modell:* Mechaniker · Haiku; Review Sonnet
  - *Nachweise:* settings.json-Diff; Protokoll eines blockierten Stop-Versuchs; Scheibenumfang-Tor rot bei absichtlich fremder Datei; plan-graph.mjs rot bei absichtlich vertauschter Abhängigkeit; Screenshot des Branch-Schutzes (Eigentümer)
  - *Offene Entscheidung:* —
- **018 · Entwicklungsplan, Glossar und README abgleichen** — niedrig · 1 AStd · Kalender 01.10.2026 (W1) · Lanes: docs-plan
  - *Ziel:* docs/agentische-entwicklung-plan.md Abschnitt 5 auf Ist-Stand mit Spalte „geplant in Scheibe", Abschnitte 7–9 (Kostenrahmen, 15-Tage-Demo) durch Verweis auf diesen Plan und die Messtabelle ersetzt; Glossar-Zeilen für Koordination, Verweigerung, Antwortbündel (getrennt von Runde), Bühnenplatz, Weiterleiten, Vertraulichkeitsstufe, Fokusansicht, Steuerungsansicht, Leitstand, Rechtsfreigabe; „Versammlungsbüro" auf `moderation` bleibt bis E1; Abschnitt 3 des Entwicklungsplans: der Sicherheitsreview bleibt ein Modus des Architekten an den Prüfpunkten 3, 4 und 7, ergänzt um die Perspektive Security im Opus-Review je Scheibe; README-Index vollständig; Slice-Vorlage docs/slices/README.md um „Quellen-IDs", „Perspektive", „Glossar: neue Begriffe ja/nein", „Herabstufung freigegeben von" erweitert.
  - *Abhängigkeiten:* 014, 016
  - *Rolle/Modell:* Mechaniker · Haiku; Review Sonnet
  - *Nachweise:* Plan-Ehrlichkeits-Tor grün, Glossar-Diff, Vorlage
  - *Offene Entscheidung:* —
- **013 · Barrierefreiheit und Tastaturpfad als Tor** — niedrig · 1 AStd · Kalender 02.10.2026 (W1) · Lanes: e2e
  - *Ziel:* axe-core in allen fünf Playwright-Szenarien (Verstoß ab „serious" blockiert), Tastaturpfad-Spec je Kernszene, prefers-reduced-motion geprüft. Die vier bestehenden Spec-Dateien (001–003, abnahme) sind geteilte e2e-Dateien, die diese Scheibe in „Files allowed" nennt. Zeitbudget und Job-Matrix folgen in 084 nach dem Korpuswechsel.
  - *Abhängigkeiten:* 012
  - *Rolle/Modell:* Implementierer-Oberfläche · Sonnet; Review Opus
  - *Nachweise:* axe-Bericht 0 serious/critical; Tastaturpfad-Specs grün; pnpm gates + e2e
  - *Offene Entscheidung:* —
- **010 · Lesepfade unter can() mit Leserechten** — hoch · 2 AStd · Kalender 06.10.2026 (W2) · Lanes: core
  - *Ziel:* Alle 13 Lesemethoden in packages/domain/src/api.ts prüfen ein Leserecht (question.read, speaker.read, contribution.read, stage.read, history.read, event.read) auf Rechteebene; die Leserechte kommen aus Vertrag 0.2.0 (019) und werden nur in ROLE_PERMISSIONS vergeben, nie als Rollenname im Code: observer erhält Zähler und Vorgelesenes, podium stage.read, capture speaker.read und contribution.read, expert/legal/approver/moderation question.read, event.read nur admin; HTTP-Routen liefern 403 mit R-PERM-02; `_actions`-Form unverändert; Nicht-Ziel: Attributfilter (Einheit, Bühnenplatz, Vertraulichkeit, Frage 8) — das kommt in 047.
  - *Abhängigkeiten:* 019
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus mit Perspektive Security
  - *Nachweise:* Wahrheitstabelle mit Leseaktionen neu generiert und im Spec freigegeben; Negativtests je Rolle (observer 403 auf `?status=answer_drafted`, podium 403 auf /events); Playwright: Historie unter observer zeigt Leerzustand; pnpm gates
  - *Offene Entscheidung:* —
- **011 · Legal-Trace-Feld und Regelregister** — mittel · 1,5 AStd · Kalender 07.10.2026 (W2) · Lanes: core
  - *Ziel:* Transition und Guard erhalten `legalRef {source, citation, docVersion, docHash, verified:false}`; Test „jede Regel-ID hat legalRef und mindestens einen Test" (20 IDs heute, wächst mit R-SPK, R-MTG, R-PROC, R-ADM); openapi.yaml `x-legal-notice` berichtigt; docs/legal-trace.md wird aus der Tabelle generiert; Regelregister zählt ehrlich (20, nicht 24); nach dem Merge geht ein Vorabzug des Regelregisters mit ADR 0012 (vorgeschlagen) über den Eigentümer an Recht.
  - *Abhängigkeiten:* 010
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus
  - *Nachweise:* generierte docs/legal-trace.md eingecheckt; Testausgabe „20 Regel-IDs, 20 legalRef, 0 verified"; pnpm gates
  - *Offene Entscheidung:* Rechtsprüfung der Zitate (E15) — Inhalte bleiben „ungeprüft"

### 5.3 M1 · Rückbau und Passung — Kalender 01.10.–12.10.2026 (W1–W3)

**Ziel.** Alle S-Punkte der Projektleitung sind auf hvtool.netlify.app sichtbar (erster gemessener Takt); Vertrag 0.2.0 steht vor den Scheiben, die ihn brauchen; Redezeit und Art sind entfernt und der Korpus 28/230 ist die eine Quelle; Sprecherstatus ist eine Tabelle; Vier-Augen und Rechtstor vor der Bühne gelten; Klassifizierung liegt bei der Koordination; Feature-Register und CI-Matrix tragen die folgenden Oberflächenscheiben; Feedback-Runde 2 ist protokolliert.

**Exit-Kriterien.**
- B8 zur Hälfte (Klassifizierung bei coordination, Abnahmesatz umformuliert und grün), B16 erste Messung, B6 teilweise (R-GUARD-06/07).
- openapi.yaml ohne kind/requestedMinutes; Screenshots der fünf Ansichten mit Nummern der Feedback-Punkte.
- Protokoll Feedback-Runde 2 (09.10.) mit Statustabelle; Projektleitung gibt den umformulierten Abnahmesatz frei.
- Prüfpunkt 2 am 16.10.2026.

- **019 · Vertrag 0.2.0 (nur Vertrag): Redezeit und Art veraltet, Leserechte, Koordination, Rechtsfreigabe-Ereignis, Versionierung** — mittel · 1,5 AStd · Kalender 01.10.2026 (W1) · Lanes: contract
  - *Ziel:* Eine serielle Vertragsänderung durch den Architekten, ohne Kern- oder Web-Code: kind und requestedMinutes auf Speaker werden als veraltet und optional markiert (gelöscht in 080); Rolle `coordination`; Leserechte speaker.read, contribution.read, stage.read, history.read, event.read; Recht question.legal.clear und Ereignis QuestionLegalCleared; Problemtyp R-PERM-02 für verweigertes Lesen; CHANGELOG.md des Vertrags, Versions-/Changelog-Tor, Allowlist für vorab deklarierte Operationen mit Ablaufdatum; ADR 0015 als vorgeschlagen. Kern, Seed, Web und e2e folgen in 010, 021 und 080; die bestehenden Tests bleiben grün, weil nichts entfernt wird.
  - *Abhängigkeiten:* 009
  - *Rolle/Modell:* Architekt · Fable; Review Opus
  - *Nachweise:* `pnpm contract:types` Diff; contract:lint; CHANGELOG-Eintrag 0.2.0; Allowlist mit Ablauf je Operation; pnpm gates
  - *Offene Entscheidung:* —
- **020 · Oberfläche: Rückbau und Passung (S-Punkte)** — niedrig · 2 AStd · Kalender 02.10.2026 (W1) · Lanes: web-answers, web-capture, web-stage, web-history, web-speakers, web-shell
  - *Ziel:* wörtlich die Feedback-Punkte #13 Uhr klein ohne Sekunden, #17 Griff sichtbar mit Hinweis im Rundenkopf, #21 Erfassungskarte nur Nummer, Wortlaut, Stand, #23 TOP optional und ausgeblendet, #26 Lesehinweis „In dieser Rolle nur lesen" in Rollen ohne Bearbeitungsrecht, #32 „Weiterleiten" als Anzeige (nur i18n; Ereignis und Operation bleiben, E5), #3/#9 „Nur Bühne" als Standard für podium, #10 Warteschlange anklickbar mit Vorschau ohne „Vorgelesen" und Zähler „noch n", #28 TOP und Erfassungszeit aus der Beantwortung; prefers-reduced-motion; Nachrichtenzeit und Live-Zeit in docs/messung.md (erste Takt-Zeile, Ziel < 4 h je Punkt). Nicht-Ziel: Spalten Redezeit/Art (080).
  - *Abhängigkeiten:* 017
  - *Rolle/Modell:* Implementierer-Oberfläche · Sonnet; Design-Kritik Fable; Review Opus
  - *Nachweise:* docs/evidence/020-*.png je Ansicht DE/EN mit Feedback-Nummern; Playwright: Vorschau ohne Zustandsänderung; axe grün; Takt-Zeile
  - *Offene Entscheidung:* —
- **082 · Feature-Register für Routen, Navigation, Kürzel und Hilfe** — niedrig · 1 AStd · Kalender 05.10.2026 (W2) · Lanes: web-shell
  - *Ziel:* apps/web/src/app/featureRegistry.ts führt je Feature Route, Navigationseintrag, Tastenkürzel (Alt+n), i18n-Modul, benötigtes Recht (aus `_actions` bzw. `/auth/me`) und Hilfeschlüssel; routes.tsx, Navigation und Kurzbefehl-Dialog lesen daraus; jede spätere Scheibe mit neuer Route (041, 053, 054, 059, 061) fügt genau eine Zeile hinzu und berührt die Shell sonst nicht. Kein Rollenname im Register (Regel 4).
  - *Abhängigkeiten:* 017
  - *Rolle/Modell:* Mechaniker · Haiku; Review Sonnet
  - *Nachweise:* die fünf bestehenden Routen laufen über das Register; Playwright Alt+1..5 unverändert; Test „Route ohne Recht erscheint nicht in der Navigation"; pnpm gates
  - *Offene Entscheidung:* —
- **080 · Redezeit und Art zurückbauen, Sprecher-Zustandstabelle R-SPK, Korpus 28/230 als eine Quelle** — hoch · 2,5 AStd · Kalender 08.10.2026 (W2) · Lanes: core, web-speakers, e2e, contract
  - *Ziel:* Kern, Seed, Projektion und Web ohne kind/requestedMinutes (Spalten und Dialogfelder in apps/web/src/features/speakers, SpeakingTimer entfernt); die in 0.2.0 als veraltet markierten Vertragsfelder werden gelöscht; Seed exportiert CORPUS_DEMO (28 Wortmeldungen, 230 Fragen, kurze Bühnen-Warteschlange) und CORPUS_LOAD (800); Web-Adapter, api-Default und alle e2e-Konstanten lesen daraus (die vier Alt-Spec-Dateien sind geteilte e2e-Dateien dieser Scheibe); SPEAKER_TRANSITIONS als Daten (waiting→speaking, speaking→finished, waiting→withdrawn, speaking→withdrawn, finished→waiting nur mit Grund „Nachfrage") mit R-SPK-01..05, legalRef, generiertem Test je Zeile; Umsortierung nach Runde 1 mit Begründungsfeld im Ereignis. Quellen: Feedback #14, #15; Ist-Analyse Sprecherstatus.
  - *Abhängigkeiten:* 019, 011, 017
  - *Rolle/Modell:* Implementierer-Backend · Sonnet (Kern, Seed) + Implementierer-Oberfläche · Sonnet (Spalten, e2e-Konstanten); Review Opus
  - *Nachweise:* `pnpm contract:types` Diff ohne Rest; seed.test.ts 28/230 und 800; `grep SEEDED_QUESTIONS apps/web/e2e` liefert nur den Import; transitions.test.ts eine Zeile je R-SPK, Negativtest finished→speaking 409; Screenshot Wortmeldeliste ohne Redezeit DE/EN; pnpm gates + e2e
  - *Offene Entscheidung:* —
- **021 · Koordinationsrolle, Vier-Augen-Guard R-GUARD-06, Rechtstor vor der Bühne R-GUARD-07** — hoch · 2 AStd · Kalender 09.10.2026 (W2) · Lanes: core, e2e
  - *Ziel:* Rolle `coordination` mit classify/assign/forward/round.assemble, capture verliert classify/assign; R-GUARD-06 „Ersteller der letzten Version ≠ Freigeber" auf R-TRANS-05 (personengenau nur mit Einzelidentitäten, siehe B18); legal erhält `question.legal.clear` (Ereignis QuestionLegalCleared aus 019) statt approve, approver behält approve; R-GUARD-07 „Rechtsfreigabe liegt vor" auf R-TRANS-07 und R-TRANS-08 mit Geltungsbereich aus der Datentabelle `LEGAL_GATE_BY_TRACK` in transitions.ts (Standard: alle drei Pfade); zur Laufzeit nicht abschaltbar, jede Tabellenänderung erzeugt einen Wahrheitstabellen-Diff; kein Eilpfad an der Freigabe vorbei; Wahrheitstabelle neu; e2e-Personas und Abnahmesatz umformuliert („… die Koordination klassifiziert …"); docs/erste-version-und-offene-fragen.md aktualisiert.
  - *Abhängigkeiten:* 010, 019, 080
  - *Rolle/Modell:* Implementierer-Backend · Sonnet (Kern) + Implementierer-Oberfläche · Sonnet (e2e-Personas); Review Opus mit Perspektive Legal/Security
  - *Nachweise:* Wahrheitstabellen-Diff im Spec freigegeben; Tests: legal entwirft und versucht Freigabe → 409 R-GUARD-06, stage ohne Rechtsfreigabe → 409 R-GUARD-07 für jeden Pfad, Test „keine Konfiguration schaltet den Guard ab"; abnahme.spec.ts grün mit Koordinations-Persona
  - *Offene Entscheidung:* E1 Rollenname (Arbeitsname), E25 Letztverantwortung (Standard approver), E37 Freigabetiefe je Pfad
- **022 · Nachweise M1, Demo-Skript, Protokoll Feedback-Runde 2** — niedrig · 1 AStd · Kalender 12.10.2026 (W3) · Lanes: docs-feedback
  - *Ziel:* Screenshots aller fünf Ansichten neu, docs/demo-skript.md und README-Status aktualisiert, Protokoll der zweiten Feedback-Runde (09.10.: Antworten auf das Fragenpaket, Vorführung der S-Punkte aus 020) im Statustabellen-Format mit Antworten auf die Fragen 1–9 ins Register, Abnahmesatz-Freigabe der Projektleitung vermerkt, Vorführung von Koordination und Rechtstor für Prüfpunkt 2 vorbereitet, Messtabelle 009–021.
  - *Abhängigkeiten:* 020, 021
  - *Rolle/Modell:* Mechaniker · Haiku; Review Sonnet
  - *Nachweise:* docs/feedback/2026-10-runde-2.md, docs/evidence/022-*.png, Register-Diff
  - *Offene Entscheidung:* Antworten E1–E9 eingetragen oder „auf Standard gebaut"
- **084 · CI-Job-Matrix und Zeitbudget nach Korpuswechsel** — niedrig · 1 AStd · Kalender 12.10.2026 (W3) · Lanes: infra, e2e
  - *Ziel:* Zeitbudget-Assertion für Filter- und Bühnenwechsel bei CORPUS_LOAD (800 Fragen) als hartes Tor p90 < 150 ms mit Ausweis gegen D9 (100 ms, E41); Job-Matrix mit Laufzeitbudget: Push ≤ 12 min (Lint, Typen, Tests, In-Process-e2e), PR voll (Postgres-Service und Keycloak ab 027/029, http-Projekt ab 031), nightly Last, Restore und Semgrep-Vollauf; Pfadfilter für Doku-Commits; Laufzeit je Job in docs/messung.md.
  - *Abhängigkeiten:* 080, 013
  - *Rolle/Modell:* Mechaniker · Haiku + Implementierer-Oberfläche · Sonnet (Zeitbudget-Spec); Review Sonnet
  - *Nachweise:* Zeitbudget-Ausgabe mit p90; Laufzeittabelle; CI-Lauf mit Matrix
  - *Offene Entscheidung:* E41 Performance-Ziel D9

### 5.4 M2 · Persistenz, Identität, Zeit, Betrieb — Kalender 05.10.–11.11.2026 (W2–W7) · Leitplanken 9.1 „Produktionsfundament"

**Ziel.** Das Irreversible ist festgezogen: Umschlag v2 mit Hash-Kette und Jahrgang, Personentabelle, Postgres nur anhängend mit Migrationstor, persistierte Idempotenz und Pflicht-If-Match mit Claim/Lease, OIDC-BFF hinter dem Actor-Port mit Notfallkonten, HTTP-Client mit Anmeldung, Serverzeit, zwei Protokollebenen, SSE mit inkrementellem Client, Container, Pipeline und Betriebsauswertung in drei Umgebungen, Backup/Restore-Drill, Bedrohungsmodell mit Pentest-Scope, Administration, Übungsmandant, Keycloak-Betrieb, Zulieferungen an Betriebsrat und DSB.

**Exit-Kriterien.**
- B1, B3, B4, B10, B17 erfüllt und belegt; B9 ohne Entwurfspuffer (folgt mit 060); B5 ohne Vier-Augen-Sperre (folgt mit 047).
- Staging-synthetisch läuft aus der Pipeline mit Keycloak und Anmeldung im Web, sobald der Host steht (Rückfalltrigger 30.10.).
- e2e-Suite in beiden Betriebsarten grün; Restore-Drill protokolliert; keine X-Actor-Annahme außerhalb HV_DEMO=1.
- Zulieferungen an Betriebsrat und DSB liegen beim Eigentümer.
- Prüfpunkt 3 am 13.11.2026 mit Sicherheitsreview des Architekten.

- **039 · Bedrohungsmodell v1 und Pentest-Scope** — mittel · 1 AStd · Kalender 05.10.2026 (W2) · Lanes: docs-sicherheit
  - *Ziel:* docs/sicherheit/bedrohungsmodell.md (STRIDE je ADR-0001-Grenze: Oberfläche/Dienst, Dienst/Persistenz, Nachbarsysteme; Akteure, Angriffsflächen, Kontrollen je Beta-Kriterium, Zuordnung zu Tests), das 024/027/029 zitieren; Reviewer-Checkliste Sicherheit ergänzt; Pentest-Scope-Dokument (Staging mit OIDC, Fenster 01.–12.02.2027, Retest vor der Vollprobe) als Grundlage der Bestellung bis spätestens 15.12. (E32).
  - *Abhängigkeiten:* 015
  - *Rolle/Modell:* Reviewer · Opus (Perspektive Security, nur Read); Review Fable
  - *Nachweise:* Modell mit Zuordnung zu Tests; Befundliste offen/geschlossen; Pentest-Scope beim Eigentümer
  - *Offene Entscheidung:* —
- **023 · Vertragspaket 0.3.0 Fundament** — hoch · 1,5 AStd · Kalender 13.10.2026 (W3) · Lanes: contract
  - *Ziel:* eine serielle Vertragsänderung: meetingId auf Speaker, Contribution, Question und Ereignissen; GET/POST /v1/meetings, /v1/meetings/{id}/… kanonisch, /v1/meeting als Alias; Umschlag-Felder (schemaVersion, idempotencyKey, causationId, prevHash, hash, recordedAt, occurredAt mit occurredAtSource, retentionClass, legalHold, personId); Contribution.version; If-Match und alle neuen Pflichtfelder zunächst optional mit Ablaufdatum (ADR 0015), 028 macht sie in 0.3.1 zur Pflicht; Meeting.format (presence | hybrid | virtual); Tagesordnungsereignisse AgendaItemOpened, VotingOpened, VotingClosed; POST claim/release auf Redebeitrag und Einzelfrage; /healthz, /readyz, /metrics; GET /v1/stream; Sicherheitsschema `session` (Cookie) und Endpunkte /auth/login, /auth/callback, /auth/logout, /auth/me; Admin-Operationen (Jahrgang anlegen/klonen, Fachbereiche, TOPs, Bühnenplatzliste je Jahrgang statt Enum mit Person und Gerät je Platz, Rollenzuordnung mit optionaler unitId als RoleAssigned/RoleRevoked, Konfigurationsfreeze); Transparenzhinweis-Feld für die Anmeldeseite; Header X-Server-Time; counts.byUnit und counts.bySeat auf Meeting (implementiert in 040); CHANGELOG 0.3.0; Allowlist mit Ablaufdatum für noch nicht implementierte Operationen.
  - *Abhängigkeiten:* 019, 015
  - *Rolle/Modell:* Architekt · Fable; Review Opus
  - *Nachweise:* contract:lint und Typen-Diff; CHANGELOG-Eintrag; Allowlist mit Ablauf je Operation; Validatoren regeneriert
  - *Offene Entscheidung:* —
- **024 · Ereignis-Umschlag v2 mit Hash-Kette, zwei Zeiten, Aufbewahrungsklasse, PII-Codec** — hoch · 2,5 AStd · Kalender 14.10.2026 (W3) · Lanes: core, web-api
  - *Ziel:* Base-Ereignis erhält die Felder aus 023; SHA-256 über kanonisches JSON, Kette wird beim Laden verifiziert; recordedAt aus der Server-Uhr als maßgebliche Zeit, occurredAt als Angabe mit Quellenkennzeichen (server, device, paper, transcript); retentionClass, legalHold:false; payload.pii mit keyId je Jahrgang hinter Codec-Port (Beta: Identitäts-Codec); Upcaster v1→v2 nur für JSONL-Dev-Bestände; die Demo zeigt bei altem localStorage-Protokoll ein Reset-Banner (ADR 0002 bleibt, kein Upcaster); Nachweise für ADR 0011.
  - *Abhängigkeiten:* 015, 023, 080
  - *Rolle/Modell:* Architekt · Fable (Umschlag-Design im Spec) + Implementierer-Backend · Sonnet; Review Opus mit Perspektive Security/Datenschutz
  - *Nachweise:* Test manipuliertes Ereignis → Ladefehler mit seq; Test Replay JSONL v1 → v2; Test occurredAt aus Quelle device wird nie zu recordedAt, Zukunft abgelehnt; Test altes localStorage-Protokoll → Reset-Banner; pnpm gates
  - *Offene Entscheidung:* E16 Aufbewahrung/Krypto — Umschlag ist unabhängig davon
- **025 · Jahrgang, Lebenszyklus und Tagesordnung R-MTG, Nachtragsregel für Papier** — hoch · 2,5 AStd · Kalender 15.10.2026 (W3) · Lanes: core
  - *Ziel:* meetingId überall im Kern und in der Projektion; `seq` bleibt global lückenlos, Fragennummern F-n je Jahrgang; Meeting-Lebenszyklus preparation→running→closed und Tagesordnungsfortschritt (AgendaItemOpened, VotingOpened, VotingClosed mit Recht agenda.manage) als Tabelle R-MTG-01..06; Guard R-MTG-03: nach debateClosed wird Erfassung verweigert, außer für source paper oder transcript mit occurredAt ≤ debateClosedAt und Pflichtgrund, das Ereignis trägt dann das Kennzeichen lateEntry; die Restantenliste aus 087 wird später Eingabe des Schlussübergangs; Listenfilter je Jahrgang; Seed erzeugt zwei HVs im selben Log als Test.
  - *Abhängigkeiten:* 024
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus
  - *Nachweise:* Test zwei HVs, Nummern F-1 je Jahrgang; Test manual nach Schluss → 409 R-MTG-03; Test paper mit früherem occurredAt und Grund → 201 mit lateEntry; Test VotingOpened ohne agenda.manage → 403; contract.test.ts alle operationIds; pnpm gates + e2e
  - *Offene Entscheidung:* —
- **026 · Personentabelle und Rollenzuordnung als Ereignisse** — hoch · 2 AStd · Kalender 16.10.2026 (W3) · Lanes: core
  - *Ziel:* Person {personId, displayName, organisation} als eigene Entität; Ereignisse tragen personId und pseudonyme subject-IDs, nie Klarnamen (Test); Projektion löst Namen beim Lesen über das Recht `question.identity.reveal` auf (Vergabe nur in ROLE_PERMISSIONS, Standard coordination, moderation, legal, approver, podium); alle anderen sehen ein Pseudonym „Redner 12"; Meeting-Konfiguration `pseudonymiseForUnits` steht standardmäßig auf true; RoleAssigned/RoleRevoked (subject, Rolle, Jahrgang, Ablauf, Vertretung, unitId optional) mit Recht admin.roles.manage; Notfallkonten als Zuordnung mit Alarmereignis (die Anmeldung dazu baut 029); Auto-Expiry am Jahrgangsende.
  - *Abhängigkeiten:* 025
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus mit Perspektive Datenschutz
  - *Nachweise:* Test „kein displayName in Ereignis-Payloads"; Test Pseudonym ohne question.identity.reveal; Test expert ohne unitId → 403 auf question.read; Test abgelaufene Rolle → 403; Wahrheitstabellen-Diff
  - *Offene Entscheidung:* E8 Rollenzuweisungspfad (Tabelle ist Wahrheit)
- **027 · Postgres-Adapter nur anhängend, Migrationen, Migrationstor, Rebuild-Test** — hoch · 3 AStd · Kalender 19.10.2026 (W4) · Lanes: persist, service
  - *Ziel:* apps/api/src/persistence/postgres.ts (Dienstrolle INSERT/SELECT, `seq` global lückenlos mit Advisory-Lock, Index auf meeting_id, Personentabelle, synchrones Commit), Migrationswerkzeug mit Vorwärts/Rückwärts gegen leere und gefüllte DB im CI-Service-Container, Rebuild von 10 000 Ereignissen < 5 min als Test, Snapshot optional; JSONL bleibt Dev-Adapter; /readyz prüft ab hier DB und Migrationsstand; der Adapter wird in apps/api/src/server.ts verdrahtet; Nachweise für ADR 0003.
  - *Abhängigkeiten:* 024, 025, 026
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus mit Perspektive Betrieb/Security
  - *Nachweise:* Test UPDATE/DELETE als Dienstrolle → Berechtigungsfehler; CI-Schritt Migrationslauf grün; Rebuild-Zeit im Bericht; Hash-Kette nach Neustart verifiziert; `curl /readyz` bei gestoppter DB → 503
  - *Offene Entscheidung:* E10 Hosting — Adapter ist plattformneutral
- **028 · Idempotenz persistiert, If-Match Pflicht mit Vertrag 0.3.1, Contribution-Version, Claim/Lease, Zwei-Schreiber-Test** — hoch · 2 AStd · Kalender 20.10.2026 (W4) · Lanes: core, contract, web-capture
  - *Ziel:* Idempotenzschlüssel werden aus dem Ereignislog rekonstruiert (idempotencyKey im Umschlag); If-Match Pflicht (428 ohne Header) auf allen mutierenden Vorgangs-, Redebeitrags- und Wortmeldungsoperationen außer „Vorgelesen", das den Versions-Hash prüft (049); Vertrag 0.3.1 macht If-Match und die in 0.3.0 optional eingeführten Felder zur Pflicht, der Allowlist-Eintrag entfällt; Contribution und Wortmeldeliste tragen version; Übernahme-Sperre: ContributionClaimed/QuestionClaimed mit TTL 10 min (Daten, keine harte Sperre, Ablauf gibt frei); Tests „zwei Schreiber, eine Version" für captureQuestions und reorderSpeakers; Neustart-Idempotenz-Test.
  - *Abhängigkeiten:* 024, 023, 026
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus
  - *Nachweise:* Test Neustart, gleicher Schlüssel → Replay statt Doppelanlage; Test paralleles captureQuestions → 412 für den Zweiten; Test abgelaufener Claim ist wieder frei; Web: StaleBanner auf der Erfassung
  - *Offene Entscheidung:* —
- **029 · OIDC-BFF im Dienst hinter dem Actor-Port, Sitzung, Sperrliste, Notfallkonten, Demo-Verriegelung** — hoch · 3 AStd · Kalender 21.10.2026 (W4) · Lanes: service, infra
  - *Ziel:* actor.ts wird Port mit drei Adaptern (demoHeader nur bei HV_DEMO=1 und ohne OIDC-Issuer, sonst Startabbruch; sessionCookie: Authorization Code serverseitig, JWKS, iss/aud/exp, Clock-Skew aus injizierter Uhr, HttpOnly/SameSite-Cookie, CSRF-Token für Schreibvorgänge; localBreakGlass: zwei versiegelte Notfallkonten mit langem Einmalgeheimnis, nur aktivierbar bei gemeldetem IdP-Ausfall, zeitlich befristet, jede Nutzung ein Alarmereignis); Rollen aus der Zuordnungstabelle (026), IdP-Gruppen nur als Vorschlag in /auth/me; Sitzung 14 h mit stillem Refresh, Leerlauf-Timeout konfigurierbar, /auth/logout; Kill-Switch (Recherche SOLL): Sperrliste von subject-IDs ohne Neustart; Keycloak-Container in CI mit Testrealm; Transparenzhinweis-Text (Art. 13 DSGVO) als Vertragsfeld für die Anmeldeseite; Nachweise für ADR 0004.
  - *Abhängigkeiten:* 010, 023, 026
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus mit Perspektive Security; zusätzlich Sicherheits-Checkliste des Reviewers
  - *Nachweise:* Negativtests abgelaufene Sitzung 401, falsche Audience 401, X-Actor ohne Demo 401, Subject ohne Rolle 403, gesperrtes Subject 401, HV_DEMO=1 mit Issuer → Start verweigert, Notfallkonto bei laufendem IdP → 403, Nutzung erzeugt Alarm; CI mit Keycloak grün; Wahrheitstabelle unverändert
  - *Offene Entscheidung:* E11 IdP des Konzerns (Konfiguration)
- **030 · HTTP-HvApi-Client aus dem Vertrag, Anmeldung im Web, zwei Betriebsarten** — hoch · 2,5 AStd · Kalender 22.10.2026 (W4) · Lanes: web-api, web-shell
  - *Ziel:* generierter Client (openapi-typescript + fetch-Wrapper) implementiert HvApi mit ETag/If-Match/Idempotency-Key/Problem-Details/CSRF; AuthAdapter-Port (demoPersona | session) mit Anmeldeseite (Transparenzhinweis DE/EN, Link zur DSFA-Zusammenfassung), stillem Refresh, Abmelden, 401-Behandlung; Betriebsart per Build-Konfiguration; Rollenumschalter nur in Demo; `grep fetch(` außerhalb apps/web/src/api/http liefert nichts.
  - *Abhängigkeiten:* 029, 028
  - *Rolle/Modell:* Implementierer-Oberfläche · Sonnet; Review Opus
  - *Nachweise:* Screenshot Anmeldeseite und 401-Behandlung; Unit-Tests des Wrappers; pnpm gates
  - *Offene Entscheidung:* —
- **031 · e2e gegen Hono, Postgres und Keycloak in beiden Betriebsarten** — mittel · 1,5 AStd · Kalender 23.10.2026 (W4) · Lanes: e2e, infra
  - *Ziel:* Playwright-Projekt „http" führt alle Szenarien gegen den Dienst mit OIDC-Testrealm aus; Projekt „in-process" bleibt; beide Pflicht auf PR nach main; Test „altes Demo-Protokoll → Reset-Banner"; Nachweis für die Ergänzung zu ADR 0002; die Job-Matrix aus 084 erhält das http-Projekt.
  - *Abhängigkeiten:* 030, 027, 084
  - *Rolle/Modell:* Implementierer-Oberfläche · Sonnet; Review Opus
  - *Nachweise:* e2e-Lauf beider Projekte grün mit Laufzeiten; ADR-0002-Ergänzung mit Nachweis
  - *Offene Entscheidung:* —
- **033 · Zwei Protokollebenen, Health/Ready, Kennzahlen, Serverzeit-Header** — hoch · 2 AStd · Kalender 26.10.2026 (W5) · Lanes: service
  - *Ziel:* strukturiertes Zugriffslog (JSON: requestId, subjectHash, operationId, status, latency, seq; nie Fragetext) in eigene Senke mit konfigurierbarer Aufbewahrung (Standard 30 Tage); Korrelations-ID; /healthz, /readyz (NTP-Status; DB und Migrationsstand ergänzt 027); /metrics mit fünf fachlichen Kennzahlen (Alter der ältesten offenen Frage, Rückstand je Fachbereich, Zulauf/5 min, Fragen in Rechtsfreigabe > 10 min, Ereignisse/min); Kennzahlen-Allowlist-Tor (keine Kennzahl je subject ohne Spec-Eintrag); X-Server-Time; generierter Auswertungskatalog (welche Kennzahlen existieren, keine je Person) als CI-Artefakt, Erstfassung; Verfahren „Auswertung des Zugriffslogs nur zu zweit" in ADR 0013, technische Sperre mit 047; Rate-Limit-Zähler aus 034 sind flüchtig und aus dem Katalog ausgeschlossen; Aufbewahrung von subjectHash im DSFA-Entwurf; Nachweise für ADR 0013.
  - *Abhängigkeiten:* 023
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus mit Perspektive Datenschutz/Betrieb
  - *Nachweise:* Test Log-Zeile ohne Fragetext trotz Body; `curl /healthz` 200, `/readyz` meldet NTP-Status; Katalog als CI-Artefakt; Allowlist-Tor rot bei absichtlicher Kennzahl je Person
  - *Offene Entscheidung:* —
- **032 · Serverzeit als Referenz im Web, Drift-Hinweis, now()-Tor auf web** — mittel · 1 AStd · Kalender 27.10.2026 (W5) · Lanes: web-shell, web-answers, web-capture, web-history, web-stage, web-speakers
  - *Ziel:* Client berechnet Offset aus X-Server-Time und nutzt eine `clock()`-Quelle für Alter, Fristen, Uhr; Drift > 30 s zeigt Hinweis; statischer Check erweitert auf apps/web (nur time.ts). Die Ersetzungen in den Feature-Ordnern (answers, capture, history, stage, speakers) gehören zu dieser Scheibe und sind in deren Lanes angemeldet.
  - *Abhängigkeiten:* 030, 033
  - *Rolle/Modell:* Implementierer-Oberfläche · Sonnet + Mechaniker · Haiku (Ersetzungen); Review Opus
  - *Nachweise:* `grep Date.now|new Date(` in apps/web/src ohne Treffer außerhalb time.ts; Test gefälschte Client-Uhr, Alter stimmt
  - *Offene Entscheidung:* —
- **034 · Limits, Sicherheitsheader, Konfigurationsschema des Dienstes** — mittel · 1 AStd · Kalender 27.10.2026 (W5) · Lanes: service
  - *Ziel:* Rate-Limit je Subject (Standard 60 Schreibvorgänge/min), Body-Limit 256 kB, Request-Timeout, Sicherheitsheader und CSP am Dienst (netlify.toml folgt in 037), typisiertes Konfigurationsschema (zod) mit .env.example, CORS-Allowlist aus Konfiguration, Doppelklickschutz-Header-Konvention.
  - *Abhängigkeiten:* 033
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus
  - *Nachweise:* Negativtests 429, 413, 408; Test fehlende Pflichtkonfiguration → Start verweigert; Header-Probe in contract.test.ts; CSP-Report ohne Verstoß in e2e
  - *Offene Entscheidung:* —
- **035 · SSE-Strom /v1/stream mit Last-Event-ID** — mittel · 1 AStd · Kalender 28.10.2026 (W5) · Lanes: service
  - *Ziel:* text/event-stream mit Heartbeat 15 s, Jahrgangsfilter, Rechteprüfung wie die Leserechte aus 010 (kein Ereignis, das der Leser nicht lesen darf), Wiederaufnahme über after=seq; Nachweise für ADR 0014.
  - *Abhängigkeiten:* 023, 010, 024, 034
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus
  - *Nachweise:* Test Verbindung trennen, wieder verbinden, keine Lücke in seq; Test observer erhält keine Entwurfsereignisse
  - *Offene Entscheidung:* —
- **036 · Inkrementeller Client-Zustand statt Vollabruf** — mittel · 2 AStd · Kalender 29.10.2026 (W5) · Lanes: web-api
  - *Ziel:* hinter der unveränderten Signatur von useApiVersion arbeitet ein ereignisgetriebener Store (die Aufrufer in web-shell und den Feature-Ordnern bleiben unverändert) (SSE-Ereignisse auf gepufferte Listen anwenden, gezielter Nachlauf bei Lücken, Polling-Fallback), mehrfach-Tab-sicher, Lade-/Offline-/Wiederverbindungszustände; Vollabrufe nur beim ersten Laden; Historie paginiert; Netztrace ohne Vollabruf je Ereignis.
  - *Abhängigkeiten:* 035, 030
  - *Rolle/Modell:* Implementierer-Oberfläche · Sonnet; Review Opus
  - *Nachweise:* Unit-Tests des Store-Reducers; Playwright zweiter Browser sieht Änderung < 2 s; Netztrace im Bericht
  - *Offene Entscheidung:* —
- **037 · Container, Pipeline, drei Umgebungen, Betriebsauswertung, Freeze-Regel** — hoch · 2,5 AStd · Kalender 30.10.2026 (W5) · Lanes: infra
  - *Ziel:* Dockerfile für apps/api (distroless, non-root), Prüfung des Konfigurationsschemas aus 034 beim Start im Image, Secrets nur aus der Plattform, CSP und Sicherheitsheader in netlify.toml, Betriebsauswertung je Umgebung (plattformnativ oder Prometheus/Grafana im Container-Stack) mit Alarmversand an die benannte Beobachterin, Härtungs-Checkliste des gemieteten Hosts (SSH-Schlüssel, Updates, Firewall, verschlüsselte Backups), CI-Job build+push Image mit Digest, Deploy nach Staging-synthetisch nur über Approval-Environment (Eigentümer-Go), Health-Smoke nach Deploy (/readyz 200 sonst Rollback), Freeze-Kalender als Pipeline-Regel, Umgebungsdefinitionen demo / staging-synthetic / rehearsal (Übungsmandant mit eigener DB); Eigentümer-Checkliste Secrets (< 2 h) in docs/betrieb/; Nachweise für ADR 0007. Staging-synthetisch mit Anmeldung, sobald der Host steht (Rückfalltrigger 30.10.).
  - *Abhängigkeiten:* 033
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus mit Perspektive Betrieb/Security; Eigentümer führt Secrets-Checkliste aus
  - *Nachweise:* Image-Digest und Staging-URL im Bericht; Testalarm kommt bei der Beobachterin an; Pipeline-Protokoll mit Approval-Schritt; Deploy im Freeze-Fenster → abgelehnt (Test)
  - *Offene Entscheidung:* E10 Hosting — Container und Pipeline sind neutral; Rückfall gemieteter Host ab 30.10.
- **038 · Backup, Restore, Rebuild-Drill, Jahrgangs-Export, RPO/RTO/SLO** — hoch · 2 AStd · Kalender 02.11.2026 (W6) · Lanes: persist, docs-betrieb
  - *Ziel:* tägliches Backup plus WAL/PITR dokumentiert, Restore-Skript, Drill: Backup → neue DB → Dienst startet → Hash-Kette verifiziert → Projektion identisch; RPO 0 für Ereignisse, RTO 15 min, SLO p90 < 300 ms für Listen- und Bühnenaufrufe im Fenster der Probe; Exportskript „Jahrgang als Archiv" (JSONL + Hash-Liste); nightly Restore-Test.
  - *Abhängigkeiten:* 027, 037
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus mit Perspektive Betrieb; Umsetzer führt den Drill einmal selbst aus
  - *Nachweise:* docs/evidence/038-restore.md mit Zeiten; Test Export → Import → identische Hash-Kette; nightly Job grün
  - *Offene Entscheidung:* E22 RPO/RTO/SLO (Standardwerte)
- **040 · Administration im Kern: Jahrgang, Stammdaten, Bühnenplätze, Einheiten, Rollen, Konfigurationsfreeze** — hoch · 2,5 AStd · Kalender 03.11.2026 (W6) · Lanes: core
  - *Ziel:* Jahrgang anlegen/klonen, Fachbereiche, TOPs, Bühnenplätze (Liste je Jahrgang, Person und Gerätekennung je Platz), Personen einer Einheit zuordnen, Einheit „AR-Büro" im Seed, counts.byUnit und counts.bySeat in der Projektion, Rollenzuordnung mit Ablauf und zwei Vertretungen, Meeting-Lebenszyklus-Aktionen, Nummernkreise je Erfassungsplatz als Meeting-Daten (für den Papierpfad), Konfigurationsfreeze (Ereignis ConfigFrozen mit Hash über Rechtetabelle, Übergangstabelle, Stammdaten; Änderung danach nur mit admin.override und Grund); alles Ereignisse, deny by default, R-ADM-01..04.
  - *Abhängigkeiten:* 025, 026
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus mit Perspektive Security/Admin
  - *Nachweise:* Test Stammdatenänderung nach Freeze → 409 R-ADM-03; Test override erzeugt Ereignis mit Grund; Wahrheitstabellen-Diff für admin-Rechte
  - *Offene Entscheidung:* E8 (Tabelle ist Wahrheit)
- **041 · Admin-Oberfläche /admin und Admin-Anleitung** — mittel · 2,5 AStd · Kalender 04.11.2026 (W6) · Lanes: web-admin
  - *Ziel:* Route /admin (admin.*): Jahrgang, Fachbereiche, TOPs, Bühnenplätze, Personen mit Einheit und Rollen mit Ablauf, Konfiguration, Freeze mit Hash-Anzeige im Kopf; docs/admin/anleitung.md „Übungs-HV in unter zwei Stunden anlegen"; Rollenkarten-Vorschau je Rolle aus ROLE_PERMISSIONS; die Route kommt als eine Zeile ins Feature-Register (082).
  - *Abhängigkeiten:* 040, 030, 082
  - *Rolle/Modell:* Implementierer-Oberfläche · Sonnet; Design-Kritik Fable; Review Opus
  - *Nachweise:* Screenshots DE/EN; Playwright Jahrgang anlegen → Freeze → Änderung abgelehnt; Anleitung
  - *Offene Entscheidung:* —
- **042 · Übungsmandant und Pilotmodus HV_MODE** — mittel · 1 AStd · Kalender 04.11.2026 (W6) · Lanes: service, infra
  - *Ziel:* HV_MODE=training|shadow|live: Banner, eigene Datenbank je Modus, Podium-Push nur in live, Seed nur in training, „nicht führend" im Kopf bei shadow; Löschverfahren für den Übungsbestand: der Plattformbetreiber entfernt die getrennte Datenbank, das Skript erzeugt das Löschprotokoll (nie Löschen durch die Dienstrolle, Regel 7); Nachweise für ADR 0010.
  - *Abhängigkeiten:* 037, 034
  - *Rolle/Modell:* Implementierer-Backend · Sonnet + Mechaniker · Haiku; Review Opus
  - *Nachweise:* Test seed im Modus live → 403; Screenshot Banner je Modus; Löschprotokoll-Trockenlauf
  - *Offene Entscheidung:* E12 Pilotmodus (Konfiguration)
- **088 · Keycloak-Betrieb für Staging und Probe** — niedrig · 1 AStd · Kalender 05.11.2026 (W6) · Lanes: infra
  - *Ziel:* Realm-Export als Konfiguration im Repositorium (ohne Geheimnisse), CSV-Import synthetischer Testpersonen und im Rückfall E11/E13 gepoolter Stationskonten, Erstpasswort-Verfahren, TOTP-Pflicht für Inhaber von question.legal.clear, question.approve und admin.*, Sperr- und Löschskript nach der Probe mit Protokoll; Checkliste für den Eigentümer (< 1 h).
  - *Abhängigkeiten:* 029, 037
  - *Rolle/Modell:* Mechaniker · Haiku; Review Sonnet mit Perspektive Security
  - *Nachweise:* Trockenlauf Import → Anmeldung → Sperre → Löschung auf Staging mit Protokoll; Test TOTP-Pflicht
  - *Offene Entscheidung:* E11, E13, E38
- **083 · Zulieferungen an Betriebsrat und DSB** — niedrig · 2 AStd · Kalender 11.11.2026 (W7) · Lanes: docs-datenschutz
  - *Ziel:* docs/datenschutz/: Schutzmaßnahmenkatalog (zwei Protokollebenen, Auswertung nur zu zweit, keine Kennzahl je Person, 30 Tage Zugriffslog, Pseudonymisierung gegenüber Fachbereichen), Beschreibung der Testidentitäten und der gepoolten Stationsidentitäten als geplanter Weg (Anlage, Nutzung, Sperre, Löschung), DSFA-Endfassung aus dem Vorentwurf von 014 mit Stand der gebauten Scheiben, Auswertungskatalog aus 033 als Anlage; Übergabe durch den Eigentümer spätestens 18.12.2026. Eine Interimsvereinbarung ist eine Chance, kein Planpfad.
  - *Abhängigkeiten:* 014, 033, 039, 026, 047
  - *Rolle/Modell:* Architekt · Fable; Review Opus mit Perspektive Datenschutz
  - *Nachweise:* drei Dokumente eingecheckt; Übergabevermerk mit Datum im Register (E13, E14)
  - *Offene Entscheidung:* E13, E14

### 5.5 M3 · Rechtlicher Kern — Kalender 23.10.–17.11.2026 (W4–W8)

**Ziel.** Verweigerungspfad, Nachfragen, Notiz, Vertraulichkeit mit Attributrechten, Weiterleiten, Auskunftsschuldner, Vorgelesen als Entität mit Soll-Ist, Verfahrensereignisse, Alarme mit Quittung, Restanten-Feststellung und das Gerüst der Niederschrift-Anlage sind gebaut; jede Regel hat ID, legalRef und Test; das Rechtekonzept ist auf das implementierte Modell umbasiert und liegt mit dem Regelregister bei Recht.

**Exit-Kriterien.**
- B6 erfüllt; B2 vollständig (Attributebene); B5 vollständig (Auswertung nur zu zweit).
- Beide Wahrheitstabellen (Rolle × Status × Aktion; Attribut × Aktion) eingecheckt und im Tagesbericht ausgewiesen.
- Kein Übergang auf die Bühne ohne Rechtsfreigabe; Exportereignis je Ausgabe; „ungeprüft"-Markierung bei Gründen ohne verified.
- Regelregister und Rechtekonzept an Recht übergeben (Mitte November).
- Prüfpunkt 4 am 20.11.2026 mit Sicherheitsreview des Architekten.

- **043 · Vertragspaket 0.4.0 Domäne** — mittel · 2 AStd · Kalender 23.10.2026 (W4) · Lanes: contract
  - *Ziel:* eine serielle Vertragsänderung nach den Antworten aus Feedback-Runde 2 (09.10.) und der Entscheidungsstunde am 16.10.; unbeantwortete Punkte als Standard mit Vermerk: answerKind und refusalGroundId auf AnswerVersion, Grundkatalog-Endpunkt, parentQuestionId/relation, note (hinter Konfiguration), confidentiality, deferred/correctionOpen/followUp-Kennzeichen, forward-Operation, accountable (Auskunftsschuldner) und language auf Question, Delivery-Entität mit versionHash, mode/deviationNote, AnswerBundle, getStage-Filter (seat, bundleId, strategy), Verfahrensereignis-Operationen, Export-Operationen (record.json, record.html), Antwortformat-Schema (Blockdokument + text), ingest/speech-segments (Form nach E3a), answer-suggestions, Aktienregister-Lookup, Ereignisstrom-Abonnement/Webhooks, Vorabfragen-Quelle, Papier-Quelle; Rechte question.refuse.propose/approve, question.forward, round.assemble, procedure.record, export.dossier, question.identity.reveal, ingest.write, agenda.manage, debate.close, cockpit.read; NotificationRaised/NotificationAcknowledged; RemainderListConfirmed; Systemakteur canary mit Kennzeichen synthetic; Prüfliste je Pfad als Daten; CHANGELOG 0.4.0.
  - *Abhängigkeiten:* 023, 014
  - *Rolle/Modell:* Architekt · Fable; Review Opus
  - *Nachweise:* contract:lint, Typen-Diff, CHANGELOG, Allowlist mit Ablauf
  - *Offene Entscheidung:* E2, E3a, E4, E6, E7, E17 als Enums (Standardannahmen, Vermerk „auf Standard gebaut")
- **046 · Nachfragen-Threads, Notizfeld hinter Konfiguration, Zurückstellen und Korrektur offen** — mittel · 2 AStd · Kalender 28.10.2026 (W5) · Lanes: core, web-capture, web-history
  - *Ziel:* QuestionRecord.parentQuestionId und relation (follow_up | clarification), Ereignis QuestionLinked (nur innerhalb desselben Jahrgangs), Erfassung kann „Nachfrage zu F-n" setzen; note mit QuestionNoteAdded nur bei Meeting-Konfiguration notes=on (Schalter liegt hier), nie Export, nie Bühne, eigener Datenbereich; Kennzeichen deferred (Pflichtgrund, Wiedervorlage) und correctionOpen (aus delivered mit Grund, geschlossen durch neue freigegebene Version und erneutes Vorlesen, Frist aus dem Ereignis VotingOpened des TOP aus 025); Regel-IDs R-TRANS-14..16 als Zeilen oder Guards in transitions.ts mit Test, Kennzeichen statt Hauptzuständen; Historie und Erfassung zeigen Thread.
  - *Abhängigkeiten:* 025, 043
  - *Rolle/Modell:* Implementierer-Backend · Sonnet + Implementierer-Oberfläche · Sonnet (Erfassung, Historie); Review Opus
  - *Nachweise:* Test Verknüpfung nur im selben Jahrgang; Test Notiz bei notes=off → 409; Test Korrektur nach Vorlesen erzeugt neue Version und zweite Delivery; Screenshot Thread
  - *Offene Entscheidung:* E4 Notizfeld (Standard aus)
- **085 · Benachrichtigungen und Alarme** — mittel · 2 AStd · Kalender 29.10.2026 (W5) · Lanes: core, web-shell
  - *Ziel:* Ereignisse NotificationRaised {severity, targetPermission, subjectId, ruleId} und NotificationAcknowledged; Zustellung über den SSE-Strom (035) an angemeldete Sitzungen, deren Rechte das Zielrecht enthalten; Quittungspflicht für severity high; Glocke mit Zähler in der Shell, Liste mit Quittieren; Empfänger sind Rechte, nie Rollennamen; kein Push, keine E-Mail. Nutzer in der Beta: 049 (Abweichung beim Vorlesen), 050 (Widerspruch), 029 (Notfallkonto), 086 (Kanarienfrage fehlgeschlagen).
  - *Abhängigkeiten:* 035, 043, 026
  - *Rolle/Modell:* Implementierer-Backend · Sonnet + Implementierer-Oberfläche · Sonnet; Review Opus
  - *Nachweise:* Test Empfänger ohne Zielrecht erhält nichts; Test Quittung als Ereignis; Playwright zweiter Browser sieht Alarm < 2 s; Screenshot DE/EN
  - *Offene Entscheidung:* Zusatzkanal E-Mail oder Push (Nach-Beta)
- **048 · Weiterleiten zwischen Fachbereichen, Auskunftsschuldner, Inhaltssprache** — mittel · 1,5 AStd · Kalender 05.11.2026 (W6) · Lanes: core
  - *Ziel:* R-TRANS-13 forward aus assigned | answer_drafted | in_review an andere Einheit (coordination, expert der aktuellen Einheit), Antwortversion bleibt, Ereignis QuestionForwarded mit Grund; Feld accountable (Auskunftsschuldner, genau eine Person oder Funktion, RACI-Accountable) getrennt vom Bühnenplatz (Sprecher), Standard = Bühnenplatz; Feld language (Standard de) reserviert ohne Kopplungslogik; der Dialog „Weiterleiten" mit Einheit und Grund entsteht in der Fokusansicht (054); eine Umbenennung von Ereignis oder Operation nur nach Antwort auf Frage 6 (E5).
  - *Abhängigkeiten:* 021, 043, 040
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus
  - *Nachweise:* Test je Regelzeile; Wahrheitstabellen-Diff
  - *Offene Entscheidung:* E5 Bedeutung „Weiterleiten" (beides gebaut)
- **044 · Verweigerungspfad A und B im Kern** — hoch · 2,5 AStd · Kalender 06.11.2026 (W6) · Lanes: core
  - *Ziel:* answerKind refusal_no_claim (Pfad A) und refusal_with_ground (Pfad B, Pflichtauswahl aus packages/domain/src/refusalGrounds.ts mit legalRef und verified:false, Begründung Pflicht) als Antwortart durch in_review → approved → staged → delivered; Guards R-GUARD-08 „Verweigerung nur mit Rechtsfreigabe-Ereignis" und Vier-Augen gelten; Rechte question.refuse.propose (legal, coordination) und question.refuse.approve (approver); Grundpflicht als Guard R-GUARD-09 (Pfad B ohne refusalGroundId oder Begründung → 409; `_actions` enthält die Verweigerung erst, wenn der Guard erfüllbar ist); Formulierungsbaustein für die Bühne aus dem Katalog; Export markiert Verweigerungen; Nachweise für ADR 0012 (liegt seit 011 bei Recht, sonst Vermerk „auf Standard gebaut"). Höchstes rechtliches Risiko: Opus baut, Sonnet reviewt, Fable prüft stichprobenartig; der Wahrheitstabellen-Diff steht vor der Implementierung im Spec.
  - *Abhängigkeiten:* 021, 011, 043
  - *Rolle/Modell:* Implementierer · Opus; Review Sonnet (frischer Kontext) + Stichprobe Fable mit Perspektive Legal
  - *Nachweise:* Test je neuer Regel-ID inkl. Vier-Augen-Negativtest; Wahrheitstabellen-Diff freigegeben; Katalog mit 0 verified sichtbar als „ungeprüft"; pnpm gates
  - *Offene Entscheidung:* E15 Rechtsprüfung des Grundkatalogs (Daten)
- **045 · Verweigerung in Beantwortung und auf der Bühne** — mittel · 2 AStd · Kalender 09.11.2026 (W7) · Lanes: web-answers, web-stage
  - *Ziel:* Aktion „Auskunft verweigern" im Beantwortungsdetail mit Pflichtauswahl Pfad A/B, Grund und Begründung; „ungeprüft"-Badge am Grund; Bühne zeigt verweigerte Fragen mit Formulierungsbaustein und Kennzeichen; Historie zeigt den Verweigerungsvorschlag und die Freigabe.
  - *Abhängigkeiten:* 044, 036
  - *Rolle/Modell:* Implementierer-Oberfläche · Sonnet; Design-Kritik Fable; Review Opus
  - *Nachweise:* Screenshots Verweigerungsdialog und Bühne DE/EN; Playwright Pfad B ohne Grund → Aktion fehlt in `_actions`, die Oberfläche rendert nur, was der Kern erlaubt
  - *Offene Entscheidung:* —
- **050 · Verfahrensereignisse: Protokollierungsverlangen, Widerspruch, Anordnungen** — mittel · 1,5 AStd · Kalender 09.11.2026 (W7) · Lanes: core, web-capture
  - *Ziel:* ProtocolRequested, ObjectionRaised, ChairOrderRecorded als Ereignisse erster Klasse mit R-PROC-01..03, occurredAt/recordedAt, Notarmarkierung, Recht procedure.record (moderation, capture, legal); Schnellaktionen in der Erfassung; Historie-Filter; Alarm (085) an Inhaber von question.legal.clear bei Widerspruch; Aufnahme in die Niederschrift-Anlage.
  - *Abhängigkeiten:* 025, 043, 085
  - *Rolle/Modell:* Implementierer-Backend · Sonnet + Mechaniker · Haiku (Schnellaktionen); Review Opus mit Perspektive Legal
  - *Nachweise:* Tests je R-PROC-Zeile; Screenshot Schnellaktion und Historie-Filter
  - *Offene Entscheidung:* —
- **047 · Vertraulichkeitsstufe, attributbasierte Rechte, Podium-Sichtbarkeit, Insider-Kennzeichen** — hoch · 3 AStd · Kalender 10.11.2026 (W7) · Lanes: core
  - *Ziel:* can() erhält Kontext {unit, seat, confidentiality, timeWindow}, im Dienst aufgelöst aus Rollenzuordnung (026) und Bühnenplatz/Einheit (040), nie aus einer Client-Angabe; Attribut confidentiality (internal | restricted | protected) mit Ereignis; setzen dürfen legal, approver, admin, `question.read.protected` halten legal, approver, admin und die Fachkräfte der zugewiesenen Einheit, das Podium sieht geschützte Fragen erst ab staged (E17); Sichtbarkeit „nur eigene Einheit" für expert als Attributregel; podiumVisibility own | all_marked als Meeting-Konfiguration (Schalter liegt hier) im getStage-Filter; Attributregel „Vorstands-Einheiten lesen AR-Fragen nicht"; `event.read.personal` mit Vier-Augen-Guard (Ereignis AuditAccessGranted mit Zweck und Frist) und personId-Maskierung im Standardlesepfad; Insider-Kennzeichen insiderRelevance (unknown | no | yes) auf der Klassifizierung als Eingabe für R-GUARD-07 (yes erfordert Rechtsfreigabe mit Vermerk); zweite generierte Wahrheitstabelle Attribut × Aktion (packages/domain/policy-attribute-table.md) mit Diff-Tor; Zähler bleiben lückenlos; Badge in der Oberfläche; Nachweise für ADR 0009.
  - *Abhängigkeiten:* 010, 026, 040, 044
  - *Rolle/Modell:* Implementierer-Backend · Sonnet + Mechaniker · Haiku (Badge); Review Opus mit Perspektive Security/Datenschutz
  - *Nachweise:* policy-attribute-table.md eingecheckt; Negativtests expert anderer Einheit 403, observer auf protected 403, podium auf Platz ceo sieht keine cfo-Fragen bei own, Client behauptet einen fremden Platz → wird ignoriert; Test personId-Auswertung ohne zweite Freigabe → 403; B2 vollständig belegt; Test Export ohne Notiz
  - *Offene Entscheidung:* E7 Podium-Sichtbarkeit (Standard own), E17 Stufen
- **051 · Niederschrift-Anlage: Gerüst und Exportereignis** — mittel · 1,5 AStd · Kalender 11.11.2026 (W7) · Lanes: service, web-history
  - *Ziel:* GET /v1/meetings/{id}/exports/record (JSON) und /record.html (druckbar mit Print-Stylesheet, PDF über Browser) mit dem, was bis hier existiert: Einzelfragen mit Wortlaut, Redner (Klarname nach Recht), Antwortstand, verwendete Version, Verweigerungen mit Grund, Hash-Liste und Log-Hash; Recht export.dossier; jeder Export ein Ereignis ExportCreated (wer, wann, Umfang); Notiz und technische Felder nie enthalten; Druckpfad auch als stündlicher Katalog für den Papierbetrieb nutzbar. Vorgelesen-Quittungen, Verfahrensereignisse, Restantenliste, Papierquelle und formatierte Antworten ergänzt 081.
  - *Abhängigkeiten:* 043, 044, 026
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus mit Perspektive Datenschutz/Legal
  - *Nachweise:* Test Export ohne Recht 403, Export erzeugt Ereignis; Snapshot-Test des HTML gegen Seed; Screenshot Druckansicht; Test Notiz fehlt
  - *Offene Entscheidung:* E19 Notarzugang (lesend über Export)
- **049 · Vorgelesen als Entität mit Abweichungsvermerk (Soll-Ist)** — hoch · 2 AStd · Kalender 12.11.2026 (W7) · Lanes: core, web-stage
  - *Ziel:* Delivery {questionId, answerVersion, versionHash, seat, personId, deviceId, recordedAt, occurredAt mit Quelle, mode: as_approved | deviation, deviationNote, idempotencyKey}; „Vorgelesen" ist von If-Match auf der Frage ausgenommen und prüft den Versions-Hash; passt er nach Wiederverbindung nicht, entsteht ein Vermerk DeliveryConflict statt eines stillen Fehlers; Mehrfach-Delivery erlaubt (Nachfrage, Korrektur); Bühne fragt „Vorgelesen wie freigegeben" (Leertaste) oder „mit Abweichung" (A + Pflichttext); Historie zeigt Soll-Ist-Vermerk; Alarm (085) an Inhaber von question.legal.clear bei deviation.
  - *Abhängigkeiten:* 021, 043, 085
  - *Rolle/Modell:* Implementierer-Backend · Sonnet + Implementierer-Oberfläche · Sonnet; Review Opus mit Perspektive Legal
  - *Nachweise:* Test Delivery referenziert exakt die freigegebene Version (Hash); Test Hash passt nicht → DeliveryConflict; Playwright Bühne: Abweichung erfordert Text; Screenshot
  - *Offene Entscheidung:* —
- **052 · Rechtekonzept umbasieren, Regelregister an Recht** — niedrig · 1 AStd · Kalender 13.11.2026 (W7) · Lanes: docs-legal
  - *Ziel:* docs/rollen-und-rechtekonzept.md auf das implementierte Modell umschreiben (Rollen, Rechte, Attribute, Status wie im Code; Zielrollen Notar, Kanzlei, Revision, Versammlungsleitung als Ausbaustufe markiert); Regelregister (Regel-ID → Zitat → verified → Test) und Verweigerungskatalog als Übergabepaket für Recht mit Datum (der Vorabzug aus 011 liegt seit Anfang Oktober dort); Verifikationslog eröffnet.
  - *Abhängigkeiten:* 044, 047
  - *Rolle/Modell:* Architekt · Fable; Review Opus
  - *Nachweise:* Diff des Rechtekonzepts; Übergabevermerk mit Datum im Register (E15)
  - *Offene Entscheidung:* E15
- **087 · Restanten-Feststellung vor Debattenschluss** — hoch · 2 AStd · Kalender 17.11.2026 (W8) · Lanes: core, web-cockpit
  - *Ziel:* Ereignis RemainderListConfirmed {Liste der Einzelfragen mit Stand eingegangen / beantwortet / verweigert / offen, Hash, bestätigt durch Inhaber von debate.close (Standard moderation, approver), occurredAt}; Guard R-MTG-07: debateClosed nur nach bestätigter Restantenliste, deren Hash dem aktuellen Stand entspricht; Ansicht „Offene Fragen vor Schluss" im Leitstand mit namentlicher Liste und Quittung; Aufnahme in die Niederschrift-Anlage (081). Quelle: Recherche Z.78.
  - *Abhängigkeiten:* 025, 043, 061
  - *Rolle/Modell:* Implementierer-Backend · Sonnet + Implementierer-Oberfläche · Sonnet; Review Opus mit Perspektive Legal
  - *Nachweise:* Test debateClosed ohne Bestätigung → 409 R-MTG-07; Test Liste veraltet (neue Frage nach Bestätigung) → 409; Wahrheitstabellen-Diff; Screenshot Leitstand
  - *Offene Entscheidung:* E15 (Zitat ungeprüft)

### 5.6 M4 · Oberfläche der Beta — Kalender 13.11.–11.12.2026 (W7–W11)

**Ziel.** Die M/L-Punkte des Feedbacks: Steuerungsansicht, Fokusansicht, Antwortformat, Bühne je Gerät mit eigenem Bundle und Offline-Lesepuffer, Antwortbündel, Rechtsfreigabe-Sicht, Leitstand, Entwurfspuffer und Präsenz, Onboarding mit Login-Check; Feedback-Runde 3 auf Staging.

**Exit-Kriterien.**
- B7, B8, B9 vollständig und Browser-Anteil von B11 (Zeitbudget-Tor aus 084).
- Screenshots aller neuen Ansichten DE/EN; axe 0 serious; Tastaturpfad je Kernszene.
- Playwright: Bühne mit abgetrenntem Netz zeigt die nächsten 20 Antworten; Offline-Test einmal auf der realen Geräteklasse.
- Protokoll Feedback-Runde 3 (11.12.2026).

- **053 · Steuerungsansicht der Koordination** — mittel · 2,5 AStd · Kalender 13.11.2026 (W7) · Lanes: web-steering
  - *Ziel:* Route /steering (Recht question.classify): Klassifizierung (Antwortpfad, Bühnenplatz, Insider-Kennzeichen), Zuweisung, Weiterleiten, Verweigerung vorschlagen, Zurückstellen; Verteilung „wo liegt was" je Fachbereich und je Bühnenplatz als Matrix aus counts.byUnit und counts.bySeat (040) (Feedback #11, #25); Mehrfachauswahl mit Einzeltasten; Filter bleiben hier; Vertraulichkeits-Badge; die Route kommt als eine Zeile ins Feature-Register (082), sichtbar über das Recht question.classify, nie über einen Rollennamen.
  - *Abhängigkeiten:* 021, 043, 036, 047, 040, 082
  - *Rolle/Modell:* Implementierer-Oberfläche · Sonnet; Design-Kritik Fable; Review Opus
  - *Nachweise:* Screenshots DE/EN; Playwright Matrix-Zahlen gegen counts; Zeitmessung Filterwechsel p90 < 150 ms bei 800 (Tor) mit Ausweis gegen D9 100 ms; axe grün
  - *Offene Entscheidung:* E1 Rollenname (nur i18n)
- **054 · Fokusansicht der Beantworter** — mittel · 2 AStd · Kalender 16.11.2026 (W8) · Lanes: web-focus
  - *Ziel:* Route /my: nur eigene Zuweisungen (Einheit/Person), keine Filter, Doppelklick öffnet Vollbild-Schreibmodus, Enter/Escape-Pfad, Lesehinweis bei fehlendem Recht, TOP und Erfassungszeit ausgeblendet, Rückgabegrund prominent, „Weiterleiten" als primäre Aktion mit Dialog für Einheit und Grund (Übergang aus 048); Alt+6 über das Feature-Register (082).
  - *Abhängigkeiten:* 036, 021, 048, 082
  - *Rolle/Modell:* Implementierer-Oberfläche · Sonnet; Design-Kritik Fable; Review Opus
  - *Nachweise:* Screenshots inkl. Weiterleiten-Dialog; Playwright Doppelklick → Vollbild → speichern; axe grün
  - *Offene Entscheidung:* —
- **061 · Leitstand mit fachlichen Kennzahlen** — mittel · 2 AStd · Kalender 16.11.2026 (W8) · Lanes: web-cockpit
  - *Ziel:* Route /cockpit (Recht cockpit.read, Standard coordination, moderation, admin; eine Zeile im Feature-Register 082): Alter der ältesten offenen Frage, Rückstand je Fachbereich, Zulauf/5 min, Fragen in Rechtsfreigabe > 10 min, „Fragen ohne Endstatus" vor Debattenschluss; Drill-down auf Liste; Platz für den Kanarienfrage-Status (gefüllt durch 086); Werte aus /metrics oder Projektion; keine personenbezogenen Kennzahlen (Negativtest, Allowlist).
  - *Abhängigkeiten:* 033, 043, 082, 040
  - *Rolle/Modell:* Implementierer-Oberfläche · Sonnet; Review Opus mit Perspektive Datenschutz
  - *Nachweise:* Test keine Kennzahl je subject; Screenshot; axe grün
  - *Offene Entscheidung:* —
- **055 · Antwortformat: Normalisierung im Kern, Editor, einheitlicher Renderer** — mittel · 3 AStd · Kalender 18.11.2026 (W8) · Lanes: core, web-components
  - *Ziel:* AnswerVersion.body als Blockdokument (paragraph, list; bold, italic, highlight) plus text (Klartextprojektion); Normalisierung in der Domäne (Whitelist, leere Blöcke zusammenführen, idempotent); Editor mit Tastenkürzeln und Einfügen aus Word (Normalisierung beim Speichern und Weiterleiten); Renderer-Komponente für Bühne, Historie, Export; Diff auf der Klartextprojektion; Nachweise für ADR 0005.
  - *Abhängigkeiten:* 043, 054
  - *Rolle/Modell:* Implementierer-Backend · Sonnet (Normalisierung) + Implementierer-Oberfläche · Sonnet (Editor, Renderer); Design-Kritik Fable; Review Opus
  - *Nachweise:* Test verbotene Marke wird entfernt, Idempotenz der Normalisierung; Screenshots Bühne und Historie mit Format; pnpm gates + e2e
  - *Offene Entscheidung:* E6 Formatumfang (Whitelist ist ein Enum)
- **060 · Entwurfspuffer, Präsenz und Merge-Ansicht** — mittel · 2 AStd · Kalender 18.11.2026 (W8) · Lanes: web-answers, web-focus
  - *Ziel:* lokaler Entwurfspuffer je Frage (IndexedDB, Wiederherstellung nach Reload, Playwright kappt die Verbindung beim Tippen), Präsenzanzeige „wird bearbeitet von" über Claim aus 028 (weiche Sperre), 412-Merge-Ansicht mit beiden Texten, Doppelklickschutz; auch in der Erfassung für laufende Atomisierung.
  - *Abhängigkeiten:* 028, 036, 054
  - *Rolle/Modell:* Implementierer-Oberfläche · Sonnet; Review Opus
  - *Nachweise:* Playwright Reload verliert keinen Entwurf; Playwright Verbindungsabbruch beim Tippen; Screenshot Merge-Ansicht
  - *Offene Entscheidung:* —
- **056 · Bühne je Gerät mit eigenem Bundle** — hoch · 3 AStd · Kalender 19.11.2026 (W8) · Lanes: web-stage, infra
  - *Ziel:* StageView je Bühnenplatz über getStage-Filter aus 047 mit Sortierstrategie (Standard stagePosition), eigener Reihenfolge und Fortschritt; Vorblättern ohne Vorgelesen; Anzeigeeinstellungen je Gerät (Schriftgröße, Zeilenabstand, Gewicht, Kontrast, „alle mit Markierung" nur wenn podiumVisibility=all_marked) in localStorage; Inhalt beim Öffnen eingefroren mit Hinweisstreifen bei Korrektur; Tastaturhandler an die Ansicht und Gerätekennung gebunden; eigenes minimales Podium-Bundle (< 150 kB gzip) mit Größen-Tor; 200 %-Zoom-Screenshot; Nachweise für ADR 0006.
  - *Abhängigkeiten:* 049, 047, 055, 036
  - *Rolle/Modell:* Implementierer-Oberfläche · Sonnet; Design-Kritik Fable und Opus (zweite Sicht, weil Fable die Spec schrieb); Review Opus
  - *Nachweise:* Test podium auf Platz ceo sieht keine cfo-Fragen im Standard; Playwright Vorblättern ohne Zustandsänderung, Korrektur zeigt Streifen; Screenshots je Einstellung; Bündelgröße; Zeitbudget Bühnenwechsel p90 < 150 ms
  - *Offene Entscheidung:* E7 (Standardwert own)
- **057 · Antwortbündel** — mittel · 2 AStd · Kalender 20.11.2026 (W8) · Lanes: core, web-steering
  - *Ziel:* Entität AnswerBundle (Antwortbündel, getrennt von der bestehenden Runde `Speaker.round`) mit Ereignissen BundleAssembled/BundleClosed, Recht round.assemble (coordination), Strategie-Feld (manual | by_seat), Steuerungsansicht „Bündel zusammenstellen" (Zielgröße 20), Bühne filtert optional nach Bündel (zweite Sortierstrategie); Zähler je Bündel; ohne Bündel bleibt die Bühne je Gerät voll nutzbar.
  - *Abhängigkeiten:* 056, 053
  - *Rolle/Modell:* Implementierer-Backend · Sonnet + Implementierer-Oberfläche · Sonnet; Review Opus
  - *Nachweise:* Test Bündel referenziert nur approved/staged Fragen desselben Jahrgangs; Screenshot Zusammenstellung und Bühne mit Bündelfilter
  - *Offene Entscheidung:* E2 Zusammenstellungsregel (Strategie-Feld)
- **058 · Podium offline: Lesepuffer, Absichtswarteschlange, Wiederaufnahme, Test auf realer Geräteklasse** — hoch · 2,5 AStd · Kalender 23.11.2026 (W9) · Lanes: web-stage
  - *Ziel:* Bühne hält die nächsten 20–30 freigegebenen Antworten des eigenen Bühnenplatzes in IndexedDB, zeigt bei Verbindungsverlust „Stand HH:MM:SS" und liest weiter; „Vorgelesen" wird offline als Absicht mit Gerätezeit (occurredAt, Quelle device) und Idempotenzschlüssel gepuffert, die Frage bleibt staged und zeigt „nicht bestätigt", bis der Dienst die Absicht nach Wiederverbindung anwendet; keine Statuslogik im Client (ADR 0001, Regel 5); Wiederaufnahme über SSE Last-Event-ID; kein Service Worker für Code; datenfreier Fehler-Beacon (Gerätekennung, Fehlerklasse, Zeit) an die Betriebsauswertung; Offline-Test einmal auf der realen Geräteklasse (E33) mit Screenshot.
  - *Abhängigkeiten:* 056, 028
  - *Rolle/Modell:* Implementierer-Oberfläche · Sonnet; Review Opus mit Perspektive Betrieb
  - *Nachweise:* Playwright context.setOffline 20 s, Vorgelesen als Absicht, online, der Dienst wendet an, Ereignis trägt occurredAt mit Quelle device und recordedAt vom Dienst; Test keine Doppelanlage nach Wiederverbindung; Test geänderte Version → Vermerk statt 412; Screenshot vom Podiumsgerät
  - *Offene Entscheidung:* E33 Geräteklasse
- **059 · Rechtsfreigabe-Sicht** — mittel · 2 AStd · Kalender 24.11.2026 (W9) · Lanes: web-clearing, core
  - *Ziel:* Route /clearing (legal, approver): Redline-Diff zwischen Versionen (Klartextprojektion), Prüfliste als Daten je Antwortpfad mit Guard im Kern (R-GUARD-10: Rechtsfreigabe erst bei vollständiger Prüfliste, `_actions` enthält legal.clear erst dann), fünf Aktionen (Rechtsfreigabe erteilen, Freigeben, Zurück mit Grund, Verweigerung vorschlagen, Weiterleiten), Vier-Augen-Hinweis, Vertraulichkeitsstufe und Insider-Kennzeichen setzen; Tastaturpfad; die Route kommt als eine Zeile ins Feature-Register (082).
  - *Abhängigkeiten:* 045, 047, 055, 082
  - *Rolle/Modell:* Implementierer-Backend · Sonnet (Guard) + Implementierer-Oberfläche · Sonnet; Design-Kritik Fable; Review Opus mit Perspektive Legal
  - *Nachweise:* Screenshots; Test Prüfliste unvollständig → 409 R-GUARD-10; Playwright Aktion fehlt, bis die Liste vollständig ist; axe grün
  - *Offene Entscheidung:* —
- **062 · Onboarding, Kontexthilfe, Login-Check, Barrierefreiheit-Nacharbeit** — niedrig · 2 AStd · Kalender 25.11.2026 (W9) · Lanes: web-shell, web-components
  - *Ziel:* Rollenkarte beim ersten Login (Was darf ich, wo fange ich an), generiert aus ROLE_PERMISSIONS und Wahrheitstabelle, druckbar DE/EN; „?"-Kontexthilfe als Shell-Komponente, die je Feature einen Hilfeschlüssel aus dem Feature-Register liest; Login-Check-Seite (Anmeldung, Rolle, Gerät, Netz zu /readyz) für die Generalprobe; gebündelte Live-Regionen „polite" bei Bühnenwechsel; Tastaturpfad-Specs aus 013 um die neuen Ansichten ergänzt; 200 %-Zoom; axe-Befunde aus M1–M4 geschlossen.
  - *Abhängigkeiten:* 013, 059, 058, 082
  - *Rolle/Modell:* Implementierer-Oberfläche · Sonnet + Mechaniker · Haiku (i18n, Druckvorlage); Review Opus
  - *Nachweise:* Screenshots Rollenkarte je Rolle und Login-Check; Playwright Tastaturpfad-Specs; axe-Bericht 0 moderate+
  - *Offene Entscheidung:* —
- **063 · Nachweise M4, Protokoll Feedback-Runde 3** — niedrig · 1 AStd · Kalender 11.12.2026 (W11) · Lanes: docs-feedback
  - *Ziel:* Screenshots aller neuen Ansichten neu; Protokoll der dritten Feedback-Runde (11.12.2026, auf Staging-synthetisch mit Anmeldung) mit Klick-Durchlauf der Projektleitung; die Sitzung mit einem Podiumsmitglied oder dessen Assistenz zu Schrift und Zeilenabstand folgt in Runde 4 am 22.01.2027 über die Kleinänderungsspur; Antworten ins Register; Messtabelle.
  - *Abhängigkeiten:* 056, 057, 058, 062
  - *Rolle/Modell:* Mechaniker · Haiku; Review Sonnet
  - *Nachweise:* docs/feedback/2026-12-runde-3.md, docs/evidence/063-*.png
  - *Offene Entscheidung:* E2, E6, E7, E17 bestätigt oder Änderungsauftrag

### 5.7 M5 · Integrationen — Kalender 20.11.–02.12.2026 (W8–W10)

**Ziel.** Ingest-Vertrag mit erstem Adapter, Ereignisstrom und Webhooks für Nachbarn mit Sandbox-Mandant, KI-Port ohne Anbieter, Aktienregister-Lookup-Port, Vorabfragen light, Papierpfad im Tool, Zusammenführen mit Rückverfolgbarkeit, vollständige Niederschrift-Anlage, Kanarienfrage.

**Exit-Kriterien.**
- Segmente aus einer Datei landen als unbestätigte Redebeiträge und werden ohne Änderung des Erfassungsflusses atomisiert; Partnerleitfaden vorhanden.
- Vertrag enthält answer-suggestions, ingest, lookup, subscriptions; Vorabfragen-Modul standardmäßig aus.
- Papier-Nacherfassung erscheint im Export mit Quelle und lateEntry; B12 erfüllt (081).
- Kanarienfrage läuft auf Staging alle 30 Minuten.
- Prüfpunkt 5 am 11.12.2026 (gemeinsam mit M4).

- **066 · KI-Port ohne Anbieter** — mittel · 1,5 AStd · Kalender 20.11.2026 (W8) · Lanes: service, web-answers
  - *Ziel:* POST /v1/questions/{id}/answer-suggestions (sources[], model, version, confidence Pflicht), Ereignis SuggestionRecorded ohne Statuswechsel, Port SuggestionProvider mit Adapter none (503 „nicht konfiguriert"); Oberfläche zeigt Vorschlag nur mit Quellen und verlangt Diff-Bestätigung bei Übernahme; Prompt-Injection-Hinweis im Leitfaden.
  - *Abhängigkeiten:* 055, 043
  - *Rolle/Modell:* Implementierer-Backend · Sonnet + Mechaniker · Haiku (Anzeige); Review Opus
  - *Nachweise:* Test Vorschlag ohne Quellen 422; Test Statuswechsel durch Systemakteur 403; Changelog
  - *Offene Entscheidung:* E18 KI-Funktionen und Anbieter (Adapter)
- **068 · Vorabfragen light und Papierpfad im Tool** — mittel · 2,5 AStd · Kalender 25.11.2026 (W9) · Lanes: core, web-capture, service
  - *Ziel:* Contribution.source submitted (submittedAt, Frist, Kennzeichen madeAccessible; Modul über Meeting-Konfiguration presubmittedEnabled (Schalter liegt hier), Standard aus; Abgleich „vorab beantwortet" als Kennzeichen an der Live-Frage) und source paper (reservierte Nummernkreise je Erfassungsplatz aus 040, Nacherfassung nach R-MTG-03 aus 025: occurredAt mit Quelle paper vor debateClosedAt und Pflichtgrund, Kennzeichen lateEntry, Kennzeichen in Historie und Export); Erfassung zeigt beide Quellen; Runbook-Abschnitt verweist darauf.
  - *Abhängigkeiten:* 040, 046, 024, 025
  - *Rolle/Modell:* Implementierer-Backend · Sonnet + Mechaniker · Haiku; Review Opus
  - *Nachweise:* Test Modul aus → 409 auf Vorabfrage; Test Nummer außerhalb des Kreises → 422; Test occurredAt in der Zukunft abgelehnt; Test paper nach Schluss mit früherem occurredAt → 201, manual nach Schluss → 409; Export zeigt Quelle paper
  - *Offene Entscheidung:* E20 Formatprofil (Profilfeld)
- **064 · Transkript-Ingest: Endpunkt, unveränderliche Segmente, Datei-Adapter, Partnerleitfaden** — hoch · 2,5 AStd · Kalender 26.11.2026 (W9) · Lanes: service, web-capture
  - *Ziel:* POST /v1/ingest/speech-segments (Idempotenz je segmentId, Segmente unveränderlich, Status unconfirmed, speakerId optional, Zeitanker), Ereignis SegmentIngested; Erfassung übernimmt Segmente per Knopf in einen Redebeitrag (source transcript) und ordnet den Redner zu; erster Adapter: Datei-/Zwischenablage-Import im Browser, der die Datei zerlegt und den Endpunkt mit der Sitzung der erfassenden Person aufruft; ingest.write halten capture (Zeile in ROLE_PERMISSIONS) und Systemakteure für spätere Push-Adapter (Client-Credentials oder mTLS als Konfiguration); docs/integration/transkript.md mit /v1-Kompatibilitätsregel (zwei Vertragszyklen); Nachweise für ADR 0008.
  - *Abhängigkeiten:* 029, 028, 043
  - *Rolle/Modell:* Implementierer-Backend · Sonnet + Implementierer-Oberfläche · Sonnet; Review Opus mit Perspektive Security
  - *Nachweise:* Test gleiches Segment zweimal → ein Ereignis; Negativtest Rolle ohne ingest.write (z. B. observer) → 403; Playwright Import → Redebeitrag → Einzelfragen; Leitfaden
  - *Offene Entscheidung:* E3b Adapter des Tools
- **065 · Ereignisstrom für Nachbarn, HMAC-Webhooks, Sandbox-Mandant** — hoch · 2 AStd · Kalender 27.11.2026 (W9) · Lanes: service
  - *Ziel:* Abonnements (Systemakteur, Ereignistypen, Ziel-URL, HMAC-Secret aus Konfiguration), signierte Zustellung mit Wiederholung und Idempotenzschlüssel, Ereignisfilter nach Leserecht des Systemakteurs (nie Notizen, nie protected), Sandbox-Mandant HV_MODE=training mit synthetischem Korpus für Partnertests; Abschnitt im Integrationsleitfaden.
  - *Abhängigkeiten:* 035, 029
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus mit Perspektive Security
  - *Nachweise:* Test Signatur falsch → verworfen; Test Wiederholung nach 5xx; Test protected-Ereignis nicht zugestellt
  - *Offene Entscheidung:* —
- **067 · Aktienregister-JIT-Lookup-Port und Aufdecken als Ereignis** — hoch · 2 AStd · Kalender 30.11.2026 (W10) · Lanes: core, service, web-speakers
  - *Ziel:* Port RegistryLookup mit Adapter local (Personentabelle), Klarname per protokolliertem Lookup (Ereignis IdentityRevealed mit Grund) für Inhaber von question.identity.reveal (Recht aus 026); Klärungs-Queue bei Registerausfall als Kennzeichen; Bühne und Niederschrift-Anlage zeigen Klarnamen nach Recht; Wortmeldeliste zeigt Pseudonym oder Klarname je Recht.
  - *Abhängigkeiten:* 026, 047
  - *Rolle/Modell:* Implementierer-Backend · Sonnet + Implementierer-Oberfläche · Sonnet; Review Opus mit Perspektive Datenschutz
  - *Nachweise:* Test expert sieht Pseudonym, Aufdecken erzeugt Ereignis; Wahrheitstabellen-Diff; Screenshots
  - *Offene Entscheidung:* Aktienregister-Schnittstelle (Adapter, Nach-Beta)
- **069 · Zusammenführen mit Rückverfolgbarkeit und Dublettenvorschlag** — mittel · 2 AStd · Kalender 01.12.2026 (W10) · Lanes: core, web-steering
  - *Ziel:* Merge n:m mit Abdeckungsgrad je Einzelfrage (alle Fragesteller werden mitgeführt), reversibel mit Grund (R-TRANS-17 unmerge vor in_review), Dublettenvorschlag über Klartextähnlichkeit in der Steuerungsansicht (nur Vorschlag, Mensch entscheidet); Sammelantwort zeigt Abdeckungsmatrix.
  - *Abhängigkeiten:* 043, 053
  - *Rolle/Modell:* Implementierer-Backend · Sonnet + Implementierer-Oberfläche · Sonnet; Review Opus
  - *Nachweise:* Test unmerge stellt beide Fragen her; Test Export führt alle Fragesteller; Screenshot Vorschlag
  - *Offene Entscheidung:* —
- **081 · Niederschrift-Anlage vollständig** — mittel · 2 AStd · Kalender 01.12.2026 (W10) · Lanes: service, web-history
  - *Ziel:* Das Gerüst aus 051 wird vollständig: Vorgelesen-Quittungen mit Soll-Ist (049), Verfahrensereignisse (050), bestätigte Restantenliste (087), Papier- und Vorabquelle mit lateEntry (068), formatierte Antworten über den einen Renderer (055), Klarnamen nach Recht über das Aufdecken-Ereignis (067); Hash-Liste und Log-Hash über alles. Quellen: Recherche Z.74, Z.78, Z.103; B12.
  - *Abhängigkeiten:* 051, 049, 050, 055, 067, 087, 068
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus mit Perspektive Legal/Datenschutz
  - *Nachweise:* Snapshot-Test HTML und JSON gegen Seed mit allen Abschnitten; Test Notiz fehlt; Test Export ohne Recht 403; Screenshot Druckansicht
  - *Offene Entscheidung:* E19 Notarzugang (lesend über Export)
- **086 · Kanarienfrage** — mittel · 2 AStd · Kalender 02.12.2026 (W10) · Lanes: service, core
  - *Ziel:* Systemakteur canary mit eigenem Rechtebündel in ROLE_PERMISSIONS (Wahrheitstabellen-Diff); Kennzeichen synthetic=true auf Wortmeldung und Frage mit Ausschlussfilter in getStage, Export, counts und Bündelbildung (je ein Test); ein Läufer im Dienst treibt alle 30 min eine synthetische Frage durch Erfassung → Klassifizierung → Entwurf → Rechtsfreigabe → Freigabe → Bühne → Vorgelesen (auf einem eigenen Bühnenplatz „Kanarie") und misst die Durchlaufzeit; Fehlschlag erzeugt einen Alarm (085); Status im Leitstand (061); aktiv nur in training und shadow.
  - *Abhängigkeiten:* 049, 047, 035, 042, 085, 061
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus mit Perspektive Betrieb
  - *Nachweise:* Test synthetische Frage erscheint nie auf einem echten Bühnenplatz, im Export oder in counts; Protokoll von zehn Durchläufen mit Zeiten; Test Fehlschlag → Alarm
  - *Offene Entscheidung:* —

### 5.8 M6 · Betrieb, Datenschutz, Dokumentation, Generalprobe — Kalender 24.11.2026–11.03.2027 (W9–W24) · Leitplanken 9.2 „Pilotbereit"

**Ziel.** Runbook mit Datenpanne, Lasttest, Chaos-Katalog, Datenschutz-Paket, Sicherheitsprüfung mit Pentest, alle Anleitungen, Rechtsprüfungs-Nachtrag, Vertrags- und Konfigurationsfreeze, Generalprobe mit Konzernteilnehmern auf dem Übungsmandanten, Beta-Abnahme. Die Bauscheiben dieses Meilensteins laufen früh; 074, 076, 077, 078 und 079 sind an feste Termine gebunden.

**Exit-Kriterien.**
- B11, B13 (vollständig), B14, B15, B16, B18 erfüllt.
- Lastbericht mit p90-Werten; Chaos-Protokoll; Runbook, Admin-, Integrations-, Entwickler-Anleitung von einem fremden Modell befolgt.
- Generalprobe-Drehbuch einmal komplett auf dem Übungsmandanten durchgespielt; Go/No-Go-Liste unterschrieben (Prüfpunkt 7, 05.03.2027).
- Feature-Stopp 12.02.2027; Tag `beta-1` am 12.03.2027.

- **070 · Runbook v1, Datenpanne, Freeze-Kalender** — mittel · 2 AStd · Kalender 24.11.2026 (W9) · Lanes: docs-betrieb
  - *Ziel:* docs/betrieb/runbook.md: Degradationsstufen (Funktionsabwurf → nur lesen → lokale Bühnenkopie → stündlicher gedruckter Katalog → Papier) je Stufe mit Auslöser, Wer, Schritte, Rückweg; Notfallkonten (versiegelter Umschlag, nur bei IdP-Ausfall, Alarmereignis aus 029); Abschnitt Datenpanne (Szenarien: Fragenliste im falschen Verteiler, interne Fassung exportiert, Bildschirm sichtbar, Podiumsgerät verloren; Erstmaßnahme, Meldekette an DSB und Security innerhalb 72 h, Beweissicherung über ExportCreated-Ereignisse); Papierpfad mit Nummernkreisen und Nacherfassung (068, Regel R-MTG-03); Offline-Podium; Eskalationskette; War-Room-Protokollvorlage; fünf Alarmregeln (readyz rot, Append-Latenz, Alter der ältesten offenen Frage, Projektionsverzug, Anmeldefehler) mit benannter Beobachterin je Probestunde; Kanarienfrage alle 30 min (086); NTP-Pflicht für Dienst und Podiumsgeräte; Geräte-Checkliste je Station; Freeze-Kalender (Code, Konfiguration, Infrastruktur, Konzern-IT) mit T-Werten; Neustart-Prozedur.
  - *Abhängigkeiten:* 038, 042
  - *Rolle/Modell:* Architekt · Fable; Review Opus mit Perspektive Betrieb
  - *Nachweise:* Runbook mit je Stufe „Auslöser, Wer, Schritte, Rückweg"; Alarmregeln in der Betriebsauswertung aus 037 aktiv, Testalarm protokolliert; Nummernkreis-Reservierung als Test in 068 referenziert
  - *Offene Entscheidung:* E26 technischer Betreiber während der Probe
- **071 · Lasttest 50+15 Nutzer, Vielfrager-Szenario, nightly** — mittel · 2 AStd · Kalender 02.12.2026 (W10) · Lanes: infra, e2e
  - *Ziel:* k6-Szenario gegen Staging-synthetisch: 50 Backoffice (Lesen, Entwurf, Freigabe) und 15 Erfasser (Redebeitrag, Atomisierung mit Claim) über 30 Minuten gegen 800 Fragen; p90 Schreiben < 300 ms, SSE-Latenz < 2 s, Fehlerrate < 0,1 %; Vielfrager (500 Fragen eines Sprechers); Browser-Zeitbudget aus 084 im Lauf; nightly Job mit Schwellen.
  - *Abhängigkeiten:* 037, 036, 031, 053, 056
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus
  - *Nachweise:* docs/evidence/071-last.md mit p50/p90/p99 und Fehlerrate; nightly Lauf grün; Befunde als Kleinänderungen
  - *Offene Entscheidung:* —
- **072 · Chaos- und Failover-Katalog auf Staging** — hoch · 2 AStd · Kalender 03.12.2026 (W10) · Lanes: infra, docs-betrieb
  - *Ziel:* skriptgesteuerte Szenarien mit Soll und Ist: Dienst-Kill mitten im Append (keine Lücke, kein Duplikat in seq), Postgres-Neustart, 20 s Podium-Partition (058), Restore aus letztem Backup (038), Sitzungsablauf während des Tags, Uhrenversatz eines Clients (032), Kill-Switch eines Subjects, IdP nicht erreichbar → Anmeldung über Notfallkonto mit Alarm; Ergebnisse in docs/evidence/072-chaos.md; Befunde als Mechaniker-Scheiben.
  - *Abhängigkeiten:* 038, 058, 029
  - *Rolle/Modell:* Implementierer-Backend · Sonnet; Review Opus mit Perspektive Betrieb; Umsetzer führt zwei Szenarien selbst aus
  - *Nachweise:* Protokoll je Szenario (erwartet/beobachtet); seq-Lücken-/Duplikatprüfung nach Kill
  - *Offene Entscheidung:* —
- **073 · Datenschutz-Paket für Beta und Betriebsrat** — hoch · 2,5 AStd · Kalender 04.12.2026 (W10) · Lanes: docs-datenschutz
  - *Ziel:* Rechtsgrundlagen-Matrix feldgenau aus den Typen generiert (mit retentionClass), Auswertungskatalog aus 033 vervollständigt und mit Diff-Tor versehen, Dokumentation „Auswertung nur zu zweit", Aufbewahrung des Zugriffslogs als Konfiguration (30 Tage), Löschkonzept-Entscheidungsvorlage (Klassen, Fristen, Krypto-Shredding als Nach-Beta-Blocker vor Produktion) mit benanntem Schlüsselverwahrer, Löschprotokoll-Vorlage für Generalprobe-Bestände, Betroffenenauskunft-Skript, Fortschreibung der Zulieferungen aus 083 auf den Endstand, Datenpannen-Playbook aus 070 als Zulieferung an den DSB, AVV-Kette in der Hosting-Anfrage.
  - *Abhängigkeiten:* 033, 061, 067, 083
  - *Rolle/Modell:* Architekt · Fable + Implementierer-Backend · Sonnet (Generatoren); Review Opus mit Perspektive Datenschutz
  - *Nachweise:* generierte Matrix und Katalog eingecheckt; Tor-Lauf grün; Übergabeliste für DSB und Betriebsrat mit Datum
  - *Offene Entscheidung:* E13, E14, E16 (Dokumente sind Zulieferung)
- **075 · Dokumentationssatz: Betrieb, Integration, Entwickler-Einstieg, Paket-READMEs, Vertrags-Changelog-Regel** — niedrig · 2,5 AStd · Kalender 07.12.2026 (W11) · Lanes: docs-entwicklung
  - *Ziel:* docs/betrieb/ (Monitoring, Backup, Deploy-Checkliste, Secrets, Umgebungen), docs/integration/ (Ingest, Ereignisstrom, Webhooks, Idempotenz, Sandbox-Mandant, Kompatibilitätsregel; Redocly-Build des Vertrags als CI-Artefakt), docs/entwicklung/einstieg.md (zwei Stunden: Trace Oberfläche → Vertrag → Domäne → Persistenz; „wie ändere ich eine Regel, ein Recht, einen Endpunkt"), README je Paket (apps/api, apps/web, packages/domain, packages/contract), Deprecation-Regel im CHANGELOG; Zwei-Stunden-Test durch ein fremdes Modell (Haiku) mit Stolperstellen-Protokoll; Admin-Anleitung aus 041 mitgeprüft.
  - *Abhängigkeiten:* 041, 064, 070
  - *Rolle/Modell:* Implementierer-Backend · Sonnet (Text) + Mechaniker · Haiku (Zwei-Stunden-Test); Review Opus
  - *Nachweise:* Protokoll des Zwei-Stunden-Tests; README-Index vollständig; Tor: Vertragsänderung ohne Changelog blockiert
  - *Offene Entscheidung:* —
- **074 · SBOM, Signatur, Bedrohungsmodell v2, Pentest-Begleitung** — hoch · 2 AStd · Kalender 01.02.–05.02.2027 (W19) · Lanes: infra, docs-sicherheit
  - *Ziel:* Semgrep-Vollauf auf den Endstand (Regelsatz seit 012 im Tor), SBOM-Erzeugung in CI, signierte Images, Ausnahmeliste für Audit, Bedrohungsmodell v2 mit Befundstatus, Begleitung des externen Pentests im Fenster 01.–12.02.2027 (Scope aus 039), Remediation-Regel (Befunde ab hoch als Hoch-Scheiben vor beta-1, Budget 5 AStd); ohne externen Pentest zählt ein interner Lauf (Semgrep, OWASP ZAP gegen Staging) als Sicherheitsprüfung der Beta, der externe Test folgt vor der Vollprobe (E32).
  - *Abhängigkeiten:* 034, 029, 039
  - *Rolle/Modell:* Reviewer · Opus (Perspektive Security, Modell) + Implementierer-Backend · Sonnet (CI); Review Fable
  - *Nachweise:* SBOM-Artefakt in CI; Semgrep-Lauf 0 Befunde ≥ mittel; Bedrohungsmodell v2; Pentest-Bericht oder interner ZAP-Bericht mit Befundstatus
  - *Offene Entscheidung:* E32 Pentest-Auftrag (Bestellung bis 15.12.)
- **076 · Rechtsprüfungs-Nachtrag: legalRef und Verweigerungskatalog auf verified** — hoch · 1,5 AStd · Kalender 01.02.2027 (W19) · Lanes: core, docs-legal
  - *Ziel:* Läuft immer im Fenster nach der Rückmeldefrist von Recht (29.01.2027): trägt ein, was Recht bis dahin bestätigt hat (Zitate, Dokumentversionen und -Hashes, verified:true, Katalogergänzung), und übergibt Offenes an Register und Restliste; die Oberfläche entfernt „ungeprüft" nur bei verified; docs/legal-trace.md regeneriert; Verifikationslog fortgeschrieben. Spätere Rückmeldungen laufen als Datenpflege über die Kleinänderungsspur. Ohne Rückmeldung bleibt „ungeprüft" sichtbar und die Generalprobe läuft mit synthetischen Fragen.
  - *Abhängigkeiten:* 011, 044, 052
  - *Rolle/Modell:* Mechaniker · Haiku (Datenpflege); Review Opus mit Perspektive Legal; Freigabe durch Eigentümer
  - *Nachweise:* Diff nur in Datenfeldern; Test verified-Quote in legal-trace.md; Freigabevermerk mit Datum
  - *Offene Entscheidung:* E15
- **077 · Vertrags- und Konfigurationsfreeze, Rechte-Snapshot, Release-Kandidat** — mittel · 1 AStd · Kalender 08.02.2027 (W20) · Lanes: contract, infra
  - *Ziel:* Vertrag 0.4.x eingefroren (Tor: keine Vertragsänderung nach beta-1-rc ohne ADR und Eigentümer-Go), ConfigFrozen für den Übungsmandanten mit Hash-Anzeige, Rechte-Snapshot des Jahrgangs als Artefakt, Tag beta-1-rc, Freeze-Fenster in der Pipeline aktiviert.
  - *Abhängigkeiten:* 019, 080, 020, 021, 082, 084, 023, 024, 025, 026, 027, 028, 029, 030, 031, 032, 033, 034, 035, 036, 037, 038, 039, 040, 041, 042, 088, 043, 044, 045, 046, 047, 048, 049, 050, 051, 052, 085, 087, 053, 054, 055, 056, 057, 058, 059, 060, 061, 062, 064, 065, 066, 067, 068, 069, 081, 086, 083
  - *Rolle/Modell:* Mechaniker · Haiku; Review Opus
  - *Nachweise:* Tag im Repositorium; Snapshot-Artefakt mit Hash; Test Deploy im Freeze → abgelehnt
  - *Offene Entscheidung:* —
- **078 · Generalprobe-Drehbuch, Login-Check, Support-Rota, Drill und Generalprobe** — hoch · 2,5 AStd · Kalender 15.02.–05.03.2027 (W21–W23) · Lanes: docs-betrieb
  - *Ziel:* docs/betrieb/generalprobe.md: Login-Check mit der Seite aus 062 und Quote > 95 % als Go-Kriterium, Kanarienfrage über alle Schritte (086), Datenpannen-Szenario (verlorenes Podiumsgerät → Sitzung sperren), Failover-Drill (Dienst-Neustart, DB-Restore), 20 s Podium-Partition, Papierpfad-Übung, Support-Rota (wer beantwortet welche Station, besetzt bis 05.02.2027), Schulung je Rolle mit Rollenkarten (W21–W22, rund 4 h), Einladungen an Teilnehmende und Podiumsmitglieder bis 11.12.2026 (Projektleitung), Nutzer-Störungslog, Go/No-Go-Liste; Teil 1 technischer Drill auf Staging-synthetisch mit Agenten-Simulanten und Umsetzer (W22), Teil 2 Generalprobe mit Konzernteilnehmern auf dem Übungsmandanten (01.–05.03.2027, W23), Löschprotokoll danach; S-Befunde sofort behoben.
  - *Abhängigkeiten:* 070, 071, 072, 042, 062, 058, 077, 088
  - *Rolle/Modell:* Architekt · Fable (Drehbuch) + Eigentümer (Durchführung); Review Opus
  - *Nachweise:* docs/betrieb/generalprobe-2027-03-protokoll.md mit Zeiten und Befunden; docs/evidence/078-*.png je Station; Login-Quote; Go/No-Go-Liste unterschrieben; Löschprotokoll
  - *Offene Entscheidung:* E13 (Interimsvereinbarung oder gepoolte Identitäten), E33 Geräte
- **079 · Beta-Abnahme B1–B18, Restliste, Nach-Beta-Backlog** — hoch · 2,5 AStd · Kalender 08.03.–11.03.2027 (W24) · Lanes: docs-plan
  - *Ziel:* Abnahmesatz über HTTP mit OIDC-Testrealm in beiden e2e-Projekten; Nachweispaket je Beta-Kriterium (Test, Screenshot, Protokoll) in docs/evidence/beta/README.md mit 18 Zeilen; docs/messung.md mit Kosten je Scheibe, Takt-Tabelle und Budget je Meilenstein; ADR-Status, Register und Plan-Tor-Inventar final abgeglichen (B13 vollständig); docs/beta-abnahme.md mit Restliste (Nach-Beta-Punkte mit Eigentümer, Zeitfenster, reserviertem Attribut; Kriterien „erfüllt mit Einschränkung"); Abnahme durch den Eigentümer; Tag beta-1.
  - *Abhängigkeiten:* 078, 073, 074, 075, 076
  - *Rolle/Modell:* Reviewer · Opus (frischer Kontext, sieht nur Kriterien und Repositorium); Architekt · Fable (Restliste); Eigentümer unterschreibt
  - *Nachweise:* 18 Zeilen Kriterium → Nachweis; pnpm gates und beide e2e-Projekte; Tag beta-1 (12.03.2027)
  - *Offene Entscheidung:* —

### 5.9 Anpassungsphase und Kleinänderungsspur

**Anpassungsphase (07.12.2026–12.02.2027).** Nach dem Bau des Funktionsumfangs bleiben rund zehn Wochen bis zum Feature-Stopp. Sie sind kein Leerlauf, sondern der Ort für alles, was diese Planung bewusst offen lässt: Antworten aus dem Register, die später kommen, werden als Tabellen-, Enum-, Konfigurations- oder Adapteränderung nachgezogen (Abschnitt 3); M-Punkte aus den Feedback-Runden 3 (11.12.) und 4 (22.01.) bekommen eigene Specs; Last- und Chaos-Katalog laufen nach jeder größeren Änderung erneut; die Bühne wird auf der realen Geräteklasse geprüft, sobald E33 beantwortet ist. Budget: 25 AStd für Anpassungsscheiben. Eine kleine Vorprobe mit fünf bis zehn Personen im Januar ist als Option E49 im Register.

**Kleinänderungsspur.** Ein dauerhafter Worktree `takt` für S-Punkte der Projektleitung und für Befunde unter einer Stunde Agentenzeit. Regel 1 gilt auch hier: Jeder Punkt bekommt eine Mini-Spec auf einer Bildschirmseite, `docs/slices/takt-NNN.md` (Ziel, Files allowed, Nachweis), und wird einzeln gemergt (Regel 12). Haiku oder Sonnet baut, Sonnet oder Opus reviewt. Budget 1,5 AStd je Woche; getrennte Posten für Befunde aus Last und Chaos (3 AStd), Generalprobe (5 AStd) und Pentest (5 AStd). Jeder Punkt mit Nachrichtenzeit, Klasse S/M/L und Live-Zeit in der Takt-Tabelle von docs/messung.md (`scripts/takt.mjs`; Ziel S live am nächsten Bautag, M < 2 Bautage, L < 1 Woche nach Klärung). M-Punkte bekommen eine volle Spec und laufen im nächsten freien Fenster ihrer Lane; L-Punkte gehen in die Entscheidungsstunde. Ein Takt-Punkt berührt keine Lane, in der gerade eine Scheibe läuft. Die Taktfläche ist die Netlify-Demo; Staging-synthetisch folgt mit dem nächsten freigegebenen Deploy; im Freeze-Fenster (ab 12.02.2027) nur Fehlerbehebungen. Mehrere S-Punkte in einem Merge wären eine Änderung von AGENTS.md Regel 1 und 12 und stehen als Option E44 im Register.

### 5.10 B-Liste — bewusst nicht in der Beta

Jeder Eintrag hat einen Eigentümer und das Attribut, das die Beta reserviert, damit der Ausbau später nicht blockiert.

| Punkt | Quelle | Eigentümer | Frühestens | In der Beta reserviert |
|---|---|---|---|---|
| Vorbereitung §7 (Fragenkatalog, Briefingbuch, Pre-Clearing, Zulieferlandkarte) | Recherche Z.175-184 | Projektleitung | nach HV 2027 | Meeting.status preparation |
| Aktionärskanal, Präsenz-Intake mit Legitimation, Eingangsquittung | Recherche Z.192-209, Ist §6 | Projektleitung (Make-or-Buy) | nach HV 2027 | Contribution.source submitted, Kennzeichen internal/external |
| Nebenstränge und Antragsmodul, Fristenrechner | Recherche Z.60, Z.75 | Recht | nach HV 2027 | — |
| MAR-Insiderampel als Pflichtfeld, Ad-hoc-Pfad, Sperrthemen-Register | Recherche Z.90-102 | Recht | nach Beta | insiderRelevance (047), R-GUARD-07 |
| Ethical Wall mit verdecktem Bestand | Recherche Z.332 | Recht | nach Beta (ändert Nummernkreis und Zähler) | confidentiality protected |
| PDF/A mit Bates-Nummern, qualifizierter Zeitstempel, Web-Archivierung | Recherche Z.227, Z.278-286 | Recht, Notar | nach Beta | Hash-Liste und druckbares HTML (051/081) |
| Publikations-Workflow mit PII-Tor, Veröffentlichung nach der HV | Recherche Z.93, Z.121 | Projektleitung, Recht | nach HV 2027 | publicationVersion, Kennzeichen internal/external |
| Löschung und Krypto-Shredding ausführen | Recherche Z.124-125 | DSB, Schlüsselverwahrer | vor Produktion (Blocker 9.3) | retentionClass, legalHold, keyId, Codec-Port |
| Rollen Notar, Kanzlei, Revision, Versammlungsleitung; Gastzugänge Externer | Rechtekonzept 180-194; Recherche Z.451 | Projektleitung, Recht | nach Beta | Rolle = Tabellenzeile; observer deckt Lesezugang |
| KI-Anbieter, Wissensbasis, Golden Set | Recherche §6 | Projektleitung, Recht, DSB | nach Rechts- und Datenschutzfreigabe | Port answer-suggestions (066) |
| Aktienregister-Push-Adapter, Legitimation und Vollmachtsketten | Ist §6.4, Recherche Z.204 | Konzern-IT | nach Beta | Port RegistryLookup (067) |
| Rollen-Chat, Souffleur-Kanal | Recherche Z.253, Z.261 | Projektleitung | nach Beta | Notizfeld (046) |
| Deutsche Suchqualität, Cluster als Standardansicht | Recherche Z.304, Z.393 | Umsetzer | nach Beta | Klartextprojektion (055) |
| DE/EN-Kopplung der Antworttexte | Recherche Z.234 | Projektleitung | nach Beta | Feld language (048) |
| SAML, zweite Zone, zweiter Netzweg, externes Monitoring | Recherche Z.311-316 | Konzern-IT | vor Produktion | Auth-Port, ADR 0007 |
| Zustandsreform Haupt-/Unterzustand | ADR 0012 | Umsetzer | nach Beta | Kennzeichen statt Zustände |
| Simulationsmodus für Rechteänderungen (Wahrheitstabellen-Diff ohne Anwendung) | Gegenlese zu 077 | Umsetzer | nach Beta | Wahrheitstabellen-Generator |
| Zweiter Rechtsträger | Abschnitt 3 | Projektleitung | nach Beta | meetingId; Feld legalEntityId reserviert |
| E-Mail- oder Push-Benachrichtigungen | 085 | Umsetzer, Konzern-IT | nach Beta | NotificationRaised mit targetPermission |
| Eigener AR-Strang mit getrennter Freigabe | Recherche Z.449 | Projektleitung, Recht | nach Beta | Einheit AR-Büro und Attributregel (040/047) |
| Beschleunigte Rechtsfreigabe (verkürzte Prüfliste mit Pflichtgrund und Alarm, nie Umgehung) | E25 | Projektleitung, Recht | nur wenn E25 so entscheidet | Prüfliste je Pfad als Daten (059), LEGAL_GATE_BY_TRACK |
| Externer Pentest-Retest | Recherche Z.343 | Eigentümer, Konzern-Security | vor der Vollprobe | Scope aus 039, Befundstatus aus 074 |

## 6. Orchestrierung der Agenten

### 6.1 Rollen und Modelle je Scheibentyp

| Scheibentyp | Spec | Bau | Review (anderes Modell, nur Spec und Diff) | Zusätzlich |
|---|---|---|---|---|
| Kern und Rechte (core, Risikoklasse hoch) | Architekt Fable, Planer Opus | Implementierer-Backend Sonnet; Ausnahme 044 Verweigerung: Opus | Opus mit benannter Perspektive (Security, Datenschutz, Legal); bei Opus-Bau: Sonnet plus Stichprobe Fable | Wahrheitstabellen-Diff steht vor dem Bau in der Spec |
| Vertragspakete (contract) | Architekt Fable | Fable (019, 023, 043) oder Haiku (077) | Opus gegen Recherche und Rechtekonzept | Changelog-Tor, Allowlist mit Ablauf |
| Persistenz, Dienst, Infrastruktur | Planer Opus | Implementierer-Backend Sonnet | Opus mit Perspektive Betrieb/Security | Eigentümer führt privilegierte Checklisten aus |
| Oberfläche | Planer Opus | Implementierer-Oberfläche Sonnet | Opus | Design-Kritik Fable vor dem Review (Checkliste D1–D10, Screenshots DE/EN, Kontrastprobe); bei 056, deren Spec Fable schrieb, zusätzlich Opus mit der D-Checkliste |
| Mechanik (i18n, Konstanten, Datenpflege, Screenshots, Protokolle, Skripte) | Planer Opus oder Architekt | Mechaniker Haiku | Sonnet | Positivliste der Verzeichnisse |
| Dokumente, ADRs, Runbook, Drehbuch, Datenschutz-Paket | Architekt Fable | Fable (Text) + Sonnet (Generatoren) | Opus (Lesebefund) | Jede Anleitung wird einmal von einem fremden Modell befolgt |
| Bedrohungsmodell, Sicherheitsprüfung, Beta-Abnahme | — | Opus (Perspektive Security, nur Read) | Fable | Abnahme 079 sieht nur Kriterien und Repositorium |

Perspektiven (Security, Datenschutz, Legal, Betrieb) sind Checklisten im Spec und in reviewer.md, keine neuen Agentenrollen. Agentendefinitionen ab 016: architekt.md, planer.md, design-kritiker.md, reviewer.md, reviewer-sonnet.md, implementierer-backend.md, implementierer-oberflaeche.md, mechaniker.md. Jede Hoch-Spec und jede ADR bekommt vor dem Bau einen Opus-Lesebefund in frischem Kontext.

### 6.2 Bautag, Parallelität und Dateibesitz

Ein Bautag ist eine Orchestrierungssitzung, die der Umsetzer mit einem Satz startet („Bautag: nächste Scheiben nach Plan"). Der Orchestrator (Architekt, Fable) liest den Kalender aus `scripts/plan-graph.mjs`, schreibt oder prüft die Specs der nächsten Scheiben, startet bis zu drei Worktrees, lässt bauen, reviewen, nacharbeiten und mergt. Am Ende schreibt er den Tagesbericht (Abschnitt 6.7). Die Lanes contract und core sind seriell, weil die Wahrheitstabelle ein Snapshot ist; Vertragsänderungen bündelt der Architekt in 019, 023 und 043 vor den Implementierern. Das Scheibenumfang-Tor (016) macht Regel 1 mechanisch: PR-Dateien außerhalb „Files allowed" sind rot. Jede Scheibe schreibt ihre eigene e2e-Datei, ihr eigenes i18n-Modul (017) und ihre Zeile im Feature-Register (082). Zwischen-Pushes tragen `[skip netlify]`, damit nur freigegebene Stände die Demo neu bauen.

### 6.3 Review, Merge und Design-Kritik

- **Review.** Jede Scheibe bekommt nach dem ersten grünen Torlauf ein Review durch ein anderes Modell in frischem Kontext, das nur Spec und Diff sieht (Regel 3). Nacharbeit höchstens eine Runde; danach geht die Scheibe an den Planer zurück, weil meist die Spec falsch ist.
- **Merge.** Der Orchestrator mergt, wenn die Tore grün sind und das Review ohne offenen Blocker oder Hauptbefund endet (E48). Der Mensch mergt nicht je Scheibe. Rechte- und Übergangsänderungen stehen als Wahrheitstabellen-Diff im Tagesbericht; der Mensch kann jede Scheibe per Revert zurücknehmen.
- **Was nie ohne Mensch geht.** Deploy auf Staging-synthetisch und Übungsmandant (Regel 11), Herabstufung einer Risikoklasse (Zeile „Herabstufung freigegeben von <Umsetzer> am <Datum>", das Tor aus 016 blockiert sonst), Annahme eines ADR (Abschnitt 4), privilegierte Schritte (Secrets, Branch-Schutz, Konten).
- **Bündelung.** Niedrig-Scheiben derselben Lane dürfen gebündelt reviewt werden (Bautag-2-Muster); Hoch-Scheiben nie.
- **Design-Kritik.** Fable prüft vor jedem Review einer Oberflächenscheibe Screenshots DE/EN, Kontrast und D1–D10; Blocker gehen zurück an den Implementierer, nicht an den Reviewer.
- **Sicherheitsreview des Architekten.** An den Prüfpunkten 3, 4 und 7 liest Fable den Gesamtstand mit der Perspektive Security (Modus des Architekten nach docs/agentische-entwicklung-plan.md Abschnitt 3).
- **Rückkopplung.** Mehr als drei Hauptbefunde je Scheibe lösen eine Spec-Nachschärfung aus; eine Scheibe mit zwei Nacharbeitsrunden wird gestoppt und zum Architekten zurückgegeben.

### 6.4 Tore, die in CI hinzukommen (Scheibe in Klammern)

- dependency-cruiser, gitleaks, Semgrep mit kleinem Regelsatz, pnpm audit mit Ausnahmeliste und Ablauf, Rollenliteral-Scan über apps/api und packages/domain, now()-Check domain/api, Antwort-Schema-Validierung, CI-Pfadfilter, Plan-Ehrlichkeits-Tor (012).
- axe-core blockierend ab serious, Tastaturpfad je Kernszene (013).
- Zeitbudget p90 < 150 ms mit Ausweis gegen D9, CI-Job-Matrix mit Laufzeitbudget (084).
- Legal-Trace-Test und Regelregister-Diff (011).
- Vertrags-Changelog- und Versionstor, Allowlist mit Ablauf (019).
- Scheibenumfang-Tor, Herabstufungs-Tor, Plan-Graph-Prüfung, Stop-/SubagentStop-/PostToolUse-/erweiterter PreToolUse-Hook (016).
- i18n-Paritäts-Tor je Modul (017).
- Hash-Ketten-Prüfung, occurredAt-Quellen-Test, Reset-Banner-Test (024).
- Migrationstor vorwärts/rückwärts, Append-only-Test gegen Postgres, Rebuild-Zeit, /readyz mit DB (027).
- Zwei-Schreiber-, Claim-Ablauf- und Neustart-Idempotenz-Test (028).
- Identitäts-Negativtests mit Keycloak-Container, Demo-Verriegelung, Notfallkonten (029).
- Dual-Mode-e2e-Matrix (031).
- now()-Check web (032).
- Zugriffslog-Tor ohne Nutzdaten, Kennzahlen-Allowlist, Auswertungskatalog als Artefakt (033).
- Header- und Limit-Proben, Konfigurationsschema (034).
- Health-Smoke nach Deploy, Freeze-Regel, Approval-Environment, Testalarm (037).
- nightly Restore-Test (038).
- zweite Wahrheitstabelle Attribut × Aktion (047).
- Export-Snapshot und Notiz-Ausschluss (051, 081).
- Bündelgrößen-Tor und Offline-Test der Bühne (056, 058).
- nightly Last mit p90-Schwellen (071).
- Auswertungskatalog-Diff-Tor (073).
- SBOM, Signatur, Semgrep-Vollauf (074).
- Vertragsfreeze-Tor (077).
- Takt-Skript (014).

CI-Laufzeit: Push ≤ 12 min (Lint, Typen, Tests, In-Process-e2e mit axe), PR vollständig (plus Postgres-Service, Keycloak, Dual-Mode-e2e, Migrationstor; Ziel ≤ 25 min), nightly (Last, Restore, Semgrep-Vollauf); Pfadfilter für Doku-Commits; Laufzeit je Job wird ab 084 in docs/messung.md geführt.

### 6.5 Messung und Regelkreis

docs/messung.md wird je Scheibe fortgeführt (Rolle, Modell, Token, Wandzeit, Reviewrunden, Befunde, Tore) und um vier Tabellen ergänzt: Bautag (Scheiben, Subagenten-Token, Token der Kopfsitzung über `/cost`, Wandzeit), Takt (Nachrichtenzeit, Klasse, Live-Zeit), Budget je Meilenstein (Plan-AStd, Ist-AStd, Plan-Token, Ist-Token, Geld aus den Nutzungsberichten) und CI-Laufzeit je Job. Regelkreis:
- Eine Scheibe über 1,2 Mio. Token einschließlich Review und Nacharbeit oder über das Doppelte ihrer AStd wird gestoppt und vom Planer in zwei Specs geteilt.
- Überschreitet ein Meilenstein sein Token-Budget um 25 % oder erreicht der Geld-Deckel aus E47 seine Grenze, entscheidet der Mensch in der Entscheidungsstunde über die Streichreihenfolge (Abschnitt 8.6).
- Liegt der gemessene Tagesdurchsatz nach fünf Bautagen unter einer Scheibe je Bautag, rechnet 016 den Kalender neu, und Prüfpunkt 1 entscheidet über zusätzliche Bautage oder einen API-Schlüssel mit Budgetgrenze.
- Jeder Kopflauf hat `--max-budget-usd` und `maxTurns` (Entwicklungsplan 6).

### 6.6 Änderungstakt für Kleinänderungen

Ziel: S live am nächsten Bautag, M < 2 Bautage, L < 1 Woche nach Klärung. Ablauf: Nachricht der Projektleitung (Sprache oder Text) → am selben Tag Statustabelle mit Klasse → S als Mini-Spec im Worktree `takt`, Tore, Review, Merge durch den Orchestrator, Netlify-Build → Live-Zeit in docs/messung.md. Nachfragen an die Projektleitung als Sprachnachricht mit nummeriertem Screenshot. Erste Messung in 020, Nachweis in B16.

### 6.7 Wo der Mensch gebraucht wird

Die Arbeitszeit des Umsetzers ist in diesem Plan keine Planungsgröße; die folgende Liste sagt nur, wofür es einen Menschen braucht.
- **Bautag:** Sitzung starten; Tagesbericht lesen (gebaute und gemergte Scheiben, Wahrheitstabellen-Diffs, Befunde, Token, offene Fragen). Bei Einwand: Revert oder Stopp.
- **Deploy:** Go für Staging-synthetisch und Übungsmandant (Regel 11), gebündelt an Prüfpunkten oder auf Anfrage des Orchestrators.
- **Entscheidungsstunde (wöchentlich):** Registerantworten, Herabstufungen, Streichentscheidungen, Budget, Durchsatz.
- **Privilegiert (je Checkliste):** Branch-Schutz (W1), Secrets (vor 037), Restore-Drill (038), zwei Chaos-Szenarien (072), Keycloak-Konten (088), Generalprobe (W21–W23), Unterschrift Go/No-Go und Abnahme.
- **Projektleitung:** Fragenpaket beantworten (bis 09.10.), Feedback-Runden 2 (09.10.), 3 (11.12.) und 4 (22.01.2027, mit Podiumssitzung), Bestätigung des HV-Datums (02.10.), Benennung des technischen Betreibers (27.11.), Einladungen zur Generalprobe (11.12.).
- **Eigentümer gegenüber Dritten:** Betriebsrat/DSFA starten (25.09.), Rechtsprüfung beauftragen und Satzung/GO liefern (25.09./09.10.), Pentest-Beschaffung (ab 25.09., Bestellung spätestens 15.12.), Konzern-IT (IdP, Hosting, Geräte), Interimsvereinbarung oder Rückfall entscheiden (29.01.2027).

## 7. Nachweise, Prüfpunkte und Abnahme

Die Nachweise liegen in docs/evidence, docs/slices und docs/messung.md. Ein Prüfpunkt ist ein Termin, an dem der Umsetzer mit den genannten Personen die Nachweise ansieht, ADRs annimmt und Registerentscheidungen trifft; er ist kein Merge-Tor für einzelne Scheiben.

| Prüfpunkt | Datum | Stand laut Kalender | Nachweise | Entscheidungen |
|---|---|---|---|---|
| 0 Plan | 25.09.2026 | — | dieser Plan, Register-Rohfassung | Plan und Standardannahmen freigegeben; E23, E47, E48 |
| 1 Arbeitsordnung | 09.10.2026, mit Feedback-Runde 2 | M0 fertig | Wahrheitstabelle mit Leserechten; docs/legal-trace.md; CI-Lauf mit neuen Toren und ein absichtlicher Verstoß rot; Leitplanken-Diff; 14 ADR-Dateien; Register; Hook-Protokoll; plan-graph.mjs grün; gemessener Tagesdurchsatz der ersten Bautage | ADR 0001 (Umsetzer und Projektleitung, E42), Ergänzung 0002, 0015, 0016; Durchsatzannahme bestätigt oder Kalender neu gerechnet |
| 2 Rückbau und Passung | 16.10.2026 | M1 fertig | Screenshots DE/EN mit Feedback-Nummern; erste Takt-Zeilen; seed.test 28/230; R-SPK-Tests; Wahrheitstabellen-Diff 021; abnahme.spec grün; Changelog 0.2.0; Protokoll Feedback-Runde 2 | Antworten E1–E9 eingetragen oder „auf Standard gebaut"; Abnahmesatz durch die Projektleitung freigegeben |
| 3 Fundament | 13.11.2026 | M2 fertig | Migrationstor, Append-only-Test, Rebuild-Zeit, Restore-Drill-Protokoll, Identitäts-Negativtests mit Keycloak, Dual-Mode-e2e, Staging-URL mit /readyz, Pipeline-Protokoll mit Approval, Testalarm, Test „kein displayName in Ereignissen", Admin-Anleitung, Bedrohungsmodell v1 mit Pentest-Scope; Sicherheitsreview des Architekten | ADR 0003, 0004, 0007, 0010, 0011, 0014; Mensch verfolgt eine Anfrage Oberfläche → Vertrag → Domäne → Postgres |
| 4 Rechtlicher Kern | 20.11.2026 | M3 fertig | Tests je neuer Regel-ID (R-GUARD-06..10, R-TRANS-13..16, R-PROC, R-MTG-01..07); beide Wahrheitstabellen; Verweigerungsdialog- und Bühnen-Screenshots; Export-Gerüst und Exportereignis; Rechtekonzept-Diff; Übergabevermerk an Recht; Sicherheitsreview des Architekten | ADR 0009, 0012 (mit Recht), 0013; Übergabe der Zulieferungen an Betriebsrat und DSB |
| 5 Funktionsumfang | 11.12.2026, mit Feedback-Runde 3 | M4 und M5 fertig | Screenshots DE/EN neuer Ansichten; Offline-Playwright; Bündelgröße; Zeitbudget; axe 0 serious; Rollenkarten; Ingest-, Webhook-, Pseudonym-, Papierpfad- und Merge-Tests; Niederschrift-Anlage vollständig; Kanarienfrage-Protokoll; erster Last- und Chaos-Bericht; Übungs-HV nach Anleitung in unter zwei Stunden angelegt | ADR 0005, 0006, 0008; Inhalt der Anpassungsphase; Option Vorprobe (E49) |
| 6 Anpassung | 29.01.2027 | Anpassungsphase | Protokoll Feedback-Runde 4 mit Podiumssitzung; Registerstand; erneuter Last- und Chaos-Lauf; Datenschutz-Paket; Stand der Rechtsprüfung | E13 und E10b (Identitäten, Plattform des Übungsmandanten); Umfang bis Feature-Stopp; Streichentscheidungen |
| Feature-Stopp | 12.02.2027 | 077 | Tag beta-1-rc, Rechte-Snapshot, Freeze-Tor aktiv; Sicherheitsprüfung 074 mit Befundstatus | nur noch Fehlerbehebungen |
| 7 Go/No-Go | 05.03.2027 | Generalprobe | Generalprobe-Protokoll mit Login-Quote, Kanarienfrage, Failover, Partition, Papierpfad, Datenpanne; Löschprotokoll; Sicherheitsreview des Architekten | Go/No-Go-Liste unterschrieben |
| Abnahme | 12.03.2027 | 079 | Beta-Abnahmebericht mit 18 Zeilen; Opus-Abnahme in frischem Kontext; Tag beta-1 | Eigentümer unterschreibt die Abnahme |

Leitplanken 9.3 „Produktionsbereit" (Löschung ausgeführt, Krypto-Codec eingeschaltet, Pentest-Retest, Betriebsvereinbarung, zweite Zone) liegt außerhalb dieses Plans und steht als Restliste in docs/beta-abnahme.md.

## 8. Zeit- und Kostenrahmen

Der Plan rechnet in Agentenzeit. Der Kalender ergibt sich aus dem Abhängigkeitsgraphen der 80 Scheiben, den Lanes und den äußeren Terminen; er wird nicht von Hand geschätzt. Personentage kommen nicht vor.

### 8.1 Aufwand in Agentenstunden

Grundlage: eine Demo-Scheibe brauchte rund eine Stunde Wandzeit einschließlich Review und Nacharbeit (docs/messung.md). Beta-Scheiben sind mit dem Zwei- bis Dreifachen angesetzt: niedrig meist 1–1,5 AStd, mittel 1,5–2,5 AStd, hoch 2–3 AStd.

| Posten | AStd | Herleitung |
|---|---|---|
| Bau M0 | 16,5 | 10 Scheiben, 1 hoch |
| Bau M1 | 11 | 7 Scheiben, 2 hoch |
| Bau M2 | 42 | 22 Scheiben, 12 hoch |
| Bau M3 | 23 | 12 Scheiben, 4 hoch |
| Bau M4 | 24 | 11 Scheiben, 2 hoch |
| Bau M5 | 16,5 | 8 Scheiben, 3 hoch |
| Bau M6 | 20,5 | 10 Scheiben, 6 hoch |
| **Bau gesamt** | **153,5** | 80 Scheiben, 30 hoch; je Scheibe Spec, Bau, Review, eine Nacharbeitsrunde |
| Reserve für zweite Nacharbeitsrunden | 61 | 40 % auf den Bau (gemessen: 60 % an Bautag 1, 25 % an Bautag 2) |
| Anpassungsphase | 25 | Registerantworten und M-Punkte aus den Feedback-Runden 3 und 4 |
| Kleinänderungsspur | 33 | 1,5 AStd je Woche über 22 Wochen |
| Befunde aus Last, Chaos, Generalprobe, Pentest | 13 | 3 + 5 + 5 AStd |
| **Gesamt** | **rund 285 AStd** | Agentenzeit, verteilt auf bis zu drei parallele Worktrees |

### 8.2 Token und Geld

| Posten | Mio. Token | Herleitung |
|---|---|---|
| Scheiben M0 | 6,8 | 0,65 Mio. je Scheibe, 0,95 Mio. je Hoch-Scheibe, jeweils einschließlich Review und Nacharbeit (gemessener Median der Demo 0,65 Mio.) |
| Scheiben M1 | 5,2 | wie oben |
| Scheiben M2 | 17,9 | wie oben |
| Scheiben M3 | 9,0 | wie oben |
| Scheiben M4 | 7,8 | wie oben |
| Scheiben M5 | 6,1 | wie oben |
| Scheiben M6 | 8,3 | wie oben |
| Specs und Lesebefunde | 8 | 0,1 Mio. je Scheibe |
| Kopfsitzung des Orchestrators | 24 | geschätzt 0,3 Mio. je Bautag über rund 80 Bautage; wird ab Woche 1 über `/cost` gemessen |
| Anpassungsphase | 6,5 | rund zehn Scheiben-Äquivalente |
| Kleinänderungsspur | 6,6 | 0,3 Mio. je Woche |
| Befunde | 3,5 | Last, Chaos, Generalprobe, Pentest |
| **Gesamt** | **rund 110 Mio.** | Spanne 90–135 Mio. |

Die Obergrenze je Meilenstein ist sein Planwert; die Stoppregel greift bei 25 % darüber (Abschnitt 6.5). In der Bauphase bedeutet der Plan rund 2 Mio. Token je Bautag, also rund 10 Mio. je Woche. Ob die Nutzungsfenster des Abonnements das tragen, ist nicht belegt; in der Planung selbst sind dreimal Sitzungsgrenzen aufgetreten. Deshalb wird der Durchsatz in Woche 1 gemessen, und Prüfpunkt 1 entscheidet über einen API-Schlüssel mit Budgetgrenze für unbeaufsichtigte Läufe. Geld wird nicht geschätzt, sondern aus den Nutzungsberichten je Woche in docs/messung.md abgelesen; den Deckel setzt der Eigentümer an Prüfpunkt 0 (E47).

### 8.3 Kalender (Planungsannahme HV 15.04.2027; Registerzeile E20: Datum bis 02.10.2026 bestätigen)

**Rechenmodell.** Bautage Montag bis Freitag ohne 24.12.–01.01.; je Bautag drei Stunden Orchestrierung mit höchstens drei parallelen Worktrees und rund 1,5 Mio. Subagenten-Token; jede Abhängigkeit ist gemergt, bevor die nächste Scheibe beginnt; gleichzeitig laufende Scheiben teilen keine Lane. Äußere Termine setzen frühestmögliche Starts: Vertrag 0.4.0 nach Feedback-Runde 2 (ab 12.10.), Ingest nach der Ansprechperson des Tool-Teams (ab 19.10.), Restore-Drill, Last und Chaos erst mit Staging-Host (ab 02.11.), Sicherheitsprüfung im Pentest-Fenster (ab 01.02.), Rechtsprüfungs-Nachtrag nach der Rückmeldefrist (ab 01.02.), Freeze ab 08.02., Generalprobe 15.02.–05.03., Abnahme ab 08.03. `scripts/plan-graph.mjs` (016) rechnet den Kalender nach jeder Messung neu; die Kalenderfenster der Scheiben in Abschnitt 5 stammen aus diesem Modell.

**Drei Phasen.**
- **Bau (28.09.–04.12.2026).** Alle Bauscheiben; der Funktionsumfang steht am 02.12.2026.
- **Anpassung (07.12.2026–12.02.2027).** Registerantworten, Feedback-Runden 3 und 4, erneute Last- und Chaos-Läufe, Pentest, Rechtsprüfungs-Nachtrag, Freeze. Diese Phase ist der Puffer: Verzug im Bau verkürzt sie, nicht die Generalprobe.
- **Probe und Abnahme (15.02.–12.03.2027).** Drehbuch, Schulungen, technischer Drill, Generalprobe, Abnahme.

**Empfindlichkeit.** Der Feature-Stopp bleibt in allen gerechneten Fällen erreichbar.

| Annahme | Funktionsumfang gebaut | Folge |
|---|---|---|
| gemessene Demo-Geschwindigkeit (5 h Orchestrierung, 4 Mio. Token je Bautag) | 02.11.2026 (begrenzt durch den Staging-Host) | längere Anpassungsphase |
| Planannahme (3 h, 1,5 Mio. Token) | 02.12.2026 | wie unten |
| weniger Durchsatz (3 h, 1,0 Mio. Token) | 12.01.2027 | Feedback-Runde 3 rückt in den Januar |
| weniger Durchsatz und doppelte Dauer je Scheibe | 19.01.2027 | Anpassungsphase schrumpft auf drei Wochen; Streichreihenfolge (8.6) wird vorbereitet |

**Wochenübersicht.**

| Woche | Zeitraum | Phase | Scheiben (neu begonnene fett) | Termine |
|---|---|---|---|---|
| 0 | 23.–25.09.2026 | Vorlauf | — | **Prüfpunkt 0**: Plan und Standardannahmen freigegeben; Anfragen der Woche 0 (Abschnitt 11) |
| 1 | 28.09.–02.10. | Bau | **009**, **017**, **012**, **014**, **015**, **016**, **018**, **019**, **013**, **020** | Fragenpaket an die Projektleitung (02.10.); HV-Datum und Format bestätigt (02.10., E20) |
| 2 | 05.10.–09.10. | Bau | **039**, **082**, **010**, **011**, **080**, **021** | **Prüfpunkt 1** mit Feedback-Runde 2 (09.10.); Satzung und Geschäftsordnung bis 09.10. |
| 3 | 12.10.–16.10. | Bau | **022**, **084**, **023**, **024**, **025**, **026** | **Prüfpunkt 2** (16.10.); Entscheidungsstunde; Ansprechperson Tool-Team (E3a) bis 16.10. |
| 4 | 19.10.–23.10. | Bau | **027**, **028**, **029**, **030**, **031**, **043** | Vertrag 0.4.0 (043) |
| 5 | 26.10.–30.10. | Bau | **033**, **032**, **034**, **035**, **046**, **036**, **085**, **037** | Rückfalltrigger Hosting (30.10., E10); erster Deploy auf Staging-synthetisch |
| 6 | 02.11.–06.11. | Bau | **038**, **040**, **041**, **042**, **048**, **088**, **044** | Restore-Drill auf Staging (038) |
| 7 | 09.11.–13.11. | Bau | **045**, **050**, **047**, **051**, **083**, **049**, **052**, **053** | **Prüfpunkt 3** (13.11.); DSFA-Vorentwurf beim DSB (13.11., E14); Rechtekonzept und Regelregister an Recht (052) |
| 8 | 16.11.–20.11. | Bau | **054**, **061**, **087**, **055**, **060**, **056**, **057**, **066** | **Prüfpunkt 4** (20.11.); Zulieferungen an Betriebsrat und DSB übergeben (083) |
| 9 | 23.11.–27.11. | Bau | **058**, **059**, **070**, **062**, **068**, **064**, **065** | IdP-Client, technischer Betreiber, Geräteantwort bis 27.11. (E11, E26, E33) |
| 10 | 30.11.–04.12. | Bau | **067**, **069**, **081**, **071**, **086**, **072**, **073** | Funktionsumfang gebaut (02.12.); erster Last- und Chaos-Lauf auf Staging |
| 11 | 07.12.–11.12. | Anpassung | **075**, **063** · Anpassungen und Kleinänderungen | **Prüfpunkt 5** mit Feedback-Runde 3 auf Staging (11.12.); Einladungen zur Generalprobe versandt (11.12.) |
| 12 | 14.12.–18.12. | Anpassung | Anpassungen und Kleinänderungen | Pentest spätestens bestellt (15.12., E32) |
| 13 | 21.12.–23.12. | Anpassung | Anpassungen und Kleinänderungen | drei Arbeitstage |
| 14 | 28.12.–01.01. | Anpassung | — | Feiertagspause 24.12.–01.01. |
| 15 | 04.01.–08.01.2027 | Anpassung | Anpassungen und Kleinänderungen |  |
| 16 | 11.01.–15.01. | Anpassung | Anpassungen und Kleinänderungen | IdP-Rückfall entschieden (15.01., E11); Rückmeldung Recht erbeten bis 15.01.; optionale Vorprobe (E49) |
| 17 | 18.01.–22.01. | Anpassung | Anpassungen und Kleinänderungen | Feedback-Runde 4 mit Podiumssitzung (22.01.); Chaos-Katalog erneut |
| 18 | 25.01.–29.01. | Anpassung | Anpassungen und Kleinänderungen | **Prüfpunkt 6** (29.01.); E13 und E10b; Rückmeldefrist Recht (29.01.) |
| 19 | 01.02.–05.02. | Anpassung | **074**, **076** · Anpassungen und Kleinänderungen | Pentest-Fenster ab 01.02.; Support-Rota besetzt (05.02.); Eskalation Recht (05.02.) |
| 20 | 08.02.–12.02. | Anpassung | **077** · Anpassungen und Kleinänderungen | **Feature-Stopp 12.02.2027**; Tag beta-1-rc; Pentest-Fenster endet |
| 21 | 15.02.–19.02. | Probe und Abnahme | **078** | Drehbuch, Schulungen je Rolle; Einberufungspassagen von Recht bis 14.02. |
| 22 | 22.02.–26.02. | Probe und Abnahme | 078 | Technischer Drill auf Staging-synthetisch |
| 23 | 01.03.–05.03. | Probe und Abnahme | 078 | **Generalprobe** mit Konzernteilnehmern; **Prüfpunkt 7** Go/No-Go (05.03.) |
| 24 | 08.03.–12.03. | Probe und Abnahme | **079** | Beta-Abnahme; **Tag beta-1 (12.03.2027)** |

Nach dem Tag beta-1 liegen bis zur HV fünf Wochen außerhalb dieses Plans: Konfigurationsfreeze T-30 (16.03.), technische Probe T-28 (18.03.) bei Befunden, Pentest-Retest, Vollprobe T-10..T-7 (05.–08.04.), Login-Check T-5..T-3. Wer diese Wochen verantwortet, steht als Registerzeile E45.

### 8.4 Betriebsrat-Vorlauf und Generalprobe-Fenster

Neun bis zwölf Monate ab 25.09.2026 enden zwischen Juni und September 2027, also nach der HV. Deshalb schneidet die Beta die Software BV-verträglich (zwei Protokollebenen, 30 Tage Zugriffslog, Auswertung nur zu zweit, keine Kennzahl je Person als Tor, generierter Auswertungskatalog, Pilotmodus shadow). Die Zulieferungen an Betriebsrat und DSB (083) sind Mitte November fertig und werden spätestens am 18.12. übergeben. Geplanter Weg für die Generalprobe sind gepoolte Stationsidentitäten ohne Personenbezug (erfassung-03, recht-01), 30 Tage Zugriffslog und Löschung nach der Probe; eine Interimsvereinbarung bis 29.01.2027 ist eine Chance, kein Planpfad. Im Rückfall gelten B1, B6, B9 und B15 nur mit der Einschränkung aus B18. Die DSFA ist ein Torartefakt: Vorentwurf aus 014 bis 13.11. beim DSB (bevor Staging eine Personenidentität trägt; IdP-Subjects sind personenbezogen, auch bei synthetischen Fragen), Endfassung aus 083 und 073. Das Generalprobe-Fenster liegt bei 01.–05.03.2027 mit dem technischen Drill in der Woche davor und der Abnahme danach.

### 8.5 Menschliche Berührungspunkte

Die Arbeitszeit des Umsetzers begrenzt den Kalender nicht; Abschnitt 6.7 nennt, wofür es einen Menschen braucht. Zwei Ausnahmen haben feste Tage: der technische Drill (W22, rund 4 h) und die Generalprobe selbst (W23, ein voller Tag) brauchen den Umsetzer ganztägig und eine zweite Person als technischen Betreiber (E26). Die Anfragen an Konzern-IT, Betriebsrat, DSB, Recht und Pentest-Dienstleister brauchen Laufzeit bei Dritten; deshalb liegen sie in Woche 0.

### 8.6 Was bei Verzug zuerst gestrichen wird

Verzug entsteht hier vor allem aus zwei Quellen: Nutzungsgrenzen der Modelle und Scheiben, die länger brauchen als geplant. Erst schrumpft die Anpassungsphase; reicht das nicht, gilt diese feste Reihenfolge, damit die Entscheidungsstunde nicht neu verhandelt. Jede Zeile hat einen Nach-Beta-Pfad im Register.

1. 066 KI-Port (Port bleibt als Vertrag).
2. 065 Webhooks und Sandbox (Ereignisstrom über SSE bleibt).
3. 068 nur der Vorabfragen-Anteil (Papierpfad bleibt, er wird in der Generalprobe geübt).
4. 069 Dublettenvorschlag (Zusammenführen bleibt).
5. 057 Antwortbündel (die Bühne je Gerät funktioniert ohne; E2 vermerkt dann „Podium blättert ohne Bündel").
6. 060 Präsenz und Merge-Ansicht (Entwurfspuffer für B9 bleibt).
7. 062 Onboarding und Kontexthilfe (Login-Check bleibt).
8. 055 Editor auf Klartext mit Absätzen (Normalisierung und Renderer bleiben).
9. 041 Admin-Oberfläche durch ein Seed-Skript für die Probe ersetzen.
10. 067 Aktienregister-Port (Pseudonymanzeige aus 026 bleibt).

Nie gestrichen werden: Audit-Befunde, Persistenz, Identität mit Notfallkonten, Rechtstor, Vier-Augen, Verweigerung, Restanten-Feststellung, Bühne je Gerät mit Offline-Lesepuffer, Niederschrift-Anlage, Runbook, Lasttest, Kanarienfrage, Keycloak-Betrieb für die Probe, Zulieferungen an Betriebsrat und DSB, Generalprobe. Reicht auch die Streichliste nicht, verschiebt der Eigentümer die Generalprobe auf die technische Probe T-28 (18.03.2027); das steht als Rückfall in E45. Der Feature-Stopp 12.02.2027 ist fest.

## 9. Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Nutzungsfenster der Modelle tragen den geplanten Durchsatz nicht (in der Planung dreimal Sitzungsgrenzen) | Durchsatz in Woche 1 messen; Prüfpunkt 1 entscheidet über einen API-Schlüssel mit Budgetgrenze für unbeaufsichtigte Läufe (E47); Last über die Woche verteilen; Kalender mit plan-graph.mjs neu rechnen; Anpassungsphase als Puffer; bei halbem Durchsatz bleibt der Feature-Stopp erreichbar (8.3) |
| Agenten bauen schnell, aber falsch: Merges ohne Menschen lassen Fehler in Rechte- oder Rechtslogik durch | Unabhängiges Review mit Perspektive je Scheibe (Regel 3); Wahrheitstabellen-Diff im Tagesbericht; Revert jederzeit; Sicherheitsreview des Architekten an den Prüfpunkten 3, 4 und 7; kein Deploy ohne Go des Menschen (Regel 11); 044 mit Opus-Bau, Sonnet-Review und Fable-Stichprobe |
| Betriebsrat und DSFA (9–12 Monate) sind vor April 2027 nicht abschließbar; eine Generalprobe mit echten Anmeldungen zeichnet auf, wer was tat | Start 25.09.; DSFA-Vorentwurf beim DSB bis 13.11.; Zulieferungen 083 Mitte November; Staging nur mit Testidentitäten; zwei Protokollebenen, Auswertung zu zweit, keine Kennzahl je Person (Tor); Pilotmodus shadow; geplanter Weg gepoolte Stationsidentitäten mit Löschung (Entscheidung 29.01.2027) |
| Lesepfade ohne Rechteprüfung und X-Actor-Vertrauen erreichen eine Umgebung mit echten Anmeldungen | 010 ist die erste Kernscheibe und Voraussetzung von 029/030; Negativtests je Recht; Staging nie ohne OIDC erreichbar; HV_DEMO=1 mit Issuer verweigert den Start |
| Persistenz-Entscheidungen, die sich nicht nachrüsten lassen (Hash-Kette, Jahrgang, Personentabelle, PII-Umschlag, zwei Zeiten, Legal Hold) | 024, 025, 026 vor 027; Beta-Bestand bis 027 wegwerfbar; keyId ab dem ersten Ereignis; Umkodieren nur als Export in eine neue Datenbank |
| Zustandsautomat wächst über 15 Zustände | ADR 0012: Verweigerung als Antwortart, Nebenaspekte als Kennzeichen mit Regel-ID, fünf Anzeigegruppen; neuer Zustand nur mit ADR |
| Antworten der Projektleitung und des Registers kommen spät oder ändern sich; weil früh gebaut wird, entsteht mehr „auf Standard gebaut" | Standardannahme und Änderungspreis je Frage (Abschnitt 3); Antworten verändern Tabelle, Enum, Konfiguration oder Adapter; die Anpassungsphase ist für genau diese Änderungen reserviert; Vermerk „auf Standard gebaut" mit Datum |
| Konzern-IdP, Hosting-Konto, Endgeräte und Netzzugang der Podiumsgeräte kommen spät | Keycloak und gemieteter Container-Host (Rückfalltrigger 30.10., nur Testidentitäten bis zur AVV); IdP-Rückfall 15.01. mit Keycloak-Realm und Konten aus 088; Notfallkonten bei IdP-Ausfall; Podium-Netz: Rückfallkette Gast-WLAN/Hotspot → Offline-Lesepuffer (058) und gedruckter Katalog (051/070) → Papier; Anfragen in Woche 0 |
| Normzitate bleiben ungeprüft und werden als geprüft wahrgenommen; Grundkatalog falsch | verified:false als Pflichtstandard mit sichtbarer Markierung; Katalog als Daten; Regelregister Anfang Oktober und Rechtekonzept Mitte November bei Recht; Rückmeldung erbeten bis 15.01., Frist 29.01., Eskalation 05.02.; Generalprobe mit synthetischen Fragen; 076 trägt ein, was vorliegt, und blockiert nichts |
| Recht hat in der HV zu wenig Kapazität, weil jede Frage vor die Bühne durch die Rechtsfreigabe muss | Wer `question.legal.clear` hält, ist eine Rollenzuordnung (z. B. Fast-Track-Mitglieder); Prüflistentiefe je Pfad als Daten; Kennzahl „Fragen in Rechtsfreigabe > 10 min" im Leitstand als Go/No-Go-Schwelle; Rechnung in E37 |
| Tor-Inventar überzeichnet erneut | Plan-Ehrlichkeits-Tor (012); Spalte „geplant in Scheibe"; Reviewer-Checkliste prüft gates.yml; finaler Abgleich in 079; Branch-Schutz verhindert rote Merges |
| Vertragsbrüche brechen e2e, Seed und Demo mehrfach | Drei gebündelte Vertragspakete vom Architekten (019, 023, 043) plus 0.3.1 in 028; neue Pflichtfelder erst optional mit Ablauf; eine Korpusquelle; Alias /v1/meeting; Changelog-Tor; generierter Client; Allowlist mit Ablauf; Freeze in 077 |
| Zwei Betriebsarten driften auseinander; die Demo zeigt Verhalten, das der Dienst nicht hat | Ein HvApi-Interface; Dual-Mode-e2e als Tor (031); Demo bleibt Taktfläche bis beta-1, Staging Abnahmefläche; Reset-Banner statt Upcaster (ADR 0002) |
| Podium-Ausfall (weißer Bildschirm) in der Generalprobe | Offline-Lesepuffer mit Absichtswarteschlange (058), Test auf realer Geräteklasse, Einfrieren beim Öffnen (056), eigenes Bundle mit Größentor, gedruckter Katalog und Papierpfad (070), Chaos-Szenario Partition (072) |
| Corporate-Browser-Richtlinie löscht oder blockiert localStorage/IndexedDB auf den Podiumsgeräten | Registerzeile E33 in Woche 0 angefragt; 058 prüft auf dem realen Gerät, sobald E33 beantwortet ist; Geräteeinstellungen sind reine Bequemlichkeit, „Vorgelesen" bestätigt der Dienst |
| CI-Laufzeit wächst mit Postgres, Keycloak, Dual-Mode-e2e, axe, Semgrep, Last und bremst die Bautage | Laufzeitbudget und Job-Matrix (084): Push ≤ 12 min, PR ≤ 25 min, nightly für Last/Restore/Semgrep-Vollauf; Pfadfilter; Laufzeit je Job in docs/messung.md |
| Lasttest offenbart Vollabrufe bei 50 Nutzern | SSE mit inkrementellem Client (035/036) vor den neuen Ansichten; erster Lasttest Anfang Dezember, dann nightly; Zeitbudget-Tor; Paginierung der Historie |
| Vier-Augen-Guard blockiert Freigaben, wenn die einzige Freigeberin selbst entworfen hat oder auf dem Podium sitzt | Zwei benannte Vertretungen je Rolle (040); Registerzeile E25 in Feedback-Runde 2; kein Eilpfad an der Freigabe vorbei |
| Pentest findet Hohes nach dem Feature-Stopp | Bedrohungsmodell v1 mit Scope früh (039); Beschaffung ab Woche 0, Bestellung spätestens 15.12.; Fenster 01.–12.02. auf Staging mit OIDC; Remediation als Hoch-Scheiben (Budget 5 AStd); ohne externen Pentest interner ZAP-Lauf, externer Test vor der Vollprobe |
| Scheibe 008 wird unkonsolidiert gemergt und bringt eine zweite Arbeitsordnung | 009 zuerst; AGENTS.md bleibt einzige Arbeitsordnung; die Leitplanken liefern Risikoklassen und Nachweisanforderungen |
| Scope-Druck aus 279 MUSS-Items | B-Liste mit Eigentümern (5.10); Nicht-Ziele je Spec; Streichreihenfolge (8.6); Feature-Stopp 12.02.2027 fest; Regelkreis über Token-Budget |
| HV-Format ist virtuell oder hybrid statt Präsenz | Profilfeld `format` ab 023; hybrid: 068 rückt vor; virtuell: M4/M5 werden neu geschnitten; Bestätigung bis 02.10. (E20) |

## 10. Offene Entscheidungen mit Standardannahme

Vollständiges Register in docs/entscheidungsregister.md (Scheibe 014) mit Spalten Eigentümer, Fällig, Rückfalltrigger, Kosten bei Änderung, betroffene Scheibe und Vermerk „auf Standard gebaut am". Hier die Zeilen, die eine Person außerhalb der Umsetzung entscheiden muss; die strukturellen Standardannahmen mit Änderungskosten stehen in Abschnitt 3. Weil die Agenten früh bauen, nennt die Spalte „Standard gebaut ab" den Tag, ab dem der Standard im Code steht; eine spätere Antwort löst die genannten Kosten aus und läuft in der Anpassungsphase. Kosten in Agentenstunden (AStd).

| Nr. | Entscheidung | Standardannahme | Standard gebaut ab · Kosten danach | Entscheider | Frage an die Projektleitung |
|---|---|---|---|---|---|
| E1 | Name und Zuschnitt der Koordinationsrolle (Frage 2) | Schlüssel coordination, Anzeige „Koordination"; capture verliert classify/assign | 021 (09.10.2026); Umbenennung < 1 h, Zuordnung zu bestehender Rolle 0,5 AStd | Projektleitung | Welche Rolle oder Person entscheidet Pfad, Bühnenplatz und Zuweisung, und wie heißt sie im Haus? |
| E2 | Zusammenstellung der Antwortrunde (Frage 3) | Antwortbündel getrennt von der bestehenden Runde; manuell durch Koordination, Zielgröße 20, Reihenfolge Bühnenplatz dann Nummer | 043 (23.10.2026, Vertragsform), 057 (20.11.2026, Verhalten); neue Strategie < 1 AStd, Bündel als Filter auf die bestehende Runde 1 AStd | Projektleitung | Wer stellt die rund 20 Antworten zusammen, nach welcher Regel, gibt es eine feste Reihenfolge je Vorstandsmitglied, und ist das dieselbe Runde wie die heutige Beantwortungs-Runde? |
| E3a | Vertragsform der Transkript-Segmente | segmentId, text, startedAt, endedAt, speakerId optional, source | 043 (23.10.2026); Formänderung ein Vertragszyklus, 1 AStd plus Allowlist | Tool-Team, Projektleitung | Welche Felder liefert das Tool je Segment? Ansprechperson bis 16.10. |
| E3b | Adapter des Transkriptionstools (Frage 4) | Datei-/Zwischenablage-Import im Browser mit der Sitzung der erfassenden Person | 064 (26.11.2026); Push-Adapter 1,5–3 AStd | Projektleitung, Tool-Team | Wie heißt das Tool, wie kommen Texte heraus (Schnittstelle, Datei, Kopieren), erkennt es die sprechende Person? |
| E4 | Notiz-/Rückfragefeld je Frage (Frage 5) | Feld im Vertrag, Konfiguration notes=off | 046 (28.10.2026); Einschalten Konfiguration | Projektleitung | Soll es je Frage ein Notiz- oder Rückfragefeld geben, das Teams ersetzt, oder bleibt das bewusst außerhalb (auch aus Mitbestimmungsgründen)? |
| E5 | Bedeutung „Weiterleiten" (Frage 6) | Anzeige „Weiterleiten" für den nächsten Schritt (020) plus Weiterleiten an eine andere Einheit (048); Ereignisnamen unverändert | 020 (02.10.2026, nur Anzeige), 048 (05.11.2026); Zeile entfernen 0,5 AStd | Projektleitung | Nur zum nächsten Schritt oder auch an eine Kollegin oder einen anderen Fachbereich? |
| E6 | Formatierungsumfang (Frage 7) | Absatz, Liste, fett, kursiv, Hervorhebung; keine Schriftwahl | 043 (23.10.2026), 055 (18.11.2026); Marke ergänzen < 1 AStd, entfernen über Renderer-Whitelist | Projektleitung | Reichen fett, kursiv, Hervorhebung und Aufzählung? Ist Schriftwahl bewusst nicht gewünscht, weil das Hausformat gilt? |
| E7 | Podium sieht nur eigene Fragen (Frage 8) | podiumVisibility=own als Meeting-Konfiguration; Bühnenplätze je Jahrgang | 047 (10.11.2026); Standardwert Minuten, Rechtseinschränkung eine Tabellenzeile | Projektleitung, Vorstand | Sieht ein Vorstandsmitglied nur seine eigenen Fragen oder alle mit Markierung der eigenen? |
| E8 | Rollenzuweisung UI oder IdP-Gruppen (Frage 9) | Tabelle im Tool mit optionaler Einheit, IdP-Gruppen als Vorschlag | 026 (16.10.2026); Sync-Adapter < 1,5 AStd | Konzern-IT, Projektleitung | Wie ist die angekündigte Aufteilung der bis zu 50 Personen, und gibt es Gruppen im IdP, die als Vorschlag dienen können? |
| E9 | „Button Daten" (Frage 1) | Wird mit dem nummerierten Screenshot geklärt | — | Projektleitung | Welcher Knopf ist gemeint? (Screenshot mit Nummern liegt bei) |
| E10 | Hosting-Plattform | Container plus managed Postgres, souveräne Cloud nach Telekom-Standard; Staging-synthetisch auf gemietetem Host als Rückfall | Anfrage 25.09.; Rückfalltrigger 30.10.2026 (Host, Kontoinhaber Umsetzer, Monatskosten im Register) | Eigentümer, Konzern-IT | Wer ist der Ansprechpartner der Konzern-IT für Hosting, Postgres, AVV? |
| E10b | Plattform des Übungsmandanten | Dieselbe Plattform wie Staging; Rückfall gemieteter Host plus Keycloak-Realm mit gepoolten Stationsidentitäten, AVV vom Umsetzer, DSB informiert | 29.01.2027 gemeinsam mit E13 | Eigentümer, DSB | — |
| E11 | Identity Provider | Konzern-OIDC über BFF; Keycloak als Stand-in; Notfallkonten | Client bis 27.11.; Rückfall 15.01.2027 (Keycloak-Realm und Konten aus 088) | Konzern-IT | Welcher IdP, welcher Client-Typ, wer registriert den Client, gibt es Gastkonten für Externe? |
| E12 | Pilotmodus | Schattenbetrieb in der Generalprobe | 042 (04.11.2026); Konfiguration | Projektleitung | Bestätigung: die Beta läuft in der Generalprobe im Schatten, das bisherige Verfahren bleibt führend? |
| E13 | Mitbestimmung: Betriebsrat-Prozess und Identitäten in der Probe | Start 25.09.; gepoolte Stationsidentitäten als geplanter Weg; Interimsvereinbarung bis 29.01.2027 als Chance | 29.01.2027 | Eigentümer, HR, Betriebsrat | Welches Gremium ist zuständig, gibt es eine IT-Rahmen-BV, und wer trägt die Interimsanfrage? |
| E14 | DSFA als Vorbedingung für Personenidentitäten auf Staging | Vorentwurf aus 014, DSB-Review bis 13.11.; bis dahin nur Testidentitäten | 13.11.2026 | Eigentümer, DSB | Wer ist der DSB, und nimmt er den Vorentwurf bis 13.11. an? |
| E15 | Legal-Verifikation: Normzitate und Verweigerungskatalog | Alles verified:false mit Markierung „ungeprüft"; Satzung/GO bis 09.10.; Einberufungspassagen bis 14.02. | Rückmeldung erbeten 15.01., Frist 29.01., Eskalation 05.02.2027; 076 trägt ein, was vorliegt | Eigentümer, Recht | Wer in Recht prüft die Zitate und den Katalog, bis wann, und liefert Satzung und GO in aktueller Fassung? |
| E16 | Aufbewahrung, Löschung, Krypto-Shredding, Schlüsselverwahrer | Klassen und Legal Hold als Attribute, keyId ab erstem Ereignis, Identitäts-Codec, keine Löschung in der Beta | vor Produktion (Blocker 9.3); Verwahrer in 073 benannt | Recht, DSB | Wer verwahrt die Jahrgangsschlüssel, und welche Aufbewahrungsfristen gelten je Klasse? |
| E17 | Vertraulichkeitsstufen und geschützte Fragen | internal, restricted, protected; setzen legal, approver, admin; lesen protected legal, approver, admin und Fachkräfte der zugewiesenen Einheit; Podium ab staged | 047 (10.11.2026); Stufe ergänzen Enum plus Tabellenzeilen | Recht | Reichen drei Stufen, und wer darf „protected" setzen und lesen? |
| E18 | KI-Funktionen und Anbieter | Keine in der Beta; Port mit Adapter none | Nach-Beta | Projektleitung, Recht, DSB | Welche KI-Funktionen sind gewünscht, welche Anbieter kommen in Frage, welche Vertragsbedingungen gelten? |
| E19 | Notarzugang und Übergabeformat | Export (HTML, JSON) durch Inhaber von export.dossier; kein Notar-Login | 051 (11.11.2026); Rolle notar als Tabellenzeile | Recht, Notar | Reicht dem Notar die gedruckte und die JSON-Anlage, oder braucht er einen lesenden Arbeitsplatz? |
| E20 | HV-Datum und Formatprofil | Planungsannahme 15.04.2027, Präsenz; Profilfeld format ab 023 | 02.10.2026; hybrid: 068 rückt vor (+2,5 AStd); virtuell: M4/M5 neu schneiden | Projektleitung | Bestätigung von Datum und Format der HV 2027? |
| E21 | Antwortformat DE/EN-Kopplung, Inhaltssprache | Feld language reserviert (de), keine Kopplung | Nach-Beta | Projektleitung | Werden Antworten zweisprachig freigegeben, und wenn ja, gekoppelt? |
| E22 | RPO/RTO/SLO | RPO 0, RTO 15 min, p90 < 300 ms im Probefenster | 038 (02.11.2026) | Eigentümer | — |
| E23 | Umgang mit Scheibe 008 und dem Codex-Branch | Konsolidiert übernehmen (009), Branch danach löschen | 25.09.2026 | Eigentümer | — |
| E24 | Rollen Notar, Kanzlei, Revision, Versammlungsleitung; Gastzugänge | Nicht in der Beta; observer/legal decken Lesezugang; keine Gastkonten | 052 (13.11.2026); Rolle = Tabellenzeile | Projektleitung, Recht | Braucht eine externe Kanzlei in der Probe einen Live-Zugang? |
| E25 | Letztverantwortung Freigabe, Vertretungen, Rechtstor | approver gibt frei, legal empfiehlt; zwei Vertretungen; Rechtstor für jeden Pfad über LEGAL_GATE_BY_TRACK; kein Eilpfad. Offene Option: beschleunigte Rechtsfreigabe mit verkürzter Prüfliste, Pflichtgrund und Alarm, nie Umgehung | 021 (09.10.2026); Tabellenzeilen 0,5 AStd | Projektleitung, Vorstand, Recht | Wer trägt formal die Letztfreigabe, wer vertritt, und was gilt, wenn die Freigeberin auf dem Podium sitzt? |
| E26 | Product Owner, fachlicher und technischer Betreiber während der Probe | Umsetzer plus eine benannte Konzern-IT-Kontaktperson; Beobachterin je Probestunde nach Runbook | 27.11.2026 | Projektleitung | Wer ist während der achtstündigen Generalprobe technischer Ansprechpartner neben dem Umsetzer? |
| E27 | Datenbanktopologie und Hochverfügbarkeit | Eine managed Postgres mit PITR, keine zweite Zone in der Beta | 027 (19.10.2026) | Eigentümer, Konzern-IT | — |
| E28 | Legitimation, Aktien- und Teilnehmermodell | Manuelle Aufnahme der Wortmeldung durch das Versammlungsbüro; kein Registerabgleich in der Beta | B-Liste | Projektleitung | Wie legitimiert das Versammlungsbüro heute die Wortmeldung, und soll das Tool das abbilden? |
| E29 | Veröffentlichungsumfang und tatsächlich gegebene Antwort | Keine Veröffentlichung in der Beta; Soll-Ist als Vermerk an der Vorgelesen-Entität | 049 (12.11.2026) | Projektleitung, Recht | Werden Antworten nach der HV veröffentlicht, mit oder ohne Namen? |
| E30 | Zurückstellen und Korrektur nach dem Vorlesen | Kennzeichen mit Pflichtgrund; Korrektur über neue freigegebene Version und erneutes Vorlesen; Frist aus VotingOpened des TOP | 046 (28.10.2026) | Recht | Wer darf eine Korrektur nach dem Vorlesen anstoßen, und bis wann muss sie auf der Bühne sein? |
| E31 | Ist-Analyse-Fragen 1–4, 6, 8, 9 (Verfahren, Zuständigkeiten, Volumen je Kanal, Werkzeuge) | Standardannahmen je Frage im Register | Fragenpaket 02.10.; Antworten Feedback-Runde 2 | Projektleitung | Je eine Einsatz-Frage, in einem Satz beantwortbar |
| E32 | Pentest | Extern, Scope aus 039, Beschaffung ab 25.09., Bestellung spätestens 15.12.2026, Durchführung 01.–12.02.2027 auf Staging mit OIDC; ohne externen Test interner ZAP-Lauf, externer Test vor der Vollprobe | 15.12.2026 | Eigentümer, Konzern-Security | Wer bestellt und bezahlt den Pentest, und gibt es einen Rahmenvertrag? |
| E33 | Endgeräte und Browser-Richtlinie (Podium, Erfassung, Externe) | Tablet oder Laptop je Podiumsmitglied im Kiosk-Modus, Chromium-basiert, localStorage/IndexedDB nicht gelöscht, Hallen-WLAN plus Hotspot-Rückfall | Anfrage 25.09.; Antwort bis 27.11.; 058 (23.11.2026) baut auf Standard, Test auf realer Klasse danach in der Anpassungsphase | Konzern-IT, Projektleitung | Welche Geräte nutzen die Podiumsmitglieder, welcher Browser, welche Speicher- und MDM-Richtlinie, welches Netz im Saal? |
| E34 | Formales Kriterium für „Beta abgenommen" | B1–B18 mit Nachweisen; Einschränkungen nur mit Registerzeile | 079 (08.03.2027) | Eigentümer | Wer unterschreibt Go/No-Go und Abnahme? |
| E35 | Taktfläche nach Umstellung auf HTTP | Netlify-Demo bleibt Taktfläche bis beta-1; Staging-synthetisch mit dem nächsten freigegebenen Deploy | 031 (23.10.2026) | Umsetzer | — |
| E36 | Personenzuweisung von Einzelfragen (Person statt Fachbereich) | Zuweisung an Fachbereich; Person nur über Claim (weiche Sperre) sichtbar; keine automatisierte Personenzuweisung (BV) | 028 (20.10.2026) | Projektleitung, Betriebsrat | Sollen Einzelfragen einzelnen Personen zugewiesen werden, oder bleibt die Zuweisung beim Fachbereich mit sichtbarer Übernahme? |
| E37 | Freigabetiefe je Pfad und Kapazität Recht | Rechtsfreigabe für jede Frage; Kapazität über die Zahl der Inhaber von question.legal.clear und die Prüflistentiefe je Pfad; Rechnung: rund 200 Fragen in 8 h, bei 3 Minuten je Freigabe rund 10 Personenstunden Recht in der HV, also mindestens zwei bis drei Freigebende parallel; Go/No-Go-Schwelle „Fragen in Rechtsfreigabe > 10 min" | 021 (09.10.2026), 059 (24.11.2026); Prüfliste und Rollenzuordnung sind Daten | Recht, Projektleitung | Wie viele Personen aus Recht und Fast-Track dürfen in der HV freigeben, und wie tief prüft jeder Pfad? |
| E38 | MFA-Richtlinie und Konten für Keycloak im Rückfall | TOTP-Pflicht für Freigabe-, Rechts- und Admin-Rechte; Erstpasswort-Verfahren; Sperre und Löschung nach der Probe | 088 (05.11.2026) | Eigentümer, Konzern-Security | — |
| E39 | Rückfall-Host: Verantwortlichkeit, AVV, Standort, Löschung | Bis zur AVV nur synthetische Testidentitäten ohne Personenbezug; Härtungs-Checkliste aus 037 | 30.10.2026 | Eigentümer, DSB | — |
| E40 | Zwei Rechtsrollen (Compliance für Insider-Kennzeichen, Recht für Aktienrecht) oder eine (Ist-Frage 5) | Eine Rolle legal; Insider-Kennzeichen als Attribut | 047 (10.11.2026); zweite Rolle = Tabellenzeile plus zweite Freigabe als Guard, rund 1,5 AStd | Projektleitung, Recht | Prüft Compliance Insider-Themen getrennt von Recht, oder ist es dieselbe Stelle? |
| E41 | Performance-Ziel D9 | Hartes Tor 150 ms; D9 (100 ms) als ausgewiesenes Ziel | 084 (12.10.2026); Entscheidung an Prüfpunkt 5: D9 halten mit Performance-Arbeit in der Anpassungsphase oder D9 durch die Design-Kritik ändern | Umsetzer, Design-Kritik | — |
| E42 | Annahme von ADR 0001 | Vorlage aus 009; Annahme an Prüfpunkt 1 durch Umsetzer und Projektleitung | 09.10.2026 | Umsetzer, Projektleitung | Ist die Architekturgrenze (Vertrag, Ports, ein Adapter je Nachbarsystem) auch für die Projektleitung verbindlich? |
| E43 | Zweite Person für Drill und Generalprobe | Eine der beiden Entwicklerinnen oder Entwickler aus dem Haus als technischer Betreiber neben dem Umsetzer | 27.11.2026 (mit E26) | Projektleitung | — |
| E44 | Leichtere Regel für Kleinänderungen | Jede Kleinänderung mit Mini-Spec und eigenem Merge (AGENTS.md Regel 1 und 12 unverändert) | Option; eine Sammelregel wäre eine Änderung von AGENTS.md | Eigentümer | — |
| E45 | Wochen nach beta-1 bis zur HV und Rückfall Generalprobe | Außerhalb dieses Plans; Verantwortung Projektleitung mit Umsetzer; Rückfall: Generalprobe auf T-28 (18.03.2027) | 29.01.2027 | Projektleitung, Eigentümer | Wer verantwortet Freeze, Vollprobe und Login-Check im März und April? |
| E46 | Aufsichtsratsfragen | Einheit AR-Büro und Attributregel; eigener Strang Nach-Beta | 040 (03.11.2026), 047 (10.11.2026) | Projektleitung, Recht | Gibt es Fragen an den Aufsichtsratsvorsitz, die getrennt vorbereitet und freigegeben werden? |
| E47 | Geld- und Nutzungsdeckel | Plan rund 110 Mio. Token; Deckel in Euro setzt der Eigentümer; Abonnement zuerst, API-Schlüssel mit Budgetgrenze, wenn der Durchsatz nicht reicht | Prüfpunkt 0 (25.09.2026), Überprüfung Prüfpunkt 1 | Eigentümer | — |
| E48 | Merge-Befugnis beim Orchestrator | Der Orchestrator mergt nach grünen Toren und unabhängigem Review; der Mensch sieht jeden Merge im Tagesbericht und kann ihn zurücknehmen; Deploy nur nach Go | Prüfpunkt 0 (25.09.2026) | Eigentümer | — |
| E49 | Vorprobe im Januar | Keine; Option: fünf bis zehn Personen auf dem Übungsmandanten in W16–W17, nur mit Klarheit zu E13 | Prüfpunkt 5 (11.12.2026) | Projektleitung, Eigentümer | Gibt es fünf bis zehn Personen, die im Januar eine Stunde lang eine Probe klicken? |

## 11. Sofortige nächste Schritte

1. **Woche 0, bis 25.09.2026 (Prüfpunkt 0).** Der Eigentümer gibt diesen Plan und die Standardannahmen frei und entscheidet E23 (Codex-Branch nach 009 löschen), E47 (Geld- und Nutzungsdeckel) und E48 (Merge-Befugnis beim Orchestrator). Er stellt die Anfragen mit Laufzeit bei Dritten: Konzern-IT für IdP-Client, Hosting/Postgres-Konto mit AVV, Endgeräte und Netz der Podiumsgeräte (E10, E11, E33); Start von Betriebsrat- und DSFA-Prozess (E13, E14); Beauftragung der Rechtsprüfung mit Anforderung von Satzung und Geschäftsordnung (E15); Beschaffung des Pentests (E32); Ansprechperson des Tool-Teams (E3a); Bestätigung von HV-Datum und Format (E20).
2. **Ab 28.09. (W1).** Bautage beginnen mit 009, 017, 012, 014, 015, 016, 018, 019, 013, 020 in der berechneten Reihenfolge. Der Eigentümer setzt den Branch-Schutz nach der Checkliste aus 016. Das Fragenpaket geht am 02.10. an die Projektleitung. Ab dem ersten Bautag führt docs/messung.md den Durchsatz je Bautag.
3. **Bis 09.10. (Prüfpunkt 1 mit Feedback-Runde 2).** M0 steht, die S-Punkte aus 020 sind auf der Demo sichtbar, der gemessene Durchsatz ist bekannt. Entscheidungen: ADR 0001 (E42), Ergänzung 0002, 0015, 0016; Durchsatzannahme bestätigt oder Kalender neu gerechnet; Antworten E1–E9 und E25 ins Register, sonst Vermerk „auf Standard gebaut".
4. **Bis 16.10. (Prüfpunkt 2).** M1 steht; Vertrag 0.3.0 ist geschrieben; danach laufen Kern, Persistenz, Identität und Betrieb (M2) und ab 23.10. der rechtliche Kern (M3).
5. **30.10.** Rückfalltrigger Hosting: steht kein Konzernkonto, mietet der Umsetzer den Staging-Host (nur Testidentitäten bis zur AVV, E39).
6. **Laufend.** Bautag starten und Tagesbericht lesen; wöchentliche Entscheidungsstunde; Deploy-Go an den Prüfpunkten; Rückfalltrigger im Register vermerken: 30.10.2026 (Hosting), 13.11.2026 (DSFA-Review), 27.11.2026 (IdP-Client, Betreiber, Geräte), 15.12.2026 (Pentest-Bestellung), 15.01.2027 (IdP-Rückfall), 29.01.2027 (Identitäten, Plattform des Übungsmandanten, Rechtsprüfung).
