# Scheibe 060 — Entwurfspuffer, Präsenz und Fassungsvergleich

**Status:** spec (05.10.2026; gelesen auf `c5990c8`: 028, 036a, 036b, 054, 055b, 090 und takt-048 gemergt, Vertrag 0.4.4).
Achte Scheibe der Oberflächenkette der Freigabe-Demo 045 → 048 → 053 → 054 → 055 → 055b → 059 → 046 → **060** → 061 → 041
(Register E57). Nicht geteilt; Rückfallteilung 060b (Erfassung) vorbereitet, Abschnitt „Teilung und Zuschnitt“. Auf Standard
gebaut; keine Eigentümerfrage blockiert. **Lesebefund der Spec vor dem Bau** (Klasse hoch, Leitplanken §4).
**Risikoklasse:** hoch · 3,8 AStd · Kalender 23.11.2026 (W9), vorgezogen · Lanes: web-api, web-components, web-answers, web-focus, web-capture, i18n, e2e, docs-sicherheit, docs-datenschutz
**Rolle:** implementierer-oberflaeche; Design-Kritik (D1–D10) in frischem Kontext vor dem Review (nicht die Sitzung, die
diese Spec schrieb, nicht die bauende); ein Review in frischem Kontext mit den Perspektiven **Datenschutz** (Gerätespeicher,
Präsenz von Beschäftigten), **Security** (unveröffentlichte Antworten im Browserspeicher, T-G1-I-08) und **UX/Barrierefreiheit**
(Vergleich, Präsenz, Fokus); Modell nur in `.claude/agents/` (takt-012). Nie gebündelt.
**Rule ids:** AGENTS.md R1–R4, R6, R7, R9–R12; R-CLAIM-01 und R-CLAIM-02 (Übernahme, weiche Sperre, 028); R-TRANS-03 und
R-GUARD-04 (eine neue Version hebt Freigabe und Rechtsfreigabe auf); 090 (Eingaben gehören dem Akteur); 010d Ziel 1/3
(Ausgang eines Schreibens nur auf der gezeigten Frage); takt-008 (Sperre bis der Datensatz nachgezogen hat, Fokus bleibt);
takt-048 Entscheidungen 2, 6, 7 (Vorbelegung, Basis nach dem Speichern, Hinweis bei fremder Version; Entscheidung 7 wird hier
geändert, Entscheidung 13); 054 (Entwurf je Akteur und Einzelfrage, `writingOutcome`); 055b Entscheidung 7 (`generation`);
ADR 0002, ADR 0009 (keine `personId` in Lesepfaden), ADR 0013 (Person nur über die Übernahme sichtbar), ADR 0014 (Strom);
DSFA-Vorentwurf V5 („Entwurfsspeicherung ohne Personenauswertung (060)“); Bedrohungsmodell T-G1-I-08.
**Quellen-IDs:** Plan §5 Eintrag 060; `docs/agentische-entwicklung-plan.md` §5.3 Zeile „Fehlerpfad (Konflikt 412 in der
Oberfläche)“ (geplant in Scheibe 060); `docs/folgeliste.md` 054 Bau (`focus.write.gone`) und 054 Review 5; Hinweise an 060 in
054, 055, 055b, takt-048; Register E13, E14, E33, E36.
**Depends on:** 028 (gemergt), 036a/036b (gemergt), 054 (gemergt); gelesen gegen 055b und takt-048 (gemergt).
**Perspektive:** Datenschutz, Security, UX · **Glossar: neue Begriffe:** ja (Entscheidung 15)

## Warum hoch (Plan: mittel)

Der Plan führt 060 als mittel. Diese Spec stuft hoch (Hochstufen braucht keine Freigabe, Leitplanken §4; „ist die Zuordnung
unklar, gilt hoch“). Zwei Auslöser der Klasse hoch liegen vor, keiner davon ist eine Vertragsänderung:

1. **Personenbezogene und vertrauliche Daten an einem neuen Ort.** Der Puffer legt unveröffentlichte Antwortentwürfe und
   unbestätigte Wortlaute von Redebeiträgen (Inhalt mit Aktionärsbezug, DSFA V2/V5) über das Neuladen hinaus im Speicher des
   Geräts ab. Das ist genau das Szenario T-G1-I-08 („Browserspeicher zeigt unveröffentlichte Antworten“). Die DSFA nennt 060
   ausdrücklich als Maßnahmenträger für V5.
2. **Präsenz von Beschäftigten.** „Wird gerade bearbeitet“ zeigt, dass eine bestimmte Person gerade an einer Einzelfrage
   arbeitet, und jede Übernahme ist ein Ereignis mit `personId` im Log (028). Mehr Übernahmen heißen mehr Verhaltensdaten;
   Mitbestimmung (E13, E36) und Auswertungsverbot je Person (6.6) sind berührt.

Nicht ausgelöst: Rechte, Rollen, Übergänge, Vertrag, Ereignisform, Dienst, Persistenz des Dienstes. **Wahrheitstabellen-Diff:
keiner** (kein neues Recht, keine neue Operation; die Oberfläche ruft die vorhandenen `claimQuestion`, `releaseQuestion`,
`claimContribution`, `releaseContribution` nur, wenn `_actions` das Recht enthält).

Folgen der Klasse: Positiv- und Negativtest je Auslöser (Puffer: schreibt/liest nur den eigenen Akteur, löscht bei Abmelden,
fremdem Akteur, Ablauf; Präsenz: zeigt fremde, nicht eigene oder abgelaufene Übernahme, nie einen Namen), ein Fehler- und
Wiederherstellungsfall (Verbindungsabbruch beim Tippen, Neuladen, nicht verfügbarer Speicher), Lesebefund vor dem Bau.

## Befund (Ist-Stand, gelesen auf `c5990c8`)

- **Entwurf heute:** Beantwortung (`features/answers/QuestionDetail.tsx` mit `draft.ts`) und Schreibmodus der Fokusansicht
  (`features/focus/Page.tsx`, Speicher `drafts` je `draftKey(actorId, questionId)`) halten denselben `FocusDraft` (Eingabeform
  `body: AnswerBodyInput | null`, `sources`, Basis `baseVersion`/`baseBody`/`baseSources`, `rebase`, `generation`) nur im
  Speicher der Seite. Neuladen, Schließen des Tabs, Verlassen von `/my` oder ein fremder Schreibvorgang, der die Frage aus
  „Meine Fragen“ nimmt, verwerfen ungespeicherten Text (Toast `focus.write.gone`; Folgeliste 054 Bau und 054 Review 5).
- **Fremde neuere Version:** `writingOutcome`/`onRecord` setzen `rebase`; über dem Feld steht `StaleBanner` (`focus-rebase`,
  `answer-editor-rebase`), dessen „Neu laden“ den eigenen Text **kommentarlos verwirft**; Speichern bleibt möglich und legt
  den eigenen Text über die fremde Version (takt-048 Entscheidung 7). Einen Vergleich beider Texte gibt es nicht.
- **412:** `useWriteDoor` sendet `If-Match` aus dem beim Klick gezeigten Datensatz; ein 412 zeigt „Stand veraltet“
  (`answers.stale.banner`), lädt neu und lässt den Entwurf stehen. Ob danach eine neue Antwortversion da ist, sagt niemand;
  der 412-Pfad ist in der Oberfläche ungetestet (Tor-Zeile „geplant in Scheibe 060“).
- **Übernahme (028):** `claimQuestion`/`releaseQuestion` und `claimContribution`/`releaseContribution` gibt es im Vertrag und
  im Kern; `Claim` trägt `actorId`, `claimedAt`, `expiresAt` (10 Minuten, der Inhaber verlängert durch erneutes Übernehmen,
  R-CLAIM-01; nur der Inhaber gibt zurück, R-CLAIM-02). `viewClaim` gibt seit takt-027 keine `personId` aus. Jede Übernahme
  und Rückgabe erhöht `version` (`touch`). Die Übernahme sperrt keinen Schreibvorgang (Kommentar in `state.ts`). **Keine
  Ansicht ruft sie heute auf.** Der Live-Speicher (036a N7) beendet einen Eintrag mit Übernahme zu `claim.expiresAt` und weckt
  die Ansichten; der Strom (036b) trägt `QuestionClaimed`/`QuestionReleased`.
