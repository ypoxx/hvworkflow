# Scheibe 061 — Leitstand mit fachlichen Kennzahlen

**Status:** spec (05.10.2026; gelesen auf `c5990c8`, Vertrag 0.4.4; neunte Scheibe der Oberflächenkette der Freigabe-Demo
045 → 048 → 053 → 054 → 055 → 059 → 046 → 060 → 061 → 041, Register E57; Wunsch des Eigentümers vom 05.10.2026: „061 soll
richtig geil werden“; geteilt: Prognosen Z11 und Flussbild Z12 als 061b skizziert, Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** hoch · 3,9 AStd (Spanne 3,4–4,5; Plan 061: mittel · 2 AStd, mit Zielbild +1,75; Begründung in „Warum
hoch“ und „Aufwand“) · Plan 061: 16.11.2026 (W8), tatsächlich nach 060 in der Kette der Freigabe-Demo · Lanes: contract
(Recht `cockpit.read`, Operation `getMeetingCockpit`, Schemas `Cockpit` und `CockpitQuestionRef`, 0.4.5); core (neue Datei
`cockpit.ts`, ein Recht in drei Bündeln, eine Lesemethode); service (eine Route); web-api (eine HTTP-Route, ein Eintrag in
`READ_TOPICS`); web-cockpit (neu, `apps/web/src/features/cockpit/**`); web-shell (eine Zeile im Feature-Register, drei
Shell-Schlüssel); e2e (eigene Datei, im Projekt `http` eingereiht); docs (Glossar, DSFA-Zeile V15, Bedrohungsmodell, Status im
Zielbild). Die Planzeile nennt nur web-cockpit; die zusätzlichen Lanes folgen aus dem Befund (Hinweise an den Orchestrator).
**Bedrohungsmodell:** neue Leseoperation mit eigenem Recht (Rechte als Daten, R-PERM-02); berührt T-G1-I-01 (Anzeige) und
den Risikopunkt der DSFA „Vorgangshistorie wird zur Leistungskontrolle“ (Abschnitt 4): der Leitstand zeigt Aggregate je
Jahrgang und Fachbereich, nie je Person, und blendet im Faden die handelnden Personen aus (Entscheidung 8).
**Rolle:** Architekt (Vertragsschritt, erster Commit der Scheibe, vor jedem Code; AGENTS.md R6) + implementierer-backend (Kern,
Dienst) + implementierer-oberflaeche (Seite); **Lesebefund der Spec vor dem Bau** in frischem Kontext (Leitplanken §4, Klasse
hoch) mit den Perspektiven **Datenschutz** (keine Kennzahl je Person, Faden ohne Akteure, Allowlist), **Security** (neues
Recht, Deny by default, 403 statt Teildaten) und **Vertrag** (additiv, `additionalProperties: false`); nach dem Bau **ein**
Review in frischem Kontext mit denselben Perspektiven plus **UX/Barrierefreiheit**; **Design-Kritik in frischem Kontext**
(weder die Sitzung, die diese Spec schrieb, noch die bauende) gegen D1–D10 und `docs/evidence/089-lagebild.png`; Codex einmal,
wenn der PR bereit ist. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** keine neue fachliche Regel und keine neue Übergangszeile. Neu belegt: R-PERM-02 für `getCockpit` (Leserecht
`cockpit.read` fehlt). Gelesen und unverändert übernommen: die Definitionen der Kennzahlen aus 033b (`indicators.ts`,
`catalog.json`: „offen“, Alter der ältesten offenen Einzelfrage, Rückstand je Fachbereich, Zulauf in 300 s, Legal Clearing
über 600 s); R-PERM-04 (Stromsignale ohne Inhalt); R-TIME (Zeit nur aus der injizierten Uhr, AGENTS.md R8). Dazu AGENTS.md R1,
R2, R3, R4, R5, R6, R8, R9, R10, R12; `docs/design-prinzipien.md` D1–D10; ADR 0013 (keine Kennzahl je Person).
**Quellen-IDs:** `docs/produktplan-beta.md` §5 Eintrag 061 (Zeile 794–800), 033b (587–592), 082 (408–413), 040 (644–649), 043
(686–691), 086 (928–933, hängt an 061), 087 (762–767, hängt an 061), 089b (827–832); `docs/feedback/2026-09-zielbild-oberflaeche.md`
Z10 (Zeile 58), Z11 (59), Z12 (60), Z13 (61), Aufwand (109–110); `docs/zielbild/README.md` („Namen im Prototyp“: Lagebild →
Leitstand); `docs/zielbild/js/lagebild.js`; `docs/evidence/089-lagebild.png`; `docs/rollen-und-rechtekonzept.md` §5
(„Leitstand / Projektleitung: Schritt 8A, Steuerung, Eskalation“), §6 (Datenschutz, Betriebsrat); ADR 0013; DSFA V15
(`docs/datenschutz/dsfa-vorentwurf.md:203`); Register E13, E57; Specs 033b, 053 (Verteilung, Lesezustand, Muster), 054
(Lesehinweis, Registerzeile), takt-047 (Lieferkette, Mindestalter), takt-048 (Nullzähler Grau 600); Glossar Zeilen 61–62
**Depends on:** 033b (gemergt `115c28b`, PR #73: `computeIndicators`, Katalog, `/metrics`; die Statuszeile der Spec 033b ist nicht
nachgezogen), 043/043a (gemergt `88fa9be`, Vertrag 0.4.0), 040b (gemergt `6146251`: `counts.byUnit`, Fachbereiche je Jahrgang),
082 (gemergt `c8bcf83`: Register; die Quelle der Rechtemenge fehlt weiter, 089b), 036a/036b (Live-Store, Strom), 053 und 054
(gemergt: Muster für Lesezustand, Registerzeile, e2e-Einreihung)
**Perspektive:** Datenschutz, Security, Vertrag, UX · **Glossar: neue Begriffe:** ja (Faden, Endstatus, Kanarienfrage)

## Qualitätswirkung

Reifestufe: demo (Freigabe-Demo), gebaut pilotfest · Risikoklasse: hoch
Ausgelöst: [ ] Fachregel, Status (nur Anzeige; Statusverlauf über `reduce` der Projektion, keine eigene Statuslogik)
[x] Vertrag, Ereignis, Konfiguration (neue Operation, zwei Schemas, ein Rechtebezeichner) [ ] Persistenz, Migration,
Nebenläufigkeit (nur Lesen) [x] Rolle, Recht, Identität, Schutzklasse (neues Recht `cockpit.read` in drei Bündeln)
[x] personenbezogene oder vertrauliche Daten (Auswertung; Negativtest und Allowlist) [x] Betrieb, Wiederherstellung (Lagebild am
HV-Tag, Rechenzeit bei 800) [ ] Administration [x] Oberfläche, Barrierefreiheit [ ] Nachbarsystem [ ] KI, Agenten
[x] Dokumentation, Schulung (Glossar, DSFA V15)
Perspektive(n): Datenschutz, Security, Vertrag, UX · Nachweise: Abschnitt „Nachweise“ · Offene Entscheidung: E13 (Mindest-
Aggregationsschwelle, Standard: keine Unterdrückung wie in 033b), Eigentümerfragen unten (alle mit Standard)

## Warum hoch

Der Plan führt 061 als „mittel“ mit „Werte aus /metrics oder Projektion“. Der Befund zeigt, dass keiner der beiden Wege ohne
Vertragsschritt trägt, und die Leitplanken (§4) nennen drei Hoch-Auslöser, die 061 alle berührt. **Hochstufung, kein Fall für
`downgrade-check`.**

1. **Recht.** `cockpit.read` gibt es nicht (weder in `PERMISSIONS`, `types.ts:34-76`, noch im Vertragsenum `Permission`,
   `openapi.yaml:2616-2657`). Die Planzeile verlangt es mit dem Standard coordination, moderation, admin. Ein neuer
   Rechtebezeichner ist eine Vertragsänderung (das Enum ist „identical to the domain permission list“) und eine Änderung in
   `ROLE_PERMISSIONS`.
2. **Auswertung.** Der Leitstand ist die erste Oberfläche, die Kennzahlen aus Bearbeitungszeiten zeigt. ADR 0013 und das
   Rechtekonzept §6 machen „keine Kennzahl je Person“ zur Bedingung; der Plan verlangt Negativtest und Allowlist.
3. **Vertrag.** `/metrics` ist für den Scraper (`metricsBearer`, kein Akteur, kein `can()`, `openapi.yaml:2094-2112`), nie für den
   Browser. Die Projektion liefert dem Browser über `listQuestions` nicht, seit wann eine Einzelfrage im Legal Clearing liegt
   (`QuestionRecord` hat `createdAt` und `updatedAt`, `types.ts:315-348`; `updatedAt` ändert sich auch bei Claim, Rechtsfreigabe
   und Weiterleiten). „Legal Clearing über 10 min“ ist im Browser also nicht berechenbar, ohne die Definition aus 033b zu
   verfälschen. Und ohne serverseitige Prüfung wäre `cockpit.read` ein Recht, das niemand prüft: die Navigation zeigt
   ohnehin jede Route (Quelle der Rechtemenge fehlt, 089b), und eine Rolle mit `question.read.delivered` (Beobachtung) bekäme
   aus der eigenen Liste falsche Zahlen („0 offen“) statt eines Lesezustands.

Deshalb: **eine Leseoperation `getMeetingCockpit` mit eigenem Recht**, gerechnet im Kern aus dem Ereignisprotokoll mit
denselben Definitionen wie `/metrics` (der Kopfkommentar von `indicators.ts` sieht genau das vor: „It lives in the core so the
control desk (Leitstand, 061) uses the same definitions instead of rebuilding them“). Folgen der Klasse: Lesebefund vor dem
Bau, Positiv- und Negativtest je Auslöser, Fehlerfall, Rechte-Diff vor dem Bau (unten), nie gebündelt.

## Befund (Ist-Stand, gelesen auf `c5990c8`)

- **Kennzahlen im Kern (033b).** `computeIndicators(events, now)` (`packages/domain/src/indicators.ts`) liefert je laufendem
  Jahrgang: `oldestOpenQuestionAgeSeconds` (Minimum der Erfassungszeit `recordedAt ?? at` über offene Einzelfragen),
  `openQuestionsByUnit` (offen je Fachbereich, Schlüssel `unassigned` ohne Zuweisung), `questionsCapturedLast5m` (Alter 0–300 s
  einschließlich), `questionsInLegalReviewOver10m` (Status `in_review` ohne Rechtsfreigabe der aktuellen Fassung, Eintritt
  > 600 s; Eintritt = `QuestionSubmittedForReview`, `QuestionReturned` mit `toStatus: in_review`, `AnswerDrafted` mit
  `toStatus: in_review` — ein neuer Verweigerungsvorschlag startet die Uhr neu). „Offen“ = Status nicht in delivered, closed,
  withdrawn, merged. Nur Jahrgänge im Status `running`. Getestet in `indicators033b.test.ts`, verwendet in
  `apps/api/src/app.ts:793-813` mit eigenem Lese-Schnappschuss (takt-024) und 10-s-Zwischenspeicher.
- **Katalog** `apps/api/src/metrics/catalog.json`: sechs Familien, Labels nur `meeting_id`, `unit_id`; Tor
  `scripts/metrics-allowlist-check.mjs` (Personenbegriffe immer rot). `hv_open_questions` trägt den Vermerk E13
  (Fachbereich mit genau einer Person).
- **Projektion.** `reduce(state, event)` und `project(events)` sind exportiert (`state.ts:140`, `:555`); `createdAt` einer Einzelfrage
  ist `e.at` des `QuestionCaptured` (`state.ts:348`). `Meeting.counts` hat `open`, `delivered`, `byStatus`, `byUnit` (jeder
  Fachbereich des Jahrgangs als Schlüssel, auch mit 0; ohne `unassigned`), `bySeat`. `Meeting.debateClosedAt` ist projiziert
  (takt-016), die schließende Operation folgt mit 087.
- **Rechte.** `ROLE_PERMISSIONS` (`permissions.ts:22-104`): moderation, coordination und admin halten `question.read` und
  `history.read`; admin ist eine ausdrückliche Liste mit 14 Einträgen (gepinnt in `admin040a.test.ts:42-43`).
  `READ_PERMISSIONS` (`types.ts:90-103`) ordnet Lesemethoden ihren Rechten zu; `api.test.ts:538` prüft, dass jeder Eintrag
  eine echte `HvApi`-Methode nennt; `stream.ts:159-173` leitet daraus die Themen des Stroms ab. Die Wahrheitstabelle
  `packages/domain/policy-truth-table.md` enthält nur Aktionen an Einzelfragen (Rolle × Status × Aktion).
- **HvApi** (`api.ts:85-165`): Lesemethoden `get…`/`list…`; `getStage()` liest den aktuellen Jahrgang, im Dienst über
  `meetingDomain(meetingId)` an `/v1/meetings/{meetingId}/stage` (`app.ts:1065-1066`); `requireReadPermission(method)`
  prüft über `READ_PERMISSIONS`.
- **Live-Store** (`apps/web/src/api/liveStore.ts`): `READ_TOPICS` ist vollständig per Typ (`satisfies Record<BufferedRead, …>`):
  eine neue Lesemethode ohne Eintrag kompiliert nicht. Einträge leben höchstens 30 s (`MAX_AGE_MS`); Stromsignale nach
  Thema leeren sie. Ansichten hängen an `useApiVersion()`.
- **HTTP-Adapter** (`apps/web/src/api/http.ts:600-630`): kanonische Pfade mit `meetingRoute()`.
- **Feature-Register** (`apps/web/src/app/featureRegistry.ts`): sieben Zeilen, Kürzel Alt+1…6 belegt (speakers 1, capture 2,
  answers 3, stage 4, history 5, focus 6); steering ohne Kürzel. `visibleRoutes` wird weiter nirgends mit einer Menge gerufen.
- **Bauteile** (`apps/web/src/components`): `Panel`, `PageHeader`, `EmptyState`, `Badge`, `ProcessStrip` (gestapelter Balken mit
  Zahlen, Tönungen aus den Tokens), `SplitPane`, `Table`, `Sparkline` (Linie, auf Min–Max skaliert — für Mengen irreführend, siehe
  Entscheidung 5). Keine Diagrammbibliothek im Projekt; Symbole aus `lucide-react`.
- **Tokens** (`apps/web/src/styles/index.css`): Grautöne `--color-ink-*`, Akzent `--color-accent-*`, Tönungen
  `--color-tone-{neutral,accent,success,warning,danger}-{bg,fg,bd}`, Statustönungen je Status. Keine Druckstile.
- **Dringlichkeit heute:** `urgencyLevel` in `features/answers/lib.ts:147-152`: unter 15 min 0, unter 45 min 1, sonst 2.
- **i18n:** Paritätstest (f) **621** Schlüssel je Sprache (`parity.test.ts`, nach takt-048).
- **e2e:** `SHARED_SPECS` (`apps/web/playwright.config.ts:38-42`) und Reihenfolge-Pin (`scripts/e2e-http-031.test.mjs:26-31`):
  002, 021b, 021c, (030, 031), 045, 053, 054, 055b, 080, abnahme. Gesamtgrenze der Harness jetzt 12:00 (`TOTAL_MS = 720_000`),
  weiche Warnschwelle 6:30 (`WARN_MS`, takt-046). Personen im Projekt `http`: moderation, capture, coordination, expert (an
  `unit-fin` gebunden), legal, approver, podium; keine admin- oder observer-Person.
- **Zielbild.** Lagebild (Prototyp) = Leitstand (061) + Steuerung (053). Z10 große Zahl mit Station und Einheit, darunter die
  drei nächstältesten; Z11 Prognosen aus dem Tempo; Z12 Flussbild mit Punkt je Einzelfrage; Z13 Faden je Frage als
  Drill-down. Der Prototyp zeigt Namen von Rednern im Faden und in der Rednerwand; das übernimmt 061 **nicht** (Entscheidung 8).

## Was die Koordination im Saal braucht (Gestaltungsgrundlage)

Nachmittag der Generaldebatte, Raum hinter dem Saal, mehrere hundert Einzelfragen, der Leitstand hängt oft zusätzlich auf
einem Bildschirm an der Wand. Die Person schaut **alle paar Minuten für wenige Sekunden** hin. Sie will drei Dinge wissen,
in dieser Reihenfolge:

1. **Wartet etwas zu lange?** Die älteste offene Einzelfrage: wie alt, wo sie liegt (Station, Fachbereich), seit wann in dieser
   Station. Das ist die **eine Hauptlesung** der Ansicht (D1), groß, links oben.
2. **Wo staut es sich?** Legal Clearing über 10 Minuten (der bekannte Engpass, Recherche Z.27) und der Rückstand je Fachbereich.
3. **Wie entwickelt sich die Lage?** Zulauf je 5 Minuten mit dem Verlauf der letzten Stunde, und wie viele Einzelfragen
   noch ohne Endstatus sind — vor dem Debattenschluss die Frage „schaffen wir das“.

Alles andere ist Drill-down: Wer eine Zahl anklickt, sieht die Einzelfragen dahinter, und zu jeder ihren Faden. Der Leitstand
ist eine **Konsole, kein Dashboard**: ruhig, solange alles ruhig ist; Farbe erscheint erst, wenn eine Schwelle überschritten ist,
und dann immer mit Symbol und Wort. Er hat genau eine primäre Aktion: „Faden öffnen“ an der ältesten Einzelfrage.

### Aufbau (Breite ab 1280 px; 1440 px wie Bild 089)

```
Leitstand                                          Stand 15:42:10 · Kanarienfrage: nicht eingerichtet
Lage der Einzelfragen auf einen Blick
┌ ÄLTESTE OFFENE EINZELFRAGE ───────────────┐ ┌ OHNE ENDSTATUS ─────────┐ ┌ IM LEGAL CLEARING ÜBER 10 MIN ┐
│ 50 min   [⬣ kritisch]                      │ │ 47                      │ │ 6              [▲ erhöht]     │
│ F-0125 · zugewiesen · Finanzen             │ │ von 171 erfassten ·     │ │ von 14 im Legal Clearing      │
│ seit 14 min in dieser Station              │ │ 124 vorgelesen          │ │                               │
│ [ Faden öffnen ]          (primär)         │ │ ▇▇▇▅▃▂▁ Stationsleiste  │ │                               │
│ ───────────────────────────────            │ └─────────────────────────┘ └───────────────────────────────┘
│ DANACH DIE ÄLTESTEN                        │ ┌ ZULAUF JE 5 MIN ──────────────────────────────────────────┐
│ F-0126  auf der Bühne · Finanzen   49 min  │ │ 3      ▁▂▃▅▃▂▁▂▃▂▁█   letzte Stunde: 41                    │
│ F-0127  freigegeben · Personal     46 min  │ └───────────────────────────────────────────────────────────┘
│ F-0128  im Legal Clearing · ESG    45 min  │
└────────────────────────────────────────────┘
┌ RÜCKSTAND JE FACHBEREICH ──────────────────────────────────────────────────────────────────────────────┐
│ Finanzen           ██████████████████████████                                   23   [▲ erhöht]       │
│ Personal           ██████████                                                    9                    │
│ Nachhaltigkeit     ████████                                                      7                    │
│ …                                                                                                      │
│ Ohne Fachbereich   █████                                                         5                    │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌ IM LEGAL CLEARING ÜBER 10 MIN · 6                                  [×] ┐ ┌ FADEN F-0141                  [×] ┐
│ Nr.      Station             Fachbereich    in Station   offen seit    │ │ Wie hoch war die Ausschüttungs…   │
│ F-0141   im Legal Clearing   Finanzen         24 min        52 min     │ │ ● erfasst          14:53          │
│ …                                                                      │ │ ● zugewiesen       15:02          │
└────────────────────────────────────────────────────────────────────────┘ │ ◉ im Legal Clearing 15:18 · seit 24 min │
     (Liste und Faden erscheinen erst auf Klick; Escape schließt)          │ ○ freigegeben  ○ auf der Bühne …  │
                                                                           └───────────────────────────────────┘
```

Raster: 12 Spalten, Abstand 16 px; Hauptzahl 5 Spalten, Kennzahlen 7 Spalten (2 × 2, Zulauf über beide Spalten der zweiten
Zeile); Rückstand volle Breite; Drill-down als `SplitPane` (Liste 60 %, Faden 40 %). Bei 1024 px: Hauptzahl volle Breite,
Kennzahlen 2 × 2 darunter. Unter 768 px CSS-Breite (1280 px bei 200 % Zoom): eine Spalte, kein waagrechtes Scrollen.

## Teilung und Zuschnitt

| Punkt | In 061 | Wohin sonst | Grund |
|---|---|---|---|
| Route `/cockpit`, Recht `cockpit.read`, Registerzeile | **ja** | Ausblenden in der Navigation: 089b | Rechte als Daten; ohne Quelle der Rechtemenge wie 053/054 |
| Alter der ältesten offenen Einzelfrage, drei nächstälteste (Z10) | **ja** (Hauptzahl) | — | Planzeile und Z10 |
| Rückstand je Fachbereich | **ja** (Balken je Fachbereich) | — | Planzeile |
| Zulauf je 5 min mit Verlauf | **ja** (12 Säulen über eine Stunde) | — | Planzeile, Wunsch des Eigentümers |
| Legal Clearing über 10 min | **ja** | — | Planzeile |
| „Fragen ohne Endstatus“ vor Debattenschluss | **ja**, mit Stationsleiste | Restantenliste mit Quittung: 087 | Planzeile; 087 baut die namentliche Liste |
| Drill-down auf Liste | **ja**, in der Seite, mit URL-Zustand | Sprung in Steuerung/Beantwortung mit Filter: Folgeliste | deren Filter haben keinen URL-Zustand; 061 berührt fremde Ansichten nicht |
| Faden je Frage (Z13) | **ja**, ohne Akteure | — | Drill-down der Planzeile |
| Platz für den Status der Kanarienfrage | **ja**, ruhige Zeile im Kopf | Inhalt: 086 | Planzeile |
| Prognosen aus dem Tempo (Z11) | nein | **061b** | neue Durchsatzkennzahl des Legal Clearing (Rechtsfreigaben je 15 min) ist eine neue Auswertung: Katalogeintrag, E13-Vermerk, Datenschutzblick; „nächste Antwortrunde voll“ braucht das Antwortbündel (057) |
| Flussbild mit Punkt je Einzelfrage, Alter als Farbe und Form, Tempo je Station (Z12) | nein; 061 zeigt die Stationen als Leiste | **061b** | rund 1 AStd; 061 bliebe sonst nicht unter dem Doppelten der Planzeit |
| Druckansicht | nein | Folgeliste | Druckstile gehören in `app/**` und `styles/**`; der Papierweg ist der Export (051/052) |
| Schwellen je Jahrgang einstellbar | nein, Konstanten im Kern | 041 (Administration) nach Eigentümerfrage 1 | 6.8: erst einstellbar machen, wenn wirklich variabel |

**Skizze 061b „Leitstand: Flussbild und Prognosen“** (eigene Spec vor dem Bau, AGENTS.md R1; mittel, wenn Z11 ohne neue
Kennzahl gelingt, sonst hoch): Flussbild als SVG aus Tokens (Punkt je offene Einzelfrage in ihrer Station, Alter in drei
Stufen als Farbe **und** Form — Kreis, Ring, Quadrat —, „+n in 15 min“ je Station aus `statusTrail`, Kennzeichen „Engpass“ aus
den Schwellen dieser Scheibe, Tabelle mit denselben Zahlen als Alternative für Screenreader); Prognose „im Legal Clearing
abgebaut ca. HH:MM bei n Rechtsfreigaben je 15 min“ mit Katalogeintrag `hv_legal_clearances_last_15m` (Labels `meeting_id`),
Vermerk E13 und Abschnitt „Kennzahlen-Allowlist“ in ihrer Spec. Rund 1,25–1,5 AStd. Abhängigkeit: 061.

## Rechte-Diff (vor dem Bau, Leitplanken §4)

`ROLE_PERMISSIONS`, neue Spalte `cockpit.read` (· = nicht gehalten):

| Rolle | vorher | nachher | Begründung |
|---|---|---|---|
| moderation (Versammlungsbüro) | · | ✓ | Planzeile; Versammlungsbüro steuert die Debatte und den Debattenschluss (087) |
| coordination (Koordination) | · | ✓ | Planzeile; nächste Rolle zu „Leitstand / Projektleitung“ (Rechtekonzept §5) |
| admin (Administration) | · | ✓ | Planzeile; Aggregate, keine Inhalte (§4 „Rechte, keine Inhalte“); ausdrückliche Liste 14 → 15 |
| capture, expert, legal, approver, podium, observer | · | · | Deny by default; Eigentümerfrage 6 |

`READ_PERMISSIONS`: neuer Eintrag `getCockpit: ['cockpit.read']`. `policy-truth-table.md` bleibt **unverändert** (sie enthält
nur Aktionen an Einzelfragen; `cockpit.read` ist keine). Stromthemen (`stream.ts`) bleiben unverändert: `getCockpit` bekommt
kein eigenes Thema; die Ansicht lebt von `questions` und `meeting` (Entscheidung 7). **Invariante, als Test:** jeder Inhaber von
`cockpit.read` hält auch ein Recht des Themas `questions`; sonst fiele seine Ansicht auf den 30-s-Takt zurück, und das wäre eine
Spec-Entscheidung, keine Nebenwirkung.

## Ziel und Entscheidungen vor Bau

**Ziel:** Eine Route `/cockpit` („Leitstand“), die Inhabern von `cockpit.read` in einer Sekunde zeigt, was am längsten wartet,
wo es sich staut und wie sich die Lage entwickelt; jede Zahl führt per Klick oder Tastatur auf die Einzelfragen dahinter und zu
jeder auf ihren Faden; alles live, alles aus dem Kern mit denselben Definitionen wie `/metrics`, nichts je Person.

Jede Entscheidung hat einen **Standard**, nach dem gebaut wird; Abweichungen nur über die Eigentümerfragen unten.

### 1. Quelle der Zahlen: eine Leseoperation im Kern (Vertragsschritt)

**Standard:** neue Operation `GET /v1/meetings/{meetingId}/cockpit` (`operationId: getMeetingCockpit`), `HvApi.getCockpit()`
für den aktuellen Jahrgang (wie `getStage`), im Dienst über `meetingDomain(meetingId)`. Kein Alias ohne `meetingId` (Aliase
laufen bis 0.5 aus). Gerechnet von einer **reinen Kernfunktion** `computeCockpit(events, now, meetingId)` in
`packages/domain/src/cockpit.ts`, die die Definitionen aus `indicators.ts` **teilt** (gemeinsame Hilfen dort exportieren oder in
`cockpit.ts` ziehen und von `indicators.ts` importieren; die Ausgabe von `/metrics` bleibt Byte für Byte gleich). Keine zweite
Definition von „offen“, „Eintritt ins Legal Clearing“ oder „Erfassungszeit“.

Verworfen: (a) Rechnen im Browser aus `listQuestions` — „Legal Clearing über 10 min“ nicht berechenbar, `cockpit.read` ungeprüft,
falsche Zahlen bei eingeschränktem Leserecht; (b) `/metrics` im Browser — Scraper-Token, kein Akteur; (c) neues Feld
`statusSince` an `Question` — verallgemeinert, löst das Rechteproblem nicht und erweitert jede Liste; als Kandidat für 061b
notiert.

**Vertragsschritt (Architekt, erster Commit, nach dem Lesebefund):** Vertrag 0.4.4 → **0.4.5** (additiver Patch; ist vorher eine
andere Vertragsänderung gemergt, die nächste freie Patchnummer), Eintrag in `CHANGELOG.md`, Typen neu erzeugt
(`pnpm contract:types`). Inhalt:

- `Permission` + `cockpit.read` (Beschreibung: „Since 0.4.5 (slice 061): read the control desk figures (`getMeetingCockpit`);
  granted in `ROLE_PERMISSIONS` by slice 061“).
- Operation `getMeetingCockpit`: Parameter `meetingId`; Antworten `200` (`Cockpit`, Header `X-Server-Time`), `401`, `403`
  (R-PERM-02), `404` (unbekannter Jahrgang), `408`, `429`, `500`. Beschreibung: Aggregate je Jahrgang und Fachbereich nach den
  Definitionen des Auswertungskatalogs (033b); keine Kennzahl je Person; keine Fragetexte, keine Akteure, keine Redner.
- Schema **`Cockpit`**, überall `additionalProperties: false` (außer der Abbildung `openByUnit`):

| Feld | Typ | Bedeutung |
|---|---|---|
| `meetingId` | string | Jahrgang |
| `asOf` | date-time | Rechenzeitpunkt aus der injizierten Uhr des Dienstes; alle Alter beziehen sich darauf |
| `meetingStatus` | `MeetingStatus` | `preparation`, `running`, `closed` |
| `debateClosedAt` | date-time, optional | wie `Meeting.debateClosedAt` |
| `totals` | `{ captured, open, answered }`, ganze Zahlen ≥ 0, alle Pflicht | erfasst (alle Einzelfragen des Jahrgangs), offen (Definition 033b = „ohne Endstatus“), vorgelesen (delivered + closed) |
| `openByStatus` | Objekt mit genau den sieben offenen Status `captured`, `classified`, `assigned`, `answer_drafted`, `in_review`, `approved`, `staged`, alle Pflicht | offene Einzelfragen je Station |
| `openByUnit` | Abbildung Fachbereichs-id → ganze Zahl | jeder Fachbereich des Jahrgangs als Schlüssel, auch mit 0 (wie `counts.byUnit`) |
| `openUnassigned` | ganze Zahl | offen ohne Fachbereich (entspricht `unassigned` in `/metrics`) |
| `oldestOpen` | `{ ageSeconds, items }` | Alter der ältesten offenen (0 ohne offene) und bis zu **4** `CockpitQuestionRef`, älteste zuerst, bei gleicher Zeit nach `number` |
| `inflow` | `{ binSeconds: 300, bins, last5m }` | `bins`: genau **12** ganze Zahlen, älteste zuerst; `bins[11]` = `last5m` = Erfassungen mit Alter 0–300 s einschließlich (033b); `bins[i]` für i < 11 = Alter in (300·(11−i), 300·(12−i)] |
| `legalReview` | `{ over10m, items }` | Anzahl wie `hv_questions_in_legal_review_over_10m`; bis zu **50** `CockpitQuestionRef` mit `reviewAgeSeconds`, längste Wartezeit zuerst |

- Schema **`CockpitQuestionRef`** (`additionalProperties: false`): `id`, `number`, `status` (`QuestionStatus`), `unitId`
  (optional), `ageSeconds` (seit Erfassung), `statusAgeSeconds` (seit Eintritt in den aktuellen Status, aus dem Statusverlauf der
  Projektion, Entscheidung 6), `reviewAgeSeconds` (optional, nur in `legalReview.items`: Wartezeit nach der Definition aus 033b).
  **Kein** Fragetext, kein `speakerId`, kein Rednername, kein Akteur, kein Claim.
- Alle Zahlen ganzzahlig (Sekunden abgerundet wie in 033b), nie negativ (ein Ereignis nach `asOf` zählt nirgends).
- Jahrgänge in jedem Status werden gerechnet (anders als `/metrics`, das nur `running` zeigt); die Gleichheit mit
  `computeIndicators` gilt für laufende Jahrgänge (Test K3).

### 2. Route, Registerzeile, Lesezustand

**Standard:** eine Zeile im Feature-Register: `id: 'cockpit'`, `path: '/cockpit'`, `labelKey: 'nav.cockpit'`, Symbol `Gauge`
(lucide; fehlt es in der gepinnten Version, `Activity`), `testId: 'nav-cockpit'`, `helpKey: 'page.cockpit.description'`,
`i18nModule: 'cockpit'`, `requires: 'cockpit.read'`, **kein** Kürzel, **letzte** Zeile (nach `history`). Kein Zähler an der
Navigation. Die Navigation zeigt den Eintrag allen, bis 089b die Rechtemenge liefert (wie 053, 054). Antwortet `getCockpit` mit
403 R-PERM-02 (oder R-PERM-03), zeigt die Seite den Lesezustand `cockpit-forbidden` (`EmptyState`, Titel und ein Satz, keine
Erklärung von Rechten, D9), nie Teildaten.

### 3. Hauptlesung: älteste offene Einzelfrage (Z10)

**Standard:** links oben, Panel über 5 von 12 Spalten. Beschriftung (12 px, Gewicht 500, Grau 600, Großbuchstaben per CSS);
Zahl in Minuten, **28 px Mono**, `tabular-nums`, rechtsbündig in fester Breite (kein Springen von 9 auf 10); ab 100 min als
„1 h 40 min“. Daneben die Stufe (Entscheidung 4). Darunter in 13 px: `F-0125 · zugewiesen · Finanzen` (Nummer in Mono; Station
aus den vorhandenen Statusbeschriftungen `status.*`; Fachbereich als Kurzname aus `listMeetingUnits`, sonst „ohne
Fachbereich“) und „seit 14 min in dieser Station“. Dann die **einzige primäre Schaltfläche der Seite: „Faden öffnen“**. Unter
einer Trennlinie „Danach die ältesten“: drei Zeilen (Nummer Mono links, Station · Fachbereich, Alter Mono rechtsbündig mit
Stufenfarbe nur als Text-Tönung, keine Fläche), jede Zeile eine Schaltfläche, die den Faden öffnet. Ohne offene Einzelfrage:
„—“ statt Zahl, der Satz „Keine offene Einzelfrage.“, keine Schaltfläche (der leere Zustand hat nichts zu tun; zulässige Ausnahme
zu D2, im Bericht zu nennen).

### 4. Stufen als Daten: ruhig, erhöht, kritisch

**Standard:** `COCKPIT_THRESHOLDS` und `cockpitLevel(figure, value, context)` in `packages/domain/src/cockpit.ts` (rein,
importierbar von Web und später von 085/086), Stufen `calm` | `attention` | `critical`. Werte (Eigentümerfrage 1):

| Kennzahl | erhöht ab | kritisch ab | Quelle |
|---|---|---|---|
| Alter der ältesten offenen Einzelfrage | 15 min | 45 min | wie `urgencyLevel` (Beantwortung) und Legende des Zielbilds |
| Legal Clearing über 10 min | 3 | 10 | Annahme; Zielbild markiert „Engpass“ ab 12 im Legal Clearing |
| Rückstand eines Fachbereichs | 20 | 40 | Annahme (230er-Korpus: höchster Fachbereich unter 20) |
| Ohne Endstatus | nach Debattenschluss: > 0 | — | vor Debattenschluss immer ruhig (Planzeile: „vor Debattenschluss“) |
| Zulauf je 5 min | — | — | Information, kein Missstand: nie farbig |

Grenzwert gleich Schwelle ⇒ höhere Stufe. **Darstellung:** ruhig = **keine** Markierung (Ruhe ist der Normalfall, D4); erhöht =
Badge in `--color-tone-warning-*` mit Symbol `TriangleAlert` und Wort „erhöht“; kritisch = Badge in `--color-tone-danger-*` mit
Symbol `OctagonAlert` und Wort „kritisch“. Zahlen bleiben Grau 900; Balken im Rückstand bekommen die Füllfarbe der Stufe
(`--color-tone-*-fg`), sonst Grau 400. Jede Stufe ist ohne Farbe lesbar (Symbol, Wort, Zahl) — farbfehlsichtig sicher; der
zugängliche Name jeder Kennzahl enthält die Stufe („Im Legal Clearing über 10 min: 6, erhöht“).

### 5. Die vier Kennzahlen, der Rückstand und der Zulaufverlauf

**Standard:**

- **Ohne Endstatus:** Zahl 20 px Mono = `totals.open`; darunter „von {captured} erfassten · {answered} vorgelesen“; nach
  Debattenschluss die Unterzeile „nach Debattenschluss offen“. Darunter die **Stationsleiste**: `ProcessStrip` im Modus `dense`
  aus `openByStatus` mit den vorhandenen Statustönungen (`statusTone`) und Legende im Zugänglichen Namen; keine neue Farbe.
- **Im Legal Clearing über 10 min:** Zahl = `legalReview.over10m`; darunter „von {openByStatus.in_review} im Legal Clearing“.
- **Zulauf je 5 min:** Zahl = `inflow.last5m`; daneben **12 Säulen** (inline SVG, 132 × 32 px, Säule 8 px, Abstand 3 px),
  **Grundlinie bei 0** (keine Min–Max-Skalierung, damit 2 → 3 nicht wie ein Sprung aussieht), Skala `max(…bins, 5)`, Säulen
  Grau 300, die jüngste Säule Akzent 500, leere Fenster als 1-px-Strich auf der Grundlinie; `role="img"` mit Zugänglichem Namen
  „Zulauf je 5 Minuten in der letzten Stunde: 2, 3, …; zuletzt 3“. Darunter „letzte Stunde: {Summe}“. Eine Farbe, Position
  trägt die Bedeutung (farbfehlsichtig sicher). Das vorhandene `Sparkline` bleibt unberührt (Min–Max-Linie, für Mengen hier
  irreführend). **Keine Diagrammbibliothek** (takt-047, Lieferkette): zwölf Rechtecke brauchen keine.
- **Rückstand je Fachbereich:** Panel über die volle Breite, eine Zeile je Fachbereich (36 px): Kurzname, waagrechter Balken
  (Länge relativ zum größten Wert, mindestens 2 px bei > 0), Zahl Mono rechtsbündig (Null in Grau 600, takt-048), Stufe. Sortiert
  nach Zahl absteigend, bei Gleichstand nach Name; „Ohne Fachbereich“ (`openUnassigned`) immer zuletzt, abgesetzt. Jede Zeile ist
  eine Schaltfläche (Drill-down).
- **Kopfzeile der Seite:** `PageHeader` mit Titel „Leitstand“ und Beschreibung; rechts „Stand HH:MM:SS“ (Mono, aus `asOf`,
  Europe/Berlin wie `Clock.tsx`) und die Zeile der Kanarienfrage (Entscheidung 9). Ist der Jahrgang nicht `running`, zusätzlich
  „HV in Vorbereitung“ bzw. „HV geschlossen“ als neutrales Badge.

### 6. Drill-down und Faden (Z13)

**Standard:** Jede Kennzahl, jede Fachbereichszeile und jede Zeile der Hauptlesung öffnet unter den Kennzahlen eine **Liste**
(Panel, `SplitPane` mit dem Faden rechts). Der Zustand steht in der URL (`?list=oldest|open|legal|inflow|unit&unit=<id>&q=<id>`,
`useSearchParams` wie die Erfassung), damit Zurück im Browser schließt und der Wandbildschirm eine Liste festhalten kann.

| Auslöser | Liste | Quelle |
|---|---|---|
| Hauptzahl, „Faden öffnen“, Zeilen „Danach die ältesten“ | „Älteste offene Einzelfragen“, Faden der gewählten offen | `oldestOpen.items` |
| Im Legal Clearing über 10 min | „Im Legal Clearing über 10 min“ (bis 50, sonst Hinweis „50 von n, die am längsten wartenden“) | `legalReview.items` |
| Ohne Endstatus | „Ohne Endstatus“, gruppiert nach Station in Reihenfolge der Stationsleiste | `listQuestions({ status: [sieben offene Status], limit: 2000 })` |
| Zulauf je 5 min | „Erfasst in den letzten 5 Minuten“ | `listQuestions({ limit: 2000 })`, gefiltert auf Alter ≤ 300 s gegen `asOf` |
| Fachbereichszeile | „Offen bei {Fachbereich}“ | `listQuestions({ unitId, status: [sieben offene Status] })`; „Ohne Fachbereich“ clientseitig aus der offenen Liste |

Spalten: Nummer (Mono), Station (Statusbeschriftung), Fachbereich, „in Station“ (nur bei Referenzen mit `statusAgeSeconds`),
„offen seit“ (Mono, rechtsbündig). Alter in Listen aus `listQuestions` = `asOf − createdAt` mit `asOf` derselben
Leitstand-Lesung (Entscheidung 10). **Kein Fragetext, kein Redner, keine Wortmeldung in den Zeilen** (Entscheidung 8).

**Faden:** Kopf „Faden F-0141“, Fragetext (`getQuestion`, nur mit Leserecht; ohne: Faden ohne Text), Fachbereich und
Bühnenplatz als Badges, darunter die Stationen als senkrechte Liste: vergangene Station gefüllter Punkt (Grau 600) mit Uhrzeit
HH:MM; aktuelle Station Ring in Akzent 500 mit „seit n min“ (aus `asOf`) und dem Wort „aktuell“ im Zugänglichen Namen; künftige
Stationen hohler Punkt Grau 300 ohne Zeit (drei Formen, nicht nur Farbe). Der Verlauf kommt aus `getQuestionHistory` über die
reine Funktion **`statusTrail(events)`** in `cockpit.ts`, die `reduce` der Projektion über die Ereignisse faltet und nach jedem
Ereignis den Status der Einzelfrage vergleicht: Statuswechsel ⇒ Eintrag `{ status, at }`. **Keine eigene Zuordnung
Ereignistyp → Status in Web oder Kern** (AGENTS.md R5). Rücksprünge (Zurückgeben) erscheinen als eigene Einträge in
Zeitreihenfolge. Der Faden zeigt **keine Akteure** (weder Name noch id noch Rolle), keine Rückgabegründe, keine Antworttexte.
Ohne `history.read` zeigt der Faden nur die aktuelle Station aus der Referenz.

### 7. Live

**Standard:** `getCockpit` ist eine gepufferte Lesung im Live-Store mit `READ_TOPICS.getCockpit = ['meeting', 'questions']`.
Die Seite liest neu, wenn `useApiVersion()` zählt (Strom oder Takt), und zusätzlich alle **30 s** über ein `setInterval`
(der Puffer ist dann nach `MAX_AGE_MS` abgelaufen; das Intervall ist ein Anstoß, keine Zeitquelle). Eine Aktualisierung
verschiebt **nie** den Fokus, ändert keine Layouthöhe (feste Mindesthöhen, `tabular-nums`) und animiert nichts. Kein
`aria-live` auf den Kennzahlen (alle 30 s eine Ansage wäre Lärm). Ist die Verbindung unterbrochen (Phase `reconnecting` oder
`offline` aus `useConnection`), zeigt der Kopf „Stand HH:MM:SS · Verbindung unterbrochen“ in Warnton als Text, ohne Fläche.
Eine offene Liste wird mit derselben Lesung neu aufgebaut; verschwindet die fokussierte Zeile, geht der Fokus auf die
Überschrift der Liste.

### 8. Datenschutz: nichts je Person

**Standard:**

- Die Antwort von `getMeetingCockpit` enthält **nur** die Pfade der Allowlist (Test K7, Vertragsschema mit
  `additionalProperties: false`): `meetingId`, `asOf`, `meetingStatus`, `debateClosedAt`, `totals.{captured,open,answered}`,
  `openByStatus.{captured,classified,assigned,answer_drafted,in_review,approved,staged}`, `openByUnit.<Fachbereichs-id>`,
  `openUnassigned`, `oldestOpen.{ageSeconds,items}`, `inflow.{binSeconds,bins,last5m}`, `legalReview.{over10m,items}` und in
  jedem Element von `items`: `id`, `number`, `status`, `unitId`, `ageSeconds`, `statusAgeSeconds`, `reviewAgeSeconds`.
- Schlüssel von `openByUnit` sind ausschließlich Fachbereichs-ids des Jahrgangs, auch wenn Personen über Rollenzuordnungen an
  Fachbereiche gebunden sind. Kein Wert je Person, je Rolle, je Sitzung, je Gerät.
- Die Seite zeigt keine Rednernamen, keine Wortmeldungsnummern, keine Akteure (auch nicht im Faden), keine Claims („wird
  bearbeitet von“), keine Zahl je Person. Die Kanarienzeile zeigt keine Person.
- E13 (offen): ein Fachbereich mit genau einer Person macht dessen Rückstand faktisch zu einer Zahl je Person; der Leitstand
  folgt dem Katalog (`hv_open_questions`): **keine Unterdrückung im Code**, Schwelle regelt die Betriebsvereinbarung
  (Eigentümerfrage 5). DSFA-Zeile V15 nennt den Leitstand als Empfänger.

### 9. Platz für die Kanarienfrage (086)

**Standard:** eine ruhige Zeile im Kopf rechts neben „Stand“: „Kanarienfrage: nicht eingerichtet“ in Grau 600, ohne Farbe, ohne
Symbol, nicht fokussierbar; Komponente `CanaryLine` mit einer Eigenschaft `status?: undefined`, die 086 durch seinen Status
ersetzt (ok, verspätet, fehlgeschlagen; Stufe nach Entscheidung 4). Kein Vertragsfeld in 061 (086 bringt `Cockpit.canary`).
Eigentümerfrage 2 (ausblenden bis 086).

### 10. Zeit

**Standard:** Jede Altersangabe der Seite stammt aus dem Dienst (`ageSeconds`, `statusAgeSeconds`, `reviewAgeSeconds`) oder ist
`asOf − Zeitstempel` mit `asOf` derselben Lesung. Der Code unter `features/cockpit/**` liest **nie** die Uhr des Geräts (kein
`Date.now`, kein `new Date()` ohne Argument, kein `performance.now`; Test W7). Im Kern kommt `now` aus `clock()` der API (R8).

### 11. Tastaturpfad (D8)

**Standard:** Tab-Reihenfolge: „Faden öffnen“ → drei Zeilen „Danach die ältesten“ → Kennzahlen (jede eine Schaltfläche mit
Namen „Liste öffnen: Ohne Endstatus, 47“) → Fachbereichszeilen → Liste (Pfeil auf/ab innerhalb, Enter öffnet den Faden) →
Faden (Schließen). **Escape** schließt zuerst den Faden, dann die Liste; der Fokus kehrt zum Auslöser zurück. Sichtbare
Fokusringe der Bauteile. Kein neues globales Kürzel (Eigentümerfrage 4).

### 12. Wandbildschirm und Zoom

**Standard:** bei 1280 × 720 (Navigation ausgeklappt) sind Hauptlesung, vier Kennzahlen und die ersten Zeilen des Rückstands
ohne Scrollen sichtbar (Screenshot); keine Information nur im Hover; Kontrast nach den Tokens (axe). Bei 200 % Zoom eine Spalte
ohne waagrechtes Scrollen (e2e prüft `scrollWidth <= clientWidth`). Eine eigene Großanzeige ohne Navigation ist kein Ziel.

### 13. Sprache, Begriffe, Glossar

**Standard:** neues i18n-Modul `cockpit` (DE und en-US, rund 52 Schlüssel; der Bau nennt die Zahl) und drei Shell-Schlüssel
(`nav.cockpit`, `page.cockpit.title`, `page.cockpit.description`); Paritätstest (f) 621 → 621 + n. Begriffe: „Leitstand“
/ „Cockpit“ (Glossar), „im Legal Clearing“ (vorhandene Statusbeschriftung), „Rückstand je Fachbereich“, „Zulauf
je 5 min“, „Ohne Endstatus“ / „No final status yet“, „Faden“ / „Thread“, „Kanarienfrage“ / „Canary question“, Stufen
„erhöht“ / „elevated“ und „kritisch“ / „critical“. Nie „Dashboard“, „Ticket“, „KPI“ in Texten. Glossar: neue Zeilen
**Faden** (Code `statusTrail`, „Timeline“ verboten), **Endstatus** (vorgelesen, abgeschlossen, zurückgezogen, zusammengeführt;
Gegenteil von „offen“ im Auswertungskatalog 033b; „terminal“ in Texten verboten), **Kanarienfrage** (Platzhalter in 061, Inhalt
086); Zeile **Leitstand** ergänzt um `getMeetingCockpit`, `cockpit.read`.

## Nicht-Ziele

- Keine Prognosen (Z11) und kein Flussbild mit Punkt je Einzelfrage (Z12): 061b.
- Keine neue Kennzahl im Katalog, keine Änderung an `/metrics`, `catalog.json` oder dem Allowlist-Tor; die Ausgabe von `/metrics`
  bleibt gleich (Test K3b).
- Keine Schwellen je Jahrgang, keine Konfiguration, keine Alarme (085), kein Inhalt der Kanarienfrage (086), keine Restantenliste
  oder Quittung (087), kein Debattenschluss.
- Kein Sprung in Steuerung, Beantwortung oder Historie mit vorbelegtem Filter (deren Filter haben keinen URL-Zustand).
- Keine Quelle der Rechtemenge an `/auth/me` und kein Ausblenden in der Navigation (089b).
- Keine Druckstile, keine Großanzeige, kein Dunkelmodus.
- Kein Schreiben: der Leitstand bietet keine Aktion an einer Einzelfrage an.
- Kein Ausschluss synthetischer Einzelfragen (das bringt 086 mit `synthetic=true`; Hinweis an 086 unten).
- Keine Änderung an `apps/web/src/components/**`, `styles/**`, anderen Feature-Ordnern oder an der Shell außer der Registerzeile.

## Files allowed

Vertragsschritt (Architekt):
- `packages/contract/openapi.yaml` (nur `cockpit.read` im Enum `Permission`, die Operation `getMeetingCockpit`, die Schemas `Cockpit` und `CockpitQuestionRef`, ggf. ein Tag, `info.version`)
- `packages/contract/CHANGELOG.md` (nur der Abschnitt 0.4.5)
- `packages/contract/src/types.ts` (nur neu erzeugt)

Kern und Dienst (implementierer-backend):
- `packages/domain/src/cockpit.ts` (neu)
- `packages/domain/src/__tests__/cockpit061.test.ts` (neu)
- `packages/domain/src/indicators.ts` (nur gemeinsame Hilfen exportieren oder aus `cockpit.ts` importieren; Ausgabe unverändert)
- `packages/domain/src/types.ts` (nur `cockpit.read` in `PERMISSIONS`, `getCockpit` in `READ_PERMISSIONS`, die Typen `Cockpit` und `CockpitQuestionRef`)
- `packages/domain/src/permissions.ts` (nur `cockpit.read` in den Bündeln moderation, coordination, admin)
- `packages/domain/src/api.ts` (nur `getCockpit` in `HvApi` und seine Umsetzung)
- `packages/domain/src/index.ts` (nur Exporte aus `cockpit.ts`)
- `packages/domain/src/__tests__/admin040a.test.ts` (nur die Liste der Administration 14 → 15)
- `apps/api/src/app.ts` (nur die Route `GET /v1/meetings/:meetingId/cockpit`)
- `apps/api/src/__tests__/cockpit061.test.ts` (neu)
- `apps/api/src/__tests__/postgres-cockpit061.test.ts` (neu)

Oberfläche (implementierer-oberflaeche):
- `apps/web/src/features/cockpit/**` (neu)
- `apps/web/src/api/http.ts` (nur die Route `getCockpit`)
- `apps/web/src/api/liveStore.ts` (nur der Eintrag `getCockpit` in `READ_TOPICS`)
- `apps/web/src/api/http.test.ts` (nur die Zeile der Routentabelle für `getCockpit`)
- `apps/web/src/api/cockpit061.test.ts` (neu)
- `apps/web/src/app/featureRegistry.ts` (nur die Zeile `cockpit`, ihr Import und ihr Symbol)
- `apps/web/src/app/featureRegistry.test.ts` (nur die Erwartungen zur neuen Zeile)
- `apps/web/src/i18n/cockpit.de.ts` (neu), `apps/web/src/i18n/cockpit.en.ts` (neu)
- `apps/web/src/i18n/{de,en}.ts` (nur das Modul `cockpit`)
- `apps/web/src/i18n/{shell.de,shell.en}.ts` (nur die drei Schlüssel `nav.cockpit`, `page.cockpit.*`)
- `apps/web/src/i18n/parity.test.ts` (nur Modul `cockpit` und die Gesamtzahl)
- `apps/web/e2e/061-leitstand.spec.ts` (neu)
- `apps/web/playwright.config.ts` (nur `SHARED_SPECS`: die neue Datei eintragen)
- `scripts/e2e-http-031.test.mjs` (nur `SHARED_FILES` und `HTTP_ORDER`: die neue Datei an ihrer Pfadstelle zwischen 055b und 080)

Dokumentation:
- `docs/evidence/061-*.png`
- `docs/glossar.md` (nur die Zeilen aus Entscheidung 13)
- `docs/datenschutz/dsfa-vorentwurf.md` (nur Zeile V15: Leitstand als Empfänger, Verweis auf 061)
- `docs/sicherheit/bedrohungsmodell.md` (nur eine Zeile 061 in „Weitere Scheiben mit Sicherheitsbezug“)
- `docs/feedback/2026-09-zielbild-oberflaeche.md` (nur Status Z10 und Z13 auf `ist (061)`, Ort von Z11 und Z12 auf 061b)
- `docs/folgeliste.md` (nur nicht blockierende Befunde aus Bau und Review)
- `docs/slices/061-leitstand.md` (diese Spec: Bericht, Review findings)

## Ausdrücklich nicht erlaubt

Alles unter `apps/web/src/components`, `apps/web/src/styles`, `apps/web/src/app` außer den zwei Registerdateien, die übrigen
Feature-Ordner (answers, steering, focus, capture, stage, history, speakers), `apps/api/src/metrics`, `scripts/` außer der einen
Testdatei, die Wahrheitstabelle, `docs/produktplan-beta.md` (Hinweise an den Orchestrator unten), `.github`. Fehlt etwas: anhalten
und melden. Dieser Abschnitt steht bewusst außerhalb von „Files allowed“.

## Vor dem Bau prüfen

1. **Lesebefund** dieser Spec in frischem Kontext liegt vor (Datenschutz, Security, Vertrag) und ist eingearbeitet; erst dann
   der Vertragsschritt. Vertrag ist noch 0.4.4, sonst nächste freie Patchnummer.
2. `reduce` lässt sich über die Ereignisse falten, die `getQuestionHistory` liefert (maskierte Leseereignisse einer einzelnen
   Einzelfrage, ohne Redebeitrag und Wortmeldung im Zustand), und liefert für jede Einzelfrage des Seeds den Status, den
   `getQuestion` meldet. **Geht das nicht, anhalten und melden**; keine zweite Zuordnung Ereignistyp → Status. Rückfall nach
   Entscheidung des Orchestrators: der Faden zeigt nur die aktuelle Station aus der Referenz.
3. `listQuestions({ status: […], limit: 2000 })` ist für moderation, coordination und admin in beiden Projekten vollständig
   (Summe = `totals.open`). Sonst nennt der Bericht die Abweichung.
4. Rechenzeit: `getCockpit` bei 800 Einzelfragen in-process (Seed mit `questions: 800`) p90 < 50 ms. Darüber: Zwischenspeicher je
   Jahrgang bis zum nächsten Ereignis oder 5 s, eine Rechnung zur Zeit (Muster `createSingleFlightCache`), im Bericht begründet.
5. **Laufzeit `e2e-http`:** Dauer des Schritts „End-to-end http project …“ aus den letzten drei grünen Läufen lesen
   (`gh api repos/ypoxx/hvworkflow/actions/runs/<id>/jobs`). Schätzung der Mehrzeit: drei Rollenwechsel, keine Schreibschritte,
   axe, ein Screenshot ≈ **0:40**. Liegt Ist plus Schätzung über 6:30 (weiche Warnschwelle), im Bericht nennen; über 11:00
   anhalten.
6. Die e2e-Datei schreibt im Projekt `http` **nichts** (nur Lesen); dann bleibt der Endzustand für 080 und abnahme unberührt.

## Tests zuerst (rot, dann grün)

**Kern** (`packages/domain/src/__tests__/cockpit061.test.ts`, feste Uhr):

- **K1 Rechte.** Genau die Bündel moderation, coordination, admin halten `cockpit.read` (erwartete Liste als Daten im Test, wie
  `admin040a`); die Administration hat 15 Rechte. Jeder Inhaber hält auch ein Recht des Themas `questions` (Invariante oben).
- **K2 Verweigerung.** `getCockpit` antwortet für jede übrige Rolle (aus `ROLES` minus Inhaber, datengetrieben) mit 403 R-PERM-02;
  für eine gebundene Fachkraft ebenso; keine Teildaten.
- **K3 Gleichheit mit 033b.** Für einen laufenden Jahrgang (Seed und eine Grenzfall-Ereignisliste mit Erfassung genau 300 s und
  301 s vor `now`, Eintritt ins Legal Clearing genau 600 s und 601 s vor `now`, Rückgabe nach `in_review`, neuer
  Verweigerungsvorschlag): `oldestOpen.ageSeconds`, `openByUnit` + `openUnassigned`, `inflow.last5m` und `legalReview.over10m`
  gleichen den Werten von `computeIndicators` für dieselbe Liste und dasselbe `now`. **K3b:** `renderMetrics` gibt für den Seed
  vor und nach der Änderung dieselbe Zeichenkette aus.
- **K4 Zulauf.** 12 Fächer, disjunkt, `bins[11] === last5m`, Summe = Erfassungen mit Alter ≤ 3600 s; Grenzen 300/600/3600 s.
- **K5 Älteste.** Höchstens 4 Referenzen, älteste zuerst, Gleichstand nach `number`; `items[0].ageSeconds === ageSeconds`;
  `statusAgeSeconds` ändert sich durch Claim, Rechtsfreigabe und Weiterleiten **nicht**, durch Zuweisen und Zurückgeben schon.
- **K6 Legal Clearing.** Höchstens 50 Referenzen, längste Wartezeit zuerst, jede mit `reviewAgeSeconds > 600`; ein neuer
  Verweigerungsvorschlag setzt `reviewAgeSeconds` zurück (033b-Regel).
- **K7 Datenschutz (Negativtest und Allowlist).** Seed mit Rollenzuordnungen, die Personen an Fachbereiche binden, mit
  `personId` und Klarnamen; Akteur coordination (hält `question.identity.reveal`). Die serialisierte Antwort enthält **keine**
  Akteur-id, keine `personId`, keine `subjectId` einer Rollenzuordnung, keinen `speakerId`, keinen Rednernamen, keinen
  Teil eines Fragetexts (Stichproben über alle Einzelfragen); der rekursive Schlüsselweg ergibt genau die Pfade der Allowlist
  (Entscheidung 8); die Schlüssel von `openByUnit` sind genau die Fachbereichs-ids des Jahrgangs. Rot-Probe: ein absichtlich
  ergänztes Feld `claimedBy` lässt den Test scheitern (im Bericht gezeigt, nicht committet).
- **K8 Zeit.** `asOf` gleich der injizierten Uhr; Uhr um 10 min vorgestellt ohne Ereignis ⇒ alle Alter + 600, `over10m` und Stufen
  folgen; ein Ereignis nach `asOf` zählt nirgends.
- **K9 Statusverlauf.** `statusTrail` liefert für jede Einzelfrage des Seeds als letzten Status den projizierten; Ereignisse ohne
  Statuswechsel erzeugen keinen Eintrag; über die Ereignisse aus `getQuestionHistory`.
- **K10 Stufen.** `cockpitLevel` an jeder Schwelle (Grenzwert ⇒ höhere Stufe), Zulauf immer `calm`, „Ohne Endstatus“ vor
  Debattenschluss immer `calm`, danach bei > 0 `attention`.
- **K11 Jahrgang nicht laufend.** In `preparation` und `closed` gerechnet, `meetingStatus` gemeldet; leerer Jahrgang: alle Zahlen 0,
  `items` leer, `bins` zwölf Nullen.

**Dienst** (`apps/api/src/__tests__/cockpit061.test.ts`, `postgres-cockpit061.test.ts`):

- **A1** 200 für coordination, Antwort gültig gegen das Vertragsschema, Header `X-Server-Time`.
- **A2** 403 R-PERM-02 für expert und observer mit Regel-id im Problem; 401 ohne Akteur; 404 für einen unbekannten Jahrgang.
- **A3** Antwort über HTTP gleich `getCockpit` in-process für denselben Speicher und dieselbe Uhr.
- **A4** (Postgres) 200 aus dem Jahrgangs-Schnappschuss, nie aus der globalen Projektion (takt-024); Zugriffslog mit
  `operationId` und ohne Inhalt der Antwort.

**Web** (`apps/web/src/api/cockpit061.test.ts`, `apps/web/src/features/cockpit/*.test.ts(x)`):

- **W1** Stufe → Darstellung: ruhig ohne Badge, erhöht und kritisch mit Symbol und Wort; Zugänglicher Name enthält die Stufe.
- **W2** Zulaufsäulen: 12 Rechtecke, Grundlinie 0, Skala `max(…, 5)`, jüngste Säule Akzent, leere Fenster als Strich, Name mit
  allen Werten.
- **W3** Rückstand: Reihenfolge, „Ohne Fachbereich“ zuletzt, `data-count` gleich `openByUnit`, Füllfarbe nur bei Stufe.
- **W4** Zustände: Laden (Skelette mit festen Höhen, keine Layoutänderung beim Wechsel zu Daten), Fehler (Grund und Regel-id,
  „Erneut laden“), Lesezustand bei 403 (`cockpit-forbidden`), leer („—“, kein „Faden öffnen“).
- **W5** Datenschutz im DOM: Seite mit Seed und Akteur coordination, Liste „Ohne Endstatus“ und ein Faden offen: das DOM enthält
  keinen Rednernamen aus `listSpeakers`, keine Akteur-id (`u-…`), kein `data-*`-Attribut mit Person.
- **W6** Faden: Stationen mit HH:MM, aktuelle mit „seit n min“ aus `asOf`, drei Formen, kein Akteur, kein Rückgabegrund.
- **W7** Keine Geräteuhr: die Quellen unter `features/cockpit/` enthalten weder `Date.now` noch `new Date()` ohne Argument noch
  `performance.now` (Test liest die Dateien).
- **W8** Tastatur: Enter auf einer Kennzahl öffnet die Liste, Pfeile in der Liste, Enter öffnet den Faden, Escape schließt in
  zwei Stufen, Fokus zurück zum Auslöser; eine Live-Aktualisierung (Schreibvorgang eines zweiten Akteurs auf demselben Speicher)
  ändert die Zahl, ohne den Fokus zu verschieben.
- **W9** Live über den echten Live-Store in-process: Schreibvorgang (Zurückziehen durch moderation) ⇒ `totals.open` sinkt in der
  angezeigten Zahl ohne Neuladen der Seite.
- **W10** Zeit: `getCockpit` bei 800 in-process p90 < 50 ms (20 Läufe); Aufbau der Liste „Ohne Endstatus“ bei 800 p90 < 100 ms (D9).

**e2e** (`apps/web/e2e/061-leitstand.spec.ts`, Projekte `in-process` und `http`, axe bei jedem Ansichtswechsel):

- **S1** coordination öffnet `/cockpit` über die Navigation: Hauptlesung, vier Kennzahlen, Rückstand sichtbar; genau eine
  primäre Schaltfläche.
- **S2** Gleichheit über Ansichten: „Ohne Endstatus“ gleich dem Zähler `open` der Navigation; jede Fachbereichszeile gleich der
  Zelle der Verteilung in `/steering` (`data-count`, 053).
- **S3** Drill-down: Klick auf „Im Legal Clearing über 10 min“ ⇒ Liste mit so vielen Zeilen wie die Zahl (bis 50), jede Zeile
  Station „im Legal Clearing“; Enter auf einer Zeile ⇒ Faden mit aktueller Station „im Legal Clearing“; Escape, Escape ⇒ zu,
  Fokus auf der Kennzahl; die URL trägt `list=legal` und nach dem Schließen nicht mehr.
- **S4** Lesezustand: expert öffnet `/cockpit` ⇒ `cockpit-forbidden`, keine Zahl.
- **S5** (nur in-process) moderation: Zahl „Ohne Endstatus“ N; eine Einzelfrage in der Beantwortung zurückziehen; zurück im
  Leitstand N − 1 und die Einzelfrage fehlt in der Liste „Ohne Endstatus“.
- **S6** Datenschutz: nach S3 enthält der Seiteninhalt keinen Rednernamen aus dem Seed (Liste der synthetischen Namen aus
  `listSpeakers` im Test gelesen) und keine Akteur-id.
- **S7** 200 % Zoom (Breite 640 CSS-px): kein waagrechtes Scrollen, alle vier Kennzahlen erreichbar.
- **S8** Screenshots (nur in-process, Schriften geladen): `061-leitstand-de.png`, `061-leitstand-en.png` (1440 × 900),
  `061-liste-faden-de.png`, `061-liste-faden-en.png` (Liste Legal Clearing mit offenem Faden), `061-wand-1280x720-de.png`.

## Akzeptanzkriterium

1. Lesebefund vor dem Bau liegt vor; Vertragsschritt als erster Commit (Typen erzeugt, CHANGELOG 0.4.5), vor jedem Code.
2. Tests K1–K11, A1–A4, W1–W10 vor der Änderung rot (Ausgabe im Bericht), danach grün; S1–S8 im Projekt `in-process` grün,
   auch mit `--repeat-each=3`; S1–S4, S6, S7 im Projekt `http` grün im CI-Lauf `e2e-http` des PR.
3. Volle Playwright-Suite `in-process` grün (Anzahl nennen), darunter unverändert 001, 013, 053, 054; axe ohne serious/critical.
4. Fünf Screenshots in `docs/evidence/061-*.png` nach S8; auf dem Hauptbild sind Hauptlesung mit Stufe, vier Kennzahlen mit
   Zulaufsäulen und Stationsleiste, Rückstand und die Kanarienzeile lesbar.
5. `pnpm role-literals`, `pnpm i18n-literals`, `pnpm vocabulary`, `pnpm now-check`, `pnpm metrics-allowlist` grün; Paritätstest
   mit der neuen Zahl; `policy-truth-table.md` unverändert; `/metrics`-Ausgabe unverändert (K3b).
6. Keine neue Abhängigkeit in einer `package.json` (takt-047).
7. `pnpm slice-scope` grün auf `claude/slice-061-…`; `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).
8. Design-Kritik in frischem Kontext liegt vor, ohne Blocker (Tabelle D1–D10 unten), mit Vergleich zu `089-lagebild.png`.

## Nachweise

- Rote und grüne Testausgaben, Schluss von `pnpm gates` mit Commit, Playwright-Zahlen, Zeitmessungen W10 und Vor-dem-Bau-Punkt 4.
- `docs/evidence/061-*.png` (fünf Bilder aus `in-process`). Das ist der Bildnachweis.
- Projekt `http`: grüner CI-Lauf `e2e-http` des PR mit Lauf-ID, Job-ID, Schluss des Logs mit den Fällen aus
  `061-leitstand.spec.ts` und der Dauer des Schritts gegen 12:00 (Warnschwelle 6:30).
- K7 mit der Rot-Probe (Ausgabe), Schlüsselweg der Antwort im Bericht.
- Design-Kritik als Tabelle im Bericht.

### Design-Vorgaben D1–D10 (Maßstab der Design-Kritik)

| D | Vorgabe für diese Scheibe | Prüfung |
|---|---|---|
| D1 | In 30 s klar: links oben die älteste offene Einzelfrage, rechts drei Kennzahlen und der Zulauf, darunter der Rückstand; Titel und ein Satz, keine Erklärtexte. | Screenshot, Design-Kritik |
| D2 | Genau eine primäre Schaltfläche („Faden öffnen“); Kennzahlen und Zeilen sind sekundär. Leerer Zustand ohne Aktion als begründete Ausnahme. | S1, W4 |
| D3 | 12-Spalten-Raster, 8-px-Raster, Panels 16–24 px Innenabstand, Kanten der Kennzahlen fluchten mit der Hauptlesung und dem Rückstand. | Screenshot |
| D4 | Ruhe ohne Farbe; Farbe nur bei Stufe, nur als Badge-Tönung oder Balkenfüllung, nie als Fläche; Zulauf einfarbig; keine Verläufe, keine Schatten. | W1–W3, Screenshot |
| D5 | Alle Zahlen, Nummern, Zeiten in Mono, rechtsbündig, `tabular-nums`; Fehler mit Regel-id. | W3, W4, Screenshot |
| D6 | Laden, leer, Fehler, Lesezustand, Verbindung unterbrochen, leere Liste gestaltet. | W4, S4 |
| D7 | Alle Texte aus `cockpit.*`/Shell, DE und en-US, Hausvokabular, nie „Dashboard“, „KPI“, „Ticket“. | Parität, `pnpm vocabulary` |
| D8 | Kernszene per Tastatur, Escape in zwei Stufen, Fokus sichtbar, Live verschiebt keinen Fokus. | W8, S3 |
| D9 | Nichts Ausgegrautes; Lesezustand statt Teildaten; bei 800 unter 100 ms für Liste, `getCockpit` unter 50 ms. | W10, S4 |
| D10 | Wirkt wie eine Konsole von 2026: ruhig, dicht, präzise; Hauptzahl trägt, Säulen und Leiste sind klein und genau, nichts wirkt wie eine Vorlage. | Design-Kritik gegen 089-lagebild |

## Wirkung und Risiko

| Risiko | Abwehr | Nachweis |
|---|---|---|
| Eine Kennzahl je Person schleicht sich ein (Feld, Schlüssel, Faden mit Akteur) | Schema `additionalProperties: false`, Allowlist-Schlüsselweg, Faden ohne Akteure, DOM-Negativtest | K7, W5, W6, S6 |
| Zwei Definitionen derselben Kennzahl (Leitstand ≠ `/metrics`) | gemeinsame Hilfen, Gleichheitstest, Ausgabe von `/metrics` gepinnt | K3, K3b |
| Recht ohne Prüfung | Prüfung im Kern über `READ_PERMISSIONS`; 403 statt Teildaten | K2, A2, S4 |
| Statuslogik außerhalb der Tabelle | Statusverlauf nur über `reduce` der Projektion | K9, Vor-dem-Bau-Punkt 2 |
| Zeit aus dem Gerät | alle Alter aus dem Dienst bzw. `asOf` | K8, W7 |
| Rechenlast bei vielen Leitständen | Messung bei 800, Zwischenspeicher nur bei Bedarf | W10, Vor-dem-Bau-Punkt 4 |
| Dashboard-Lärm (Farbe, Bewegung, Ansagen) | Farbe nur bei Stufe, keine Animation, kein `aria-live` auf Zahlen | Design-Kritik, W1 |
| Schwellen falsch gewählt | Konstanten als Daten an einer Stelle, Eigentümerfrage 1 | K10 |
| Leitstand in der Navigation für Rollen ohne Recht | Lesezustand; Ausblenden mit 089b | S4 |
| `e2e-http` wird zu lang | nur Lesen, Messung vor dem Bau | Vor-dem-Bau-Punkt 5 |

## Aufwand

Geschätzt **3,9 AStd** (Spanne 3,4–4,5). Plan: 2 AStd, mit dem Zielbild 3,75 (Z11 0,25, Z12 1,0, Z13 0,5); 061 trägt Z13 und
den nicht vorgesehenen Vertragsschritt, Z11 und Z12 gehen an 061b. Differenz an Prüfpunkt 2 und die Budgettabelle (Plan 6.5).

| Teil | AStd |
|---|---|
| Vertragsschritt: Recht, Operation, zwei Schemas, CHANGELOG, Typen | 0,35 |
| Kern: `cockpit.ts` (`computeCockpit`, `statusTrail`, Schwellen, Stufen), gemeinsame Hilfen mit `indicators.ts`, Recht, `getCockpit`, K1–K11 | 0,8 |
| Dienst: Route, A1–A4 | 0,3 |
| Web-API: HTTP-Route, `READ_TOPICS`, Tests | 0,1 |
| Seite: Gerüst, Zustände, Hauptlesung, vier Kennzahlen, Zulaufsäulen, Stationsleiste, Rückstand, Kanarienzeile, Live | 0,8 |
| Drill-down-Liste, Faden, URL-Zustand, Tastaturpfad | 0,45 |
| i18n, Registerzeile, Glossar | 0,15 |
| Web-Tests W1–W10 | 0,3 |
| e2e S1–S8 in beiden Projekten, axe, Screenshots, Einreihung `http` | 0,45 |
| Doku-Zeilen (DSFA, Bedrohungsmodell, Zielbild), `pnpm gates`, Bericht, CI-Nachweis | 0,2 |

**Zuschnitt bei Überschreitung (vorbereitet).** Zeichnet sich ab, dass der Bau über 4,0 AStd geht (das Doppelte der Planzeit),
committet er nach Vertrag, Kern, Dienst, Hauptlesung, Kennzahlen, Rückstand und den Listen ohne Faden einen Zwischenstand mit
allen Tests außer K9, W6 und dem Faden-Teil von S3, und meldet. Der Faden folgt dann mit 061b, nach Ergänzung von dessen Spec.

## Standards (auf Standard gebaut)

| Standard | Was 061 baut | Kosten einer späteren Änderung |
|---|---|---|
| Eigene Leseoperation mit `cockpit.read` | Vertrag, Kern, Dienst | — |
| Inhaber moderation, coordination, admin | `ROLE_PERMISSIONS` | weitere Rolle: eine Zeile plus Rechte-Diff, < 0,1 AStd (Review Security) |
| Schwellen als Konstanten im Kern | `COCKPIT_THRESHOLDS` | je Jahrgang einstellbar: Konfiguration plus Ereignis, rund 0,75 AStd (mit 041) |
| Kanarienzeile sichtbar mit „nicht eingerichtet“ | `CanaryLine` | ausblenden bis 086: < 0,1 AStd |
| Letzter Eintrag der Navigation, kein Kürzel | Registerzeile | Alt+7 oder andere Position: < 0,1 AStd |
| Zeilen ohne Fragetext, Text nur im Faden | Liste | Text in der Zeile: < 0,1 AStd (Review Datenschutz) |
| Keine Unterdrückung kleiner Fachbereiche (E13) | Rückstand | Mindestzahl aus der BV: rund 0,25 AStd in Kern und Katalog |
| Drill-down in der Seite | Liste, Faden | Sprung in Steuerung mit Filter: Filter mit URL-Zustand in 053, rund 0,4 AStd |

## Offene Eigentümerfragen

Keine blockiert den Bau; alle mit Standard.

1. **Schwellen.** Älteste offene 15/45 min, Legal Clearing über 10 min 3/10, Rückstand je Fachbereich 20/40, „Ohne Endstatus“
   erhöht erst nach Debattenschluss. *Standard:* diese Werte als Konstanten; Einstellbarkeit je Jahrgang erst mit 041.
2. **Kanarienfrage vor 086.** *Standard:* ruhige Zeile „Kanarienfrage: nicht eingerichtet“. Alternative: ausblenden, bis 086
   sie füllt (wirkt in der Freigabe-Demo fertiger, zeigt aber den Plan nicht).
3. **061b vor der Freigabe-Demo?** Flussbild (Z12) und Prognose (Z11) machen das Lagebild aus dem Zielbild komplett.
   *Standard:* 061b bekommt direkt nach 061 eine eigene Spec und läuft vor der Demo nur, wenn das Budget an Prüfpunkt 2 es
   trägt; die Prognose braucht dann eine neue Katalogkennzahl mit E13-Vermerk.
4. **Navigation.** *Standard:* letzter Eintrag, kein Kürzel. Alternative: erster Eintrag als Übersicht, Alt+7.
5. **E13, kleine Fachbereiche.** *Standard:* keine Unterdrückung (wie `/metrics`), bis die Betriebsvereinbarung eine Mindestzahl
   nennt.
6. **Weitere Inhaber.** *Standard:* nur moderation, coordination, admin (Planzeile). Frage: soll die Freigabe (approver) den
   Leitstand sehen?
7. **Fragetext in Listen.** *Standard:* nein, nur im Faden (Datensparsamkeit, Ruhe).

## Hinweise an den Orchestrator

- **Planzeile 061** nachziehen: Risikoklasse **hoch** (Hochstufung, Begründung „Warum hoch“), Lanes `contract, core, service,
  web-api, web-cockpit, web-shell, e2e, docs`, Aufwand 3,9 AStd, Nachweise um Rechte-Diff, Gleichheit mit 033b, Negativtest und
  Allowlist ergänzen; Rolle „Architekt (Vertragsschritt) + Implementierer-Backend + Implementierer-Oberfläche“.
- **Neue Planzeile 061b** „Leitstand: Flussbild und Prognosen“ (Skizze oben; Abhängigkeit 061; Lanes web-cockpit, ggf. core,
  service, docs-sicherheit), Zielbild Z11, Z12; Kalender nach 061.
- **Vertragsreihenfolge:** 055c plant ebenfalls einen Vertragsschritt; wer zuerst merged, nimmt 0.4.5.
- Die Statuszeile der Spec 033b ist nicht nachgezogen (Code gemergt in `115c28b`).
- Die Freigabe-Demo sieht nach 061 im Leitstand das Lagebild; das Demo-Skript (`docs/demo-skript.md`) kann eine Szene „Leitstand“
  bekommen (nicht in dieser Scheibe).

## Hinweise an Folgescheiben

- **061b:** Flussbild und `+n in 15 min` aus `statusTrail` und den Schwellen dieser Scheibe; Prognose nur mit Katalogeintrag.
- **086:** `Cockpit.canary` als optionales Feld (Vertragsschritt), `CanaryLine` füllen; synthetische Einzelfragen aus
  `computeCockpit` **und** `computeIndicators` ausschließen (gleiche Hilfe), Test in beiden.
- **087:** Ansicht „Offene Fragen vor Schluss“ als weiterer Drill-down im Leitstand (Liste „Ohne Endstatus“ ist die Grundlage);
  `debateClosedAt` schaltet die Stufe „Ohne Endstatus“ schon heute.
- **085:** Alarme lesen `COCKPIT_THRESHOLDS`, keine zweite Schwellenliste.
- **089b:** `visibleRoutes` blendet `/cockpit` ohne `cockpit.read` aus; der Lesezustand bleibt für Direktaufrufe.

## Bericht (nach Bau ausfüllen)

```
Slice: 061-leitstand
Done: <drei Zeilen: Vertrag 0.4.5 mit cockpit.read und getMeetingCockpit; Kern computeCockpit/statusTrail/Stufen mit
      Gleichheit zu 033b; Seite /cockpit mit Hauptlesung, Kennzahlen, Rückstand, Drill-down, Faden, live>
Evidence: <Schluss von `pnpm gates` auf Commit …>, docs/evidence/061-leitstand-de.png, 061-leitstand-en.png,
          061-liste-faden-de.png, 061-liste-faden-en.png, 061-wand-1280x720-de.png; CI e2e-http Lauf <id>, Job <id>, Dauer <m:ss>
Open: <was nicht erledigt ist, mit Grund; Abweichungen vom Zielbild 089-lagebild>
Touched: <Dateiliste>
```

Zusätzlich im Bericht: rote Testausgaben vor der Änderung; Zeitmessungen (W10, `getCockpit` p90, Liste p90, ggf.
Zwischenspeicher); Schlüsselweg der Antwort und Rot-Probe aus K7; Zahl der i18n-Schlüssel und neue Paritätszahl; Ergebnis von
Vor-dem-Bau-Punkt 2 (Faltbarkeit) und 5 (Laufzeit); Design-Kritik D1–D10 als Tabelle (je Zeile ja/nein mit einem Satz) mit dem
Vergleich zu `docs/evidence/089-lagebild.png`; Liste der Abweichungen vom Prototyp (Rednernamen, Wortmeldung, Widerspruchskanal,
Rednerwand, Flussbild, Prognosen) mit Grund.

## Review findings

(leer bis zum Lesebefund)
