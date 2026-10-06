# Scheibe 061 — Leitstand mit fachlichen Kennzahlen

**Status:** spec, nach Lesebefund überarbeitet (05.10.2026; erste Fassung `1ebe51e`, gelesen auf `c5990c8`, Vertrag 0.4.4;
Lesebefund in frischem Kontext: 3 Blocker, 6 major, 11 minor, 5 nits, dazu Vorschläge zur Wirkung in der Demo; Entscheidungen des
Orchestrators eingearbeitet, Abschnitt „Nacharbeit nach Lesebefund“; neunte Scheibe der Oberflächenkette der Freigabe-Demo
045 → 048 → 053 → 054 → 055 → 059 → 046 → 060 → 061 → 041, Register E57; Wunsch des Eigentümers vom 05.10.2026: „061 soll
richtig geil werden“; Prognosen Z11 und Flussbild Z12 als 061b skizziert; Bau in zwei Teilen auf dieser einen Spec, Abschnitt
„Teilung und Zuschnitt“)
**Risikoklasse:** hoch · 5,0 AStd (Spanne 4,4–5,6; Plan 061: mittel · 2 AStd, mit Zielbild +1,75; Begründung in „Warum hoch“ und
„Aufwand“; gebaut in Teil A ≈ 2,3 und Teil B ≈ 2,7, je unter einem Agententag) · Plan 061: 16.11.2026 (W8), tatsächlich nach 060 in
der Kette der Freigabe-Demo · Lanes: contract (Rechtebezeichner `cockpit.read` im Enum `Action`, Operation `getMeetingCockpit`,
Schemas, Vertrag 0.4.x); core (neue Datei `cockpit.ts`, ein Recht in drei Bündeln, eine Lesemethode); service (eine Route);
docs-sicherheit und Kennzahlenkatalog (Bericht „Leitstand“ im Auswertungskatalog, Regel (g) im Allowlist-Tor, MF-17); web-api
(eine HTTP-Route, Ausschluss aus dem Puffer, Wiederausgabe der Kernhilfen); web-cockpit (neu, `apps/web/src/features/cockpit/**`);
web-shell (eine Zeile im Feature-Register, drei Shell-Schlüssel); e2e (eigene Datei, im Projekt `http` eingereiht); docs (Glossar,
DSFA-Zeile V15, Status im Zielbild). Die Planzeile nennt nur web-cockpit; die zusätzlichen Lanes folgen aus dem Befund (Hinweise an
den Orchestrator).
**Bedrohungsmodell:** neue Leseoperation mit eigenem Recht (R-PERM-02); neuer Missbrauchsfall **MF-17** „Leistungsauswertung über
den Leitstand“ (verwandt MF-09); berührt T-G1-I-01 (Anzeige), **T-G2-D-03** (Vollscan des Logs je Aufruf, hier je Leitstand-Lesung)
und den Risikopunkt der DSFA „Vorgangshistorie wird zur Leistungskontrolle“ (Abschnitt 4). Der Leitstand zeigt Aggregate je
Jahrgang, Status und Fachbereich, nie je Person; Referenzen auf Einzelfragen nur, soweit der Leser sie nach `can()` lesen darf;
der Faden blendet handelnde Personen aus (Entscheidungen 8 und 8a).
**Rolle:** Architekt (Vertragsschritt, erster Commit von Teil A, vor jedem Code; AGENTS.md R6) + implementierer-backend (Kern,
Dienst, Katalog, Tor) + implementierer-oberflaeche (Teil B); Lesebefund der Spec erfolgt (05.10.2026); eine **Nachprüfung** der
Blocker und major-Punkte in frischem Kontext vor dem Bau (Lean-Modus, AGENTS.md R3); nach dem Bau **ein** Review je Teil in frischem
Kontext mit den Perspektiven **Datenschutz**, **Security**, **Vertrag** (Teil A) bzw. **Datenschutz** und **UX/Barrierefreiheit**
(Teil B); **Design-Kritik in frischem Kontext** (weder die Sitzung, die diese Spec schrieb, noch die bauende) gegen D1–D10, die
benannten Ausnahmen dieser Spec und `docs/evidence/089-lagebild.png`; Codex einmal je PR, wenn er bereit ist. Modell nur in
`.claude/agents/` (takt-012)
**Rule ids:** keine neue fachliche Regel und keine neue Übergangszeile. Neu belegt: R-PERM-02 für `getCockpit` (Leserecht
`cockpit.read` fehlt); R-PERM-03 wirkt über `can(actor, 'question.read', q)` auf jede Referenz (Entscheidung 8a). Gelesen und
unverändert übernommen: die Definitionen der Kennzahlen aus 033b (`indicators.ts`, `catalog.json`); R-PERM-04 (Stromsignale ohne
Inhalt); R-TIME (Zeit nur aus der injizierten Uhr, AGENTS.md R8). Dazu AGENTS.md R1–R6, R8–R10, R12; `docs/design-prinzipien.md`
D1–D10; ADR 0013 (keine Kennzahl je Person, generierter Auswertungskatalog).
**Quellen-IDs:** `docs/produktplan-beta.md` §5 Eintrag 061 (Zeile 794–800), 033b (587–592), 082 (408–413), 040 (644–649), 043
(686–691), 046 (692–697), 086 (928–933, hängt an 061), 087 (762–767, hängt an 061), 089b (827–832);
`docs/feedback/2026-09-zielbild-oberflaeche.md` Z10 (Zeile 58), Z11 (59), Z12 (60), Z13 (61), Aufwand (109–110);
`docs/zielbild/README.md` („Namen im Prototyp“: Lagebild → Leitstand); `docs/zielbild/js/lagebild.js`; `docs/evidence/089-lagebild.png`;
`docs/rollen-und-rechtekonzept.md` §5 („Leitstand / Projektleitung: Schritt 8A, Steuerung, Eskalation“), §6; ADR 0013; DSFA V15
(`docs/datenschutz/dsfa-vorentwurf.md:203`); Bedrohungsmodell T-G2-D-03 (Zeile 248), MF-09 (Zeile 526); Register E13, E57; Specs
033b, 053, 054, takt-046, takt-047, takt-048; Glossar Zeilen 61–62
**Depends on:** 033b (gemergt `115c28b`, PR #73; die Statuszeile der Spec 033b ist nicht nachgezogen), 043/043a (gemergt `88fa9be`),
040b (gemergt `6146251`), 082 (gemergt `c8bcf83`; Quelle der Rechtemenge fehlt weiter, 089b), 036a/036b (Live-Store, Strom), 053 und
054 (gemergt: Muster für Lesezustand, Registerzeile, e2e-Einreihung); **046** nimmt vorher die nächste Vertragsversion (erwartet
0.4.5), 061 dann 0.4.6
**Perspektive:** Datenschutz, Security, Vertrag, UX · **Glossar: neue Begriffe:** ja (Faden, Endstatus, Kanarienfrage, Engpass)

## Qualitätswirkung

Reifestufe: demo (Freigabe-Demo), gebaut pilotfest · Risikoklasse: hoch
Ausgelöst: [ ] Fachregel, Status (nur Anzeige; Statusverlauf über `reduce` der Projektion, keine eigene Statuslogik)
[x] Vertrag, Ereignis, Konfiguration (neue Operation, drei Schemas, ein Rechtebezeichner) [ ] Persistenz, Migration,
Nebenläufigkeit (nur Lesen) [x] Rolle, Recht, Identität, Schutzklasse (neues Recht `cockpit.read` in drei Bündeln; Referenzen über
`can()`) [x] personenbezogene oder vertrauliche Daten (Auswertung; Bericht im Auswertungskatalog, Negativtest, Allowlist aus dem
Vertrag) [x] Betrieb, Wiederherstellung (Lagebild am HV-Tag, Rechenzeit bei 800, T-G2-D-03) [ ] Administration [x] Oberfläche,
Barrierefreiheit [ ] Nachbarsystem [ ] KI, Agenten [x] Dokumentation, Schulung (Glossar, DSFA V15, MF-17)
Perspektive(n): Datenschutz, Security, Vertrag, UX · Nachweise: Abschnitt „Nachweise“ · Offene Entscheidung: E13 (Mindest-
Aggregationsschwelle für Fachbereiche **und Rollengruppen**, Standard: keine Unterdrückung wie in 033b, Mindestzahl im Bericht als
Feld vorgesehen), Eigentümerfragen unten (alle mit Standard)

## Warum hoch

Der Plan führt 061 als „mittel“ mit „Werte aus /metrics oder Projektion“. Keiner der beiden Wege trägt ohne Vertragsschritt, und
die Leitplanken (§4) nennen drei Hoch-Auslöser, die 061 alle berührt. **Hochstufung, kein Fall für `downgrade-check`.**

1. **Recht.** `cockpit.read` gibt es nicht (weder in `PERMISSIONS`, `types.ts:34-76`, noch im Vertragsenum **`Action`**,
   `openapi.yaml:2583-2657`, das „identical to the domain permission list“ ist). Die Planzeile verlangt es mit dem Standard
   coordination, moderation, admin.
2. **Auswertung.** Der Leitstand ist die erste Oberfläche, die Kennzahlen aus Bearbeitungszeiten zeigt. ADR 0013 und das
   Rechtekonzept §6 machen „keine Kennzahl je Person“ zur Bedingung und verlangen einen generierten Auswertungskatalog.
3. **Vertrag.** `/metrics` ist für den Scraper (`metricsBearer`, kein Akteur, kein `can()`, `openapi.yaml:2094-2112`), nie für den
   Browser. Die Projektion liefert dem Browser über `listQuestions` nicht, seit wann eine Einzelfrage im Legal Clearing liegt
   (`QuestionRecord` hat `createdAt` und `updatedAt`, `types.ts:315-348`; `updatedAt` ändert sich auch bei Claim, Rechtsfreigabe
   und Weiterleiten). Ohne serverseitige Prüfung wäre `cockpit.read` ein Recht, das niemand prüft, und eine Rolle mit
   `question.read.delivered` (Beobachtung) bekäme falsche Zahlen („0 offen“) statt eines Lesezustands.

Deshalb **eine Leseoperation `getMeetingCockpit` mit eigenem Recht**, gerechnet im Kern mit denselben Definitionen wie `/metrics`
(Kopfkommentar von `indicators.ts`: „It lives in the core so the control desk (Leitstand, 061) uses the same definitions instead of
rebuilding them“). Folgen der Klasse: Lesebefund vor dem Bau (erfolgt), Positiv- und Negativtest je Auslöser, Fehlerfall, Rechte-
Diff vor dem Bau (unten), nie gebündelt.

## Befund (Ist-Stand, gelesen auf `c5990c8`)

- **Kennzahlen im Kern (033b).** `computeIndicators(events, now)` (`packages/domain/src/indicators.ts`) liefert je laufendem
  Jahrgang: `oldestOpenQuestionAgeSeconds`, `openQuestionsByUnit` (Schlüssel `unassigned` ohne Zuweisung),
  `questionsCapturedLast5m` (Alter 0–300 s einschließlich), `questionsInLegalReviewOver10m` (Status `in_review` ohne Rechtsfreigabe
  der aktuellen Fassung, Eintritt > 600 s; Eintritt = `QuestionSubmittedForReview`, `QuestionReturned` mit `toStatus: in_review`,
  `AnswerDrafted` mit `toStatus: in_review` — ein neuer Verweigerungsvorschlag startet die Uhr neu). „Offen“ = Status nicht in
  delivered, closed, withdrawn, merged. Nur Jahrgänge im Status `running`. Verwendet in `apps/api/src/app.ts:793-813` mit eigenem
  Lese-Schnappschuss (takt-024) und 10-s-Zwischenspeicher; Prometheus-Ausgabe in `apps/api/src/metrics/prometheus.ts`
  (`renderMetrics`, iteriert nur `catalog.metrics`).
- **Katalog** `apps/api/src/metrics/catalog.json`: `version`, `notice`, `definitions`, `metrics` (sechs Familien, Labels nur
  `meeting_id`, `unit_id`). Tor `scripts/metrics-allowlist-check.mjs`: Regeln (a)–(f) nur über `metrics`, unbekannte Schlüssel der
  obersten Ebene werden weder geprüft noch abgelehnt. Generator `scripts/auswertungskatalog.mjs` schreibt `dist/auswertungskatalog/`
  aus `metrics` (CI-Schritt in `.github/workflows/gates.yml:111-116`, Artefakt `auswertungskatalog`); Test
  `scripts/auswertungskatalog.test.mjs`. Es gibt heute **keinen Platz für einen Bericht** (eine Ansicht, die Kennzahlen zeigt) —
  061 schafft ihn (Entscheidung 8b).
- **Projektion.** `reduce(state, event)` und `project(events)` sind exportiert (`state.ts:140`, `:555`); `createdAt` einer Einzelfrage
  ist `e.at` des `QuestionCaptured` (`state.ts:348`). `Meeting.counts` hat `questions`, `open`, `staged`, `delivered`, `byStatus`,
  `byUnit` (jeder Fachbereich als Schlüssel, ohne `unassigned`), `bySeat`. `TERMINAL_STATUSES` = closed, withdrawn, merged
  (`types.ts:122`) — **ohne** delivered. `Meeting.debateClosedAt` ist projiziert (takt-016), die schließende Operation folgt mit 087.
- **Rechte.** `ROLE_PERMISSIONS` (`permissions.ts:22-104`): moderation, coordination und admin halten `question.read` und
  `history.read`, keines davon ist ein `unitBound`-Bündel; expert ist `unitBound` (R-PERM-03). Die Liste der Administration ist an
  **zwei** Stellen gepinnt: `admin040a.test.ts:42-43` (Menge und Länge 14) und `forward048.test.ts:149-152` (genaue Reihenfolge).
  `READ_PERMISSIONS` (`types.ts:90-103`); `api.test.ts:538` prüft, dass jeder Eintrag eine `HvApi`-Methode nennt; `stream.ts:159-173`
  leitet daraus die Stromthemen ab. `policy-truth-table.md` ist generiert (`transitions.test.ts:426`) und enthält neben Rolle × Status
  × Aktion weitere Tabellen, darunter **„Role × Leserecht“** (Zeile 208–223, Spalten aus den Leserechten); `api.test.ts` pinnt das
  Bündel der Koordination in einer Zeile. `ACTION_KEYS` in `apps/web/src/i18n/labels.ts:54` ist `Record<Permission, TKey>`: ein neues
  Recht kompiliert im Web erst mit seinem Eintrag und dem Schlüssel `action.<recht>` in beiden Sprachen.
- **Vertragsversion an vier Stellen:** `openapi.yaml` `info.version`, `packages/contract/package.json` (`"version": "0.4.4"`),
  `apps/api/src/__tests__/takt-019-contract.test.ts:8,11` (Version und **70** Operationen), `apps/api/src/__tests__/contract.test.ts:90`
  (Version). Antwort `503 PersistenceBusy` ist für Lesungen über Postgres üblich (`openapi.yaml:108`, `:182`).
- **HvApi** (`api.ts:85-165`): `getStage()` liest den aktuellen Jahrgang, im Dienst über `meetingDomain(meetingId)`
  (`app.ts:409-434`, `:1065-1066`); `requireReadPermission(method)` über `READ_PERMISSIONS`; `can()` entscheidet je Einzelfrage
  einschließlich R-PERM-03.
- **Live-Store** (`apps/web/src/api/liveStore.ts`): `BufferedRead = Exclude<ReadMethodName, 'listEvents'>`; `READ_TOPICS` vollständig
  per Typ; Einträge leben höchstens 30 s (`MAX_AGE_MS`). `http.ts:718` umhüllt jede Methode aus `READ_TOPICS` für die Neuanmeldung
  des Stroms.
- **Feature-Register:** sieben Zeilen, Alt+1…6 belegt, steering ohne Kürzel; `visibleRoutes` wird ohne Menge gerufen.
- **Bauteile:** `Panel`, `PageHeader`, `EmptyState`, `Badge`, `ProcessStrip`, `Table`, `Sparkline` (Min–Max-Linie). Keine
  Diagrammbibliothek; Symbole aus `lucide-react`. Tokens `--color-ink-*`, `--color-accent-*`, `--color-tone-*-{bg,fg,bd}`,
  Statustönungen. `urgencyLevel` (`features/answers/lib.ts:147-152`): < 15 min, < 45 min, sonst.
- **i18n:** Paritätstest (f) **621**. **e2e:** `SHARED_SPECS` und Reihenfolge-Pin (002, 021b, 021c, (030, 031), 045, 053, 054, 055b,
  080, abnahme); Harness 12:00, Warnschwelle 6:30 (takt-046); Personen im Projekt `http` ohne admin und observer.
- **Bedrohungsmodell:** T-G2-D-03 (Vollscan je Aufruf; für `/metrics` mit 10-s-Zwischenspeicher behandelt); MF-09 (Leistungs-
  auswertung über das Zugriffslog); höchste Nummer auf dem Integrationszweig MF-14; MF-15 belegt die Spec 046, MF-16 die Spec 060 (Branches `claude/slice-046-nachfragen-threads`, `claude/slice-060-entwurfspuffer-praesenz`, gelesen 05.10.2026), daher **MF-17**.
- **Zielbild.** Lagebild = Leitstand (061) + Steuerung (053). Z10–Z13 wie in der Quelle. Der Prototyp zeigt Namen von Rednern im
  Faden und in der Rednerwand; das übernimmt 061 **nicht**.

## Was die Koordination im Saal braucht (Gestaltungsgrundlage)

Nachmittag der Generaldebatte, Raum hinter dem Saal, mehrere hundert Einzelfragen, der Leitstand hängt oft zusätzlich an der Wand.
Die Person schaut **alle paar Minuten für wenige Sekunden** hin und will drei Dinge wissen, in dieser Reihenfolge:

1. **Wartet etwas zu lange?** Die älteste offene Einzelfrage — die **eine Hauptlesung** (D1), groß, links oben.
2. **Wo staut es sich?** Die Stationen mit dem Engpass im Legal Clearing (Recherche Z.27), Legal Clearing über 10 Minuten und der
   Rückstand je Fachbereich.
3. **Wie entwickelt sich die Lage?** Zulauf je 5 Minuten über die letzte Stunde, was auf der Bühne wartet, und wie viele Einzelfragen
   noch ohne Endstatus sind — vor dem Debattenschluss die Frage „schaffen wir das“.

Alles andere ist Drill-down. Der Leitstand ist eine **Konsole, kein Dashboard**: ruhig, solange alles ruhig ist; Farbe erscheint erst
über einer Schwelle, dann immer mit Symbol, Wort und Schwelle. Genau eine primäre Aktion: „Faden öffnen“ an der ältesten Einzelfrage.

### Aufbau (1440 px wie Bild 089; Wandbildschirm 1280 × 720)

```
Leitstand                                              Stand 15:42:10 · Kanarienfrage: nicht eingerichtet
Lage der Einzelfragen auf einen Blick
┌ ÄLTESTE OFFENE EINZELFRAGE ──────────────┐ ┌ OHNE ENDSTATUS ─┐ ┌ LEGAL CLEARING > 10 MIN ┐ ┌ AUF DER BÜHNE ─┐
│ 50 min  [⬣ kritisch · über 45 min]       │ │ 47              │ │ 6 [▲ erhöht · ab 3]     │ │ 8              │
│  (44 px Mono, „min“ 16 px Grau 600)      │ │ von 171 erfass- │ │ von 14 im Legal         │ │ 124 vorgelesen │
│ F-0125 · zugewiesen · Finanzen           │ │ ten             │ │ Clearing                │ │                │
│ seit 14 min in diesem Status             │ └─────────────────┘ └─────────────────────────┘ └────────────────┘
│ [ Faden öffnen ]          (primär)       │ ┌ ZULAUF JE 5 MIN ─────────────────────────────────────────────┐
│ ───────────────────────────────          │ │ 3     ▁▂▃▅▃▂▁▂▃▂▁█  (280 × 48 px)    letzte Stunde: 41       │
│ DANACH DIE ÄLTESTEN                      │ │       −60 min                 jetzt                           │
│ F-0126  freigegeben · Finanzen   49 min  │ └───────────────────────────────────────────────────────────────┘
│ F-0127  Antwortentwurf · Personal 46 min │
│ F-0128  im Legal Clearing · ESG  45 min  │
└──────────────────────────────────────────┘
┌ STATIONEN ─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ERFASST      │ KLASSIFIZIERT │ ZUGEWIESEN   │ ANTWORTENTWURF │ IM LEGAL CLEARING      │ FREIGEGEBEN           │
│ 5            │ 3             │ 12           │ 9              │ 14  [▲ Engpass]         │ 4                     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌ RÜCKSTAND JE FACHBEREICH ──────────────────────────────────────── Strich = Schwelle „erhöht“ (20) ─────────┐
│ Finanzen           ███████████████████████|███                             23   [▲ erhöht · ab 20]         │
│ Personal           ██████████             |                                 9                              │
│ …                                                                                                          │
│ Ohne Fachbereich   █████                  |                                 5   noch nicht zugewiesen      │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌ IM LEGAL CLEARING ÜBER 10 MIN · 6                                                                     [×] ┐
│ Nr.      Station             Fachbereich    wartet seit   offen seit                                       │
│ F-0141   im Legal Clearing   Finanzen          24 min        52 min                                        │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌ FADEN F-0141 ──────────────────────────────────────────────────────────────────────────────────────── [×] ┐
│ Wie hoch war die Ausschüttungsquote im Geschäftsjahr 2025 …                         Finanzen · Bühne: CFO  │
│ ●──────────●──────────●──────────◉──────────○──────────○──────────○                                       │
│ erfasst    klassif.   zugewiesen  im Legal Clearing  freigegeben  auf der Bühne  vorgelesen               │
│ 14:53      14:58      15:02       15:18 · seit 24 min                                                     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
        (Liste und Faden erscheinen erst auf Klick; Escape schließt erst den Faden, dann die Liste)
```

Raster: 12 Spalten, Abstand 16 px. Zeile 1: Hauptlesung 5 Spalten über zwei Kartenhöhen; rechts 7 Spalten mit drei Karten (Ohne
Endstatus, Legal Clearing über 10 min, Auf der Bühne) in der ersten und der Zulaufkarte über alle 7 Spalten in der zweiten Höhe;
die Unterkanten der Hauptlesung und der Zulaufkarte fluchten. Darunter Stationen, Rückstand, Liste, Faden jeweils über die volle
Breite. Bei 1024 px: Hauptlesung volle Breite, drei Karten in einer Reihe, Zulauf darunter. Unter 768 CSS-px (1280 px bei 200 %
Zoom): eine Spalte, Stationen als zwei Reihen zu drei, kein waagrechtes Scrollen.

## Teilung und Zuschnitt

| Punkt | In 061 | Wohin sonst | Grund |
|---|---|---|---|
| Route `/cockpit`, Recht `cockpit.read`, Registerzeile | **ja** | Ausblenden in der Navigation: 089b | Rechte als Daten |
| Älteste offene Einzelfrage und drei nächstälteste (Z10) | **ja** (Hauptlesung) | — | Planzeile und Z10 |
| Rückstand je Fachbereich | **ja**, mit Schwellenstrich | — | Planzeile |
| Zulauf je 5 min mit Verlauf | **ja**, 12 Säulen mit Achse | — | Planzeile |
| Legal Clearing über 10 min | **ja** | — | Planzeile |
| „Fragen ohne Endstatus“ vor Debattenschluss | **ja** | Restantenliste: 087 | Planzeile |
| Stationen mit Engpass | **ja**, sechs Spalten mit Zahl | Punkt je Einzelfrage: 061b | Wirkung in der Demo, ohne Z12-Aufwand |
| Auf der Bühne | **ja**, vierte Karte | — | Wirkung in der Demo; ergänzt die Stationen bis zum Vorlesen |
| Drill-down auf Liste | **ja**, in der Seite, mit URL-Zustand | Sprung in Steuerung/Beantwortung mit Filter: Folgeliste | deren Filter haben keinen URL-Zustand |
| Faden je Frage (Z13) | **teilweise**: Stationen mit Uhrzeit und Verweildauer, ohne Akteure | Absprung in die Fokusansicht: nicht vorgesehen (die Koordination ist keine Fachkraft) | Drill-down der Planzeile |
| Platz für den Status der Kanarienfrage | **ja** | Inhalt: 086 | Planzeile |
| Bericht „Leitstand“ im Auswertungskatalog | **ja** (Entscheidung 8b) | — | ADR 0013, Leitplanken 6.6 |
| Prognosen aus dem Tempo (Z11) | nein | **061b** | neue Durchsatzkennzahl des Legal Clearing (Leistungsbezug einer Rollengruppe, E13); „nächste Antwortrunde voll“ braucht 057 |
| Flussbild mit Punkt je Einzelfrage (Z12) | nein | **061b** | rund 1 AStd |
| Druckansicht, Schwellen je Jahrgang | nein | Folgeliste; 041 nach Eigentümerfrage 1 | — |

**Bau in zwei Teilen auf dieser Spec (vom Orchestrator angenommen 05.10.2026, kein Planknoten 061a).** Die überarbeitete Scheibe liegt
mit 5,0 AStd über einem Agententag und über dem Doppelten der Planzeit. Statt einer zweiten Spec wird sie in zwei PRs gebaut, die
beide diese Spec und ihre „Files allowed“ nutzen (`slice-scope` erkennt `claude/slice-061-…`):

- **Teil A „Kern“** (Branch `claude/slice-061-kern`, ≈ 2,3 AStd, hoch): Vertragsschritt, `cockpit.ts`, Recht, `getCockpit`, Route,
  Bericht im Katalog, Regel (g) im Tor, Generator, MF-17, DSFA V15, dazu der kleinste Web-Adapter (HTTP-Route, Pufferausschluss und
  Durchreichung, `ACTION_KEYS`-Eintrag mit `action.cockpit.read`, Paritätszahl), damit Teil A allein durch `pnpm gates` kommt; Tests
  K1–K12, A1–A7, G1–G3, L1. Merge vor Teil B.
- **Teil B „Oberfläche“** (Branch `claude/slice-061-oberflaeche`, ≈ 2,7 AStd): Wiederausgabe `api/cockpit.ts`, Seite, Liste, Faden, i18n, Register, Glossar,
  Zielbild-Status; Tests W1–W11, S1–S8; Screenshots; Design-Kritik.

**Skizze 061b „Leitstand: Flussbild und Prognosen“** (eigene Spec vor dem Bau, AGENTS.md R1): Flussbild als SVG aus Tokens (Punkt je
offene Einzelfrage in ihrer Station, Alter in drei Stufen als Farbe **und** Form, „+n in 15 min“ je Station, Tabelle mit denselben
Zahlen); Prognose „im Legal Clearing abgebaut ca. HH:MM bei n Rechtsfreigaben je 15 min“ mit Katalogfamilie
`hv_legal_clearances_last_15m`, E13-Vermerk für die Rollengruppe Legal Clearing und Erweiterung des Berichts „Leitstand“. Rund
1,25–1,5 AStd, hoch. Abhängigkeit: 061.

## Rechte-Diff (vor dem Bau, Leitplanken §4)

`ROLE_PERMISSIONS`, neue Spalte `cockpit.read` (· = nicht gehalten):

| Rolle | vorher | nachher | Begründung |
|---|---|---|---|
| moderation (Versammlungsbüro) | · | ✓ | Planzeile; steuert die Debatte und den Debattenschluss (087) |
| coordination (Koordination) | · | ✓ | Planzeile; nächste Rolle zu „Leitstand / Projektleitung“ (Rechtekonzept §5) |
| admin (Administration) | · | ✓ | Planzeile; Aggregate (§4 „Rechte, keine Inhalte“); Liste 14 → 15, `cockpit.read` als letzter Eintrag |
| capture, expert, legal, approver, podium, observer | · | · | Deny by default; Eigentümerfrage 6 |

`PERMISSIONS`: `cockpit.read` nach `event.read` (Leserechte stehen zusammen). `READ_PERMISSIONS`: `getCockpit: ['cockpit.read']`.
**Diff der Wahrheitstabelle (die Rechteentscheidung, Festlegung 4 der Spec 010):** `policy-truth-table.md` wird neu erzeugt; die
Tabelle „Role × Leserecht“ bekommt die Spalte `cockpit.read` mit ✓ bei moderation, coordination, admin und · sonst; alle übrigen
Tabellen, darunter Rolle × Status × Aktion, bleiben Zeile für Zeile gleich. Dieser Diff ist die Rechteentscheidung dieser Scheibe; der
Review prüft ihn gegen die Tabelle oben. Stromthemen bleiben unverändert. **Invarianten,
als Test (K1):** jeder Inhaber von `cockpit.read` hält `question.read` **ungebunden** (sein Bündel ist kein `unitBound`-Bündel) und
damit auch das Thema `questions`. Ein späteres gebundenes oder auf Schutzklassen beschränktes Bündel mit `cockpit.read` ist eine
Spec-Entscheidung: Die Aggregate wären dann Zahlen über Einzelfragen, die der Leser nicht lesen darf (Hinweis an 047).

## Ziel und Entscheidungen vor Bau

**Ziel:** Eine Route `/cockpit` („Leitstand“), die Inhabern von `cockpit.read` in einer Sekunde zeigt, was am längsten wartet, wo
es sich staut und wie sich die Lage entwickelt; jede Zahl führt per Klick oder Tastatur auf die Einzelfragen dahinter und zu jeder
auf ihren Faden; live, aus dem Kern mit denselben Definitionen wie `/metrics`, als Bericht im Auswertungskatalog geführt, nichts je
Person.

Jede Entscheidung hat einen **Standard**, nach dem gebaut wird; Abweichungen nur über die Eigentümerfragen unten.

### 1. Quelle der Zahlen: eine Leseoperation im Kern (Vertragsschritt)

**Standard:** `GET /v1/meetings/{meetingId}/cockpit` (`operationId: getMeetingCockpit`), `HvApi.getCockpit()` für den aktuellen
Jahrgang (wie `getStage`), im Dienst über `meetingDomain(meetingId)`. Kein Alias. Gerechnet von der reinen Kernfunktion
`computeCockpit(events, now, meetingId, canRead)` in `packages/domain/src/cockpit.ts`, die die Definitionen aus `indicators.ts`
**teilt** (gemeinsame Hilfen dort exportieren oder in `cockpit.ts` ziehen; die Ausgabe von `/metrics` bleibt Byte für Byte gleich,
Test A5 gegen ein vorher gepinntes Golden). `computeCockpit` faltet `reduce` **einmal** über die Ereignisse des Jahrgangs und hält
dabei je Einzelfrage Erfassungszeit, Zeit des letzten Statuswechsels und Eintritt ins Legal Clearing (033b-Definition) fest.

Verworfen: Rechnen im Browser aus `listQuestions`; `/metrics` im Browser; neues Feld `statusSince` an `Question` (Kandidat für 061b).

**Vertragsschritt (Architekt, erster Commit von Teil A):** Vertrag **0.4.x (erwartet 0.4.6**, weil 046 vorher merged und 0.4.5
nimmt; sonst die nächste freie Patchnummer); `info.version`, `packages/contract/package.json`, `CHANGELOG.md`, Typen neu erzeugt
(`pnpm contract:types`); die Versions- und Operationszeilen in `takt-019-contract.test.ts` (eine Operation mehr) und
`contract.test.ts` nachgezogen. Inhalt:

- Enum **`Action`** + `cockpit.read`; in seiner Beschreibung der Absatz „Since 0.4.x (slice 061): `cockpit.read` (read the control
  desk figures, `getMeetingCockpit`); granted in `ROLE_PERMISSIONS` by slice 061 to moderation, coordination and admin; holders hold
  unscoped `question.read`.“
- Operation `getMeetingCockpit`: Parameter `meetingId`; Antworten `200` (`Cockpit`, Header `X-Server-Time`), `401`, `403`
  (R-PERM-02), `404`, `408`, `429`, `500`, **`503` (`PersistenceBusy`)**. Beschreibung: Aggregate je Jahrgang, Status und
  Fachbereich nach den Definitionen des Auswertungskatalogs (033b, Bericht `leitstand`); keine Kennzahl je Person; Referenzen nur auf
  Einzelfragen, die der Leser lesen darf; keine Fragetexte, keine Akteure, keine Redner.
- Schema **`Cockpit`** (`additionalProperties: false` überall außer der Abbildung `openByUnit`; alle Zahlen `type: integer`,
  `minimum: 0`):

| Feld | Typ | Bedeutung |
|---|---|---|
| `meetingId` | string, `maxLength: 200` | Jahrgang |
| `asOf` | date-time | Rechenzeitpunkt aus der injizierten Uhr des Dienstes |
| `meetingStatus` | `MeetingStatus` | `preparation`, `running`, `closed` |
| `debateClosedAt` | date-time, optional | wie `Meeting.debateClosedAt` |
| `totals` | `{ captured, open, staged, answered }`, alle Pflicht | erfasst (alle Einzelfragen), offen (033b = „ohne Endstatus“), auf der Bühne (`staged`), vorgelesen (delivered + closed) |
| `openByStatus` | genau die sieben offenen Status `captured`, `classified`, `assigned`, `answer_drafted`, `in_review`, `approved`, `staged`, alle Pflicht | offene Einzelfragen je Station |
| `openByUnit` | Abbildung Fachbereichs-id → integer, `maxProperties: 200` | jeder Fachbereich des Jahrgangs, auch mit 0 |
| `openUnassigned` | integer | offen ohne Fachbereich |
| `oldestOpen` | `{ ageSeconds, items }`; `items`: `CockpitOldestRef[]`, `maxItems: 4` | Alter der ältesten offenen (0 ohne offene, unabhängig vom Filter in 8a); Referenzen älteste zuerst, Gleichstand nach `number` |
| `inflow` | `{ binSeconds, bins, last5m }`; `binSeconds` `enum: [300]`; `bins` `minItems: 12`, `maxItems: 12` | `bins[11]` = `last5m` = Alter 0–300 s einschließlich (033b); `bins[i]` für i < 11 = Alter in (300·(11−i), 300·(12−i)] |
| `legalReview` | `{ over10m, items }`; `items`: `CockpitReviewRef[]`, `maxItems: 50` | Anzahl wie `hv_questions_in_legal_review_over_10m`; Referenzen längste Wartezeit zuerst |

- Schema **`CockpitOldestRef`** (`additionalProperties: false`): `id`, `number` (je `maxLength: 200`), `status` (`QuestionStatus`),
  `unitId` (optional), `ageSeconds` (seit Erfassung), `statusAgeSeconds` (seit dem letzten Statuswechsel).
- Schema **`CockpitReviewRef`** (`additionalProperties: false`): dieselben Felder plus `reviewAgeSeconds` (Pflicht; Wartezeit nach
  033b, ein neuer Verweigerungsvorschlag setzt sie zurück). Getrennte Schemas, damit `reviewAgeSeconds` in `oldestOpen` nicht
  vorkommen kann.
- **Kein** Fragetext, kein `speakerId`, kein Rednername, kein Akteur, kein Claim. Sekunden abgerundet wie in 033b, nie negativ.
- Jahrgänge in jedem Status werden gerechnet; die Gleichheit mit `computeIndicators` gilt für laufende Jahrgänge (K3).

### 2. Route, Registerzeile, Lesezustand

**Standard:** Registerzeile `id: 'cockpit'`, `path: '/cockpit'`, `labelKey: 'nav.cockpit'`, Symbol `Gauge` (sonst `Activity`),
`testId: 'nav-cockpit'`, `helpKey: 'page.cockpit.description'`, `i18nModule: 'cockpit'`, `requires: 'cockpit.read'`, kein Kürzel,
**letzte** Zeile. Kein Zähler an der Navigation. Die Navigation zeigt den Eintrag allen, bis 089b die Rechtemenge liefert. 403
R-PERM-02/-03 ⇒ Lesezustand `cockpit-forbidden` (`EmptyState`, Titel und ein Satz, D9), nie Teildaten.

### 3. Hauptlesung: älteste offene Einzelfrage (Z10)

**Standard:** Panel über 5 Spalten und zwei Kartenhöhen. Beschriftung 12 px, Gewicht 500, Grau 600, Großbuchstaben per CSS. Zahl in
Minuten in **44 px Mono** (`tabular-nums`, feste Breite), Einheit „min“ in **16 px Grau 600** — **benannte Ausnahme zu D3** (dort
20–28 px für die Bühne): die Hauptlesung muss auf dem Wandbildschirm aus mehreren Metern lesbar sein und ist die einzige Zahl dieser
Größe; die Design-Kritik prüft die Ausnahme. Bei 1280 × 720 darf sie auf 40 px fallen. Ab 100 min „1 h 40 min“. Daneben die Stufe
(Entscheidung 4). Darunter 13 px: `F-0125 · zugewiesen · Finanzen` (Nummer Mono; Station aus `status.*`; Fachbereich als Kurzname,
sonst „ohne Fachbereich“) und **„seit 14 min in diesem Status“** (`statusAgeSeconds`). Dann die **einzige primäre Schaltfläche:
„Faden öffnen“**. Unter einer Trennlinie „Danach die ältesten“: drei Zeilen (Nummer Mono, Station · Fachbereich, Alter Mono
rechtsbündig), jede eine Schaltfläche zum Faden. Ohne offene Einzelfrage: „—“, „Keine offene Einzelfrage.“, keine Schaltfläche
(benannte Ausnahme zu D2). Darf der Leser die älteste nicht lesen (8a), zeigt die Hauptlesung Alter und Stufe, ohne Nummer und ohne
Schaltfläche.

### 4. Stufen als Daten: ruhig, erhöht, kritisch

**Standard:** `COCKPIT_THRESHOLDS` und `cockpitLevel(figure, value, context)` in `cockpit.ts` (rein; importierbar vom Web über
`apps/web/src/api/cockpit.ts`, später von 085/086). Stufen `calm` | `attention` | `critical`. Werte (Eigentümerfrage 1):

| Kennzahl | erhöht ab | kritisch ab | Badge-Text (DE) |
|---|---|---|---|
| Alter der ältesten offenen Einzelfrage | 15 min | 45 min | „erhöht · über 15 min“, „kritisch · über 45 min“ |
| Legal Clearing über 10 min | 3 | 10 | „erhöht · ab 3“, „kritisch · ab 10“ |
| Rückstand eines Fachbereichs **und** „Ohne Fachbereich“ | 20 | 40 | „erhöht · ab 20“, „kritisch · ab 40“ |
| Ohne Endstatus | nach Debattenschluss > 0 | — | „erhöht · nach Debattenschluss“ |
| Zulauf je 5 min, Auf der Bühne | — | — | nie farbig |

Grenzwert gleich Schwelle ⇒ höhere Stufe (beim Alter: genau 15 min ist erhöht, wie `urgencyLevel`). Die Schwelle im Badge-Text
kommt aus `COCKPIT_THRESHOLDS`, nie als Literal. **„Engpass“** an der Spalte „im Legal Clearing“ der Stationen erscheint, wenn die
Stufe „Legal Clearing über 10 min“ mindestens erhöht ist (gleiche Tönung wie dessen Badge). **Darstellung:** ruhig = keine
Markierung (D4); erhöht = Badge `--color-tone-warning-*` mit `TriangleAlert`; kritisch = Badge `--color-tone-danger-*` mit
`OctagonAlert`. Zahlen bleiben Grau 900; Balken im Rückstand in der Füllfarbe der Stufe, sonst Grau 400. Jede Stufe ist ohne Farbe
lesbar (Symbol, Wort, Schwelle). **Ein Muster für zugängliche Namen** jeder anklickbaren Kennzahl, Stationsspalte und
Fachbereichszeile: „Liste öffnen: {Beschriftung}, {Zahl}[, {Stufe} · {Schwelle}]“, etwa „Liste öffnen: Im Legal Clearing über 10 min,
6, erhöht · ab 3“; ruhig ohne Zusatz.

### 5. Karten, Stationen, Rückstand, Zulauf

**Standard:**

- **Ohne Endstatus:** Zahl 28 px Mono = `totals.open`; „von {captured} erfassten“; nach Debattenschluss „nach Debattenschluss offen“.
- **Im Legal Clearing über 10 min:** Zahl = `legalReview.over10m`; „von {openByStatus.in_review} im Legal Clearing“.
- **Auf der Bühne:** Zahl = `totals.staged`; „{answered} vorgelesen“. Keine Stufe.
- **Zulauf je 5 min:** Zahl = `inflow.last5m`; **12 Säulen** als inline SVG **280 × 48 px** (Säule 18 px, Abstand 5 px), Grundlinie bei
  0, Skala `max(…bins, 5)`, Säulen Grau 300, jüngste Akzent 500, leere Fenster als 1-px-Strich; Achsenbeschriftung **11 px Grau 600**
  „−60 min“ links und „jetzt“ rechts (benannte Ausnahme zu D3: 11 px wie Badges); `role="img"` mit Namen „Zulauf je 5 Minuten in der
  letzten Stunde: 2, 3, …; zuletzt 3“; daneben „letzte Stunde: {Summe}“. Eine Farbe, Position trägt die Bedeutung. `Sparkline`
  bleibt unberührt. **Keine Diagrammbibliothek** (takt-047).
  *Nachtrag nach Design-Kritik (Entscheidung des Orchestrators, 06.10.2026):* Säulen **Grau 500** (3,9:1 auf der Karte) statt Grau 300
  (1,68:1); leere Fenster als 1-px-Strich ebenfalls in Grau 500 (mindestens 3:1, WCAG 1.4.11). Beschriftung der Karte „Zulauf letzte
  5 min“ / „Inflow last 5 min“, damit eine 0 nicht wie ein Fehler liest; Zahl, Säulen und „letzte Stunde“ auf einer Zeile, Achse
  darunter (wie die Skizze). Die Karte „Im Legal Clearing über 10 min“ trägt sichtbar „Legal Clearing über 10 min“; Beschriftung und
  zugänglicher Name teilen eine Zeichenkette (WCAG 2.5.3).
- **Stationen** (volle Breite, ersetzt hier die dichte `ProcessStrip`): sechs beschriftete Spalten **erfasst, klassifiziert,
  zugewiesen, Antwortentwurf, im Legal Clearing, freigegeben** mit `openByStatus` (20 px Mono) und der Statustönung nur als 3-px-
  Oberkante; „auf der Bühne“ steht in der vierten Karte, nicht doppelt. „Engpass“-Badge nach Entscheidung 4. Jede Spalte eine
  Schaltfläche: Drill-down „Ohne Endstatus“, auf diese Station gefiltert. Die Reihenfolge ist Anzeigereihenfolge (wie die
  Statusbeschriftungen), keine Statuslogik.
- **Rückstand je Fachbereich:** volle Breite, Zeile je Fachbereich (36 px): Kurzname, Balken (relativ zu `max(größter Wert,
  kritische Schwelle)`, mindestens 2 px bei > 0), **senkrechter 1-px-Strich bei der Schwelle „erhöht“** (Grau 500, `aria-hidden`,
  Legende im Kopf „Strich = Schwelle ‚erhöht‘ (20)“), Zahl Mono rechtsbündig (Null in Grau 600), Stufe. Sortiert nach Zahl
  absteigend, dann Name; „Ohne Fachbereich“ zuletzt mit Unterzeile „noch nicht zugewiesen“, gleiche Schwellen. Jede Zeile eine
  Schaltfläche.
- **Kopfzeile:** `PageHeader` „Leitstand“ mit Beschreibung; rechts „Stand HH:MM:SS“ (Mono, aus `asOf`, Europe/Berlin) und die
  Kanarienzeile; nicht laufender Jahrgang zusätzlich „HV in Vorbereitung“ bzw. „HV geschlossen“ als neutrales Badge.

### 6. Drill-down und Faden (Z13, teilweise)

**Standard:** Jede Karte, jede Stationsspalte, jede Fachbereichszeile und jede Zeile der Hauptlesung öffnet unter dem Rückstand eine
**Liste** (Panel über die volle Breite); der **Faden** erscheint darunter, ebenfalls über die volle Breite, **waagrecht**. Zustand in
der URL (`?list=oldest|open|legal|inflow|unit|stage&station=<status>&unit=<id>&q=<id>`, `useSearchParams`), Zurück schließt.

| Auslöser | Liste | Quelle |
|---|---|---|
| Hauptlesung, „Faden öffnen“, „Danach die ältesten“ | „Älteste offene Einzelfragen“, Faden der gewählten offen | `oldestOpen.items` |
| Legal Clearing über 10 min | „Im Legal Clearing über 10 min“ (bis 50, sonst „50 von n, die am längsten wartenden“) | `legalReview.items` |
| Ohne Endstatus, Stationsspalte | „Ohne Endstatus“ bzw. „{Station}“, gruppiert nach Station | `listQuestions({ status: […], limit: 2000 })` |
| Auf der Bühne | „Auf der Bühne“ | `listQuestions({ status: ['staged'] })` |
| Zulauf je 5 min | „Erfasst in den letzten 5 Minuten“ | `listQuestions({ limit: 2000 })`, Alter ≤ 300 s gegen `asOf` |
| Fachbereichszeile | „Offen bei {Fachbereich}“ / „Ohne Fachbereich“ | `listQuestions({ unitId, status: […] })` bzw. clientseitig aus der offenen Liste |

Spalten: Nummer (Mono), Station, Fachbereich, eine Zeitspalte — in „Älteste“ **„in diesem Status“** (`statusAgeSeconds`), in „Legal
Clearing“ **„wartet seit“** (`reviewAgeSeconds`), sonst keine —, „offen seit“ (Mono, rechtsbündig). Alter aus `listQuestions` =
`max(0, asOf − createdAt)` mit `asOf` derselben Leitstand-Lesung. Die Liste trägt ihre **eigene Zahl** im Kopf; sie kann von der
Karte abweichen, weil Liste und Kennzahl zu verschiedenen Zeitpunkten gelesen werden; die nächste Lesung gleicht an (im Bericht
genannt, kein Fehler). **Kein Fragetext, kein Redner, keine Wortmeldung in den Zeilen.**

**Faden:** Kopf „Faden F-0141“, Fragetext (`getQuestion`, nur mit Leserecht), Fachbereich und Bühnenplatz als Badges; darunter eine
waagrechte Linie mit den Einträgen des Verlaufs in Zeitreihenfolge, dann die noch nicht erreichten Stationen bis „vorgelesen“:
vergangen gefüllter Punkt (Grau 600) mit HH:MM; aktuell Ring Akzent 500 mit „seit n min“ aus `asOf` und „aktuell“ im zugänglichen
Namen; künftig hohler Punkt Grau 300 ohne Zeit (drei Formen). Rücksprünge (Zurückgeben) erscheinen als eigene Einträge; bei mehr als
acht Einträgen bricht die Linie um. Quelle: `getQuestionHistory` und **`statusTrail(events, questionId)`** in `cockpit.ts`: faltet
`reduce` über die übergebenen Ereignisse und legt einen Eintrag `{ status, at }` an, wenn der Status der Einzelfrage nach dem Ereignis
ein anderer ist als davor; `at` = `recordedAt ?? at` des Ereignisses; gleicher Status (z. B. neuer Verweigerungsvorschlag im Legal
Clearing) ergibt keinen Eintrag; der erste Eintrag ist `captured`. Dieselbe Faltung nutzt `computeCockpit` für `statusAgeSeconds`
(eine Implementierung). **Keine eigene Zuordnung Ereignistyp → Status** (R5). Kein Akteur (Name, id, Rolle), kein Rückgabegrund,
kein Antworttext. Ohne `history.read` nur die aktuelle Station aus der Referenz.

### 7. Live

**Standard:** `getCockpit` wird **nicht gepuffert**: `BufferedRead = Exclude<ReadMethodName, 'listEvents' | 'getCockpit'>`, kein
Eintrag in `READ_TOPICS`, und im Live-Store neben `listEvents` die Durchreichung `getCockpit: () => adapter.getCockpit()` — eine
zeitabhängige Lesung, deren Wert ohne Ereignis altert. Ein Unit-Test (L1, Teil A) prüft, dass `api.getCockpit` im Live-Store existiert
und bei zwei Aufrufen zweimal den Adapter ruft. Die Seite liest neu, wenn `useApiVersion()`
zählt (Strom oder Takt), und **alle 15 s** über ein `setInterval` (Anstoß, keine Zeitquelle; pausiert, solange das Dokument
verborgen ist). Keine Fokusverschiebung, keine Layoutänderung (feste Mindesthöhen, `tabular-nums`), keine Animation. **Eine einzige
höfliche Ansage** (`aria-live="polite"`, sonst stumm): wenn eine Kennzahl neu in „kritisch“ wechselt („Leitstand: älteste offene
Einzelfrage kritisch, über 45 min“); keine Ansage bei jedem Wert. Den Verbindungszustand (Phasen `connecting`, `live`, `reconnecting`, `polling`, `offline` aus
`useConnectionState`, `connection.ts:113`) zeigt schon die Kopfzeile (`app/ConnectionStatus.tsx`); der Leitstand **wiederholt ihn
nicht**, „Stand HH:MM:SS“ bleibt neutral und sagt, wie alt die Zahlen sind. Verschwindet die fokussierte Zeile, geht der Fokus auf die Überschrift der
Liste.

### 8. Datenschutz: nichts je Person

**Standard:**

- Die Antwort enthält **nur** die Pfade der Schemas aus Entscheidung 1; die Allowlist des Tests wird **aus dem Vertrag abgeleitet**
  (A7, Schemawanderung über `openapi.yaml`), nicht von Hand gepflegt; `additionalProperties: false` verbietet jedes weitere Feld.
- Schlüssel von `openByUnit` sind ausschließlich Fachbereichs-ids des Jahrgangs, auch wenn Personen an Fachbereiche gebunden sind.
  Kein Wert je Person, je Rolle, je Sitzung, je Gerät.
- Die Seite zeigt keine Rednernamen, keine Wortmeldungsnummern, keine Akteure (auch nicht im Faden), keine Claims, keine Zahl je
  Person.
- **E13 (offen), weiter gefasst:** Ein Fachbereich mit genau einer Person macht dessen Rückstand faktisch zu einer Zahl je Person.
  Dasselbe gilt für **Rollengruppen**: Die Stationen „im Legal Clearing“ (Gruppe Legal Clearing, im Seed zwei Personen), „erfasst“
  (Gruppe Erfassung) und „freigegeben“ (Freigabe) zeigen Bestände, deren Abbau einer kleinen Gruppe zuzurechnen ist; „Legal Clearing
  über 10 min“ ist eine Wartezeit vor genau dieser Gruppe. Der **Zulauf** (Erfassungen je 5 min, mit den elf früheren Fenstern) ist
  ehrlich eingestuft: er ist die Arbeitsmenge der **Gruppe Erfassung**, nach oben begrenzt durch das Redetempo im Saal (E13). Der
  Leitstand zeigt **Bestände, Wartezeiten und Zulauf; keinen Erledigungsdurchsatz (erledigt je Zeit je Station)**; ein solcher
  Durchsatz (Z11) ist an 061b und einen Katalogeintrag gebunden. Keine Unterdrückung im Code; die
  Mindestzahl ist im Bericht als Feld `minimumGroupSize` vorgesehen (Standard `null` = nicht festgelegt, Eigentümerfrage 5); DSFA V15
  nennt den Leitstand als Empfänger, beide Fälle (Fachbereich, Rollengruppe) und den Zulauf als Zahl der Gruppe Erfassung, und
  **berichtigt** dort die bisherige Angabe „Mindestfallzahl im Code“: eine Mindestzahl gibt es im Code noch nicht, sie ist als
  Feld `minimumGroupSize` vorbereitet und hängt an E13.

### 8a. Security: Referenzen nur, was der Leser lesen darf

**Standard:** `getCockpit` reicht `computeCockpit` die Prüfung `(q) => can(actor, 'question.read', q).allow` mit; jede Referenz in
`oldestOpen.items` und `legalReview.items` wird dadurch gefiltert (R-PERM-03 heute, Schutzklassen aus 047 später automatisch). Die
**Aggregate** bleiben ungefiltert — K1 stellt sicher, dass heute nur ungebundene Leser sie bekommen. Wird gefiltert, bleiben Zahlen
und `oldestOpen.ageSeconds` gleich, `items` enthält nur lesbare Referenzen (die Hauptlesung zeigt dann Alter ohne Nummer, Entscheidung
3). **Hinweis an 047:** mit `question.read.protected` muss 047 entscheiden, ob geschützte Einzelfragen in den Aggregaten zählen.

### 8b. Bericht „Leitstand“ im Auswertungskatalog

**Standard:** Der Leitstand wird als **Bericht** (eine Ansicht, die Kennzahlen zeigt) in derselben einzigen Quelle geführt wie die
Familien: `catalog.json` bekommt ein Feld `reports` (Liste), Eintrag `id: "leitstand"`, `spec: "061"`, `operationId:
"getMeetingCockpit"`, `permission: "cockpit.read"`, `aggregation` als **strukturierte Liste** `["meeting", "status", "unit"]`
mit Kennzeichen `questionReferences: true` (Referenzen je Einzelfrage; kein Freitext, damit die Begriffsprüfung der Regel (g) nicht an
Wörtern wie „ohne Person“ anschlägt), `minimumGroupSize: null`, `fields` (je **Blattpfad** des Schemas `Cockpit`: Pfad, Quelle =
Katalogfamilie, `Meeting.counts`-Feld, `derived:` oder `meta:` nach dem Abschnitt „Kennzahlen-Allowlist“, `personalReference`). Im Kern spiegelt `COCKPIT_REPORT` in `cockpit.ts` denselben
Deskriptor (Aggregationsstufe, Mindestzahl, Felder); Test A6 hält beide gleich. Technisch möglich, geprüft: `renderMetrics` iteriert
nur `catalog.metrics` (Prometheus-Ausgabe unberührt, A5), das Tor lehnt unbekannte Schlüssel der obersten Ebene nicht ab.

- **Generator** `scripts/auswertungskatalog.mjs`: neuer Abschnitt „## Berichte (Oberfläche)“ je Bericht mit Zweck, Recht,
  Operation, Aggregation, Mindestzahl, Feldtabelle; JSON-Ausgabe mit `reports`. Test G1 in `auswertungskatalog.test.mjs`.
- **Tor** `scripts/metrics-allowlist-check.mjs`, neue Regel **(g)**: jeder Bericht hat eine `id` nach `^[a-z0-9-]+$`, eine `spec`,
  deren Abschnitt „## Kennzahlen-Allowlist“ die `id` in Backticks nennt; `aggregation` ist eine Liste aus `meeting`, `status`, `unit`, `seat`
  (geschlossene Menge) plus das boolesche `questionReferences`; kein Feldpfad enthält einen Personenbegriff (gleiche Liste wie (c));
  jede `fields[].source` ist eine Familie aus `metrics`, ein Feld `Meeting.counts.*`, `derived:` mit Begründung oder `meta:`
  (Stammdaten der Antwort ohne Kennzahl). Fehlt `reports`, ist das kein Fehler (Rückwärtsverträglichkeit). Tests G2, G3 mit Fixtures.

### 9. Platz für die Kanarienfrage (086)

**Standard:** ruhige Zeile im Kopf: „Kanarienfrage: nicht eingerichtet“ in Grau 600, ohne Farbe, nicht fokussierbar; Komponente
`CanaryLine` mit `status?: undefined`, die 086 füllt. Kein Vertragsfeld in 061. Eigentümerfrage 2.

### 10. Zeit

**Standard:** Jede Altersangabe stammt aus dem Dienst oder ist `max(0, asOf − Zeitstempel)` derselben Lesung. Der Code unter
`features/cockpit/**` liest nie die Uhr des Geräts (Test W7). Im Kern kommt `now` aus `clock()` (R8).

### 11. Tastaturpfad (D8)

**Standard:** Tab: „Faden öffnen“ → „Danach die ältesten“ → vier Karten (Namen nach dem Muster aus Entscheidung 4, etwa „Liste öffnen: Ohne Endstatus, 47“) → Stationsspalten →
Fachbereichszeilen → Liste (Pfeil auf/ab, Enter öffnet den Faden) → Faden (Schließen). Escape schließt erst den Faden, dann die
Liste; Fokus zurück zum Auslöser. Kein neues globales Kürzel.

### 12. Wandbildschirm und Zoom

**Standard:** bei 1280 × 720 mit ausgeklappter Navigation sind Hauptlesung, vier Karten mit Zulauf und die Stationen ohne Scrollen
sichtbar (Screenshot); keine Information nur im Hover; Kontrast nach den Tokens. Bei 200 % Zoom eine Spalte ohne waagrechtes Scrollen.
Keine eigene Großanzeige.

### 13. Sprache, Begriffe, Glossar

**Standard:** neues i18n-Modul `cockpit` (DE, en-US; rund 62 Schlüssel, der Bau nennt die Zahl) und drei Shell-Schlüssel; Parität
621 → 621 + n. Begriffe: „Leitstand“ / „Cockpit“ (Glossar), „im Legal Clearing“, „Stationen“ / „Stations“, „Engpass“ /
„Bottleneck“, „Rückstand je Fachbereich“, „Zulauf je 5 min“, „Auf der Bühne“, „Ohne Endstatus“ / „No final status yet“, „Faden“ /
„Thread“, „Kanarienfrage“ / „Canary question“, „erhöht“ / „elevated“, „kritisch“ / „critical“. Nie „Dashboard“, „Ticket“, „KPI“.
Glossar: **Faden** (`statusTrail`; „Timeline“ verboten); **Endstatus** (Oberfläche: vorgelesen, abgeschlossen, zurückgezogen,
zusammengeführt = Gegenteil von „offen“ im Katalog 033b; **nicht** dasselbe wie `TERMINAL_STATUSES` im Code, das „vorgelesen“
nicht enthält, weil danach noch „abgeschlossen“ folgen kann; „terminal“ in Texten verboten); **Kanarienfrage** (Platzhalter in 061,
Inhalt 086); **Engpass** (Kennzeichen an der Station Legal Clearing ab Stufe erhöht); Zeile **Leitstand** um `getMeetingCockpit`,
`cockpit.read`, Bericht `leitstand` ergänzt.

## Kennzahlen-Allowlist

Bericht `leitstand` (Entscheidung 8b). Keine neue Familie; jeder **Blattpfad** von `Cockpit` hat eine Quelle (Familie, `Meeting.counts`,
`derived:` oder `meta:`); die Feldliste von `COCKPIT_REPORT` und A7 vergleichen genau diese Blattpfade:

| Feld | Quelle | Personenbezug |
|---|---|---|
| `oldestOpen.ageSeconds` | Familie `hv_open_question_oldest_age_seconds` | keiner |
| `openByUnit`, `openUnassigned` | Familie `hv_open_questions` (Label `unit_id`; `unassigned`) | E13: Fachbereich mit einer Person |
| `inflow.last5m`, `inflow.bins[11]` | Familie `hv_questions_captured_last_5m` | E13: Gruppe Erfassung, begrenzt durch Redetempo |
| `inflow.bins[0..10]` | dieselbe Definition, frühere Fenster (Zeitreihe derselben Familie, `derived:`) | E13: Gruppe Erfassung, begrenzt durch Redetempo (Eigentümerfrage 5: ggf. entfallen) |
| `inflow.binSeconds` | `meta:` (Konstante 300) | keiner |
| `legalReview.over10m` | Familie `hv_questions_in_legal_review_over_10m` | E13: Rollengruppe Legal Clearing |
| `totals.captured` | `Meeting.counts.questions` | keiner |
| `totals.open` | `Meeting.counts.open` | keiner |
| `totals.staged` | `Meeting.counts.staged` | keiner |
| `totals.answered` | `Meeting.counts.delivered` (zählt delivered und closed) | keiner |
| `openByStatus.*` | `Meeting.counts.byStatus` | E13: Rollengruppen Erfassung, Legal Clearing, Freigabe |
| `oldestOpen.items[].{id,number,status,unitId,ageSeconds,statusAgeSeconds}`, `legalReview.items[].{id,number,status,unitId,ageSeconds,statusAgeSeconds,reviewAgeSeconds}` | Referenzen je Einzelfrage (`derived:` aus der Projektion, gefiltert nach `can()`), keine Kennzahl | keiner (kein Redner, kein Akteur) |
| `meetingId`, `asOf`, `meetingStatus`, `debateClosedAt` | `meta:` | keiner |

## Nicht-Ziele

- Keine Prognosen (Z11), kein Flussbild mit Punkt je Einzelfrage (Z12): 061b. Kein Erledigungsdurchsatz (erledigt je Zeit je Station).
- **Keine neue Kennzahlfamilie**, keine Änderung an `/metrics` oder `prometheus.ts`; `catalog.json` bekommt nur den Bericht.
- Keine Schwellen je Jahrgang, keine Konfiguration, keine Alarme (085), kein Inhalt der Kanarienfrage (086), keine Restantenliste
  (087), kein Debattenschluss, kein Schreiben.
- Kein Sprung in andere Ansichten mit Filter; keine Quelle der Rechtemenge (089b); keine Druckstile, keine Großanzeige.
- Kein Ausschluss synthetischer Einzelfragen (086). Keine Änderung an `components/**`, `styles/**`, anderen Feature-Ordnern oder der
  Shell außer der Registerzeile.

## Files allowed

Teil A — Vertragsschritt (Architekt):
- `packages/contract/openapi.yaml` (nur `cockpit.read` im Enum `Action` mit seinem „Since“-Absatz, die Operation `getMeetingCockpit`, die Schemas `Cockpit`, `CockpitOldestRef`, `CockpitReviewRef`, ggf. ein Tag, `info.version`)
- `packages/contract/package.json` (nur `version`)
- `packages/contract/CHANGELOG.md` (nur der neue Abschnitt)
- `packages/contract/src/types.ts` (nur neu erzeugt)
- `apps/api/src/__tests__/takt-019-contract.test.ts` (nur die Zeilen zu Version und Zahl der Operationen)
- `apps/api/src/__tests__/contract.test.ts` (nur die Versionszeile)

Teil A — Kern, Dienst, Katalog (implementierer-backend):
- `packages/domain/src/cockpit.ts` (neu)
- `packages/domain/src/__tests__/cockpit061.test.ts` (neu)
- `packages/domain/src/indicators.ts` (nur gemeinsame Hilfen exportieren oder aus `cockpit.ts` importieren; Ausgabe unverändert)
- `packages/domain/src/types.ts` (nur `cockpit.read` in `PERMISSIONS`, `getCockpit` in `READ_PERMISSIONS`, die drei Typen)
- `packages/domain/src/permissions.ts` (nur `cockpit.read` in den Bündeln moderation, coordination, admin)
- `packages/domain/src/api.ts` (nur `getCockpit` in `HvApi` und seine Umsetzung)
- `packages/domain/src/index.ts` (nur Exporte aus `cockpit.ts`)
- `packages/domain/src/__tests__/admin040a.test.ts` (nur die Liste der Administration 14 → 15, der Testtitel „fourteen“ und Zeile 48 `PERMISSIONS.length - 14`)
- `packages/domain/src/__tests__/api.test.ts` (nur die Zeile mit dem Bündel der Koordination)
- `packages/domain/policy-truth-table.md` (nur neu erzeugt: Spalte `cockpit.read` in der Tabelle „Role × Leserecht“)
- `packages/domain/src/__tests__/forward048.test.ts` (nur die Zeile der Administrationsliste)
- `apps/api/src/app.ts` (nur die Route `GET /v1/meetings/:meetingId/cockpit`)
- `apps/api/src/__tests__/cockpit061.test.ts` (neu)
- `apps/api/src/__tests__/postgres-cockpit061.test.ts` (neu)
- `apps/api/src/__tests__/fixtures/metrics-golden-061.txt` (neu, vor jeder Änderung an `indicators.ts` erzeugt)
- `apps/api/src/metrics/catalog.json` (nur das neue Feld `reports`)
- `scripts/auswertungskatalog.mjs` (nur der Abschnitt Berichte), `scripts/auswertungskatalog.test.mjs` (nur Test G1)
- `scripts/metrics-allowlist-check.mjs` (nur Regel (g)), `scripts/metrics-allowlist-check.test.mjs` (nur Tests G2, G3)
- `scripts/fixtures/metrics-allowlist/report-*.json` (neu)
- `docs/sicherheit/bedrohungsmodell.md` (nur eine Zeile 061 in „Weitere Scheiben mit Sicherheitsbezug“, Verweis in der Zeile T-G2-D-03 und der neue Missbrauchsfall MF-17)
- `docs/datenschutz/dsfa-vorentwurf.md` (nur Zeile V15)

Teil A — Web-Adapter, damit Teil A allein durch `pnpm gates` kommt (implementierer-backend):
- `apps/web/src/api/http.ts` (nur die Route `getCockpit`)
- `apps/web/src/api/liveStore.ts` (nur `getCockpit` im Ausschluss von `BufferedRead` und die Durchreichung neben `listEvents`)
- `apps/web/src/api/http.test.ts` (nur die Zeile der Routentabelle für `getCockpit`)
- `apps/web/src/api/liveStore061.test.ts` (neu, Test L1)
- `apps/web/src/api/liveStore.test.ts` (nur Test „(p)“: `getCockpit` steht neben `listEvents` als ungepufferte Lesemethode; Nachtrag des Orchestrators nach der Nachprüfung, 05.10.2026)
- `apps/web/src/i18n/labels.ts` (nur der Eintrag `cockpit.read` in `ACTION_KEYS`)
- `apps/web/src/i18n/{shell.de,shell.en}.ts` (nur `action.cockpit.read`)
- `apps/web/src/i18n/parity.test.ts` (nur die Gesamtzahl +1 und ihr Kommentar)

Teil B — Oberfläche (implementierer-oberflaeche):
- `apps/web/src/features/cockpit/**` (neu)
- `apps/web/src/api/cockpit.ts` (neu: Wiederausgabe von `cockpitLevel`, `COCKPIT_THRESHOLDS`, `statusTrail` und der Typen für die Ansicht)
- `apps/web/src/api/cockpit061.test.ts` (neu)
- `apps/web/src/app/featureRegistry.ts` (nur die Zeile `cockpit`, ihr Import und ihr Symbol)
- `apps/web/src/app/featureRegistry.test.ts` (nur die Erwartungen zur neuen Zeile)
- `apps/web/src/i18n/cockpit.de.ts` (neu), `apps/web/src/i18n/cockpit.en.ts` (neu)
- `apps/web/src/i18n/{de,en}.ts` (nur das Modul `cockpit`)
- `apps/web/src/i18n/{shell.de,shell.en}.ts` (in Teil B nur `nav.cockpit`, `page.cockpit.*`)
- `apps/web/src/i18n/parity.test.ts` (in Teil B nur Modul `cockpit` und die Gesamtzahl)
- `apps/web/e2e/061-leitstand.spec.ts` (neu)
- `apps/web/playwright.config.ts` (nur `SHARED_SPECS`)
- `scripts/e2e-http-031.test.mjs` (nur `SHARED_FILES` und `HTTP_ORDER`: die neue Datei zwischen 055b und 080)
- `docs/evidence/061-*.png`
- `docs/glossar.md` (nur die Zeilen aus Entscheidung 13)
- `docs/feedback/2026-09-zielbild-oberflaeche.md` (nur Status Z10 `ist (061)`, Z13 `ist teilweise (061)`, Ort von Z11 und Z12 auf 061b)

Beide Teile:
- `docs/folgeliste.md` (nur nicht blockierende Befunde aus Bau und Review)
- `docs/slices/061-leitstand.md` (diese Spec: Bericht, Review findings)

## Ausdrücklich nicht erlaubt

`apps/web/src/components`, `apps/web/src/styles`, `apps/web/src/app` außer den zwei Registerdateien, die übrigen Feature-Ordner,
`apps/api/src/metrics/prometheus.ts`, die Familien in `catalog.json`, `scripts/` außer den genannten Dateien, die Wahrheitstabelle außer
der neu erzeugten Spalte `cockpit.read` in „Role × Leserecht“, `apps/web/src/i18n/labels.ts` außer dem einen Eintrag,
`docs/produktplan-beta.md`, `.github`. Fehlt etwas: anhalten und melden. Dieser Abschnitt steht bewusst außerhalb von „Files allowed“.

## Vor dem Bau prüfen

1. Nachprüfung der Blocker und major-Punkte in frischem Kontext liegt vor; dann der Vertragsschritt. Vertragsversion lesen
   (046 gemergt? dann 0.4.6).
2. **Golden zuerst:** vor jeder Änderung an `indicators.ts` die Ausgabe von `renderMetrics` für den Seed mit fester Uhr als
   `metrics-golden-061.txt` committen (eigener Commit); A5 vergleicht dagegen.
3. `reduce` lässt sich über die Ereignisse falten, die `getQuestionHistory` liefert, und ergibt für jede Einzelfrage des Seeds den
   Status von `getQuestion`. **Geht das nicht, anhalten und melden**; keine zweite Zuordnung Ereignistyp → Status. Rückfall: der Faden
   zeigt nur die aktuelle Station aus der Referenz; `statusAgeSeconds` kommt **in jedem Fall** aus der Faltung in `computeCockpit`
   über das vollständige Log des Jahrgangs (dort ist der Zustand vollständig).
4. `listQuestions({ status: […], limit: 2000 })` ist für moderation, coordination und admin in beiden Projekten vollständig.
5. Rechenzeit (T-G2-D-03): `getCockpit` bei 800 in-process p90 < 50 ms. Darüber: Zwischenspeicher je Jahrgang bis zum nächsten
   Ereignis oder 5 s, eine Rechnung zur Zeit (`createSingleFlightCache`), Filter nach `can()` je Leser **nach** dem Zwischenspeicher.
6. Laufzeit `e2e-http` aus den letzten drei grünen Läufen; Schätzung +0:40 (nur Lesen); über 6:30 im Bericht nennen, über 11:00
   anhalten. Die e2e-Datei schreibt im Projekt `http` nichts.

## Tests zuerst (rot, dann grün)

**Kern** (`packages/domain/src/__tests__/cockpit061.test.ts`, feste Uhr):

- **K1 Rechte.** Genau moderation, coordination, admin halten `cockpit.read` (Liste als Daten im Test); die Administration hat 15
  Rechte, `cockpit.read` zuletzt; jeder Inhaber hält `question.read`, und sein Bündel ist **kein** `unitBound`-Bündel.
- **K2 Verweigerung.** `getCockpit` für jede übrige Rolle (datengetrieben) und für eine gebundene Fachkraft: 403 R-PERM-02, keine
  Teildaten.
- **K3 Gleichheit mit 033b** (laufender Jahrgang; Seed und Grenzfall-Liste: Erfassung 300/301 s, Eintritt ins Legal Clearing 600/601 s,
  ein **eigens gebautes Altereignis** `QuestionReturned` mit `toStatus: in_review` — über die API nicht erzeugbar, weil
R-TRANS-06 nie nach `in_review` führt, von 033b aber gezählt —, neuer Verweigerungsvorschlag): `oldestOpen.ageSeconds`, `openByUnit` + `openUnassigned`,
  `inflow.last5m`, `legalReview.over10m` gleich `computeIndicators`.
- **K4 Zulauf.** 12 Fächer, disjunkt, `bins[11] === last5m`, Summe = Erfassungen mit Alter ≤ 3600 s; Grenzen 300/600/3600 s.
- **K5 Älteste und Verweildauer.** Höchstens 4 Referenzen, älteste zuerst, Gleichstand nach `number`; `items[0].ageSeconds ===
  ageSeconds`. `statusAgeSeconds` = Sekunden seit dem letzten Ereignis, nach dem sich der Status geändert hat: **unverändert** nach
  Claim und Freigabe des Claims, Rechtsfreigabe (Status bleibt `in_review`), Weiterleiten und neuem Verweigerungsvorschlag im Legal
  Clearing; **neu gesetzt** nach Zuweisen (classified → assigned), Einreichen, Zurückgeben, Freigeben.
- **K6 Legal Clearing.** Höchstens 50, längste Wartezeit zuerst, `reviewAgeSeconds > 600`, Rücksetzen beim neuen Vorschlag;
  `reviewAgeSeconds` erscheint nie in `oldestOpen.items`.
- **K7 Datenschutz (Negativtest).** Seed mit Rollenzuordnungen, die Personen an Fachbereiche binden, mit `personId` und Klarnamen;
  Akteur coordination (hält `question.identity.reveal`): die serialisierte Antwort enthält keine Akteur-id, keine `personId`, keine
  `subjectId` einer Rollenzuordnung, keinen `speakerId`, keinen Rednernamen, keinen Teil eines Fragetexts; Schlüssel von `openByUnit`
  = Fachbereichs-ids. Rot-Probe: ein ergänztes Feld `claimedBy` lässt den Test scheitern (im Bericht gezeigt, nicht committet).
- **K8 Zeit.** `asOf` = injizierte Uhr; Uhr +10 min ohne Ereignis ⇒ alle Alter + 600, `over10m` und Stufen folgen; Ereignis nach `asOf`
  zählt nirgends.
- **K9 Statusverlauf.** `statusTrail` für jede Einzelfrage des Seeds: letzter Eintrag = projizierter Status, erster = `captured`, kein
  Eintrag ohne Statuswechsel; über die Ereignisse aus `getQuestionHistory`; `statusAgeSeconds` = `asOf − letzter Eintrag.at`.
- **K10 Stufen.** `cockpitLevel` an jeder Schwelle; Zulauf und Bühne immer `calm`; „Ohne Endstatus“ vor Debattenschluss `calm`,
  danach bei > 0 `attention`; „Ohne Fachbereich“ mit den Rückstandsschwellen.
- **K11 Jahrgang nicht laufend / leer.** `preparation`, `closed` gerechnet; leerer Jahrgang: Nullen, `items` leer, `bins` zwölf Nullen.
- **K12 Filter nach `can()`.** Mit einer Prüfung, die eine bestimmte Einzelfrage ablehnt: sie fehlt in `items`, alle Zahlen und
  `oldestOpen.ageSeconds` bleiben gleich.

**Dienst und Katalog** (`apps/api/src/__tests__/cockpit061.test.ts`, `postgres-cockpit061.test.ts`; `scripts/*.test.mjs`):

- **A1** 200 für coordination, gültig gegen das Vertragsschema, Header `X-Server-Time`.
- **A2** 403 R-PERM-02 für expert und observer mit Regel-id; 401 ohne Akteur; 404 unbekannter Jahrgang.
- **A3** Antwort über HTTP gleich `getCockpit` in-process für denselben Speicher und dieselbe Uhr.
- **A4** (Postgres) 200 aus dem Jahrgangs-Schnappschuss (takt-024); 503 `PersistenceBusy` bei belegter Persistenz wie andere Lesungen;
  Zugriffslog mit `operationId`, ohne Antwortinhalt.
- **A5** `/metrics` unverändert (früher K3b): Ausgabe von `renderMetrics` für den Seed mit fester Uhr gleich `metrics-golden-061.txt`
  (rot, wenn ein Refactoring die Ausgabe ändert; die Rot-Probe steht im Bericht).
- **A6** Bericht: `catalog.json` `reports[leitstand]` gleich `COCKPIT_REPORT` (Felder, Aggregation, Mindestzahl, Recht, Operation).
- **A7** Allowlist aus dem Vertrag (früher Teil von K7): die Menge der **Blattpfade** (etwa `inflow.binSeconds`,
  `legalReview.items[].reviewAgeSeconds`), die das Schema `Cockpit` mit Unterschemas erlaubt, ist
  gleich der Feldliste von `COCKPIT_REPORT`, und jede tatsächliche Antwort (Seed, alle drei Inhaber) enthält nur solche Pfade.
- **G1** Generator schreibt den Abschnitt „Berichte (Oberfläche)“ mit `leitstand` und `reports` ins JSON.
- **G2** Tor grün mit dem echten Katalog und für einen Katalog ohne `reports`; **G3** rot für die Fixtures
  `report-person-field.json` (Feldpfad mit `actor`), `report-no-spec-section.json`, `report-bad-source.json`, `report-bad-id.json`.

**Web-Adapter, Teil A** (`apps/web/src/api/liveStore061.test.ts`):

- **L1** `api.getCockpit` existiert im Live-Store, wird nicht gepuffert (zwei Aufrufe ⇒ zwei Adapteraufrufe) und gibt die Antwort
  des Adapters unverändert weiter; `READ_TOPICS` hat keinen Eintrag `getCockpit` (Typprüfung).

**Web, Teil B** (`apps/web/src/api/cockpit061.test.ts`, `apps/web/src/features/cockpit/*.test.ts(x)`):

- **W1** Stufen: ruhig ohne Badge; erhöht/kritisch mit Symbol, Wort und Schwelle aus `COCKPIT_THRESHOLDS`; „Engpass“ an der Station
  Legal Clearing genau ab erhöht; zugängliche Namen aller Kennzahlen, Stationsspalten und Fachbereichszeilen nach dem einen Muster aus Entscheidung 4.
- **W2** Zulauf: 12 Rechtecke in 280 × 48, Grundlinie 0, Skala `max(…, 5)`, jüngste Säule Akzent, Strich für leere Fenster,
  Achsenbeschriftungen, Name mit allen Werten.
- **W3** Rückstand: Reihenfolge, „Ohne Fachbereich“ zuletzt mit Unterzeile, `data-count`, Füllfarbe nur bei Stufe, Schwellenstrich an
  der richtigen Position (Anteil 20 / Skala).
- **W4** Zustände: Laden mit festen Höhen, Fehler mit Regel-id und „Erneut laden“, `cockpit-forbidden`, leer, Hauptlesung ohne
  lesbare Referenz (8a).
- **W5** Datenschutz im DOM: Liste „Ohne Endstatus“ und Faden offen ⇒ kein Rednername aus `listSpeakers`, keine Akteur-id (`u-…`).
- **W6** Faden: waagrecht, Einträge in Zeitreihenfolge mit HH:MM, aktuelle mit „seit n min“, drei Formen, Umbruch nach acht, kein
  Akteur, kein Rückgabegrund.
- **W7** Keine Geräteuhr in `features/cockpit/` (Test liest die Dateien).
- **W8** Tastatur und Fokus: Pfad nach Entscheidung 11; eine Live-Aktualisierung verschiebt den Fokus nicht.
- **W9** Live in-process über den echten Live-Store: Zurückziehen durch moderation ⇒ `totals.open` sinkt ohne Neuladen; das
  15-s-Intervall liest `getCockpit` am Puffer vorbei (zwei Aufrufe ⇒ zwei Rechnungen).
- **W10** Zeit: `getCockpit` bei 800 p90 < 50 ms; Liste „Ohne Endstatus“ bei 800 p90 < 100 ms (D9).
  *Angenommen vom Orchestrator (06.10.2026, Review R6):* harte Grenze für `getCockpit` 100 ms wie `timing053`, bis zu drei
  Messreihen, die beste zählt, jede steht im Log mit „within/above“ gegen 50 ms; Stolperdraht: mit gesetztem `CI` muss die beste
  Messreihe unter 50 ms liegen (sonst Zwischenspeicher nach Vor-dem-Bau-Punkt 5).
- **W11** Ansage: Wechsel einer Kennzahl nach „kritisch“ erzeugt genau eine Ansage; gleichbleibend kritisch keine weitere; Wechsel
  nach erhöht keine.

**e2e** (`apps/web/e2e/061-leitstand.spec.ts`, Projekte `in-process` und `http`, axe bei jedem Ansichtswechsel):

- **S1** coordination öffnet `/cockpit`: Hauptlesung, vier Karten, Zulauf, Stationen, Rückstand sichtbar; genau eine primäre
  Schaltfläche.
- **S2** Gleichheit über Ansichten: „Ohne Endstatus“ = Zähler `open` der Navigation; „Auf der Bühne“ = Zähler `staged`; jede
  Fachbereichszeile = Zelle der Verteilung in `/steering`.
- **S3** Drill-down Legal Clearing: Zeilenzahl = Kennzahl (bis 50), Spalte „wartet seit“; Enter ⇒ Faden mit aktueller Station; Escape,
  Escape ⇒ zu, Fokus auf der Karte; URL mit und ohne `list=legal`.
- **S4** Lesezustand für expert.
- **S5** (nur in-process) moderation zieht eine Einzelfrage zurück ⇒ „Ohne Endstatus“ N − 1, Einzelfrage fehlt in der Liste.
- **S6** Datenschutz: nach S3 kein Rednername aus dem Seed, keine Akteur-id im Seiteninhalt.
- **S7** 200 % Zoom (640 CSS-px): kein waagrechtes Scrollen.
- **S8** Screenshots (in-process, Schriften geladen): `061-leitstand-de.png`, `061-leitstand-en.png` (1440 × 900),
  `061-liste-faden-de.png`, `061-liste-faden-en.png` (Liste Legal Clearing mit waagrechtem Faden), `061-wand-1280x720-de.png`,
  `061-wand-1280x720-en.png`.

## Akzeptanzkriterium

1. Nachprüfung liegt vor; Vertragsschritt als erster Commit von Teil A, Golden als eigener Commit vor jeder Änderung an
   `indicators.ts`.
2. Teil A: K1–K12, A1–A7, G1–G3, L1 vor der Änderung rot (Ausgabe im Bericht), danach grün; `pnpm gates` grün auf dem Branch von Teil A.
3. Teil B: W1–W11 rot, dann grün; S1–S8 `in-process` grün, auch mit `--repeat-each=3`; S1–S4, S6, S7 im Projekt `http` grün im CI-Lauf
   `e2e-http` des PR; volle Suite `in-process` grün, darunter unverändert 001, 013, 053, 054; axe ohne serious/critical.
4. Sechs Screenshots nach S8; auf dem Hauptbild sind Hauptlesung mit Stufe und Schwelle, vier Karten, Zulauf mit Achse, Stationen mit
   Zahlen, Rückstand mit Schwellenstrich und die Kanarienzeile lesbar.
5. `pnpm role-literals`, `i18n-literals`, `vocabulary`, `now-check`, `metrics-allowlist` grün; Parität mit neuer Zahl;
   `policy-truth-table.md` nur um die Spalte `cockpit.read` in „Role × Leserecht“ geändert (Diff im Bericht, Rechteentscheidung);
   `/metrics` unverändert (A5); Artefakt `auswertungskatalog` des PR-Laufs enthält den Bericht.
6. Keine neue Abhängigkeit in einer `package.json` (takt-047).
7. `pnpm slice-scope` grün auf beiden Branches; `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).
8. Design-Kritik in frischem Kontext ohne Blocker (Tabelle unten), mit Vergleich zu `089-lagebild.png` und Prüfung der benannten
   Ausnahmen (44-px-Hauptzahl, 11-px-Achse, 3-px-Statustönung als Oberkante der Stationen, leerer Zustand ohne Aktion).

## Nachweise

- Rote und grüne Testausgaben, Schluss von `pnpm gates` mit Commit je Teil, Playwright-Zahlen, Zeitmessungen.
- `docs/evidence/061-*.png` (sechs Bilder aus `in-process`).
- Projekt `http`: grüner CI-Lauf `e2e-http` des PR von Teil B mit Lauf-ID, Job-ID, Log-Schluss mit den Fällen aus
  `061-leitstand.spec.ts`, Dauer gegen 12:00 (Warnschwelle 6:30).
- Artefakt `auswertungskatalog` des PR von Teil A (Lauf-ID, Artefakt-ID) mit dem Abschnitt „Berichte (Oberfläche)“.
- K7 und A5 mit Rot-Probe; Schlüsselweg der Antwort.
- Design-Kritik als Tabelle im Bericht.

### Design-Vorgaben D1–D10 (Maßstab der Design-Kritik)

| D | Vorgabe für diese Scheibe | Prüfung |
|---|---|---|
| D1 | In 30 s klar: links oben die älteste offene Einzelfrage, rechts drei Karten und der Zulauf, darunter Stationen mit Engpass und Rückstand; Titel und ein Satz. | Screenshot, Design-Kritik |
| D2 | Genau eine primäre Schaltfläche („Faden öffnen“); leerer Zustand ohne Aktion als benannte Ausnahme. | S1, W4 |
| D3 | 12-Spalten-Raster, 8-px-Raster, Unterkanten Hauptlesung/Zulauf fluchten, Karten gleich hoch; benannte Ausnahmen: Hauptzahl 44 px (40 px an der Wand), Achse 11 px, 3-px-Statustönung der Stationen (D4); Kartenzahlen 28 px, Stationen 20 px. | Screenshot |
| D4 | Ruhe ohne Farbe; Farbe nur bei Stufe als Badge oder Balkenfüllung, Statustönung der Stationen nur als 3-px-Kante; Zulauf einfarbig; keine Verläufe, keine Schatten. | W1–W3 |
| D5 | Alle Zahlen, Nummern, Zeiten Mono, rechtsbündig, `tabular-nums`; Fehler mit Regel-id. | W3, W4 |
| D6 | Laden, leer, Fehler, Lesezustand, leere Liste, Referenz nicht lesbar gestaltet; Verbindungszustand nur in der Kopfzeile (nicht doppelt). | W4, S4 |
| D7 | Texte aus `cockpit.*`/Shell, DE/en-US, Hausvokabular. | Parität, `pnpm vocabulary` |
| D8 | Kernszene per Tastatur, Escape zweistufig, Fokus sichtbar, Live ohne Fokussprung, eine Ansage nur bei „kritisch“. | W8, W11, S3 |
| D9 | Nichts Ausgegrautes; Lesezustand statt Teildaten; Liste < 100 ms, `getCockpit` < 50 ms bei 800. | W10, S4 |
| D10 | Konsole von 2026: die große Zahl trägt, Stationen und Säulen sind genau und klein, Schwellen sichtbar, nichts wirkt wie eine Vorlage. | Design-Kritik gegen 089-lagebild |

## Wirkung und Risiko

| Risiko | Abwehr | Nachweis |
|---|---|---|
| Kennzahl je Person (Feld, Schlüssel, Faden mit Akteur) | Schema `additionalProperties: false`, Allowlist aus dem Vertrag, Bericht im Katalog mit Tor-Regel (g), Faden ohne Akteure | K7, A6, A7, G3, W5, S6 |
| Leistungskontrolle kleiner Gruppen (E13) | nur Bestände, Wartezeiten und Zulauf, kein Erledigungsdurchsatz; `minimumGroupSize` vorgesehen; MF-17 | Kennzahlen-Allowlist, Bedrohungsmodell |
| Referenz auf eine Einzelfrage, die der Leser nicht lesen darf | Filter nach `can(actor, 'question.read', q)`; Inhaber ungebunden (K1) | K1, K12 |
| Zwei Definitionen (Leitstand ≠ `/metrics`) | gemeinsame Hilfen, Gleichheitstest, Golden | K3, A5 |
| Recht ohne Prüfung | `READ_PERMISSIONS`; 403 statt Teildaten | K2, A2, S4 |
| Statuslogik außerhalb der Tabelle | eine Faltung über `reduce` | K5, K9 |
| Zeit aus dem Gerät | Alter aus dem Dienst bzw. `asOf` | K8, W7 |
| Rechenlast (T-G2-D-03) | Messung bei 800, Zwischenspeicher nur bei Bedarf, kein Puffer im Browser, 15 s | W10, Vor-dem-Bau-Punkt 5 |
| Dashboard-Lärm | Farbe nur bei Stufe, keine Animation, eine Ansage nur bei „kritisch“ | W1, W11, Design-Kritik |
| Schwellen falsch gewählt | Konstanten an einer Stelle, Eigentümerfrage 1 | K10 |
| `e2e-http` zu lang | nur Lesen, Messung vor dem Bau | Vor-dem-Bau-Punkt 6 |

**Missbrauchsfall MF-17 „Leistungsauswertung über den Leitstand“** (061; verwandt MF-09), Text für das Bedrohungsmodell:
- *Ablauf:* eine Person mit `cockpit.read` beobachtet über den Tag „im Legal Clearing“, „Legal Clearing über 10 min“, den Zulauf
  (Arbeitsmenge der Erfassung) oder den Rückstand eines Fachbereichs mit einer Person und schließt auf die Arbeitsgeschwindigkeit einzelner Beschäftigter; Screenshots oder
  Mitschriften der Wand ersetzen eine Auswertung.
- *Verhindert durch:* nur Bestände, Wartezeiten und Zulauf, kein Erledigungsdurchsatz (erledigt je Zeit je Station), kein Akteur, keine Zahl je Person (Allowlist, Tor-Regel (g));
  Inhaberkreis auf drei Rollen; Mindestzahl über E13 vorbereitet (`minimumGroupSize`); organisatorisch die Betriebsvereinbarung.
- *Erkennung, Signal und Empfänger:* jede Lesung steht im Zugriffslog mit `operationId` `getMeetingCockpit` und `subjectHash`
  (033a); auffällige Lesemuster außerhalb des HV-Fensters prüft der Datenschutz im Verfahren zu zweit (ADR 0013); Empfänger DSB und
  Betriebsrat über die Betriebsakte. Kein automatischer Alarm (Ausnahme mit Eigentümer Datenschutz, Ablauf mit E13, spätestens
  29.01.2027).
- *Nachweis:* K7, A6, A7, G3.

## Aufwand

Geschätzt **5,0 AStd** (Spanne 4,4–5,6), erste Fassung 3,9, zweite 4,9; die Nachprüfung verschiebt den Web-Adapter nach Teil A
(+0,15 in A, −0,1 in B) und ergänzt L1, die Spalte der Wahrheitstabelle und die strukturierte Aggregation (+0,05). Plan: 2 AStd, mit Zielbild 3,75. Mehraufwand gegenüber der ersten
Fassung rund 1,0 AStd: Bericht im Katalog mit Generator und Tor-Regel (0,35), Filter nach `can()` und schärferes K1 (0,05), Golden
(0,05), MF-17 und Zeilen (0,05), getrennte Schemas und Grenzen (0,05), weitere Testpins (0,05), Stationen über die volle Breite,
vierte Karte, Schwellenbadges, Achse, Schwellenstrich, Ansage (0,4). Differenz an Prüfpunkt 2 und die Budgettabelle (Plan 6.5).

| Teil | AStd |
|---|---|
| **A** Vertragsschritt: Recht, Operation, drei Schemas, Version an vier Stellen, CHANGELOG, Typen | 0,4 |
| **A** Kern: `cockpit.ts` (Faltung, `computeCockpit`, `statusTrail`, Schwellen, Stufen, `COCKPIT_REPORT`), Hilfen mit `indicators.ts`, Recht, `getCockpit` mit `can()`-Filter, K1–K12 | 0,85 |
| **A** Dienst: Route, Golden, A1–A7 | 0,35 |
| **A** Katalog: `reports`, Generator, Tor-Regel (g), Fixtures, G1–G3; MF-17, DSFA V15 | 0,4 |
| **A** Web-Adapter: HTTP-Route, Pufferausschluss und Durchreichung, `ACTION_KEYS`, `action.cockpit.read`, Parität, L1; Wahrheitstabelle neu erzeugt | 0,15 |
| **B** Wiederausgabe `api/cockpit.ts` | 0,05 |
| **B** Seite: Gerüst, Zustände, Hauptlesung, vier Karten, Zulauf mit Achse, Stationen mit Engpass, Rückstand mit Strich, Kanarienzeile, Live, Ansage | 1,05 |
| **B** Liste, waagrechter Faden, URL-Zustand, Tastaturpfad | 0,45 |
| **B** i18n, Registerzeile, Glossar, Zielbild-Status | 0,15 |
| **B** Web-Tests W1–W11 | 0,35 |
| **B** e2e S1–S8, axe, sechs Screenshots, Einreihung `http` | 0,5 |
| beide: `pnpm gates`, Berichte, CI-Nachweise (je 0,15) | 0,3 |

Teil A ≈ 2,3 AStd (2,15 + 0,15), Teil B ≈ 2,7 AStd (2,55 + 0,15). **Zuschnitt bei Überschreitung in Teil B:** über 3,0 AStd committet Teil B ohne Faden (K9 bleibt in
A grün; W6 und der Faden-Teil von S3 entfallen) und meldet; der Faden geht an 061b.

## Standards (auf Standard gebaut)

| Standard | Was 061 baut | Kosten einer späteren Änderung |
|---|---|---|
| Eigene Leseoperation mit `cockpit.read` | Vertrag, Kern, Dienst | — |
| Inhaber moderation, coordination, admin, alle ungebunden | `ROLE_PERMISSIONS`, K1 | weitere Rolle: eine Zeile plus Rechte-Diff, < 0,1 AStd |
| Schwellen als Konstanten | `COCKPIT_THRESHOLDS` | je Jahrgang einstellbar: rund 0,75 AStd (mit 041) |
| Bericht im Katalog, `minimumGroupSize: null` | `catalog.json`, `COCKPIT_REPORT` | Mindestzahl setzen und unterdrücken: rund 0,25 AStd |
| Kanarienzeile „nicht eingerichtet“ | `CanaryLine` | ausblenden: < 0,1 AStd |
| Letzter Eintrag, kein Kürzel | Registerzeile | Alt+7 oder erste Position: < 0,1 AStd |
| Zeilen ohne Fragetext | Liste | Text in der Zeile: < 0,1 AStd (Review Datenschutz) |
| Drill-down in der Seite | Liste, Faden | Sprung in die Steuerung mit Filter: rund 0,4 AStd in 053 |

## Offene Eigentümerfragen

Keine blockiert den Bau; alle mit Standard.

1. **Schwellen.** Älteste offene 15/45 min, Legal Clearing über 10 min 3/10, Rückstand je Fachbereich und ohne Fachbereich 20/40,
   „Ohne Endstatus“ erhöht erst nach Debattenschluss. *Standard:* Konstanten; Einstellbarkeit mit 041.
2. **Kanarienfrage vor 086.** *Standard:* ruhige Zeile „nicht eingerichtet“. Alternative: ausblenden bis 086.
3. **061b vor der Freigabe-Demo?** *Standard:* eigene Spec direkt nach 061, Bau vor der Demo nur mit Budget an Prüfpunkt 2.
4. **Navigation.** *Standard:* letzter Eintrag, kein Kürzel. Alternative: erster Eintrag, Alt+7.
5. **E13, kleine Fachbereiche und Rollengruppen** (Legal Clearing, Erfassung, Freigabe). *Standard:* keine Unterdrückung, nur
   Bestände, Wartezeiten und Zulauf, kein Erledigungsdurchsatz; `minimumGroupSize` bleibt `null`, bis die Betriebsvereinbarung eine
   Zahl nennt. Fragen: welche Mindestgröße, und gilt sie auch für Stationen, die einer Rollengruppe entsprechen? Option: die elf
   früheren Fenster des Zulaufs streichen und nur `last5m` zeigen (weniger Zeitverlauf der Gruppe Erfassung, Verlust der Säulen in
   der Demo); Standard: Säulen bleiben.
6. **Weitere Inhaber** (etwa approver). *Standard:* nein.
7. **Fragetext in Listen.** *Standard:* nein, nur im Faden.

## Hinweise an den Orchestrator

- **Planzeile 061** nachziehen: Klasse **hoch**, Lanes `contract, core, service, docs-sicherheit, web-api, web-cockpit, web-shell,
  e2e, docs`, Aufwand 5,0 AStd (Teil A 2,3, Teil B 2,7), Nachweise um Rechte-Diff, Gleichheit mit 033b, Golden, Bericht im
  Auswertungskatalog, Negativtest und Allowlist ergänzen; Rolle „Architekt (Vertragsschritt) + Implementierer-Backend +
  Implementierer-Oberfläche“; Bau in zwei PRs auf dieser Spec (vom Orchestrator angenommen 05.10.2026; **kein** Planknoten 061a).
- **Neue Planzeile 061b** „Leitstand: Flussbild und Prognosen“ (hoch; Abhängigkeit 061).
- **Vertragsreihenfolge:** 046 merged vorher (0.4.5), 061 erwartet 0.4.6; 055c danach.
- Die Statuszeile der Spec 033b ist nicht nachgezogen (`115c28b`).
- Demo-Skript (`docs/demo-skript.md`): Szene „Leitstand“ später, nicht in dieser Scheibe.

## Hinweise an Folgescheiben

- **061b:** Flussbild und `+n in 15 min` aus `statusTrail`; Prognose nur mit Katalogfamilie und Erweiterung des Berichts `leitstand`.
- **086:** `Cockpit.canary` (Vertragsschritt), `CanaryLine` füllen; synthetische Einzelfragen aus `computeCockpit` **und**
  `computeIndicators` ausschließen (gleiche Hilfe), Test in beiden; Bericht `leitstand` um das Feld ergänzen.
- **087:** „Offene Fragen vor Schluss“ als weiterer Drill-down; `debateClosedAt` schaltet die Stufe „Ohne Endstatus“ schon heute.
- **085:** Alarme lesen `COCKPIT_THRESHOLDS`.
- **Folgepunkt Beantwortung (Folgeliste):** die Schwellen 15/45 min stehen nach 061 zweimal — `urgencyLevel` in
  `features/answers/lib.ts` und `COCKPIT_THRESHOLDS` im Kern; ein Takt stellt `urgencyLevel` auf die Kernkonstante um (Beantwortung
  ist nicht in den „Files allowed“ dieser Scheibe). Der Bau trägt den Punkt in `docs/folgeliste.md` ein.
- **047:** geschützte Einzelfragen: Referenzen filtert `can()` schon; ob sie in den Aggregaten zählen, entscheidet 047 (Rechte-Diff
  oben).
- **089b:** `visibleRoutes` blendet `/cockpit` ohne `cockpit.read` aus; der Lesezustand bleibt.

## Nacharbeit nach Lesebefund (05.10.2026, Entscheidungen des Orchestrators)

| Nr. | Befund | Änderung in dieser Spec |
|---|---|---|
| B1 | `packages/contract/package.json` fehlte | in „Files allowed“ (nur `version`); Befund „Vertragsversion an vier Stellen“ |
| B2 | Versions- und Listenpins fehlten | `takt-019-contract.test.ts`, `contract.test.ts`, `forward048.test.ts` je eng beschränkt in „Files allowed“ |
| B3 | K3b im Kern nicht prüfbar, kein echtes Rot | K3b als A5 in den Dienst-Test; Golden als eigener Commit vor jeder Änderung an `indicators.ts` (Vor-dem-Bau-Punkt 2) |
| M4 | Enum heißt `Action` | Verweise korrigiert, „Since 0.4.x (slice 061)“-Absatz vorgegeben |
| M5 | 503 fehlte | `503 PersistenceBusy` in der Operation, A4 |
| M6 | Auswertungskatalog | Abschnitt „Kennzahlen-Allowlist“ (Feld → Familie oder `Meeting.counts`), `COCKPIT_REPORT`, Bericht `reports` in `catalog.json`, Generator, Tor-Regel (g), Tests A6, G1–G3; Machbarkeit geprüft (Entscheidung 8b) |
| M7 | E13 nur für Fachbereiche | auf Rollengruppen erweitert (Entscheidung 8, DSFA V15, Eigentümerfrage 5), „kein Durchsatz“ |
| M8 | Referenzen ungefiltert | Filter nach `can(actor, 'question.read', q)` (Entscheidung 8a), K1 verlangt ungebundenes `question.read`, K12, Hinweis an 047 |
| M9 | Missbrauchsfall fehlte | MF-17 mit Signal und Empfänger, T-G2-D-03 benannt, Zeile im Bedrohungsmodell in „Files allowed“ |
| m10 | Version | „0.4.x (erwartet 0.4.6)“, 046 zuerst |
| m11 | K5 unscharf | K5 mit genauer Liste; Beschriftung „seit n min in diesem Status“; Liste Legal Clearing zeigt `reviewAgeSeconds` („wartet seit“) |
| m12 | `statusTrail` | Signatur, Quelle von `at`, gleicher Status ohne Eintrag, **eine** Faltung; Quelle von `statusAgeSeconds` in beiden Zuschnittsfällen |
| m13 | 30-s-Puffer | `getCockpit` nicht gepuffert, 15-s-Intervall, W9 |
| m14 | Alter, Zahlendrift | `max(0, …)`, eigene Zahl der Liste, Drift benannt |
| m15 | Import der Kernhilfen | Wiederausgabe über `apps/web/src/api/cockpit.ts` |
| m16 | Schema | Grenzen, getrennte Schemas `CockpitOldestRef`/`CockpitReviewRef`, Allowlist aus dem Vertrag (A7) |
| m17 | Endstatus | Glossar grenzt gegen `TERMINAL_STATUSES` ab |
| m18 | Z13 | „teilweise“ (ohne Absprung in die Fokusansicht) |
| m19 | vierte Karte | entschieden: „Auf der Bühne“; Raster, D1, S1, S2 angeglichen |
| m20 | „Ohne Fachbereich“ | Unterzeile „noch nicht zugewiesen“, gleiche Schwellen (K10) |
| n24 | Ansagen | eine höfliche Ansage nur beim Wechsel nach „kritisch“ (W11) |
| n21 | Hook und Verbindungsanzeige | `useConnectionState` (`connection.ts:113`), Phase `polling` genannt; kein zweiter Verbindungshinweis, die Kopfzeile zeigt ihn (Entscheidung 7, D6) |
| n22 | zwei Muster für zugängliche Namen | ein Muster „Liste öffnen: {Beschriftung}, {Zahl}[, {Stufe} · {Schwelle}]“ (Entscheidung 4, 11, W1) |
| n23 | Schwellen doppelt | Folgepunkt: Beantwortung liest `urgencyLevel` aus dem Kern (Hinweise an Folgescheiben, Folgeliste) |
| n25 | „Rückgabe nach `in_review`“ nicht erzeugbar | in K3 als eigens gebautes Altereignis gekennzeichnet |
| — | MF-Nummer | MF-15 (046) und MF-16 (060) belegt; MF-17 |
| Demo a | Hauptzahl | 44 px Mono, „min“ 16 px Grau 600, benannte D3-Ausnahme; Karten 28 px |
| Demo b | Stationen | sechs beschriftete Spalten über die volle Breite mit „Engpass“ ab erhöht, statt `ProcessStrip` |
| Demo c | vierte Karte | „Auf der Bühne“ mit „{answered} vorgelesen“; `totals.staged` im Vertrag |
| Demo d | Faden | waagrecht, volle Breite unter der Liste |
| Demo e | Badge | Text mit Schwelle („kritisch · über 45 min“) |
| Demo f | Zulauf | 280 × 48 px, Achse 11 px „−60 min“/„jetzt“ |
| Demo g | Rückstand | Schwellenstrich „erhöht“ |
| — | Aufwand | 3,9 → 4,9 AStd; Bau in zwei Teilen auf dieser Spec |

## Bericht (nach Bau ausfüllen, je Teil)

```
Slice: 061-leitstand (Teil A | Teil B)
Done: <drei Zeilen>
Evidence: <Schluss von `pnpm gates` auf Commit …>; Teil A: Artefakt auswertungskatalog (Lauf, Artefakt-ID);
          Teil B: docs/evidence/061-leitstand-{de,en}.png, 061-liste-faden-{de,en}.png, 061-wand-1280x720-{de,en}.png;
          CI e2e-http Lauf <id>, Job <id>, Dauer <m:ss>
Open: <was nicht erledigt ist, mit Grund; Abweichungen vom Zielbild 089-lagebild>
Touched: <Dateiliste>
```

Zusätzlich: rote Testausgaben vor der Änderung; Zeitmessungen; Schlüsselweg der Antwort und Rot-Proben aus K7 und A5; Zahl der
i18n-Schlüssel; Ergebnisse der Vor-dem-Bau-Punkte 3 (Faltbarkeit), 5 (Rechenzeit) und 6 (Laufzeit); Design-Kritik D1–D10 als
Tabelle mit Vergleich zu `docs/evidence/089-lagebild.png` und Urteil zu den benannten Ausnahmen; Abweichungen vom Prototyp
(Rednernamen, Wortmeldung, Widerspruchskanal, Rednerwand, Flussbild, Prognosen) mit Grund.

### Bericht Teil A (Kern), 06.10.2026

```
Slice: 061-leitstand (Teil A)
Done: Vertrag 0.4.5 (getMeetingCockpit, cockpit.read, Cockpit/CockpitOldestRef/CockpitReviewRef); Kern cockpit.ts
      (computeCockpit, statusTrail, COCKPIT_THRESHOLDS, cockpitLevel, COCKPIT_REPORT), Recht in drei Bündeln, getCockpit
      mit can()-Filter; Route, Bericht leitstand im Katalog, Tor-Regel (g), Generator; MF-17, DSFA V15; Web-Adapter.
Evidence: pnpm gates grün auf 6185101 (Schluss unten); Teil A: Artefakt auswertungskatalog erst im PR-Lauf (offen)
Open: siehe „Offen“ unten
Touched: siehe „Dateien“ unten
```

**Commits** (auf `225cc4e`, Branch `claude/slice-061-leitstand`, nicht gepusht): `e8c3fbb` Golden zuerst · `c332c43`
Vertragsschritt · `4b8a310` Kerntests rot · `b6346c0` Kern · `c2c89dd` Katalog, Tor (g), Generator · `393f3c1` Dienst ·
`2be6a29` Web-Adapter · `6185101` MF-17, DSFA V15, Folgeliste.

**Rot, dann grün (echte Ausgaben, gekürzt):**
- Kern K1–K12 vor `cockpit.ts` (`4b8a310`): `FAIL src/__tests__/cockpit061.test.ts … Error: Cannot find module
  '../cockpit.js'`; danach `Tests 22 passed (22)`.
- Dienst A1–A7 ohne Route: `Tests 4 failed | 2 passed (6)` (A1, A2, A3, A7 rot; A5 und A6 prüfen vorher Gebautes, siehe
  Rot-Proben); Postgres A4 ohne Route: `Tests 3 failed (3)`; danach zusammen `Tests 9 passed (9)`.
- Katalog G1–G3 mit dem Tor und Generator vor (g): `# pass 21 # fail 6` (G1, G2, vier G3); danach `# pass 27 # fail 0`.
- Web L1 und Routenzeile vor dem Adapter: `Tests 2 failed | 168 passed (170)` (`expected 'undefined' to be 'function'`,
  `invoke is not a function`); danach mit Parität `Tests 204 passed (204)`. Test (p) ist auf `b6346c0` rot (der Kern hat
  `getCockpit`, der Live-Store noch nicht) und ab `2be6a29` grün.
- **Rot-Probe K7** (nicht committet): ein Feld `claimedBy` an jeder Referenz ⇒ `AssertionError: u-legal-1: expected
  '{"meetingId":"hv-2031",…' not to contain 'u-legal-1'`.
- **Rot-Probe A5** (nicht committet): Sortierung von `openQuestionsByUnit` in `indicators.ts` umgedreht ⇒ `× renderMetrics
  for the seed at a fixed clock equals metrics-golden-061.txt`. Das Golden wurde vor jeder Änderung an `indicators.ts`
  erzeugt (`e8c3fbb`); nach dem Umbau auf die gemeinsamen Hilfen byte-gleich (`cmp` ohne Unterschied, A5 grün).

**Schlüsselweg der Antwort:** `meetingId, asOf, meetingStatus, debateClosedAt?, totals.{captured,open,staged,answered},
openByStatus.{captured,classified,assigned,answer_drafted,in_review,approved,staged}, openByUnit.*, openUnassigned,
oldestOpen.{ageSeconds, items[].{id,number,status,unitId?,ageSeconds,statusAgeSeconds}}, inflow.{binSeconds,bins[],last5m},
legalReview.{over10m, items[].{…, reviewAgeSeconds}}` — 35 Blattpfade, gleich `COCKPIT_REPORT.fields` und
`catalog.json reports[leitstand].fields` (A6, A7).

**Rechte-Diff (Wahrheitstabelle, Rechteentscheidung):** nur „Role × Leserecht“ ändert sich, neue letzte Spalte
`cockpit.read`: moderation ✓, capture ·, coordination ✓, expert ·, legal ·, approver ·, podium ·, admin ✓, observer ·.
Alle übrigen Tabellen Zeile für Zeile gleich. Stromthemen unverändert.

**Vor-dem-Bau-Punkte:** (1) Nachprüfung lag vor; Vertragsversion: Integrationszweig bei 0.4.4, 046 noch nicht gemergt ⇒
**0.4.5** (siehe Offen). (2) Golden als eigener Commit vor `indicators.ts`. (3) Faltbarkeit: `reduce` über die Ereignisse
aus `getQuestionHistory` ergibt für alle 230 Einzelfragen des Seeds den Status von `listQuestions` (K9 grün); kein Rückfall
nötig. (5) Rechenzeit: die erste Fassung (eine Faltung über das ganze Log) lag bei 800 Einzelfragen (6329 Ereignisse)
bei p50 244 ms / p90 312 ms, weil `reduce` nach jedem Ereignis den Jahrgang neu zählt. Umbau ohne Zwischenspeicher:
dieselbe Faltung je Einzelfrage über ihre eigenen Ereignisse auf leerem Zustand, der Rest des Logs einmal, danach einmal
`refreshCounts` (Gleichheit mit `project` durch K3 und K11 gepinnt) ⇒ **p50 18,7 ms, p90 25,9 ms** (200 Läufe, warm,
in-process). (4) und (6) gehören zu Teil B.

**Abweichungen und Präzisierungen (Bau):**
- `computeCockpit` gibt `undefined` zurück, wenn die Ereignisse den Jahrgang nicht enthalten; `getCockpit` antwortet dann
  404. Ereignisse mit Serverzeit nach `now` zählen im Leitstand nirgends (K8); `computeIndicators` zählt sie im Bestand
  weiter, K3 gilt ohne solche Ereignisse (Folgeliste).
- Eine Fachbereichs-id aus dem Log, die nicht mehr in der Konfiguration steht, behält wie bei `hv_open_questions` einen
  eigenen Schlüssel in `openByUnit` (K3).
- `COCKPIT_REPORT` und der Katalogeintrag tragen zusätzlich `purpose` (Zweck für den Generator-Abschnitt); Blattpfade
  von Abbildung und Liste als `openByUnit.*` bzw. `inflow.bins[]`.
- `cockpitLevel(figure, value, { debateClosed })` mit den Kennzahlen `oldestOpen`, `legalReviewOver10m`, `unitBacklog`,
  `unassignedBacklog`, `openTotal`, `inflow`, `staged`; `COCKPIT_THRESHOLDS.oldestOpenSeconds` in Sekunden (900/2700).
- Tag der Operation: das bestehende `meeting`. Englischer Text `action.cockpit.read`: „View the cockpit“ (Glossar
  Leitstand = Cockpit); deutsch „Leitstand ansehen“. Parität 621 → **622**.

**Gates** (`pnpm gates` auf sauberem Baum, Commit `6185101`, eigene Datenbank `hv_test_s061`, Postgres-Tests aktiv):

```
packages/domain test:       Tests  513 passed (513)
apps/web test:       Tests  801 passed (801)
apps/api test:       Tests  700 passed (700)
apps/api test: operation-coverage: 71 operations in the contract, 69 exercised by tests, 2 pre-declared in allowlist.json
slice-scope: 43 changed file(s), all within "docs/slices/061-leitstand.md"'s "Files allowed" list (101 pattern(s)).
metrics-allowlist: 6 metrics, 1 report(s), all within the allowlist.
# tests 358
# pass 358
# fail 0
✓ built in 2.92s
mark-test-run: wrote /home/user/wt/s061/.claude/state/last-test-run (clean tree) at commit 6185101, tree 2a37042ca5bd…
```

Zwei frühere Läufe auf demselben Commit waren rot in `postgres027.test.ts` („rebuilds a 10,000-event Postgres snapshot“,
408 nach 16,7 s bzw. 28,6 s) und einmal in `postgres-stream035.test.ts` Test 29 (Streuung 5,6 s > 2 s), bei Lastmittel 20–30
auf vier Kernen durch parallele Agenten. Derselbe Test war in derselben Lage auch auf dem Basis-Commit `225cc4e` rot (11,6 s)
und ist einzeln auf beiden Commits grün; der grüne Lauf oben lief bei Lastmittel um 9. Kein Bezug zu 061 (der Test liest
`/v1/meetings`, nicht den Leitstand).

**Offen:**
- Vertragsversion **0.4.5** statt der erwarteten 0.4.6, weil 046 bei Baubeginn nicht gemergt war. Versionsabhängige Stellen
  bei einem Rebase auf 0.4.6: `packages/contract/openapi.yaml` (`info.version`, „Since 0.4.5“ im `Action`-Absatz, in der
  Operation und in drei Schemabeschreibungen), `packages/contract/package.json`, `packages/contract/CHANGELOG.md`
  (Abschnittskopf und Text), `packages/contract/src/types.ts` (neu erzeugen), `takt-019-contract.test.ts` (Version, Zahl
  der Operationen 71 bzw. 72 mit 046, Kommentar), `contract.test.ts` (Version), `apps/web/src/api/http.ts` (Kommentar),
  `apps/web/src/api/http.test.ts` (Kommentar), `docs/sicherheit/bedrohungsmodell.md` (Zeile 061). MF-Nummer bleibt 17.
- Artefakt `auswertungskatalog` mit „Berichte (Oberfläche)“: erst im CI-Lauf des PR (Lauf-ID, Artefakt-ID nachtragen).
- Branch heißt `claude/slice-061-leitstand` (die Spec nennt `claude/slice-061-kern`); `slice-scope` erkennt beide.
- Folgeliste: Schwellen doppelt (`urgencyLevel`), Zeitgrenze für Ereignisse nach `now` in `/metrics`.

**Dateien:** `packages/contract/{openapi.yaml,package.json,CHANGELOG.md,src/types.ts}`;
`packages/domain/src/{cockpit.ts,indicators.ts,types.ts,permissions.ts,api.ts,index.ts}`;
`packages/domain/src/__tests__/{cockpit061,admin040a,api,forward048}.test.ts`; `packages/domain/policy-truth-table.md`;
`apps/api/src/app.ts`; `apps/api/src/metrics/catalog.json`; `apps/api/src/__tests__/{cockpit061,postgres-cockpit061,
takt-019-contract,contract}.test.ts`; `apps/api/src/__tests__/fixtures/metrics-golden-061.txt`;
`scripts/{auswertungskatalog,metrics-allowlist-check}{.mjs,.test.mjs}`; `scripts/fixtures/metrics-allowlist/report-{person-field,
no-spec-section,bad-source,bad-id}.json`; `apps/web/src/api/{http.ts,http.test.ts,liveStore.ts,liveStore.test.ts,
liveStore061.test.ts}`; `apps/web/src/i18n/{labels.ts,shell.de.ts,shell.en.ts,parity.test.ts}`;
`docs/sicherheit/bedrohungsmodell.md`; `docs/datenschutz/dsfa-vorentwurf.md`; `docs/folgeliste.md`; diese Spec.

### Nacharbeit Teil A nach Review (06.10.2026)

Review in frischem Kontext auf PR #168 (Kopf `b32ecaf` nach Einmischen der Basis): 1 major, 4 minor (sofort behoben), Testlücken,
5 nits (Folgeliste). **Entscheidung Merge-Reihenfolge (Orchestrator):** 061 Teil A merged zuerst und behält Vertrag **0.4.5**; 046
rückt auf 0.4.6. Die Liste „Offen → Vertragsversion“ oben entfällt damit für 061.

| Nr. | Befund | Änderung | Commit |
|---|---|---|---|
| major 1 | Zeitfilter vor der Faltung bricht `reduce` (R-MTG-02/-05 ⇒ 500, MeetingCreated nach now ⇒ 404) | Log auf Jahrgangsebene ungeschnitten gefaltet; „nach asOf zählt nirgends“ nur je Einzelfrage (Erfassung nach now entfällt, eigene Liste endet vor dem ersten Ereignis nach now); Beschreibung im Vertrag präzisiert | `b681434` |
| minor 2 | `can()` an rekonstruiertem Datensatz | `getCockpit` prüft `state.questions.get(q.id) ?? q`; Test mit gebundenem Leser (Bündel für die Testdauer gebunden) und Weiterleitung nach now | `b681434` |
| minor 3 | Verweildauern sind Historiendaten | K1 pinnt `history.read` für jeden Inhaber | `b681434` |
| minor 4 | „kein Erledigungsdurchsatz“ zu stark | MF-17 und DSFA V15: Durchsatz aus aufeinanderfolgenden Lesungen ableitbar, Abwehr organisatorisch plus Zugriffslog (E13, `minimumGroupSize`); MF-17 nach MF-14 verschoben (MF-15/MF-16 stehen auf ihren Branches dort) | `46b8290` |
| Tests 5 | zwei Jahrgänge; K8 genau | Leitstand von B zählt nur B, während A aktuell ist; K8 `over10m` nach +600 s = 15 und = `computeIndicators` | `b681434` |
| nits 7–11 | drei Definitionen von „offen“, `withinWindow`, `maxProperties`/`status`, Commitfolge und Branch, Regel (g) für `derived:`/`meta:` | `docs/folgeliste.md` unter „Leitstand (aus 061)“ | `46b8290` |

Rot vorher (Tests zuerst): `Tests 4 failed | 24 passed (28)` — `Error: R-MTG-02: Cannot apply MeetingClosed while meeting is
preparation.`, `Error: R-MTG-05: VotingOpened is not allowed at this agenda progress.`, `expected undefined to be defined`
(MeetingCreated nach now), `expected [] to deeply equal [ 'q1' ]` (kanonischer Datensatz). Danach `Tests 28 passed (28)`.
Rechenzeit nach dem Umbau bei 800 Einzelfragen in-process: p50 22,5 ms, p90 33,4 ms (Grenze 50 ms).

Gates auf sauberem Baum, Commit `46b8290`, Datenbank `hv_test_s061`:

```
packages/domain test:       Tests  519 passed (519)
apps/web test:       Tests  801 passed (801)
apps/api test:       Tests  700 passed (700)
apps/api test: operation-coverage: 71 operations in the contract, 69 exercised by tests, 2 pre-declared in allowlist.json
slice-scope: 43 changed file(s), all within "docs/slices/061-leitstand.md"'s "Files allowed" list (101 pattern(s)).
metrics-allowlist: 6 metrics, 1 report(s), all within the allowlist.
# tests 358
# pass 358
# fail 0
✓ built in 2.50s
mark-test-run: wrote /home/user/wt/s061/.claude/state/last-test-run (clean tree) at commit 46b8290, tree 8f66f729fff4…
```

### Bericht Teil B (Oberfläche), 06.10.2026

```
Slice: 061-leitstand (Teil B)
Done: Route /cockpit („Leitstand“, letzte Registerzeile, requires cockpit.read): Hauptlesung (44 px), drei Karten und Zulauf
      (12 Säulen, Achse), Stationen mit „Engpass“, Rückstand mit Schwellenstrich, Kanarienzeile; Liste und waagrechter Faden
      mit URL-Zustand, Escape zweistufig, Fokus zurück zum Auslöser; live über useApiVersion und 15-s-Takt, eine Ansage.
Evidence: pnpm gates grün auf 41e874c (Schluss unten); docs/evidence/061-leitstand-{de,en}.png,
          061-liste-faden-{de,en}.png, 061-wand-1280x720-{de,en}.png; CI e2e-http: im PR-Lauf (offen)
Open: siehe „Offen“ unten
Touched: siehe „Dateien“ unten
```

**Commits** (auf `b32ecaf`, Branch `claude/slice-061-oberflaeche`, nicht gepusht): `3578ca9` Web-Tests zuerst (rot) · `b973808`
Seite, Liste, Faden, i18n, Register, e2e · `9e8d93d` Glossar, Zielbild, Folgeliste · `41e874c` Nachweisbilder · danach dieser
Bericht (nur Doku).

**Rot, dann grün (echte Ausgaben, gekürzt):**
- W1–W11 und Registererwartungen vor der Seite (`3578ca9`): `Test Files 6 failed (6)`, `Tests 5 failed | 15 passed (20)` —
  `Error: Cannot find module '../../api/cockpit'` (lib, CockpitView), `Cannot find module './Thread'`, `Cannot find module
  './cockpit'` (cockpit061), `expected [ 'speakers', 'capture', …(3) ] to include 'cockpit'`, `expected 'history' to be
  'cockpit'`, W7 `expected [ './fixtures.ts' ] to include './CockpitView.tsx'`.
- Danach: `apps/web test: Tests 848 passed (848)`; neu sind 37 Fälle in `features/cockpit/` (lib, CockpitView, Thread, clock),
  4 in `api/cockpit061.test.ts` (Wiederausgabe, W9 zweimal, W10) und 2 im Register, dazu geänderte Paritäts- und Registerfälle.
- Zwischenrot beim Bau, behoben: W1 (Name der Legal-Clearing-Karte nach dem Muster), W11 (Ansagebegriff), Parität (Modul
  `cockpit` fehlte in der Liste).

**e2e `in-process`:** `061-leitstand.spec.ts` S1–S8 `7 passed (45.2s)`; mit `--repeat-each=3` `21 passed (1.8m)`; volle Suite
`192 passed, 1 skipped (13.4m)` (übersprungen: 055b H1, nur `http`), darunter 001, 013, 053, 054 unverändert grün (29 Fälle).
axe bei jedem Ansichtswechsel: 0 serious/critical (DE, EN, Lesezustand, 200 %, Wand). Fremde Nachweisbilder aus dem Lauf
zurückgesetzt (`git checkout -- docs/evidence`). Projekt `http`: lokal ohne Keycloak nicht lauffähig; die Datei ist zwischen
055b und 080 eingereiht (`SHARED_SPECS`, `HTTP_ORDER`), schreibt dort nichts (S5 und S8 nur `in-process`), S3 trägt den Fall
„keine Einzelfrage über 10 min“ (dann nur Zeilenzahl 0 und Escape). Lauf-ID, Job-ID, Dauer: im PR nachtragen.

**Zeitmessungen (W10, 800 Einzelfragen, in-process, 30 Läufe nach 5 Aufwärmläufen):** Lastmittel 2,4: `getCockpit` p90 20,1 ms
allein, 30,3 ms in der vollen Web-Suite; Liste „Ohne Endstatus“ p90 5,1 bzw. 10,6 ms. Lastmittel 10 auf vier Kernen (parallele
Agenten): `getCockpit` 43 ms allein, 73–93 ms in der parallelen Suite. **Abweichung:** die harte Grenze von W10 für `getCockpit`
ist wie in `timing053.test.ts` 100 ms, das Ziel 50 ms steht je Messreihe im Log („within“/„above“); bis zu drei Messreihen, die
beste zählt, jede wird ausgegeben (Folgeliste). Die Liste hält die harte Grenze 100 ms (D9).

**i18n:** Modul `cockpit` mit 81 Schlüsseln (DE, en-US) und drei Shell-Schlüssel (`nav.cockpit`, `page.cockpit.title`,
`page.cockpit.description`); Parität 622 → **706**. Die Schätzung „rund 62“ lag zu niedrig: zugängliche Namen je Zeile,
Faden-Einträge in drei Formen und die Ansage brauchen eigene Schlüssel.

**Vor-dem-Bau-Punkte Teil B:** (4) `listQuestions({ status: […], limit: 2000 })` ist in-process für coordination vollständig
(332 offene von 800, W10; Seed 100 von 230, S5); im Projekt `http` prüft S2/S3 den Weg, die Vollständigkeit bei 2000 nicht
(Folgeliste nicht nötig: Grenze 2000 = `LIST_LIMIT` der Beantwortung). (6) Laufzeit `e2e-http`: lokal nicht messbar; die Datei
liest nur, Schätzung +0:40; im PR-Lauf nachtragen.

**Umsetzung und Präzisierungen:**
- Dateien unter `features/cockpit/`: `CockpitView.tsx` (eine Ansicht ohne API-Hooks, jeder Zustand statisch testbar),
  `Figures.tsx` (Hauptlesung, Karten, Zulauf, Stationen, Rückstand, Kopf), `DrillList.tsx`, `Thread.tsx`, `Page.tsx` (Hooks,
  URL, Escape, Fokus), `feed.ts` (15-s-Takt, Strom, Sichtbarkeit; ein Lesen zur Zeit), `lib.ts` (rein), `fixtures.ts` (nur
  Tests). Werte des Kerns nur über `apps/web/src/api/cockpit.ts` (Regel `web-features-i18n-domain-types-only`, keine neue
  Warnung in `pnpm arch`).
- Raster mit Container-Abfragen statt Viewport-Breakpoints (die eingeklappte Navigation zählt mit): nebeneinander ab 56rem
  Inhalt, Karten in einer Reihe ab 36rem, sechs Stationen ab 48rem. Bei 1280 × 720 mit ausgeklappter Navigation sind
  Hauptlesung, vier Karten mit Zulauf und Stationen ohne Scrollen sichtbar, Unterkanten Hauptlesung/Zulauf bündig (S8 misst
  beides). Schmale Karten reservieren zwei Beschriftungszeilen, damit die Zahlen einer Reihe auf einer Linie stehen.
- Sichtbare Beschriftung der Karte „Legal Clearing > 10 min“ (Skizze), zugänglicher Name „Liste öffnen: Im Legal Clearing über
  10 min, …“ (Entscheidung 4); die Ansage nennt „Im Legal Clearing über 10 min“. WCAG 2.5.3 als Frage an das Review (Folgeliste).
- Die Liste fokussiert beim Öffnen ihre Überschrift; Tab erreicht „Liste schließen“, dann die eine Zeile im Tab-Pfad (rovierend,
  Pfeile, Pos1/Ende), Enter öffnet den Faden, der Fokus bleibt auf der Zeile. Eine Live-Lesung verschiebt den Fokus nicht (S3
  mit 15-s-Takt geprüft). Fokusring in rollenden Listen und Stationen nach innen versetzt, damit nichts ihn abschneidet.
- Erste Lesung kündigt nichts an; danach eine höfliche Ansage je Wechsel nach „kritisch“, mehrere Kennzahlen in einer Ansage.
- Ein fehlgeschlagenes Neulesen nach einer erfolgreichen Lesung behält die Zahlen („Stand“ zeigt ihr Alter); eine Verweigerung
  ersetzt sie immer durch den Lesezustand; ein Wechsel der Person beginnt bei „wird geladen“.
- Faden: `getQuestion` und `getQuestionHistory` parallel; eine Verweigerung ist kein Fehler (ohne Leserecht kein Text, ohne
  `history.read` nur die aktuelle Station). Bühnenplatz als `StageAssignmentBadge` aus `stageAssignment`.
- e2e in-process mit installierter Browser-Uhr (Seed 15:20, dann +22 min), damit die Demo einen Nachmittag zeigt; im Projekt
  `http` bleibt die Uhr unberührt.

**Abweichungen vom Prototyp `089-lagebild.png` (mit Grund):** keine Rednernamen und keine Wortmeldungsnummer (Entscheidung 8);
kein Widerspruchskanal (Z15, 050/085); keine Rednerwand (Z14, 087); kein Flussbild mit Punkt je Einzelfrage und kein „+n in 15
min“ (Z12, 061b); keine Prognosen „abgebaut ca.“, „nächste Antwortrunde“ (Z11, 061b); vierte Karte „Auf der Bühne“ statt
„Nächste Antwortrunde“; Zulauf als 12 Säulen statt Linie; Stationen ohne „vorgelesen“-Spalte (steht in der Karte „Auf der
Bühne“ als „n vorgelesen“); kein Absprung „Im Schreibraum öffnen“ (Z13 teilweise).

**Design-Kritik:** nach Spec in frischem Kontext (weder Spec- noch Bausitzung) — offen, an den Orchestrator. Selbstprüfung der
Bausitzung, kein Ersatz: D1 Hauptlesung links oben, Titel und ein Satz; D2 eine primäre Schaltfläche (S1 zählt sie), leerer
Zustand ohne Aktion (W4); D3 Raster 12/16 px, bündige Unterkanten (S8), benannte Ausnahmen 44 px, 11 px Achse, 3-px-Oberkante;
D4 Farbe nur bei Stufe (Badge, Balken), Zulauf einfarbig; D5 alle Zahlen Mono, `tabular-nums`, Fehler mit Regel-id (W4); D6
Laden, leer, Fehler, Lesezustand, leere Liste, Referenz nicht lesbar; Verbindung nur in der Kopfzeile; D8 S3; D9 Lesezustand
statt Teildaten (S4), Zeiten oben; D10 gegen 089: gleiche Ruhe, große Zahl trägt; schwächer als 089 wirkt der Zulauf, weil der
Demo-Seed fast alle Ereignisse auf einen Zeitpunkt staucht (eine Säule, gleiche Uhrzeiten im Faden; Folgeliste).

**Gates** (`pnpm gates` auf sauberem Baum, Commit `41e874c`, eigene Datenbank `hv_test_s061b`, Postgres-Tests aktiv, erster Lauf):

```
packages/domain test:       Tests  513 passed (513)
apps/web test:       Tests  848 passed (848)
apps/api test:       Tests  700 passed (700)
apps/api test: operation-coverage: 71 operations in the contract, 69 exercised by tests, 2 pre-declared in allowlist.json
slice-scope: 74 changed file(s), all within "docs/slices/061-leitstand.md"'s "Files allowed" list (101 pattern(s)).
metrics-allowlist: 6 metrics, 1 report(s), all within the allowlist.
# tests 358
# pass 358
# fail 0
✓ built in 1.78s
mark-test-run: wrote /home/user/wt/s061b/.claude/state/last-test-run (clean tree) at commit 41e874c, tree 2a8d0b38190b…
```

**Offen:**
- Projekt `http`: CI-Lauf `e2e-http` des PR (S1–S4, S6, S7) mit Lauf-ID, Job-ID, Dauer gegen 12:00 (Warnschwelle 6:30).
- Design-Kritik in frischem Kontext und das Review (Datenschutz, UX/Barrierefreiheit).
- W10: harte Grenze 100 ms statt 50 ms für `getCockpit` (oben, Folgeliste).
- Folgeliste neu: W10-Grenze, Demo-Seed staucht die Zeiten, sichtbare Beschriftung vs. Name der Legal-Clearing-Karte.

**Dateien:** `apps/web/src/features/cockpit/{CockpitView,Figures,DrillList,Thread,Page}.tsx`,
`apps/web/src/features/cockpit/{feed,lib,fixtures}.ts`, `apps/web/src/features/cockpit/{lib,clock}.test.ts`,
`apps/web/src/features/cockpit/{CockpitView,Thread}.test.tsx`; `apps/web/src/api/cockpit.ts`, `apps/web/src/api/cockpit061.test.ts`;
`apps/web/src/app/featureRegistry{,.test}.ts`; `apps/web/src/i18n/{cockpit.de,cockpit.en,de,en,shell.de,shell.en,parity.test}.ts`;
`apps/web/e2e/061-leitstand.spec.ts`; `apps/web/playwright.config.ts`; `scripts/e2e-http-031.test.mjs`;
`docs/evidence/061-{leitstand-de,leitstand-en,liste-faden-de,liste-faden-en,wand-1280x720-de,wand-1280x720-en}.png`;
`docs/glossar.md`; `docs/feedback/2026-09-zielbild-oberflaeche.md`; `docs/folgeliste.md`; diese Spec.

### Nacharbeit Teil B nach Design-Kritik und Review (06.10.2026)

Basis eingemischt (`dca472e`: Teil A gemergt als `68c87d9`, dazu 041; Teil-A-Dateien auf Stand der Basis, Registerreihenfolge
… history, admin, cockpit; Parität 747 + 84 = 831, mit `cockpit.thread.seat` **832**). Tests zuerst (`40caceb`, rot: `Tests 10
failed | 36 passed (46)`), dann `04145d0` (grün), Bilder `bf4d92b`.

| Nr. | Befund | Änderung |
|---|---|---|
| D1 (Blocker) D3 | Hauptlesung `p-5`, übrige Panels `p-4` | ein Token `p-4` für alle Panels; Quelltest gegen `p-5` |
| D2 D8 | „Faden öffnen“ verschob den Fokus nicht | Fokus auf die Fadenüberschrift (`preventScroll`), danach Bildlauf; Escape und Zurück geben den Fokus an den Auslöser (S3) |
| D3 D5/D1 | „seit …“ abgeschnitten | eigene Zeile, darf umbrechen, Grau 600 Mono |
| D4 WCAG 2.5.3 | Beschriftung ≠ Name | sichtbar „Legal Clearing über 10 min“ / „Legal clearing over 10 min“, `nameLabel` entfernt |
| D5 Kontrast | Säulen Grau 300 (1,68:1), leere Fenster unsichtbar | Säulen und Striche Grau 500 (3,9:1); Nachtrag in Entscheidung 5 |
| D6/7 Zulauf, Karten | 400-px-Lücke, „0“ liest wie Fehler, Unterzeile unten | Zahl, Säulen, „letzte Stunde“ auf einer Zeile, Achse darunter; „Zulauf letzte 5 min“; Unterzeile direkt unter der Zahl |
| D8 Bildlauf, Zurück | Liste/Faden nicht oben; Zurück ohne Fokus | Bildlauf nur im Hauptbereich (block „start“; `scrollIntoView` verschob den Shell-Rahmen, gefunden am Bild), Faden nach dem Laden; Zurück fokussiert den gespeicherten Auslöser |
| D9 Namen | Unterzeile fehlte, Station mit fremder Schwelle | `aria-describedby` auf die Unterzeile; Station „…, 14, Engpass“ (auch Review minor 2) |
| D10 Raster | `pt-2.5`, `gap-1.5`, `gap-x-2.5`, `mt-0.5`, `mx-1.5`, `h-2.5` | auf 4/8 px; Quelltest |
| D11–D16 | Zählbadge, Bühnenbadge, Ladeplatzhalter, Farbe | nur die Zahl in Mono (Wörter `sr-only`); „Bühne: Finanzvorstand“; Platzhalter Rückstand; aktuelle Zeit Grau Mono; gewählte Zeile Akzent 50 + Balken, Text ungefärbt |
| R3 | Ansage wiederholt sich nicht nach ruhiger Phase | `applyResult` leert die Region ohne neuen Wechsel; Test W11 auf Seitenebene (`feed.test.ts`) |
| R4 | Verweigerter Leser liest alle 15 s | nach `forbidden` kein Intervall, keine Änderungs- oder Neuleselesung bis zum nächsten Feed (Personenwechsel); Test |
| R5 | gefilterte älteste neben fremder Nummer | Hauptreferenz nur, wenn `items[0].ageSeconds === oldestOpen.ageSeconds`, sonst alle unter „Danach die ältesten“; Test W4 |
| R6 | W10 | Annahme bei W10 vermerkt; Stolperdraht unter `CI` (beste Reihe < 50 ms) |
| R7 | `lastFocused` | bei Fokuswechsel aus der Liste gelöscht; `focus({ preventScroll: true })` |
| R10 | globales Escape | ignoriert Kopfzeile der Shell, Eingabefelder, `[role="menu"]` |
| R8, R9, R12, R13, D14, D17 | — | Folgeliste |

**Nachweise:** Web `Tests 977 passed (977)`; `061-leitstand.spec.ts` `--repeat-each=3` `21 passed (1.6m)`, axe 0 serious/critical; sechs
Bilder neu (`bf4d92b`). Die volle `in-process`-Suite lief nicht erneut (Teil-B-Änderungen nur unter `features/cockpit/**` und der
eigenen e2e-Datei; letzte volle Suite vor der Nacharbeit 192 passed).

**Gates** (`pnpm gates` auf sauberem Baum, Commit `bf4d92b`, Datenbank `hv_test_s061b`, erster Lauf):

```
packages/domain test:       Tests  519 passed (519)
apps/web test:       Tests  977 passed (977)
apps/api test:       Tests  700 passed (700)
slice-scope: 38 changed file(s), all within "docs/slices/061-leitstand.md"'s "Files allowed" list (101 pattern(s)).
metrics-allowlist: 6 metrics, 1 report(s), all within the allowlist.
# tests 358
# pass 358
# fail 0
✓ built in 2.57s
mark-test-run: wrote /home/user/wt/s061b/.claude/state/last-test-run (clean tree) at commit bf4d92b, tree c01159ddb58e…
```

**Offen:** CI `e2e-http` (Lauf, Job, Dauer); Seed-Streuung (eigener Takt des Orchestrators).

## Review findings

- **Lesebefund 05.10.2026** (frischer Kontext, auf `1ebe51e`): 3 Blocker, 6 major, 11 minor, 5 nits, Vorschläge zur Wirkung in der
  Demo; eingearbeitet nach den Entscheidungen des Orchestrators, Tabelle „Nacharbeit nach Lesebefund“. Nachprüfung der Blocker und
  major-Punkte offen. Zweite Nacharbeit (Orchestrator, 05.10.2026): MF-17 statt MF-15, Kleinbefunde n21, n22, n23, n25 im Wortlaut
eingearbeitet, Bau in zwei PRs angenommen. Nachprüfung auf `a4575f6`: 3 Blocker, 1 major, 8 minor neu, alle eingearbeitet (Tabelle
„Nachprüfung“ unten).

### Nachprüfung (auf `a4575f6`, 05.10.2026)

| Nr. | Befund | Änderung |
|---|---|---|
| N1 | Wahrheitstabelle und `api.test.ts` nicht erlaubt | beide eng in „Files allowed“; Diff der Tabelle „Role × Leserecht“ als Rechteentscheidung (Festlegung 4); Rechte-Diff, „nicht erlaubt“ und Akzeptanz 5 korrigiert |
| N2 | Teil A allein nicht grün | kleinster Web-Adapter nach Teil A (Route, Pufferausschluss und Durchreichung, `ACTION_KEYS`, `action.cockpit.read`, Parität, Routenzeile) |
| N3 | Durchreichung im Live-Store | Entscheidung 7 und Files allowed nennen sie; Test L1 |
| N4 | Zulauf ehrlich einstufen | Zeilen der Allowlist „E13, Gruppe Erfassung, begrenzt durch Redetempo“; DSFA V15, MF-17, Invariante „Bestände, Wartezeiten und Zulauf; kein Erledigungsdurchsatz (erledigt je Zeit je Station)“; Eigentümerfrage 5 mit der Option, die elf früheren Fenster zu streichen |
| m1 | `aggregation` als Freitext | strukturierte Liste `["meeting","status","unit"]` plus `questionReferences`, geschlossene Menge in Regel (g) |
| m2 | Quelle der Stammfelder | Quellform `meta:` |
| m3 | Blattpfade | Allowlist und A7 auf Blattpfaden |
| m4 | `totals.answered` | aus `Meeting.counts.delivered` |
| m5 | V15 „Mindestfallzahl im Code“ | die Änderung an V15 berichtigt die Angabe |
| m6 | 3-px-Statustönung | als benannte Ausnahme in D3/D4 und Akzeptanz 8 |
| m7 | `admin040a.test.ts` | auch Testtitel „fourteen“ und Zeile 48 erlaubt |
| m8 | Aufwand | 5,0 AStd, Teil A 2,3, Teil B 2,7 |