- **Rechte:** `question.claim` halten Fachbereich (einheitsgebunden) und Recht; `contribution.claim` hält die Erfassung. Beide
  stehen in `_actions` der jeweiligen Ressource, wenn `can()` zustimmt.
- **Erfassung:** `ContributionPane` hält `draft` (Wortlaut eines neuen Redebeitrags, je Wortmeldung) und `free` (freie
  Einzelfrage, je Redebeitrag) im Komponentenzustand; Akteurwechsel leert beide (090). 412 auf `captureQuestions` lässt die
  freie Eingabe stehen und zeigt `capture-stale-banner` (028, e2e `028-konflikte.spec.ts`).
- **Doppelklick:** Schreibtür (`writing`-Ref plus `aria-disabled`, takt-008) und `submitting`-Refs der Erfassung verhindern ein
  zweites Senden; ein e2e mit echtem Doppelklick auf „Entwurf speichern“ fehlt.
- **Speicherschlüssel:** Die vorhandenen Konstanten `STORAGE_KEY` (Demo-Log, Persona) und zwei `*_KEY`-Konstanten mit
  `hv-…-v1`-Literal lösten in takt-021 den gitleaks-Fehlalarm `generic-api-key` aus (Allowlist in `scripts/gitleaks.toml`
  nur für genau diese zwei Zeilen).

## Teilung und Zuschnitt

Eine Scheibe, zwei Teile in dieser Reihenfolge, je ein Commit:

- **Teil A — Beantwortung und Fokusansicht** (rund 3,1 AStd): Puffermodul, Präsenz, Fassungsvergleich, 412-Einordnung,
  Doppelklicktests, Löschregeln, Doku-Zeilen.
- **Teil B — Erfassung** (rund 0,7 AStd): Puffer der zwei Textfelder, Übernahme des Redebeitrags während der Atomisierung,
  Präsenzzeile.

**Rückfallteilung:** Liegt der Bau nach Teil A über 3,4 AStd, endet die Scheibe mit Teil A; Teil B wird 060b (eigene kurze
Spec aus diesem Abschnitt und Entscheidung 12, gleiche Klasse, Plan-Zeile beim Orchestrator). Der Bericht nennt, welcher Fall
eintrat.

## Ziel und Entscheidungen vor Bau

Keine Entscheidung bleibt dem Implementierer überlassen.

### 1. Ort, Form und Konstanten des Puffers

- Ein Modul `apps/web/src/api/draftBuffer.ts` (Ein-/Ausgabe gehört an die Tür der Oberfläche, nicht in ein Feature). Es hat
  einen **reinen Kern** (Eintrag bilden und prüfen, Kennung bilden, Ablauf, Eigentümerregel) und einen dünnen
  **IndexedDB-Adapter** hinter einer Schnittstelle `BufferStore` (`getAll`, `put`, `delete`, `clear`). Für Einheitstests gibt
  es einen Speicher im Arbeitsspeicher derselben Schnittstelle; **keine neue Abhängigkeit** (kein `fake-indexeddb`).
- Uhr injiziert: `createDraftBuffer({ store, now })`; verdrahtet in `api/index.ts` mit der Wanduhr des Browsers.
- Eine Datenbank, ein Objektspeicher, Schemanummer: Modulkonstanten **`BUFFER_DATABASE`**, **`BUFFER_OBJECT_STORE`**,
  **`BUFFER_SCHEMA`**. Die Namen enden **nie** auf `KEY`/`Key` und enthalten weder `token`, `secret`, `auth` noch `api`
  (gitleaks `generic-api-key`, takt-021); keine neue Allowlist-Zeile. Die Kennung eines Eintrags wird von einer Funktion
  `entryId(meetingId, ownerId, kind, subjectId)` gebildet, nie als Literal geschrieben.
- Die e2e-Datei importiert die drei Konstanten aus dem Modul (kein zweites Literal). Das Modul greift beim Import nicht auf
  `indexedDB` zu (erst beim ersten Öffnen), damit der Import im Test-Prozess gefahrlos ist.

### 2. Was ein Eintrag enthält (und nur das)

Whitelist, geprüft beim Schreiben und beim Lesen (`sanitizeEntry`; unbekannte Felder fallen weg, ein Eintrag mit falscher
Schemanummer oder falscher Form wird gelöscht, ohne Ausnahme nach oben):

| Feld | Inhalt |
|---|---|
| `id` | aus `entryId(…)` |
| `schema` | `BUFFER_SCHEMA` |
| `ownerId` | Akteur-id (`useActor().id`); nötig für die Trennung je Akteur, nie Name, Rolle oder `personId` |
| `meetingId` | Versammlung der Frage bzw. des Redebeitrags |
| `kind` | `answer` (Beantwortung und Schreibmodus teilen ihn) · `contribution` (neuer Redebeitrag, je Wortmeldung) · `free_question` (freie Einzelfrage, je Redebeitrag) |
| `subjectId` | Frage-, Wortmelde- bzw. Redebeitrags-id |
| `body`, `sources`, `baseVersion`, `baseBody`, `baseSources` | nur `answer`: die Felder des `FocusDraft` (Eingabeform, nie DOM oder HTML, 055b) |
| `text` | nur `contribution`, `free_question` |
| `changedAt` | Wanduhr des Geräts beim letzten Schreiben; nur für Ablauf und die Zeile „gesichert · HH:MM:SS“ |

Nicht gespeichert: Fragetext, Fragenummer, Rednername, Anzeigename, Rolle, Status, `generation`, `rebase`, `key` des
`FocusDraft`. Keine Zählung, kein Verlauf, keine zweite Fassung: je Kennung genau ein Eintrag, der jüngste Stand.

### 3. Geltungsbereich: je Versammlung und je Akteur

Ein Eintrag wird nur für denselben `ownerId` **und** dieselbe `meetingId` wiederhergestellt. Mehrere Tabs desselben Akteurs
teilen den Eintrag; es gilt der jüngste Schreibvorgang, es gibt keinen Abgleich zwischen Tabs (Nicht-Ziel).

### 4. Wann geschrieben und wann gelöscht wird

- **Schreiben:** nur ein **veränderter** Entwurf (`isDirty` bzw. nicht leerer Text), entprellt 400 ms nach der letzten
  Eingabe, sofort bei `pagehide` und bei `visibilitychange` → `hidden`. Ein unveränderter Entwurf löscht seinen Eintrag.
- **Löschen eines Eintrags:** erfolgreiches Speichern, das den Entwurf unverändert hinterlässt (Basis = Gesendetes,
  takt-048 Entscheidung 6); „Verwerfen“; „Version n übernehmen“ im Vergleich; erfolgreicher Redebeitrag bzw. erfolgreiche
  freie Einzelfrage.
- **Ablauf (Entscheidung, Eigentümerfrage 2):** **14 Stunden** nach `changedAt` (die Höchstdauer einer Sitzung, DSFA V11).
  Abgelaufene Einträge werden beim ersten Öffnen des Puffers einer Seite gelöscht und nie wiederhergestellt.
- **Alles eines Geräts löschen:** ausdrückliches Abmelden (der `signOut`-Weg in `api/index.ts`), Demo-Reset (`resetDemo`).
- **Alle Einträge anderer Akteure löschen** (Eigentümerregel, 090): sobald ein Akteur bestätigt ist, dessen id sich von der
  vorigen unterscheidet — im HTTP-Betrieb in `onActorChange` (anderes Subject nach Anmeldung), in der Demo beim Personawechsel
  (`setActor`). Folge in der Demo: Wechsel zu B und zurück zu A findet keinen Puffer (wie takt-048 V6, das Feld zeigt den
  Datensatz).
- **Alle Einträge des Akteurs löschen** bei Streamende mit `roles_changed` (die Rechte der Person änderten sich).
- **Nicht gelöscht** wird bei 401, Sitzungsablauf oder kurzem Netzverlust, solange danach derselbe Akteur bestätigt wird: genau
  dann ist der Puffer am wertvollsten.
- **Frage verlässt das Schreiben** (`writingOutcome` → `end`, z. B. weitergeleitet, übergeben): der Eintrag bleibt bis Ablauf;
  kommt die Frage zurück, gilt Entscheidung 5. Der Toast `focus.write.gone` sagt das (Entscheidung 14) statt „verworfen“.

### 5. Wiederherstellen und Vorrang

- Der Puffer wird je Seite **einmal** beim Aufbau für Akteur gelesen (`getAll`, gefiltert nach `ownerId`, abgelaufene gelöscht)
  und als Momentaufnahme im Modul gehalten; Wiederherstellen ist danach synchron. Bis die Antwort da ist (höchstens 300 ms),
  zeigt das Antwortfeld den vorhandenen Ladezustand; danach geht es ohne Puffer weiter (Entscheidung 9). So springt das Feld
  nicht von der Vorbelegung auf den gepufferten Text (D8).
- **Vorrang:** ein passender Eintrag geht der Vorbelegung aus takt-048 vor. Neue reine Funktion in `answers/draft.ts`:
  `restoreDraft(entry, actorId, question)` baut den `FocusDraft` aus dem Eintrag (`generation` 0) und gleicht ihn sofort mit
  `onRecord` gegen den aktuellen Datensatz ab:
  - neuere Version, die dasselbe sagt wie der Puffer → Basis nachziehen, Entwurf unverändert, Eintrag löschen;
  - neuere Version über verändertem Puffer → `rebase` steht (Entscheidung 7);
  - Puffer sagt dasselbe wie seine Basis → keine Wiederherstellung, Eintrag löschen;
  - Frage ohne `answer.draft` in `_actions` → keine Wiederherstellung, Eintrag bleibt (Entscheidung 4).
- Nach einer Wiederherstellung steht unter der Überschrift des Felds die Zeile **„Ungespeicherter Entwurf von HH:MM
  wiederhergestellt“** (`draft-restored`, `text-ink-600`, Uhrzeit Mono) mit „Verwerfen“ wie heute.
- Erfassung: `contribution` füllt `capture-text` beim Öffnen des Formulars derselben Wortmeldung, `free_question` füllt
  `capture-free-input` beim Anzeigen desselben Redebeitrags; dieselbe Zeile, sonst unverändert.

### 6. Zeile „auf diesem Gerät gesichert“

Solange ein veränderter Entwurf gepuffert ist, steht neben der Speichern-Schaltfläche (Beantwortung, Schreibmodus) bzw. unter
dem Feld (Erfassung) leise **„Auf diesem Gerät gesichert · HH:MM:SS“** (`draft-kept`, `text-2xs text-ink-600`, Zeit Mono,
`aria-live` aus: kein Ansagen bei jedem Tastendruck). Ist der Puffer nicht verfügbar, steht dort einmal **„Keine Sicherung auf
diesem Gerät möglich“** (`draft-unavailable`). Ohne Änderung keine Zeile. Die Zeile ist zugleich das Warte-Signal der e2e vor
einem Neuladen.

### 7. Fassungsvergleich (412- und Live-Fall)

Der Begriff in der Oberfläche ist **„Fassungen vergleichen“**, nie „Zusammenführen“/„Merge“ (das Hauswort „Zusammengeführt“
gehört dem Zusammenführen von Einzelfragen, Glossar).

**Wann er öffnet:**

1. **Live:** Kommt eine fremde neuere Version über verändertem Text (`rebase` wird wahr), bleibt das Feld, wie es ist (kein
   Fokuswechsel, keine Verdrängung beim Tippen). Das vorhandene Band (`answer-editor-rebase`, `focus-rebase`) trägt statt
   „Neu laden“ die Schaltfläche **„Vergleichen“** (neue optionale Beschriftung an `StaleBanner`). Das alte „Neu laden“, das
   den Text kommentarlos verwarf, entfällt.
2. **Speichern bei stehendem Band:** „Entwurf speichern“ bzw. Strg+Enter sendet **nicht**, sondern öffnet den Vergleich.
   (Änderung gegenüber takt-048 Entscheidung 7: dort blieb Speichern bei sichtbarem Hinweis möglich.)
3. **412 auf das eigene Speichern:** Nach dem Neuladen ordnet die neue reine Funktion `conflictAfterRefusal(draft, question)`
   in `answers/draft.ts` ein:
   - neuere Antwortversion, die etwas anderes sagt als der Entwurf → Vergleich öffnet sofort (die Person hat gerade gehandelt,
     der Fokus darf wandern); das Band „Stand veraltet“ der Seite entfällt dann (ein Hinweis, nicht zwei);
   - neuere Version, die dasselbe sagt → still nachziehen (wie `onRecord`), kein Vergleich, Entwurf unverändert;
   - keine neuere Antwortversion (der Datensatz bewegte sich anders, etwa durch eine Übernahme) → das vorhandene „Stand
     veraltet“ bleibt, der Entwurf bleibt, ein zweiter Klick speichert gegen den neuen Stand.

**Was er zeigt** (neue Komponente `features/answers/CompareVersions.tsx`, in Beantwortung und Schreibmodus an der Stelle des
Felds, im selben Rahmen):

- Überschrift „Fassungen vergleichen“ (`compare-title`, fokussierbar mit `tabIndex=-1`), ein Satz: „Während Sie geschrieben
  haben, wurde Version {n} gespeichert. Wählen Sie, womit Sie weiterarbeiten.“
- Zwei gleich breite Spalten nebeneinander (ab 1024 px; darunter untereinander): links **„Ihre Fassung · nicht gespeichert“**
  (`compare-mine`), rechts **„Version {n} · {Autor} · {HH:MM}“** (`compare-theirs`; Version und Zeit Mono, Autor wie in der
  Versionsliste der Beantwortung). Beide über `AnswerText` (055b, nur Textknoten) mit ihren Quellen darunter. Text ist
  markierbar, damit man Teile hinüberkopieren kann.
- Darunter ein geschlossenes `<details>` „Unterschiede Wort für Wort“ mit dem vorhandenen Wortdiff (`wordDiff` aus
  `answers/lib.ts`, Klartextprojektion, Version n → Ihre Fassung), gleiche Darstellung wie „Änderung gegenüber Version n-1“.
- Keine neue Farbe, kein neues Token: neutraler Rahmen (`border-line-strong`, `bg-sunken`), keine Bernsteinfläche im Vergleich
  selbst (der Konflikt ist mit dem Band schon gesagt, D4).

**Entscheidungen in der Ansicht** (genau eine primäre Aktion, D2):

- **„Mit meiner Fassung weiter“** (primär, `compare-keep-mine`): Basis wird Version n (`draftBase(question)`), `rebase` falsch,
  Text bleibt, Feld neu aufgebaut (`generation + 1`), Fokus ans Ende des Felds. Speichern legt dann Version n+1 an; Version n
  bleibt in der Versionsliste. Der Hinweis `answers.editor.hint` (Freigabe erlischt) steht wie heute, wenn eine Freigabe besteht.
- **„Version {n} übernehmen“** (sekundär, `compare-take-theirs`) mit dem Satz darunter „Ihre Fassung wird dabei verworfen.“:
  Entwurf = Version n (`generation + 1`), Puffer-Eintrag gelöscht, Fokus ins Feld.
- **„Zurück zum Text“** (Geisterknopf, `compare-back`) und **Escape**: zurück zum Feld ohne Entscheidung; das Band bleibt, ein
  erneutes Speichern öffnet den Vergleich wieder.
- Keine Schreiboperation in der Ansicht selbst; alle drei Wege sind lokal und wiederholbar.

**Fokus:** Öffnet der Vergleich durch eine Handlung der Person (Klick „Vergleichen“, Speichern, 412 nach eigenem Speichern),
geht der Fokus auf `compare-title`; nie durch eine Live-Aktualisierung (6.9). Nach jeder Entscheidung liegt der Fokus im Feld.

### 8. Präsenz „wird gerade bearbeitet“ über die Übernahme

**Kein Vertragsschritt.** `Claim` trägt mit `actorId`, `claimedAt`, `expiresAt` genau, was eine neutrale Präsenzanzeige braucht:
ob eine **andere** Person übernommen hat und seit wann; der Ablauf kommt vom Dienst, der Live-Speicher weckt zum Ablauf. Einen
**Namen** trägt der Vertrag nicht, und `actorId` ist im HTTP-Betrieb ein technisches Subject, das nicht angezeigt wird. Ein Name
bräuchte ein neues Feld (`Claim.displayName`, aufgelöst wie `Actor.displayName`) — Vertragsänderung, Klasse hoch, eigene
Scheibe, Eigentümerfrage 1. Standard: ohne Namen.

**Anzeige** (neue Komponente `components/PresenceLine.tsx`, `presence-line`): Ist `claim` vorhanden, nicht abgelaufen (der
Dienst liefert abgelaufene nicht aus; die Komponente prüft zusätzlich gegen die Wanduhr) und `claim.actorId !== useActor().id`,
steht über dem Antwortfeld bzw. im Kopf des Redebeitrags eine Zeile: Symbol `PencilLine` (lucide, 14 px, `aria-hidden`) und
**„Wird gerade von einer anderen Person bearbeitet · seit HH:MM“** (`text-[13px] text-ink-700`, Zeit Mono). Neutral, keine
Warnfarbe: die Sperre ist weich, Schreiben bleibt erlaubt (R-CLAIM-01 sperrt nur die zweite Übernahme). Eigene Übernahme:
keine Zeile. Orte: `QuestionDetail` (über dem Feld; auch wenn das Feld nicht angeboten wird, weil die Person nur liest),
`FocusDetail`, `WritingMode`, `ContributionPane` (Kopf). Nicht in Listen (Eigentümerfrage 6).

**Wann die Oberfläche übernimmt** (neuer Haken `api/useClaim.ts` mit reinem Kern `api/presence.ts`; gilt für Frage und
Redebeitrag gleich):

- Nur wenn `_actions` der Ressource `question.claim` bzw. `contribution.claim` enthält (R4).
- **Erste Änderung**, nicht das Öffnen: Frage — der Entwurf wird zum ersten Mal verändert (auch nach Wiederherstellung, sobald
  getippt wird); Redebeitrag — erste Eingabe in `capture-free-input` oder Beginn einer Markierung in `ContributionText`
  (Eigentümerfrage 5).
- **Verlängern** nur, wenn die eigene Übernahme in weniger als 3 Minuten abläuft **und** seit der letzten Übernahme getippt
  wurde; kein Zeitgeber, kein Herzschlag. Ein Schreibender erzeugt so höchstens eine Übernahme je rund 7 Minuten Tippen.
- **Zurückgeben**, wenn die Person die Frage bzw. den Redebeitrag verlässt (andere Auswahl, Schreibmodus geschlossen, Seite
  gewechselt), bei „Verwerfen“ und bei „Version n übernehmen“. Nur solange der aktuelle Akteur der ist, der übernommen hat (nach
  einem Akteurwechsel kein Versuch, R-CLAIM-02); kein Versuch beim Entladen der Seite (kein `sendBeacon`, kein `keepalive`):
  der Ablauf nach 10 Minuten räumt auf. Speichern gibt nicht zurück (die Person schreibt meist weiter).
- **Leise:** nicht über die Schreibtür (`run` zeigt Erfolgstoasts und sperrt die Schaltflächen), sondern direkt über `HvApi` mit
  `ifMatch: etagOf(version)` des gezeigten Datensatzes. 409 R-CLAIM-01 (andere Person hält) → kein Toast, die Präsenzzeile
  zeigt es; 409 R-CLAIM-02, 412, 428, Netzfehler → kein Toast, nächster Versuch frühestens bei der nächsten Eingabe nach 30 s.
  Höchstens eine Übernahme bzw. Rückgabe je Ansicht unterwegs (Ref).
- **Speichern wartet auf die eigene Übernahme:** Weil eine Übernahme `version` erhöht, würde ein Speichern, das während einer
  laufenden Übernahme abgeschickt wird, am eigenen 412 scheitern. Solange eine eigene Übernahme unterwegs ist **und** bis der
  gezeigte Datensatz ihre Version zeigt, ist Speichern gesperrt (`canSave` erhält `claimPending`; `aria-disabled`, Fokus
  bleibt, takt-008). Scheitert die Übernahme, fällt die Sperre sofort. Dasselbe gilt in der Erfassung für `captureQuestions`.

### 9. Ausfall und Grenzen des Puffers

- IndexedDB fehlt, ist gesperrt, das Kontingent ist voll oder ein Vorgang scheitert → der Puffer schaltet sich für die Seite
  ab, keine Ausnahme erreicht die Ansicht, Zeile `draft-unavailable` (Entscheidung 6). Kein Rückfall auf `localStorage`.
- Ein Eintrag ist höchstens so groß wie der Entwurf; Einträge über 256 KiB serialisiert werden nicht geschrieben (Zeile
  `draft-unavailable`), damit ein eingefügtes Riesendokument das Kontingent nicht füllt.
- **Synchronisiert nie:** kein Netzaufruf mit Pufferinhalt, kein `BroadcastChannel`, kein `storage`-Ereignis, kein Service
  Worker; das Modul importiert nichts aus `http.ts`.

### 10. Doppelklickschutz

- Speichern (Beantwortung, Schreibmodus, Strg+Enter mit Tastenwiederholung) bleibt über die Schreibtür geschützt; neu ist der
  Nachweis mit echtem Doppelklick in beiden Projekten (genau eine neue Version).
- Vergleich: die Entscheidungen sind lokal und schließen die Ansicht; ein zweiter Klick trifft das Feld und bewirkt nichts.
- Übernahme/Rückgabe: höchstens eine unterwegs je Ansicht (Entscheidung 8).
- Erfassung: „Redebeitrag erfassen“ per Doppelklick und Enter doppelt in der freien Eingabe legen genau einen Redebeitrag bzw.
  eine Einzelfrage an (vorhandene Refs; neu ist der Nachweis).

### 11. Akteurwechsel und Abmelden (090)

Zusätzlich zu Entscheidung 4: die Momentaufnahme im Modul wird beim Akteurwechsel verworfen und für den neuen Akteur neu
gelesen; die vorhandenen Rücksetzungen (090, 010d, takt-048) bleiben. Ein Entwurf des vorigen Akteurs erscheint nie, weder aus
dem Speicher der Seite noch aus dem Puffer. Nach ausdrücklichem Abmelden ist der Objektspeicher leer.

### 12. Erfassung (Teil B)

- Puffer für `capture-text` (`kind` `contribution`, `subjectId` = Wortmeldung) und `capture-free-input` (`free_question`,
  `subjectId` = Redebeitrag), Regeln wie oben; Wiederherstellung nach Entscheidung 5.
- Übernahme des Redebeitrags während der Atomisierung nach Entscheidung 8; Präsenzzeile im Kopf von `ContributionPane`.
- **Kein Fassungsvergleich in der Erfassung:** eine freie Einzelfrage und ein neuer Redebeitrag haben keine Vorgängerversion,
  gegen die man vergleichen könnte; das 412-Verhalten aus 028 (Eingabe bleibt, Band, neu laden) bleibt unverändert.

### 13. Änderung an takt-048 und 054

- takt-048 Entscheidung 7 („Speichern bei sichtbarem Hinweis möglich“) wird ersetzt durch Entscheidung 7 Punkt 2 dieser Spec.
- takt-048 „Später: ein gepufferter Entwurf aus 060 geht der Vorbelegung vor“ ist Entscheidung 5.
- 054 `focus.write.gone`: der Text bleibt erhalten (Entscheidung 4), der Toast sagt es.

### 14. Texte (i18n, de und en-US)

Neue Schlüssel (14), Wortlaut verbindlich, Hausvokabular:

| Schlüssel | de | en |
|---|---|---|
| `common.presence.other` (shell) | Wird gerade von einer anderen Person bearbeitet · seit {time} | Being edited by someone else · since {time} |
| `common.draft.kept` (shell) | Auf diesem Gerät gesichert · {time} | Kept on this device · {time} |
| `common.draft.restored` (shell) | Ungespeicherter Entwurf von {time} wiederhergestellt | Unsaved draft from {time} restored |
| `common.draft.unavailable` (shell) | Keine Sicherung auf diesem Gerät möglich | Cannot keep a copy on this device |
| `answers.editor.compare` | Vergleichen | Compare |
| `answers.compare.title` | Fassungen vergleichen | Compare versions |
| `answers.compare.intro` | Während Sie geschrieben haben, wurde Version {version} gespeichert. Wählen Sie, womit Sie weiterarbeiten. | Version {version} was saved while you were writing. Choose what to continue with. |
| `answers.compare.mine` | Ihre Fassung · nicht gespeichert | Your text · not saved |
| `answers.compare.theirs` | Version {version} · {author} · {time} | Version {version} · {author} · {time} |
| `answers.compare.keepMine` | Mit meiner Fassung weiter | Continue with my text |
| `answers.compare.takeTheirs` | Version {version} übernehmen | Use version {version} |
| `answers.compare.takeTheirsHint` | Ihre Fassung wird dabei verworfen. | Your text will be discarded. |
| `answers.compare.back` | Zurück zum Text | Back to the text |
| `answers.compare.diff` | Unterschiede Wort für Wort | Word-by-word differences |

Geänderter Wortlaut (kein neuer Schlüssel): `focus.write.gone` → „{number} liegt nicht mehr bei Ihnen. Ihr ungespeicherter Text
bleibt auf diesem Gerät bis {time} erhalten.“ / „{number} is no longer with you. Your unsaved text stays on this device until
{time}.“ Schlüsselzahl in `parity.test.ts` (f): 621 → 635. Die Präsenzzeile in der Erfassung nutzt `common.presence.other`. Die Schlüssel der Shell tragen das vorhandene Präfix `common` (Test (d) in `parity.test.ts` kennt kein Präfix `presence` oder `draft`; die Präfixliste bleibt unverändert).

### 15. Glossar

Drei Zeilen: „Fassungen vergleichen | Compare versions | `CompareVersions`, `conflictAfterRefusal` | Merge, Zusammenführen (gehört
den Einzelfragen)“; „Auf diesem Gerät gesichert | Kept on this device | `draftBuffer` (IndexedDB, je Akteur und Versammlung) |
Cache, Autosave“; „Übernahme (weiche Sperre), wird gerade bearbeitet | Claim, being edited | `Claim`, `claimQuestion`,
`claimContribution`, `PresenceLine` | Sperre, Lock (sie sperrt nichts), Checkout“.

## Nicht-Ziele

- Kein Vertrag, kein Kern, kein Dienst, keine Ereignisänderung; kein Name in der Präsenz (Eigentümerfrage 1); keine Änderung an
  R-CLAIM-01/02, an der Dauer der Übernahme, an Rechten, Übergängen, Seed.
- Keine Präsenz in Listen (Fokusliste, Arbeitsliste, Steuerung) und keine Liste „wer arbeitet woran“ (Eigentümerfrage 6;
  Auswertungsverbot je Person).
- Kein Abgleich zwischen Tabs oder Geräten, kein Service Worker, kein Offline-Schreiben mit Warteschlange (058 für die Bühne).
- Keine Verschlüsselung des Puffers (Eigentümerfrage 3); kein Ausschluss geschützter Fragen, weil es die Vertraulichkeitsstufe
  an der Frage noch nicht gibt (Hinweis an 047, Eigentümerfrage 4).
- Kein Puffer für Begründungsfelder (Verweigerung, Rückgabe, Bühne), Dialoge, Suche, Registrierung; nur Antwortentwurf, neuer
  Redebeitrag, freie Einzelfrage.
- Keine Änderung an `useWriteDoor` und an der Fokuslogik nach Übergaben (takt-043, takt-049).
- Kein Kern-Guard „wortgleiche Version“ (takt-048 Frage 1 bleibt offen).

## Files allowed

Teil A — Tür, Puffer, Präsenz:

- `apps/web/src/api/draftBuffer.ts` (neu), `apps/web/src/api/draftBuffer.test.ts` (neu)
- `apps/web/src/api/presence.ts` (neu), `apps/web/src/api/presence.test.ts` (neu)
- `apps/web/src/api/useClaim.ts` (neu)
- `apps/web/src/api/index.ts` (nur: Puffer verdrahten; Löschen beim Abmelden, bei anderem bestätigtem Akteur, bei Streamende
  wegen geänderter Rechte und im Demo-Reset)
- `apps/web/src/api/actor.ts` (nur: Löschen der Einträge anderer Akteure beim Personawechsel der Demo; kein neuer Rollenname)

Teil A — Komponenten:

- `apps/web/src/components/PresenceLine.tsx` (neu), `apps/web/src/components/DraftNote.tsx` (neu, Zeilen „gesichert“,
  „wiederhergestellt“, „nicht möglich“), `apps/web/src/components/PresenceLine.test.tsx` (neu, prüft beide Komponenten)
- `apps/web/src/components/StaleBanner.tsx` (nur eine optionale Beschriftung der Schaltfläche)
- `apps/web/src/components/index.ts` (nur die Exporte)

Teil A — Beantwortung und Fokusansicht:

- `apps/web/src/features/answers/CompareVersions.tsx` (neu), `apps/web/src/features/answers/CompareVersions.test.tsx` (neu)
- `apps/web/src/features/answers/draft.ts`, `apps/web/src/features/answers/draft.test.ts`
- `apps/web/src/features/answers/QuestionDetail.tsx`, `apps/web/src/features/answers/QuestionDetail.test.tsx`
- `apps/web/src/features/answers/AnswerEditor.tsx`
- `apps/web/src/features/answers/Page.tsx` (nur: das Band „Stand veraltet“ entfällt, solange das Detail den Vergleich zeigt)
- `apps/web/src/features/focus/Page.tsx` (nur Entwurf, Puffer, Übernahme, Vergleich; Fokuslogik aus takt-043 unverändert)
- `apps/web/src/features/focus/WritingMode.tsx`, `apps/web/src/features/focus/WritingMode.test.tsx`
- `apps/web/src/features/focus/FocusDetail.tsx`, `apps/web/src/features/focus/FocusDetail.test.tsx` (nur die Präsenzzeile)

Teil B — Erfassung:

- `apps/web/src/features/capture/ContributionPane.tsx`, `apps/web/src/features/capture/ContributionPane.test.tsx`
- `apps/web/src/features/capture/Page.tsx` (nur Übernahme des Redebeitrags, Wartesperre, Präsenz)
- `apps/web/src/features/capture/ContributionText.tsx` (nur der Aufruf „Markierung beginnt“ für die Übernahme)

Sprache:

- `apps/web/src/i18n/shell.de.ts`, `apps/web/src/i18n/shell.en.ts`, `apps/web/src/i18n/answers.de.ts`,
  `apps/web/src/i18n/answers.en.ts`, `apps/web/src/i18n/focus.de.ts`, `apps/web/src/i18n/focus.en.ts` (nur die Schlüssel und
  der geänderte Wortlaut aus Entscheidung 14)
- `apps/web/src/i18n/parity.test.ts` (nur die Zahl in (f) und ihr Kommentar)

e2e:

- `apps/web/e2e/060-entwurfspuffer-praesenz.spec.ts` (neu, in beiden Projekten)
- `apps/web/e2e/support/e2e-texts.ts` (nur die Konstanten dieser Scheibe und ihre Einträge in der Liste der geschriebenen Texte)
- `apps/web/e2e/support/roles.ts` (nur ein neuer Helfer für einen zweiten Browserkontext mit eigener Anmeldung bzw. Persona)
- `apps/web/playwright.config.ts` (nur die Liste der geteilten Dateien: die neue Datei nach 055b)
- `scripts/e2e-http-031.test.mjs` (nur die beiden Dateilisten: die neue Datei zwischen 055b und 080)
- `apps/web/e2e/054-fokusansicht.spec.ts`, `apps/web/e2e/takt-048-nullzaehler-vorbelegung.spec.ts`,
  `apps/web/e2e/090-eingaben-je-akteur.spec.ts` (nur falls rot durch Entscheidung 4, 5 oder 7; keine Zusicherung entfällt oder
  wird schwächer; der Bericht nennt Datei und Zeile)

Nachweise und Doku:

- `docs/evidence/060-*.png`
- `docs/glossar.md` (nur die drei Zeilen aus Entscheidung 15)
- `docs/datenschutz/dsfa-vorentwurf.md` (nur Zeile V5, Spalte Maßnahmen: je Akteur und Versammlung, nur der Entwurf, 14 h,
  Löschen bei Abmelden und fremdem Akteur, keine Synchronisierung, keine Auswertung; Präsenz ohne Namen)
- `docs/sicherheit/bedrohungsmodell.md` (nur die Zelle Gegenmaßnahme von T-G1-I-08 und eine Zeile 060 unter „Weitere Scheiben
  mit Sicherheitsbezug“)
- `docs/agentische-entwicklung-plan.md` (nur die Zeile „Fehlerpfad (Konflikt 412 in der Oberfläche)“ in §5.3: Werkzeug die neue
  e2e-Datei, Stand „läuft (CI: End-to-end acceptance scenario)“)
- `docs/folgeliste.md` (054 Bau „focus.write.gone“ und 054 Review 5 als erledigt; neue nicht blockierende Befunde)
- `docs/slices/060-entwurfspuffer-praesenz.md` (Bericht, Design-Kritik, Review findings)

## Ausdrücklich nicht erlaubt

Alles unter packages, apps/api, die Vertragsdatei und ihre Typen; der Rest von apps/web/src/api außer den genannten Dateien
(auch nicht http.ts, liveStore.ts, connection.ts); useWriteDoor.ts; focus.ts; styles und neue Tokens; app-Ordner der Shell;
features steering, speakers, stage, history; RefusalDialog, ForwardDialog, ActionDialogs; labels.ts; scripts außer der einen
Testdatei; gitleaks.toml (keine neue Allowlist); semgrep-Regeln; Workflows; package.json und Lockfile (keine Abhängigkeit);
axe-exceptions.json (keine neue Ausnahme); docs/produktplan-beta.md und das Entscheidungsregister (Hinweise an den
Orchestrator). Muss eine dieser Dateien sich ändern: anhalten und melden.

## Vor dem Bau prüfen

1. `claimQuestion` und `claimContribution` erhöhen `version`, der Strom trägt `QuestionClaimed`/`ContributionClaimed`, der
   Live-Speicher aktualisiert den gezeigten Datensatz nach einer eigenen Übernahme in beiden Betriebsarten (Grundlage der
   Wartesperre, Entscheidung 8).
2. Der Live-Speicher weckt die Ansicht zu `claim.expiresAt` (036a N7): die Präsenzzeile verschwindet ohne Ereignis.
3. In der Demo zeigt `_actions` einer Finanzen-Frage im Status „Entwurf“ für Recht und Fachbereich `answer.draft` und
   `question.claim`; die e2e wählt Fragen über `_actions`, nie über den Rollennamen im Code der Oberfläche.
4. Im HTTP-Harness gibt es Anmeldezustände für Fachbereich und Recht (zweiter Kontext, Entscheidung 8); es gibt nur eine Person
   der Erfassung, deshalb ist die Präsenz der Erfassung nur mit Einheits- und Komponententests belegt.
5. IndexedDB ist im festgelegten Chromium (headless) verfügbar; `context.setOffline(true)` lässt IndexedDB unberührt.
6. Das Band „Stand veraltet“ der Beantwortung lässt sich aus dem Detail heraus ausblenden, ohne `useWriteDoor` zu ändern
   (`clearStale` über die Seite).
7. Die Laufzeit des Schritts `e2e-http` (takt-046): Mehrzeit dieser Datei höchstens 0:50; liegt sie darüber, Fall E7 nur im
   Projekt in-process und Befund an den Orchestrator.

## Tests zuerst (rot, dann grün)

Einheit (vitest, ohne jsdom, statisches Rendern wie heute):

- **U1 `draftBuffer.test.ts`** (Speicher im Arbeitsspeicher, feste Uhr): `entryId` trennt Versammlung, Akteur, Art, Subjekt;
  `sanitizeEntry` lässt nur die Felder aus Entscheidung 2 durch (ein zusätzliches Feld `questionText`, `displayName`, `number`
  fällt weg) und löscht einen Eintrag mit fremder Schemanummer oder kaputter Form ohne Ausnahme; Ablauf an der Grenze
  (13:59:59 bleibt, 14:00:00 gelöscht); Lesen nur eigener Einträge derselben Versammlung (Negativ: fremder Akteur, fremde
  Versammlung → nichts); `purgeOthers(actorId)` löscht alle anderen, `purgeAll` alles; ein scheiternder Speicher schaltet ab
  (`status: 'unavailable'`) und wirft nicht; Eintrag über 256 KiB wird nicht geschrieben; ein Quelltexttest stellt sicher, dass
  das Modul weder `fetch`, `BroadcastChannel`, `sendBeacon`, `serviceWorker` noch `localStorage` nennt und nichts aus
  `http.ts` importiert; die drei Konstanten enden nicht auf `KEY`/`Key`.
- **U2 `draft.test.ts`, `restoreDraft`:** Puffer vor Vorbelegung; Puffer gleich Basis → keine Wiederherstellung; neuere Version
  gleich Puffer → Basis nachgezogen, unverändert; neuere Version über verändertem Puffer → `rebase`; ohne `answer.draft` → keine
  Wiederherstellung; Eintrag eines anderen Akteurs → nie verwendet.
- **U3 `draft.test.ts`, `conflictAfterRefusal`:** neuere abweichende Version → `compare`; neuere gleiche → still nachziehen;
  keine neuere Version → `retry`; Verweigerung als neueste Version → `compare` mit leerer rechter Spalte und Hinweis wie heute.
- **U4 `presence.test.ts`:** fremde, laufende Übernahme → Zeile mit `claimedAt`; eigene → keine; abgelaufen (Wanduhr) → keine;
  ohne → keine; die Ausgabe enthält nie `actorId`. Übernahmeplan: erste Änderung mit Recht → übernehmen; ohne Recht in
  `_actions` → nie; zweite Änderung bei laufender eigener → nichts; Restzeit unter 3 min mit Eingabe → verlängern, ohne Eingabe
  → nichts; nach 409/412/Netzfehler → frühestens nach 30 s; Rückgabe nur, wenn der aktuelle Akteur der Übernehmende ist.
- **U5 `CompareVersions.test.tsx`:** beide Spalten, Version und Zeit in Mono, genau eine primäre Schaltfläche, Hinweis unter
  „übernehmen“, `compare-title` mit `tabIndex=-1`, Diff geschlossen; Texte aus dem Wörterbuch (de und en).
- **U6 `QuestionDetail.test.tsx`:** mit `rebase` ruft Speichern `onAction` nicht und zeigt den Vergleich; Band trägt
  „Vergleichen“; fremde Übernahme → `presence-line` ohne id; eigene → keine; `claimPending` → Speichern `aria-disabled`;
  wiederhergestellter Entwurf → `draft-restored`.
- **U7 `WritingMode.test.tsx`, `FocusDetail.test.tsx`:** dieselben Aussagen für Schreibmodus (Strg+Enter bei `rebase` öffnet den
  Vergleich) und Präsenz im Detail.
- **U8 `ContributionPane.test.tsx`:** wiederhergestellter Text in `capture-text` und `capture-free-input`; fremde Übernahme des
  Redebeitrags → `presence-line`; Akteurwechsel leert weiter (090).
- **U9 `PresenceLine.test.tsx`:** Präsenzzeile und `DraftNote` in allen Zuständen, Zeit in Mono, kein `aria-live` an
  `draft-kept`.
- **U10 `parity.test.ts`:** 635 Schlüssel in de und en.

e2e `060-entwurfspuffer-praesenz.spec.ts` (Rolle über `asRole`, Belege über `support/evidence.ts`, axe über `support/axe.ts`
ohne neue Ausnahme; Fragen nach `_actions` gewählt; „beide“ = in-process und http):

- **E1 Neuladen (beide):** Beantwortung, Frage mit Version; Text anhängen; warten auf `draft-kept`; `page.reload()` → Feld mit
  dem angehängten Text, `draft-restored` sichtbar, Speichern offen; speichern → eine Version mehr; erneut neu laden → Feld =
  neue Version, kein `draft-restored`. Screenshots `060-wiederhergestellt-de.png`/`-en.png`, axe.
- **E2 Schreibmodus und neuer Tab (beide):** `/my`, Schreibmodus, tippen, `draft-kept`; Tab schließen, neue Seite im selben
  Kontext → Schreibmodus der Frage zeigt den Text und `draft-restored`.
- **E3 Verbindungsabbruch beim Tippen (beide; Kern des Plans):** tippen, mitten im Wort `context.setOffline(true)`, weiter
  tippen; `draft-kept` aktualisiert sich weiter. Nur http: Speichern offline → Ablehnung als Toast, Text bleibt, Sperre löst
  sich. `context.setOffline(false)`, `page.reload()` → vollständiger Text inklusive des offline Getippten; speichern → genau eine
  neue Version (in-process über einen Zähler um `draftAnswer`, http über die Zahl der Versionen im gelesenen Datensatz).
- **E4 Inhalt des Eintrags (in-process):** über `page.evaluate` den Objektspeicher (Konstanten aus dem Modul importiert) lesen:
  genau die Felder aus Entscheidung 2; weder Fragetext noch Fragenummer noch ein Anzeigename kommen im serialisierten Eintrag vor.
- **E5 Akteurwechsel und Abmelden (beide):** in-process: tippen, `draft-kept`, Rolle wechseln → Objektspeicher ohne Eintrag des
  vorigen Akteurs; zurück, neu laden → Feld = Datensatz, kein `draft-restored`, der Text nirgends in `#main`. http: tippen,
  `draft-kept`, abmelden → Objektspeicher leer; als andere Person anmelden (Cookie-Wechsel über `asRole`) nach einem Eintrag →
  Einträge der vorigen Person gelöscht.
- **E6 Präsenz (beide):** in-process: Recht tippt in der Beantwortung auf einer Finanzen-Frage (Übernahme), Wechsel zum
  Fachbereich, dieselbe Frage → `presence-line` „seit HH:MM“; der Fachbereich tippt und speichert trotzdem (eine Version mehr).
  http: zweiter Kontext als Recht tippt, der Fachbereich sieht die Zeile über den Strom ohne Neuladen; nach Rückgabe (Recht
  verlässt die Frage) verschwindet sie. Screenshots `060-praesenz-de.png`/`-en.png`, axe.
- **E7 Fassungsvergleich nach 412 (in-process):** Muster aus `028-konflikte.spec.ts`: `api.draftAnswer` wird für den ersten
  Aufruf so umwickelt, dass er zuerst eine abweichende Version derselben Frage schreibt (gleicher Akteur, „zweites Fenster“) und
  dann 412 wirft. Speichern → Vergleich öffnet, Fokus auf `compare-title`, kein „Stand veraltet“-Band; linke Spalte = eigener
  Text, rechte = neue Version. „Version n übernehmen“ → Feld = Version n, Puffer leer. Zweiter Durchgang: „Mit meiner Fassung
  weiter“ → Feld = eigener Text, speichern → Version n+1 mit eigenem Text. Escape kehrt ohne Entscheidung zurück. Screenshots
  `060-vergleich-de.png`/`-en.png`, axe.
- **E8 Live-Vergleich (http):** zweiter Kontext als Recht speichert eine Version, während der Fachbereich verändert hat → Band
  mit „Vergleichen“, Fokus bleibt im Feld; Speichern → Vergleich, **keine** neue Version (Zahl der Versionen unverändert).
- **E9 Doppelklick (beide):** Doppelklick auf „Entwurf speichern“ → genau eine neue Version, Fokus auf dem Knopf; Doppelklick auf
  „Mit meiner Fassung weiter“ → kein Schreiben, Text einmal im Feld.
- **E10 Erfassung (beide; Teil B):** Wortlaut eines neuen Redebeitrags tippen, `draft-kept`, neu laden → `capture-text` trägt
  ihn; freie Einzelfrage tippen, neu laden → `capture-free-input` trägt sie; erste Eingabe in der freien Eingabe → der gelesene
  Redebeitrag trägt `claim.actorId` des eigenen Akteurs (in-process über `api.getContribution`); Doppelklick auf „Redebeitrag
  erfassen“ → genau ein Redebeitrag.

## Akzeptanzkriterium

1. U1–U10 und E1–E10 grün; rot vor der Änderung mindestens U1–U4 (Modul fehlt), U6, E1, E3, E7 (Bericht nennt Commit und
   Fehlerzeile); Fälle aus 054, takt-048 und 090 grün, angepasste Zeilen benannt.
2. **Puffer je Akteur und Versammlung:** E4 und E5 belegen: nur Entwurfsfelder, kein Eintrag eines anderen Akteurs nach dem
   Wechsel, leerer Speicher nach dem Abmelden; U1 belegt Ablauf nach 14 h und „synchronisiert nie“.
3. **Präsenz ohne Namen und ohne id:** E6 und U4; keine Präsenz bei eigener oder abgelaufener Übernahme; keine neue Kennzahl,
   kein Eintrag im Auswertungskatalog.
4. **Kein stilles Überschreiben:** E7, E8, U6, U7: bei neuerer fremder Version entsteht ohne ausdrückliche Wahl im Vergleich
   keine Version.
5. Keine neue axe-Ausnahme; axe grün auf den drei Zuständen in de und en; sechs Screenshots unter `docs/evidence/`
   (`060-wiederhergestellt-*`, `060-praesenz-*`, `060-vergleich-*`, je de und en).
6. Kein Vertrags-, Kern- oder Dienstdiff; `pnpm role-literals`, `pnpm vocabulary`, `pnpm i18n-literals` grün; kein neuer
   gitleaks-Befund (die Konstantennamen aus Entscheidung 1; im CI-Schritt nachgewiesen).
7. Design-Kritik D1–D10 als Tabelle im Bericht, vor dem Review, in frischem Kontext.
8. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich); `pnpm --filter @hv/web e2e` für die berührten Dateien grün; CI des
   PR grün einschließlich `e2e-http`; für die nur in http laufenden Fälle (E3 Speichern offline, E5 Abmelden, E6 zweiter Kontext,
   E8) nennt der Nachweis Artefaktname, Run-id, Artefakt-id und Digest (AGENTS.md R2, E56).

## Nachweise

- `docs/evidence/060-wiederhergestellt-de.png`, `docs/evidence/060-wiederhergestellt-en.png` (Feld mit wiederhergestelltem Text,
  Zeile „wiederhergestellt“, Speichern offen)
- `docs/evidence/060-praesenz-de.png`, `docs/evidence/060-praesenz-en.png` (Präsenzzeile über dem Feld, „seit HH:MM“)
- `docs/evidence/060-vergleich-de.png`, `docs/evidence/060-vergleich-en.png` (beide Spalten, primär „Mit meiner Fassung weiter“)
- CI-Artefakt des Laufs `e2e-http` für E3/E5/E6/E8 (Angaben wie im Akzeptanzkriterium 8)

## Design-Kritik (Pflicht vor dem Review)

In frischem Kontext gegen `docs/design-prinzipien.md`, Ergebnis als Tabelle D1–D10 im Bericht. Mindestens zu prüfen:

- **D1:** Versteht man den Vergleich in 30 Sekunden — welche Fassung ist meine, welche neu, was passiert bei jeder Wahl?
- **D2:** genau eine primäre Aktion im Vergleich; im Feld bleibt die Regel aus takt-048 (Vorgangsaktion primär, solange
  unverändert).
- **D4:** Präsenz neutral (keine Warnfarbe), Bernstein nur im Konfliktband; keine neue Farbe.
- **D5:** Uhrzeiten und Versionsnummern in Mono.
- **D6:** Zustände Puffer nicht verfügbar, offline, wiederhergestellt, Präsenz abgelaufen gestaltet.
- **D8:** Vergleich per Tastatur vollständig bedienbar, Fokus auf der Überschrift nur bei eigener Handlung, Escape zurück, keine
  Fokusverschiebung durch Live-Aktualisierung; 200 % Zoom (Spalten untereinander).
- **D10:** ruhig: keine Animation außer den vorhandenen 120 ms, keine Toastflut (die Zeile „gesichert“ ist kein Toast).

Ein Blocker der Kritik wird vor dem Review behoben; minor und nit gehen in die Folgeliste (Lean-Modus).

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch
Ausgelöst: [x] personenbezogene oder vertrauliche Daten (Gerätespeicher, Präsenz) [x] Oberfläche, Barrierefreiheit
[x] Nebenläufigkeit (412, Übernahme, Live-Version) [ ] Fachregel, Status [ ] Vertrag, Ereignis [ ] Rolle, Recht
Perspektive(n) und Rolle: Datenschutz und Security (Reviewer), UX (Design-Kritik) · Nachweise: siehe Akzeptanzkriterium ·
Offene Entscheidung: E36/E13 für den Namen (Standard: ohne), E33 für Geräterichtlinie (Standard: lokaler Speicher wird nicht
gelöscht; der Ablauf von 14 h gilt trotzdem)

## Wirkung und Risiko

| Risiko | Abfang | Beleg |
|---|---|---|
| Entwurf einer Person erscheint bei einer anderen am selben Gerät | Kennung je Akteur, Löschen fremder Einträge bei Bestätigung eines anderen Akteurs, Löschen bei Abmelden | U1, E5 |
| Unveröffentlichte Antwort bleibt lange auf dem Gerät (T-G1-I-08) | 14 h Ablauf, Löschen nach Speichern/Verwerfen/Abmelden; nur der Entwurf | U1, E4 |
| Puffer stellt veralteten Text über eine neuere Version | `restoreDraft` gleicht sofort mit `onRecord` ab, sonst Band und Vergleich | U2, E7 |
| Stilles Überschreiben einer fremden Version | Speichern bei `rebase` öffnet den Vergleich; 412 mit neuer Version öffnet ihn | U3, U6, E7, E8 |
| Eigenes 412 durch die eigene Übernahme | Wartesperre bis der Datensatz die Übernahme zeigt | U4, U6, E1 (kein Band) |
| Präsenz wird zur Verhaltenskontrolle | ohne Namen, ohne id, nur „seit“, kein Herzschlag, keine Liste, keine Kennzahl | U4, E6 |
| Fehlalarm gitleaks | Konstantennamen ohne `KEY`, Kennung aus Funktion | U1, CI |
| Speicher voll oder gesperrt | Abschalten mit Zeile, keine Ausnahme | U1 |

Missbrauchsfall (Leitplanken 6.5): Eine Person mit Gerätezugriff liest den Objektspeicher einer anderen. Erkennung: keine im
Werkzeug; Begrenzung durch Löschregeln und Ablauf; der Rest gehört zur Geräterichtlinie (E33) und zum Sperren einer Sitzung
(029). Betriebswirkung: keine (kein Dienst, keine Konfiguration); Doku-Wirkung: DSFA V5, Bedrohungsmodell T-G1-I-08, Glossar,
Tor-Zeile 412.

## Aufwand

3,8 AStd (Plan: 2 AStd, ohne Klasse hoch und ohne Erfassung im Detail gerechnet): Puffermodul mit Kern, Adapter und U1 0,6;
Beantwortung und Fokusansicht (Wiederherstellen, Schreiben, Löschen) 0,5; Übernahme, Präsenz, Wartesperre 0,5; Vergleich und
412-Einordnung 0,6; Löschwege in Tür und Demo 0,15; Erfassung 0,45 (Rest von Teil B in e2e); e2e beider Projekte 0,7;
Screenshots, axe, Doku-Zeilen, Design-Kritik und Bericht 0,3.

## Offene Eigentümerfragen (blockieren nicht; Standard gilt)

1. **Name in der Präsenz?** Standard: **ohne Namen** („eine andere Person“). Option: `Claim.displayName`, aufgelöst wie
   `Actor.displayName` — Vertragsänderung (AGENTS.md R6), Klasse hoch, eigene Scheibe 060c, rund 0,8 AStd, nach Klärung E36/E13
   mit dem Betriebsrat.
2. **Aufbewahrung im Puffer?** Standard: **14 Stunden** nach der letzten Änderung. Optionen: bis zum Schließen der Versammlung;
   24 Stunden.
3. **Puffer verschlüsseln?** Standard: **nein** (der Schlüssel läge auf demselben Gerät; Schutz kommt aus Geräterichtlinie E33 und
   Sitzungssperre 029). Option: AES-GCM über WebCrypto mit nicht exportierbarem Schlüssel je Sitzung, +0,5 AStd.
4. **Geschützte Fragen vom Puffer ausnehmen?** Standard: **ja, sobald die Vertraulichkeitsstufe an der Frage steht** (047 setzt es
   um); heute nicht anwendbar.
5. **Wann übernehmen?** Standard: **bei der ersten Änderung**. Option: schon beim Öffnen des Schreibmodus bzw. beim Fokus ins Feld
   (mehr Übernahmen, Präsenz auch ohne Tippen).
6. **Präsenz auch in Listen** (Fokusliste, Arbeitsliste)? Standard: **nein**, Folgeliste; eine Liste „wer arbeitet woran“ nur nach
   E13.

## Hinweise an den Orchestrator

- Plan §5 Eintrag 060 führt „mittel · 2 AStd“; diese Spec stuft auf **hoch · 3,8 AStd** (Begründung „Warum hoch“). Plan-Zeile
  angleichen; Lane web-capture, web-api und web-components ergänzen. Lesebefund vor dem Bau einplanen (Klasse hoch).
- Eigentümerfragen 1–6 ins Register (1 an E36/E13, 2 und 3 an E14/DSB, 4 an 047).
- `e2e-http`: die neue Datei kommt in die geteilte Liste nach 055b; Mehrzeit höchstens 0:50 (Vor dem Bau 7).
- Rückfallteilung 060b nur, wenn der Bericht sie meldet.

## Hinweise an Folgescheiben

- **047 (Vertraulichkeit):** `draftBuffer` erhält eine Ausnahme für `protected` (Eigentümerfrage 4), eine Zeile in `restoreDraft`
  und beim Schreiben.
- **058 (Podium offline):** nutzt nicht diesen Puffer (andere Daten, andere Löschregeln), kann aber den Adapter `BufferStore` als
  Muster nehmen; eigener Datenbankname.
- **059 (Rechtsfreigabe-Sicht):** `CompareVersions` ist für den Redline-Vergleich nicht gedacht (dort zwei gespeicherte
  Versionen), kann aber dessen Spaltenlayout teilen.
- **029 (Sitzungssperre):** eine Sperre des Bildschirms löscht den Puffer nicht; ein gesperrtes Subject (401 ohne Rückkehr) wird
  über den nächsten bestätigten Akteur bereinigt.

## Bericht (nach Bau ausfüllen)

```
Slice: 060-entwurfspuffer-praesenz
Done: <Puffer je Akteur und Versammlung (IndexedDB, 14 h, Löschregeln), Wiederherstellen nach Neuladen und Verbindungsabbruch;
      Präsenz über die Übernahme ohne Namen; Fassungsvergleich bei 412 und Live-Version; Doppelklick belegt; Erfassung (Teil B)
      gebaut oder als 060b abgespalten>
Evidence: pnpm gates auf <commit> (Exit 0), Schluss unten; docs/evidence/060-{wiederhergestellt,praesenz,vergleich}-{de,en}.png;
      e2e in-process <n bestanden>; CI e2e-http Run <id>, Artefakt <name>/<id>, Digest <sha256>
Open: <Rückfallteilung ja/nein; Laufzeit e2e-http vorher/nachher; Befunde>
Touched: <Dateiliste>
```

Zusätzlich: rot vorher (Commit, Fehlerzeilen), Design-Kritik-Tabelle D1–D10, Zahl der Übernahme-Ereignisse in E6 (erwartet: eine
Übernahme, eine Rückgabe je Durchgang), angepasste Zeilen in 054/takt-048/090 falls nötig, Folgeliste-Einträge.

## Review findings

(leer)
