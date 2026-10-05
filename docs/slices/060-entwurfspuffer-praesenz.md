# Scheibe 060 — Entwurfspuffer der Antwortansichten und Fassungsvergleich

**Status:** spec, Fassung 2 (05.10.2026; gelesen auf `c5990c8`: 028, 036a, 036b, 054, 055b, 090 und takt-048 gemergt, Vertrag
0.4.4). Fassung 1 (`a3a2dae`) hatte im Lesebefund 2 blocker, 10 major, 13 minor, 4 nit; diese Fassung arbeitet ihn ein
(Abschnitt „Lesebefund zu Fassung 1“) und setzt die Teilung des Orchestrators um. Achte Scheibe der Oberflächenkette der
Freigabe-Demo 045 → 048 → 053 → 054 → 055 → 055b → 059 → 046 → **060** → 061 → 041 (Register E57). **Geteilt:** 060 baut den
Puffer der Antwortansichten und den Fassungsvergleich; Präsenz und Übernahmen gehen in **060b**, der Puffer der Erfassung in
**060c** (beide skizziert, Abschnitt „Teilung und Zuschnitt“). Auf Standard gebaut; keine Eigentümerfrage blockiert 060.
**Lesebefund der Fassung 2 vor dem Bau** (Klasse hoch, Leitplanken §4).
**Risikoklasse:** hoch · 3,5 AStd · Kalender 23.11.2026 (W9), vorgezogen · Lanes: web-api, web-components, web-answers, web-focus, i18n, e2e, docs-sicherheit, docs-datenschutz
**Rolle:** implementierer-oberflaeche; Design-Kritik (D1–D10) in frischem Kontext vor dem Review (nicht die Sitzung, die
diese Spec schrieb, nicht die bauende); ein Review in frischem Kontext mit den Perspektiven **Datenschutz** und **Security**
(unveröffentlichte Antworten im Browserspeicher, T-G1-I-08) und **UX/Barrierefreiheit** (Vergleich, Fokus); Modell nur in
`.claude/agents/` (takt-012). Nie gebündelt.
**Rule ids:** AGENTS.md R1–R4, R6, R7, R9–R12; R-TRANS-03 und R-GUARD-04 (eine neue Version hebt Freigabe und
Rechtsfreigabe auf); 090 (Eingaben gehören dem Akteur); 010d Ziel 1/3 (Ausgang eines Schreibens nur auf der gezeigten Frage);
takt-008 (Sperre bis der Datensatz nachgezogen hat, Fokus bleibt); takt-048 Entscheidungen 2, 6, 7 (Vorbelegung, Basis nach dem
Speichern, Hinweis bei fremder Version; Entscheidung 7 wird hier geändert, Entscheidung 12); 054 (Entwurf je Akteur und
Einzelfrage, `writingOutcome`); 055b Entscheidung 7 (`generation`) und der Renderer `AnswerText` (nur Textknoten); ADR 0002,
ADR 0005 (Antwortformat, Whitelist), ADR 0009; DSFA-Vorentwurf V5 („Entwurfsspeicherung ohne Personenauswertung (060)“);
Bedrohungsmodell T-G1-I-08; Reviewer-Checkliste Sicherheit SC-06.
**Quellen-IDs:** Plan §5 Eintrag 060; `docs/agentische-entwicklung-plan.md` §5.3 Zeile „Fehlerpfad (Konflikt 412 in der
Oberfläche)“ (geplant in Scheibe 060); `docs/folgeliste.md` 054 Bau (`focus.write.gone`) und 054 Review 5; Hinweise an 060 in
054, 055, 055b, takt-048; Register E13, E14, E33, E36; Lesebefund zu `a3a2dae` mit Entscheidungen des Orchestrators (05.10.2026).
**Depends on:** 054 (gemergt), 036a/036b (gemergt, Strom und Live-Speicher für die Live-Version); gelesen gegen 055b und takt-048
(gemergt). 028 ist nach der Teilung keine Voraussetzung mehr (Übernahmen in 060b).
**Perspektive:** Datenschutz, Security, UX · **Glossar: neue Begriffe:** ja (Entscheidung 14)

## Warum hoch (Plan: mittel)

Der Plan führt 060 als mittel. Diese Spec stuft hoch (Hochstufen braucht keine Freigabe, Leitplanken §4). Auslöser:
**personenbezogene und vertrauliche Daten an einem neuen Ort.** Der Puffer legt unveröffentlichte Antwortentwürfe (Inhalt mit
Aktionärsbezug, DSFA V5) über das Neuladen hinaus im Speicher des Geräts ab — das Szenario T-G1-I-08 („Browserspeicher zeigt
unveröffentlichte Antworten“); die DSFA nennt 060 ausdrücklich als Maßnahmenträger für V5. Die Löschregeln entscheiden, ob ein
Entwurf am selben Gerät einer anderen Person erscheint (090).

Nicht ausgelöst: Rechte, Rollen, Übergänge, Vertrag, Ereignisform, Dienst, Persistenz des Dienstes, Präsenz (060b).
**Wahrheitstabellen-Diff: keiner** (kein neues Recht, keine neue Operation, kein neuer Aufruf des Dienstes).

Folgen der Klasse: Positiv- und Negativtest je Auslöser (schreibt/liest nur den eigenen Akteur; löscht bei Abmelden, ohne Rolle,
bei entzogenem Strom, bei anderem bestätigtem Akteur, nach Ablauf; nimmt keinen manipulierten Eintrag an), ein Fehler- und
Wiederherstellungsfall (Verbindungsabbruch beim Tippen mit erneuter Anmeldung, Neuladen, nicht verfügbarer Speicher),
Missbrauchsfall nach SC-06, Lesebefund vor dem Bau.

## Befund (Ist-Stand, gelesen auf `c5990c8`)

- **Entwurf heute:** Beantwortung (`features/answers/QuestionDetail.tsx` mit `draft.ts`) und Schreibmodus der Fokusansicht
  (`features/focus/Page.tsx`, Speicher `drafts` je `draftKey(actorId, questionId)`) halten denselben `FocusDraft` (Eingabeform
  `body: AnswerBodyInput | null`, `sources`, Basis `baseVersion`/`baseBody`/`baseSources`, `rebase`, `generation`) nur im
  Speicher der Seite. Neuladen, Schließen des Tabs, Verlassen von `/my` oder ein fremder Schreibvorgang, der die Frage aus
  „Meine Fragen“ nimmt, verwerfen ungespeicherten Text (Toast `focus.write.gone`; Folgeliste 054 Bau und 054 Review 5).
- **Wo ein Entwurf entsteht** (Stellen, an denen Entscheidung 5 greifen muss): `QuestionDetail` beim Aufbau (`startDraft`), beim
  Akteurwechsel und beim Neuaufbau im Render-Abgleich (`startDraft(…, generation + 1)`), nach „Neu laden“ des Bands
  (`startDraft`), nach „Verwerfen“ (`discard`); `focus/Page.tsx` beim ersten Anzeigen einer Frage (`newDraft`) und nach „Neu
  laden“ im Schreibmodus (`newDraft(…, generation + 1)`).
- **Fremde neuere Version:** `writingOutcome`/`onRecord` setzen `rebase`; über dem Feld steht `StaleBanner` (`focus-rebase`,
  `answer-editor-rebase`), dessen „Neu laden“ den eigenen Text **kommentarlos verwirft**; Speichern bleibt möglich und legt
  den eigenen Text über die fremde Version (takt-048 Entscheidung 7). Einen Vergleich beider Texte gibt es nicht.
- **412:** `useWriteDoor.run(permission, write, onDone, onProblem)` sendet `If-Match` aus dem beim Klick gezeigten Datensatz.
  `onProblem` wird bei einer Ablehnung zuerst gefragt; `false` lässt das Standardverhalten laufen (Band „Stand veraltet“
  `answers.stale.banner`, Neuladen, Entwurf bleibt). Ob danach eine neue Antwortversion da ist, sagt niemand; der 412-Pfad ist
  in der Oberfläche ungetestet (Tor-Zeile „geplant in Scheibe 060“).
- **Sitzung:** `api/auth.ts` kennt die Zustände `signedIn`, `noRole`, `signedOut`; `api/index.ts` meldet einen anderen
  bestätigten Akteur über `onActorChange`, ein Streamende über `onStreamEnd(reason)` mit `session`, `forbidden`,
  `roles_changed`, `unauthorized`. Nach einem Neuladen im HTTP-Betrieb kennt die Seite die id des vorigen Akteurs nicht mehr.
- **Demo:** `seedIfEmpty` wechselt bei **jedem** Start zur Administration und zurück (`setActor`); ein Löschen in `setActor`
  würde bei jedem Start alles löschen (Blocker 1 des Lesebefunds).
- **Antwortformat:** `normalizeAnswerBodyForRead` (Kern, über `previewAnswer` in `api/answerFormat.ts`) wirft nie und lässt
  Unbrauchbares fallen; `ANSWER_MARKS` ist die geschlossene Markenmenge, `ANSWER_TEXT_MAX_LENGTH` 20 000; Quellen im Vertrag
  höchstens 50 zu je 2 000 Zeichen. `bodyToDom` (Eingabeform → Feld) und `AnswerText` (Speicherform → Anzeige) sind die
  vorhandenen Wege ohne HTML-Senke (055b).
- **Speicherschlüssel:** zwei `*_KEY`-Konstanten mit `hv-…-v1`-Literal lösten in takt-021 den gitleaks-Fehlalarm
  `generic-api-key` aus (Allowlist in `scripts/gitleaks.toml` nur für genau diese zwei Zeilen).

## Teilung und Zuschnitt

Entscheidung des Orchestrators nach dem Lesebefund (major 10, blocker 2), jetzt geteilt:

- **060 (diese Spec):** lokaler Entwurfspuffer der Antwortansichten (Fokusansicht, Beantwortung), Wiederherstellen,
  Fassungsvergleich bei 412 und Live-Version, Doppelklicktests, Löschregeln, Doku-Zeilen. Keine Übernahme, keine
  Präsenzzeile, kein Puffer der Erfassung.
- **060b — Präsenz über die Übernahme (Skizze, Bau erst nach Antwort des Eigentümers auf Frage 1).** Inhalt aus Fassung 1
  Entscheidung 8: Präsenzzeile „Wird gerade von einer anderen Person bearbeitet · seit HH:MM“ ohne Namen aus `Claim`
  (`actorId`, `claimedAt`, `expiresAt`, kein Vertragsschritt), Übernahme bei erster Änderung nur mit `question.claim` in
  `_actions`, Verlängern ohne Herzschlag, Rückgabe beim Verlassen, Wartesperre des Speicherns bis der Datensatz die eigene
  Übernahme zeigt, Übernahme des Redebeitrags in der Erfassung; minor 4–6 des Lesebefunds gehören dorthin. **Vorfrage:** jede
  Übernahme, Verlängerung und Rückgabe schreibt `QuestionClaimed`/`QuestionReleased`, und Zeitleiste der Historie und
  Ereignistabelle zeigen diese mit Akteur und Zeit — die Präsenz erzeugt damit ein **benanntes Tätigkeitsprotokoll**
  (E13, E36). Optionen siehe Eigentümerfrage 1. Klasse hoch.
- **060c — Puffer der Erfassung (Skizze).** Inhalt aus Fassung 1 Teil B: Puffer für `capture-text` (Wortlaut eines neuen
  Redebeitrags, je Wortmeldung) und `capture-free-input` (freie Einzelfrage, je Redebeitrag) auf dem Modul dieser Scheibe
  (`kind` erweitert), ohne Vergleich (keine Vorgängerversion). Verbatimer Wortlaut des Redebeitrags: DSFA V2/V3 kommen mit 060c,
  nicht hier. Klasse hoch.

Plan-Zeilen für 060b und 060c setzt der Orchestrator.

## Ziel und Entscheidungen vor Bau

Keine Entscheidung bleibt dem Implementierer überlassen.

### 1. Ort, Form und Konstanten des Puffers

- Ein Modul `apps/web/src/api/draftBuffer.ts` mit einem **reinen Kern** (Eintrag bilden und prüfen, Kennung bilden, Ablauf,
  Eigentümerregel, Momentaufnahme) und einem dünnen **IndexedDB-Adapter** hinter der Schnittstelle `BufferStore` (`getAll`,
  `put`, `delete`, `clear`; jede Methode löst erst nach `transaction.oncomplete` auf). Für Einheitstests gibt es einen Speicher im
  Arbeitsspeicher derselben Schnittstelle; **keine neue Abhängigkeit**.
- Uhr injiziert: `createDraftBuffer({ store, now })`; verdrahtet in `api/index.ts`. Das Modul importiert **nicht** `mode.ts`,
  `http.ts`, `actor.ts` oder `auth.ts`: es kennt weder Betriebsart noch Sitzung; `index.ts` ruft es an den Löschstellen auf.
- Eine Datenbank, ein Objektspeicher, Schemanummer: Modulkonstanten **`BUFFER_DATABASE`**, **`BUFFER_OBJECT_STORE`**,
  **`BUFFER_SCHEMA`**. Die Namen enden **nie** auf `KEY`/`Key` und enthalten weder `token`, `secret`, `auth` noch `api`
  (gitleaks `generic-api-key`, takt-021); keine neue Allowlist-Zeile. Die Kennung eines Eintrags bildet die Funktion
  `entryId(meetingId, ownerId, questionId)`, nie ein Literal.
- Die e2e-Datei importiert die drei Konstanten aus dem Modul (kein zweites Literal). Das Modul greift beim Import nicht auf
  `indexedDB` zu.

### 2. Was ein Eintrag enthält, und wie er beim Lesen geprüft wird

| Feld | Inhalt |
|---|---|
| `id` | aus `entryId(…)` |
| `schema` | `BUFFER_SCHEMA` |
| `ownerId` | Akteur-id (`useActor().id`); nötig für die Trennung je Akteur, nie Name, Rolle oder `personId` |
| `meetingId` | `question.meetingId` (Vertrag: Pflicht ab 0.3.6). Fehlt sie am Datensatz, wird für diese Frage nicht gepuffert (kein Rückfall auf einen anderen Wert) |
| `questionId` | Frage-id |
| `body`, `sources` | Eingabeform des Felds und die Quellenzeile des `FocusDraft` (nie DOM oder HTML, 055b) |
| `baseVersion` | Nummer der Antwortversion, von der der Entwurf ausging (0 ohne Version) |
| `changedAt` | Wanduhr des Geräts beim letzten Schreiben; nur für Ablauf und die Zeile „gesichert · HH:MM:SS“ |

Nicht gespeichert: Fragetext, Fragenummer, Rednername, Anzeigename, Rolle, Status, `generation`, `rebase`, `key` des
`FocusDraft` und **die Basis selbst** (`baseBody`, `baseSources`): sie kommt beim Wiederherstellen immer aus dem Datensatz
(Entscheidung 5, Re-Check major 2). Je Kennung genau ein Eintrag, der jüngste Stand; kein Verlauf.

**`sanitizeEntry` (beim Schreiben und beim Lesen; ein abgelehnter Eintrag wird gelöscht, keine Ausnahme nach oben):**

- Schemanummer gleich, `id` gleich `entryId(meetingId, ownerId, questionId)`, alle Zeichenketten-Felder Zeichenketten,
  `baseVersion` ganze Zahl ≥ 0, `changedAt` gültige Zeit nicht in der Zukunft (mehr als 5 min Vorlauf → abgelehnt).
- `body` ist die **offene Eingabeform** des Felds (sie kann Überschrift, Zitat, Tabelle, Unterstreichung, Durchstreichung,
  `content`/`items`, `language` tragen, die erst die Normalisierung abbildet oder verwirft). Geprüft wird sie deshalb mit der
  Funktion des Kerns **`checkAnswerBodyInput`** (dieselben Formen und Grenzen wie das Vertragsschema `AnswerBodyInput` und der
  422 des Dienstes; über `@hv/domain`, wie `answerFormat.ts` es schon tut), nicht mit einer eigenen, engeren Regel: ein Entwurf,
  den der Dienst annehmen würde, wird nie abgelehnt. Gibt die Prüfung einen Fehler zurück, wird abgelehnt; danach läuft `body`
  durch `previewAnswer`; ist das Ergebnis `null`, obwohl Text da war, wird abgelehnt. `body: null` (leeres Feld) ist erlaubt.
- Obergrenzen: Klartext von `body` höchstens `ANSWER_TEXT_MAX_LENGTH`; `sources` ist im `FocusDraft` **eine Zeichenkette**, beim
  Speichern an `;` getrennt (`splitSources`). Für die Grenze gilt dieselbe Teilungsregel: an `;` trennen, jeden Teil trimmen,
  leere Teile verwerfen; dann höchstens 50 Teile zu je 2 000 Zeichen (Vertragsgrenzen) und die ganze Zeichenkette höchstens
  102 000 Zeichen; serialisiert höchstens 256 KiB je Eintrag (sonst nicht
  geschrieben, Zeile `draft-unavailable`).
- **Einzige Wege eines wiederhergestellten Inhalts:** `body` ins Feld nur über `bodyToDom` (Neuaufbau mit `generation + 1`),
  Anzeige im Vergleich nur über `AnswerText`; keine andere Senke, kein `innerHTML`, kein `dangerouslySetInnerHTML`.

### 3. Geltungsbereich: je Versammlung und je Akteur

Ein Eintrag wird nur für denselben `ownerId` **und** dieselbe `meetingId` wiederhergestellt. Mehrere Tabs desselben Akteurs
teilen den Eintrag; es gilt der jüngste Schreibvorgang, kein Abgleich zwischen Tabs (Nicht-Ziel).

### 4. Schreiben und Löschen: nur auf Eingabe der Person

- **Schreiben** nur als Folge einer **Eingabe der Person** in Feld oder Quellen (`onBody`, `onSources`), entprellt 400 ms, und nur
  für einen veränderten Entwurf (`isDirty`). Wird ein Entwurf durch Eingabe wieder unverändert, wird sein Eintrag gelöscht.
- **Kein Flush bei `pagehide`/`visibilitychange`** (nicht zuverlässig testbar, IndexedDB-Transaktionen beim Entladen werden
  abgebrochen). Folge: die letzten höchstens 400 ms Eingabe vor einem harten Neuladen können fehlen; die Zeile „gesichert“ sagt
  ehrlich, welcher Stand liegt (Entscheidung 6).
- **Löschen eines Eintrags** nur als Folge einer **Handlung der Person**: erfolgreiches Speichern, das den Entwurf unverändert
  hinterlässt (Basis = Gesendetes, takt-048 Entscheidung 6); „Verwerfen“; „Version n übernehmen“ im Vergleich.
- **Programmatische Neuaufbauten löschen nie:** Akteurwechsel (090), stiller Neuaufbau bei fremder Version über unverändertem
  Entwurf (`reseed`), `startDraft`/`newDraft` beim Aufbau, `writingOutcome` → `end`, Abbau der Komponente. Was der Puffer
  über andere Akteure weiß, regeln allein die Löschstellen unten.
- **Frage verlässt das Schreiben** (`writingOutcome` → `end`, z. B. weitergeleitet, zur Prüfung gegeben): vor dem Abbau wird der
  jüngste Stand sofort geschrieben (die Entprellung wird nicht abgewartet); erst nach `oncomplete` sagt der Toast
  `focus.write.goneKept` „… bleibt auf diesem Gerät bis {time} erhalten“. Scheitert das Schreiben oder ist der Puffer nicht
  verfügbar, bleibt der heutige Toast `focus.write.gone` („… ist verworfen“). Der Eintrag bleibt bis Ablauf; kommt die Frage
  zurück, gilt Entscheidung 5.
- **Ablauf:** **14 Stunden** nach `changedAt` (Höchstdauer einer Sitzung, DSFA V11; Eigentümerfrage 2). Abgelaufene Einträge
  werden beim Laden der Momentaufnahme gelöscht und nie wiederhergestellt.

**Wem der Puffer gehört (Re-Check major 1):** `createDraftBuffer({ store, now, getActor })` erhält `getActor` injiziert, wie der
Live-Speicher. Bei **jedem** Zugriff (`entryFor`, `put`, `delete`) vergleicht das Modul `getActor().id` mit dem `ownerId`, für
den die Momentaufnahme geladen ist; weicht er ab (oder ist noch keine geladen), lädt es neu und ruft `purgeOthers(neue id)`,
bevor es antwortet (bis dahin: kein Eintrag, Schreiben wartet). Wirft `getActor` (kein bestätigter Akteur), antwortet das Modul
ohne Eintrag und schreibt nicht. Das deckt den Personawechsel der Demo (Rollenumschalter → `setActor`) ab, ohne `actor.ts` oder
`RoleSwitcher` zu berühren. Erstes Laden: in der Demo am **Ende** von `seedIfEmpty` (nach dem Zurückwechseln), im HTTP-Betrieb
in `onActorChange(actor)` mit einem Akteur.

**Löschstellen** (in `api/index.ts`, über Funktionen des Moduls; jede wartet auf `oncomplete`). Die Verdrahtung steht in einer
exportierten, testbaren Funktion `wireDraftBuffer({ buffer, sessionAuth, onStreamEnd })` in `api/draftBuffer.ts` (ohne Import
von `auth`/`http`: sie bekommt die Hooks als Parameter), die `index.ts` einmal aufruft:

| Anlass | Wirkung | Ort |
|---|---|---|
| Momentaufnahme für einen **bestätigten** Akteur geladen (Start, neue Anmeldung, Neuladen) | `purgeOthers(actorId)`: alle Einträge anderer `ownerId` gelöscht; idempotent. Deckt den HTTP-Neuladefall ab, in dem die vorige id unbekannt ist | Modul, beim Laden |
| ausdrückliches Abmelden | `store.clear()` **bevor** die Abmeldeanfrage gesendet wird, begrenzt auf 1 s und mit `catch`: ein hängender oder scheiternder Speicher blockiert das Abmelden nie (danach geht die Anfrage trotzdem; der nächste Start räumt über `purgeOthers` bzw. Ablauf auf) | `signOut` in `index.ts` |
| Zustand `noRole` (angemeldet ohne Rolle) | `store.clear()`. Erkannt über `sessionAuth.subscribe(() => sessionAuth.getState().kind === 'noRole' && clear())`, **nicht** über `onActorChange(undefined)` (derselbe Rückruf kommt bei 401 und Abmelden, der Zustand wird erst danach veröffentlicht) | `wireDraftBuffer` |
| Streamende `forbidden` | `store.clear()` | `onStreamEnd` |
| Streamende `roles_changed` | kein Sofortlöschen; Merker „nachprüfen“: liest eine Ansicht danach eine Frage mit Eintrag, deren `_actions` kein `answer.draft` mehr trägt, wird der Eintrag gelöscht (Absicht: löschen, wo Entwerfen nicht mehr angeboten wird; ohne `roles_changed` bleibt er, Entscheidung 4). **Lebensdauer des Merkers:** nur im Arbeitsspeicher des Moduls (nicht persistiert), gesetzt beim Streamende, zurückgesetzt beim Neuladen der Seite, beim Laden für eine andere Akteur-id und bei `clear()`; er bleibt sonst bis zum Ende der Seite gesetzt (jede spätere Lesung prüft). Ein Neuladen vor der Prüfung lässt den Eintrag stehen; er läuft spätestens nach 14 h ab | Modul plus Antwortansichten |
| Demo-Reset | `await store.clear()`, erst nach `oncomplete` `location.reload()` | `resetDemo` in `index.ts` |
| 401, Sitzungsablauf, Streamende `session`/`unauthorized`, Netzverlust | **nichts**; nach erneuter Anmeldung desselben Akteurs wird wiederhergestellt; ein anderer Akteur löst `purgeOthers` aus | — |

**Nicht in `setActor`** (Blocker 1): der Wechsel in `seedIfEmpty` zur Administration und zurück läuft vor dem ersten Laden
(am Ende von `seedIfEmpty`) und ohne Zugriff auf den Puffer, löst also nichts aus. Danach greift `purgeOthers` beim ersten Zugriff
nach einem Personawechsel: Wechsel zu B lädt die
Momentaufnahme für B und löscht die Einträge von A; zurück bei A ist nichts mehr da (wie takt-048 V6). Die Momentaufnahme lädt neu
bei jedem Wechsel der Akteur-id (Vergleich über `id`, R4), nicht bei einem gleichen Akteur aus einer Auffrischung.

### 5. Momentaufnahme und Wiederherstellen

- Die Momentaufnahme ist ein Speicher im Modul: einmal je bestätigtem Akteur geladen (`getAll`, Ablauf, `sanitizeEntry`,
  `purgeOthers`), danach **write-through**: jedes `put` und `delete` ändert zuerst die Momentaufnahme und dann den Speicher; eine
  scheiternde Transaktion setzt den Eintrag der Momentaufnahme **nur dann** auf den Vorzustand zurück, wenn die Momentaufnahme noch
  den gescheiterten Wert hält (ein inzwischen neuerer Schreibvorgang bleibt stehen), und schaltet den Puffer ab (Entscheidung 8). Lesen ist
  danach synchron (`entryFor(meetingId, questionId)`).
- **Wo immer ein Entwurf entsteht** (Liste im Befund), wird zuerst `restoreDraft(entry, actorId, question, generation)` aus
  `answers/draft.ts` gefragt; ohne passenden Eintrag gilt die Vorbelegung aus takt-048. Ausnahme: nach „Verwerfen“ und „Version n
  übernehmen“ gibt es keinen Eintrag mehr (Entscheidung 4).
- **Späte Momentaufnahme:** Ist sie beim Entstehen des Entwurfs noch nicht geladen, und der Entwurf ist bei ihrer Ankunft noch
  unverändert, ersetzt der wiederhergestellte Entwurf ihn mit `generation + 1` (ein Neuaufbau des Felds, keine Zusammenführung).
  Hat die Person schon getippt, bleibt ihr Text; der nächste Schreibvorgang überschreibt den Eintrag.
- **Basis aus dem Datensatz, nie aus dem Eintrag (Re-Check major 2):** `restoreDraft` nimmt `baseBody` und `baseSources` aus der
  Antwortversion `entry.baseVersion` **des Datensatzes**, nach derselben Regel wie `draftBase` (neue reine Funktion
  `baseAt(question, version)`: Dokument über `answerBodyOf`, Quellen über `joinSources`, leer bei einer Verweigerung, leer bei
  Version 0). Liegt `entry.baseVersion` über der neuesten Antwortversion oder gibt es diese Version im Datensatz nicht, wird der
  Eintrag **abgelehnt und gelöscht** (keine Wiederherstellung, Vorbelegung aus takt-048). So kann ein manipulierter oder veralteter
  Eintrag weder die Sperre „unverändert nicht speichern“ (takt-048 Entscheidung 4) umgehen noch eine Basis vortäuschen, gegen die
  eine neuere Version still überschrieben würde.
- Danach gleicht `restoreDraft` den Entwurf sofort mit `onRecord` gegen den aktuellen Datensatz ab:
  - neuere Version, die dasselbe sagt wie der Eintrag → Basis nachgezogen, Entwurf unverändert, Eintrag gelöscht (Folge der
    Wiederherstellung, kein programmatischer Neuaufbau eines Entwurfs der Person);
  - neuere Version über verändertem Eintrag → `rebase` steht (Entscheidung 7);
  - Eintrag sagt dasselbe wie seine Basis → keine Wiederherstellung, Eintrag gelöscht;
  - Frage ohne `answer.draft` in `_actions` → keine Wiederherstellung, Eintrag bleibt (außer nach `roles_changed`, Entscheidung 4).
- Nach einer Wiederherstellung steht unter der Überschrift des Felds **„Ungespeicherter Entwurf von HH:MM wiederhergestellt“**
  (`draft-restored`, `text-ink-600`, Uhrzeit Mono) mit „Verwerfen“ wie heute.

### 6. Zeile „in diesem Browser zwischengespeichert“

Solange ein veränderter Entwurf gepuffert ist, steht neben der Speichern-Schaltfläche (Beantwortung, Schreibmodus) leise
**„In diesem Browser zwischengespeichert · HH:MM:SS“** (`draft-kept`, `text-2xs text-ink-600`, Zeit Mono, kein `aria-live`). Die Zeit ist
das `changedAt` des Eintrags und erscheint **erst nach `oncomplete`** der Transaktion, nie beim Absenden. Ist der Puffer nicht
verfügbar, steht dort einmal **„Keine Sicherung auf diesem Gerät möglich“** (`draft-unavailable`). Ohne Änderung keine Zeile. Die
Zeile ist zugleich das Warte-Signal der e2e vor einem Neuladen.

**Wortlaut statt Erkennung (nit N4):** In einem privaten Fenster verwirft der Browser IndexedDB beim Schließen des Fensters;
„auf diesem Gerät gesichert“ hätte das überzeichnet. Der Wortlaut sagt deshalb „in diesem Browser zwischengespeichert“ (vorläufig,
an den Browser gebunden), und die Hilfe der Zeile (`title` und `aria-describedby` auf einen versteckten Satz, neuer
Schlüssel `common.draft.keptHelp`, Entscheidung 13) sagt: „Bleibt beim Neuladen erhalten. In einem privaten
Fenster endet die Kopie mit dem Fenster.“ Ein privates Fenster wird **nicht** erkannt (keine verlässliche Schnittstelle; Erkennungstricks
über Kontingent oder Speicher-APIs wären Gerätemerkmale).

### 7. Fassungsvergleich (412 und Live-Version)

Der Begriff in der Oberfläche ist **„Fassungen vergleichen“**, nie „Zusammenführen“/„Merge“ (das Hauswort „Zusammengeführt“
gehört dem Zusammenführen von Einzelfragen, Glossar).

**Wann er öffnet:**

1. **Live:** Kommt eine fremde neuere Version über verändertem Text (`rebase` wird wahr), bleibt das Feld, wie es ist (kein
   Fokuswechsel). Das vorhandene Band (`answer-editor-rebase`, `focus-rebase`) trägt statt „Neu laden“ die Schaltfläche
   **„Vergleichen“** (neue optionale Beschriftung an `StaleBanner`). Das alte „Neu laden“, das den Text kommentarlos verwarf,
   entfällt.
2. **Speichern bei stehendem Band:** „Entwurf speichern“ bzw. Strg+Enter sendet **nicht**, sondern öffnet den Vergleich
   (ersetzt takt-048 Entscheidung 7). In `WritingMode` heißt das: `canSave` bleibt wie heute (`mayDraft && dirty && text !== ''
   && !busy`), die Speicheraktion prüft zuerst `rebase` und öffnet dann den Vergleich; in `QuestionDetail` ebenso vor `onAction`.
3. **412 auf das eigene Speichern, ohne Änderung an `useWriteDoor`:** Beide Seiten übergeben beim Speichern `onProblem` an `run`.
   Bei 412 merkt sich die Ansicht `refused = { questionId, version }` (Frage und Datensatzversion beim Klick) und gibt `false`
   zurück (Standardverhalten: Neuladen, Band). **Zum Zeitpunkt des 412** wird mit dem gezeigten Datensatz eingeordnet, **und
   erneut beim nächsten Datensatz derselben Frage** mit `version > refused.version` (der neu geladene); die reine Funktion
   `conflictAfterRefusal(draft, question)` in `answers/draft.ts` sagt:
   - neuere Antwortversion, die etwas anderes sagt als der Entwurf → `compare`: Vergleich öffnet sofort (die Person hat gehandelt,
     der Fokus darf wandern), das Band „Stand veraltet“ der Seite wird über `clearStale` ausgeblendet (ein Hinweis, nicht zwei);
   - neuere Version, die dasselbe sagt → `rebase-silent`: still nachziehen (wie `onRecord`), kein Vergleich;
   - keine neuere Antwortversion (der Datensatz bewegte sich anders) → `retry`: das vorhandene „Stand veraltet“ bleibt, der
     Entwurf bleibt, ein zweiter Klick speichert gegen den neuen Stand.
   `refused` fällt nach der Einordnung oder bei Wechsel der gezeigten Frage oder des Akteurs (010d Ziel 3).

**Was er zeigt** (neue Komponente `features/answers/CompareVersions.tsx`, in Beantwortung und Schreibmodus an der Stelle des Felds,
im selben Rahmen):

- Überschrift „Fassungen vergleichen“ (`compare-title`, `tabIndex=-1`), ein Satz: „Während Sie geschrieben haben, wurde Version
  {n} gespeichert. Wählen Sie, womit Sie weiterarbeiten.“
- Zwei gleich breite Spalten (ab 1024 px; darunter untereinander): links **„Ihre Fassung · nicht gespeichert“** (`compare-mine`),
  rechts **„Version {n} · {Autor} · {HH:MM}“** (`compare-theirs`; Version und Zeit Mono, Autor wie in der Versionsliste der
  Beantwortung). Beide nur über `AnswerText`, Quellen darunter. **`AnswerText` erwartet die Speicherform:** die linke Spalte
  bekommt `previewAnswer(draft.body)` (der Entwurf hält die offene Eingabeform), die rechte `answerBodyOf(version)` (nit N1). Text markierbar (Teile hinüberkopieren).
- **Rechte Spalte folgt Live-Aktualisierungen:** kommt während des offenen Vergleichs Version n+1, zeigt die rechte Spalte n+1
  (Überschrift und Satz mit der neuen Nummer); der Fokus bleibt, wo er ist; eine höfliche Live-Region an der Überschrift der
  rechten Spalte sagt die neue Nummer einmal an.
- Ein geschlossenes `<details>` „Unterschiede Wort für Wort“ mit `wordDiff` (`answers/lib.ts`, Klartext, Version n → Ihre
  Fassung), Darstellung wie „Änderung gegenüber Version n-1“. `wordDiff` braucht Speicher in der Größenordnung n·m; er wird **erst
  berechnet, wenn das `<details>` geöffnet wird** (Zustand am `toggle`-Ereignis), und nur solange es offen ist neu, wenn sich eine
  Seite ändert (nit N2).
- Keine neue Farbe, kein Token: neutraler Rahmen (`border-line-strong`, `bg-sunken`), keine Bernsteinfläche im Vergleich (D4).

**Entscheidungen** (genau eine primäre Aktion, D2; alle lokal, keine Schreiboperation):

- **„Mit meiner Fassung weiter“** (primär, `compare-keep-mine`): Basis wird **die Version, die die rechte Spalte gerade zeigt**
  (`shownVersion`, nicht neu aus dem Datensatz gelesen), `rebase` falsch, Text bleibt, Feld neu aufgebaut (`generation + 1`),
  Fokus ans Ende des Felds. Danach sofort `onRecord` gegen den aktuellen Datensatz: ist dort inzwischen n+1, steht `rebase`
  wieder (Band, kein stilles Überschreiben). Reine Funktion `keepMine(draft, shownVersion, question)` in `answers/draft.ts`.
  Speichern legt dann die nächste Version an; Version n bleibt in der Versionsliste; `answers.editor.hint` steht wie heute.
- **„Version {n} übernehmen“** (sekundär, `compare-take-theirs`) mit dem Satz „Ihre Fassung wird dabei verworfen.“: Entwurf =
  gezeigte Version (`generation + 1`), Eintrag gelöscht, Fokus ins Feld; danach `onRecord` wie oben.
- **„Zurück zum Text“** (Geisterknopf, `compare-back`) und **Escape**: zurück zum Feld ohne Entscheidung; das Band bleibt. Der
  Tastaturhandler ruft `preventDefault()`, damit das Escape nicht zusätzlich den Schreibmodus verlässt (`shouldLeaveWriting`
  prüft `defaultPrevented`).

**Fokus:** Öffnet der Vergleich durch eine Handlung der Person (Klick „Vergleichen“, Speichern, 412 nach eigenem Speichern), geht
der Fokus auf `compare-title`; nie durch eine Live-Aktualisierung (6.9). Nach jeder Entscheidung liegt der Fokus im Feld.

### 8. Ausfall und Grenzen

- IndexedDB fehlt, ist gesperrt, das Kontingent ist voll, ein Vorgang scheitert oder ein Eintrag ist zu groß → der Puffer schaltet
  sich für die Seite ab, keine Ausnahme erreicht eine Ansicht, Zeile `draft-unavailable`. Kein Rückfall auf `localStorage`.
- **Synchronisiert nie:** kein Netzaufruf mit Pufferinhalt, kein `BroadcastChannel`, kein `storage`-Ereignis, kein Service
  Worker.

### 9. Doppelklickschutz

- Speichern (Beantwortung, Schreibmodus, Strg+Enter mit Tastenwiederholung) bleibt über die Schreibtür geschützt; neu ist der
  Nachweis mit echtem Doppelklick in beiden Projekten (genau eine neue Version).
- Vergleich: die Entscheidungen schließen die Ansicht; ein zweiter Klick trifft das Feld und bewirkt nichts (Nachweis).

### 10. Akteurwechsel (090)

Die Momentaufnahme wird bei jeder neuen Akteur-id neu geladen (Entscheidung 4); die vorhandenen Rücksetzungen (090, 010d,
takt-048) bleiben. Ein Entwurf des vorigen Akteurs erscheint nie, weder aus dem Speicher der Seite noch aus dem Puffer.

### 11. Restrisiko Aufbewahrung

Innerhalb von 14 Stunden liegt ein ungespeicherter Entwurf im Klartext auf dem Gerät, auch nachdem die Person es ohne Abmelden
verlassen hat (Sitzungsablauf löscht nicht, Entscheidung 4). Das steht als Restrisiko in T-G1-I-08 und in DSFA V5; Begrenzung
durch Abmelden, Geräterichtlinie (E33) und Sitzungssperre (029); Entscheidung über Dauer und Verschlüsselung beim Eigentümer
(Fragen 2 und 3).

### 12. Änderung an takt-048 und 054

- takt-048 Entscheidung 7 („Speichern bei sichtbarem Hinweis möglich“) wird ersetzt durch Entscheidung 7 Punkt 2.
- takt-048 „Später: ein gepufferter Entwurf aus 060 geht der Vorbelegung vor“ ist Entscheidung 5.
- 054 `focus.write.gone`: bleibt als Rückfall; neu `focus.write.goneKept` (Entscheidung 4).

### 13. Texte (i18n, de und en-US)

Neue Schlüssel (15), Wortlaut verbindlich, Hausvokabular. Die Shell-Schlüssel tragen das vorhandene Präfix `common` (Test (d) in
`parity.test.ts` kennt kein Präfix `draft`; die Präfixliste bleibt unverändert).

| Schlüssel | de | en |
|---|---|---|
| `common.draft.kept` | In diesem Browser zwischengespeichert · {time} | Saved in this browser for now · {time} |
| `common.draft.keptHelp` | Bleibt beim Neuladen erhalten. In einem privaten Fenster endet die Kopie mit dem Fenster. | Survives a reload. In a private window the copy ends when the window closes. |
| `common.draft.restored` | Ungespeicherter Entwurf von {time} wiederhergestellt | Unsaved draft from {time} restored |
| `common.draft.unavailable` | Keine Sicherung auf diesem Gerät möglich | Cannot keep a copy on this device |
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
| `focus.write.goneKept` | {number} liegt nicht mehr bei Ihnen. Ihr ungespeicherter Text bleibt auf diesem Gerät bis {time} erhalten. | {number} is no longer with you. Your unsaved text stays on this device until {time}. |

`focus.write.gone` bleibt unverändert (Rückfall). Schlüsselzahl in `parity.test.ts` (f): 621 → 636.

### 14. Glossar

Zwei Zeilen: „Fassungen vergleichen | Compare versions | `CompareVersions`, `conflictAfterRefusal`, `keepMine` | Merge,
Zusammenführen (gehört den Einzelfragen)“; „In diesem Browser zwischengespeichert | Saved in this browser for now | `draftBuffer` (IndexedDB, je
Akteur und Versammlung) | Cache, Autosave“. Die Zeile zur Übernahme kommt mit 060b.

## Nicht-Ziele

- Keine Übernahme, keine Präsenzzeile, keine Wartesperre (060b); kein Puffer der Erfassung (060c).
- Kein Vertrag, kein Kern, kein Dienst, keine Ereignisänderung; keine Änderung an Rechten, Übergängen, Seed.
- Kein Abgleich zwischen Tabs oder Geräten, kein Service Worker, kein Offline-Schreiben mit Warteschlange (058 für die Bühne).
- Keine Verschlüsselung (Eigentümerfrage 3); kein Ausschluss geschützter Fragen, weil es die Vertraulichkeitsstufe an der Frage
  noch nicht gibt (Hinweis an 047, Eigentümerfrage 4).
- Kein Puffer für Begründungsfelder, Dialoge, Suche, Registrierung.
- Keine Änderung an `useWriteDoor`, `focus.ts` und an der Fokuslogik nach Übergaben (takt-043, takt-049).
- Kein Kern-Guard „wortgleiche Version“ (takt-048 Frage 1 bleibt offen).

## Files allowed

Tür und Puffer:

- `apps/web/src/api/draftBuffer.ts` (neu), `apps/web/src/api/draftBuffer.test.ts` (neu)
- `apps/web/src/api/index.ts` (nur: Puffer verdrahten, Laden der Momentaufnahme bei bestätigtem Akteur, die Löschstellen aus
  Entscheidung 4)

Komponenten:

- `apps/web/src/components/DraftNote.tsx` (neu, Zeilen „gesichert“, „wiederhergestellt“, „nicht möglich“),
  `apps/web/src/components/DraftNote.test.tsx` (neu)
- `apps/web/src/components/StaleBanner.tsx` (nur eine optionale Beschriftung der Schaltfläche)
- `apps/web/src/components/index.ts` (nur die Exporte)

Beantwortung und Fokusansicht:

- `apps/web/src/features/answers/CompareVersions.tsx` (neu), `apps/web/src/features/answers/CompareVersions.test.tsx` (neu)
- `apps/web/src/features/answers/draft.ts`, `apps/web/src/features/answers/draft.test.ts`
- `apps/web/src/features/answers/QuestionDetail.tsx`, `apps/web/src/features/answers/QuestionDetail.test.tsx`
- `apps/web/src/features/answers/AnswerEditor.tsx`
- `apps/web/src/features/answers/Page.tsx` (nur: onProblem beim Speichern weiterreichen und das Band „Stand veraltet“ ausblenden,
  solange das Detail den Vergleich zeigt)
- `apps/web/src/features/focus/Page.tsx` (nur Entwurf, Puffer, onProblem, Vergleich, Toast beim Verlassen; Fokuslogik aus
  takt-043 unverändert)
- `apps/web/src/features/focus/WritingMode.tsx`, `apps/web/src/features/focus/WritingMode.test.tsx`

Sprache:

- `apps/web/src/i18n/shell.de.ts`, `apps/web/src/i18n/shell.en.ts`, `apps/web/src/i18n/answers.de.ts`,
  `apps/web/src/i18n/answers.en.ts`, `apps/web/src/i18n/focus.de.ts`, `apps/web/src/i18n/focus.en.ts` (nur die Schlüssel aus
  Entscheidung 13)
- `apps/web/src/i18n/parity.test.ts` (nur die Zahl in (f) und ihr Kommentar)

e2e:

- `apps/web/e2e/060-entwurfspuffer-praesenz.spec.ts` (neu, in beiden Projekten)
- `apps/web/e2e/support/e2e-texts.ts` (nur die Konstanten dieser Scheibe und ihre Einträge in der Liste der geschriebenen Texte)
- `apps/web/e2e/support/roles.ts` (nur ein neuer Helfer für einen zweiten Browserkontext mit eigener Anmeldung, für E7)
- `apps/web/playwright.config.ts` (nur die Liste der geteilten Dateien: die neue Datei nach 055b)
- `scripts/e2e-http-031.test.mjs` (nur die beiden Dateilisten: die neue Datei zwischen 055b und 080)
- Bestehende Dateien mit Antwortansichten, **nur falls rot durch Entscheidung 4, 5 oder 7; keine Zusicherung entfällt oder wird
  schwächer; der Bericht nennt Datei, Zeile und Ursache**: `apps/web/e2e/003-answers-stage.spec.ts`,
  `apps/web/e2e/010d-ansichtsdaten.spec.ts`, `apps/web/e2e/013-tastaturpfad.spec.ts`,
  `apps/web/e2e/021c-rechtsfreigabe.spec.ts`, `apps/web/e2e/040a-administration.spec.ts`,
  `apps/web/e2e/045-verweigerung.spec.ts`, `apps/web/e2e/054-fokusansicht.spec.ts`, `apps/web/e2e/055b-antwortformat.spec.ts`,
  `apps/web/e2e/090-eingaben-je-akteur.spec.ts`, `apps/web/e2e/abnahme.spec.ts`,
  `apps/web/e2e/takt-048-nullzaehler-vorbelegung.spec.ts`

Nachweise und Doku:

- `docs/evidence/060-*.png`
- `docs/glossar.md` (nur die zwei Zeilen aus Entscheidung 14)
- `docs/datenschutz/dsfa-vorentwurf.md` (nur Zeile V5, Spalte Maßnahmen: je Akteur und Versammlung, nur der Entwurf, 14 h,
  Löschstellen, keine Synchronisierung, keine Auswertung, Restrisiko aus Entscheidung 11; V2/V3 kommen mit 060c)
- `docs/sicherheit/bedrohungsmodell.md` (nur: Zelle Gegenmaßnahme von T-G1-I-08 mit Restrisiko; eine Zeile 060 unter „Weitere
  Scheiben mit Sicherheitsbezug“; der neue Missbrauchsfall MF-16 aus „Wirkung und Risiko“)
- `docs/agentische-entwicklung-plan.md` (nur die Zeile „Fehlerpfad (Konflikt 412 in der Oberfläche)“ in §5.3: Werkzeug die neue
  e2e-Datei, Stand „läuft (CI: End-to-end acceptance scenario)“)
- `docs/folgeliste.md` (054 Bau „focus.write.gone“ und 054 Review 5 als erledigt; neue nicht blockierende Befunde)
- `docs/slices/060-entwurfspuffer-praesenz.md` (Bericht, Design-Kritik, Review findings)

## Ausdrücklich nicht erlaubt

Alles unter packages, apps/api, die Vertragsdatei und ihre Typen; der Rest von apps/web/src/api außer den genannten Dateien
(auch nicht actor.ts, auth.ts, http.ts, liveStore.ts, connection.ts, mode.ts); useWriteDoor.ts; focus.ts; FocusDetail; die
Erfassung (features capture); styles und neue Tokens; app-Ordner der Shell; features steering, speakers, stage, history;
RefusalDialog, ForwardDialog, ActionDialogs; labels.ts; scripts außer der einen Testdatei; gitleaks.toml (keine neue
Allowlist); semgrep-Regeln; Workflows; package.json und Lockfile; axe-exceptions.json (keine neue Ausnahme);
docs/produktplan-beta.md und das Entscheidungsregister (Hinweise an den Orchestrator). Muss eine dieser Dateien sich ändern:
anhalten und melden.

## Vor dem Bau prüfen

1. `sessionAuth.subscribe` und `getState()` melden den Zustand `noRole` nach seiner Veröffentlichung; das Streamende `forbidden`
   erreicht `onStreamEnd` in `api/index.ts`; `signOut` lässt sich so ordnen, dass `store.clear()` (mit Zeitgrenze) vor der
   Abmeldeanfrage abgeschlossen ist.
2. In der Demo bestätigt `seedIfEmpty` die Persona erst nach dem Zurückwechseln (erstes Laden am Ende von `seedIfEmpty`); das Laden der Momentaufnahme hängt am
   bestätigten Akteur nach dem Start, nicht an `setActor`.
3. `run(…, onProblem)` erreicht in beiden Seiten den Speicherweg; in `answers/Page.tsx` liegt er im Fall `draft` von `onAction`.
4. IndexedDB ist im festgelegten Chromium (headless) verfügbar; `context.setOffline(true)` lässt IndexedDB unberührt;
   Playwright-Kontexte beginnen je Test mit leerem IndexedDB (der Puffer leckt nicht zwischen Tests; `storageState` des
   HTTP-Projekts enthält kein IndexedDB).
5. Im HTTP-Harness gibt es Anmeldezustände für Fachbereich und Recht (zweiter Kontext für E7). Die Antwortform „keine aktive
   Rolle“ von `/auth/me` und das `end`-Ereignis des Stroms sind aus 030 bzw. 036b als Doubles nachbildbar (E5b).
6. Laufzeit `e2e-http` (takt-046): Mehrzeit dieser Datei höchstens 0:45; liegt sie darüber, Befund an den Orchestrator.

## Tests zuerst (rot, dann grün)

Einheit (vitest, ohne jsdom, statisches Rendern wie heute):

- **U1 `draftBuffer.test.ts`** (Speicher im Arbeitsspeicher, feste Uhr):
  - `entryId` trennt Versammlung, Akteur, Frage;
  - `sanitizeEntry`: zusätzliche Felder (`questionText`, `displayName`, `number`, `baseBody`, `baseSources`) fallen weg;
    **legitime Eingabeform wird angenommen** (Überschrift, Zitat, Tabelle, Unterstreichung, Durchstreichung, `content`/`items`,
    `language: 'de'`, `body: null`); **manipulierter Eintrag** abgelehnt und gelöscht, wenn `checkAnswerBodyInput` ablehnt (z. B.
    Blocktyp `script`, Lauf mit `text` als Zahl, Schlüssel `html` im Block, `language: 'xx'`), ferner bei 51 Quellteilen, einem Teil
    mit 2 001 Zeichen (Teilung an `;` wie `splitSources`; leere Teile zählen nicht), Klartext über 20 000, `id` passt nicht zu den
    Feldern, `baseVersion` keine ganze Zahl ≥ 0, `changedAt` in der Zukunft, fremde Schemanummer;
  - Ablauf an der Grenze (13:59:59 bleibt, 14:00:00 gelöscht);
  - Laden für Akteur A löscht alle Einträge von B (`purgeOthers`), zweimal geladen bleibt gleich (idempotent); Lesen nur eigener
    Einträge derselben Versammlung (Negativ: fremder Akteur, fremde Versammlung → nichts);
  - **write-through:** nach `put` liefert `entryFor` sofort den neuen Stand, nach `delete` nichts; eine scheiternde Transaktion
    setzt die Momentaufnahme zurück und schaltet ab (`status: 'unavailable'`), ohne zu werfen; scheitert `put` A, während schon
    `put` B auf derselben Kennung in der Momentaufnahme steht, bleibt B stehen;
  - **Eigentümer über `getActor`:** wechselt `getActor().id` von A zu B, liefert der nächste Zugriff nichts von A und A ist im
    Speicher gelöscht; wirft `getActor`, liefert der Zugriff nichts und schreibt nicht; gleiche id → kein Neuladen;
  - **`wireDraftBuffer`** (Doppel für `sessionAuth` und `onStreamEnd`): Zustand `noRole` → `clear`; Streamende `forbidden` →
    `clear`; Streamende `unauthorized` und `session` (401) → nichts gelöscht; `roles_changed` → Merker gesetzt, nichts gelöscht,
    Merker fällt beim Laden für eine andere id und bei `clear`; Abmelden → `clear` ist abgeschlossen, **bevor** die Abmeldeanfrage
    des Doppels aufgerufen wird; ein `clear`, das nie abschließt oder wirft, hält das Abmelden höchstens 1 s auf;
  - `kept`-Zeit erst nach `oncomplete` (ein Speicher, der verzögert abschließt, zeigt vorher keine Zeit);
  - `clear` leert Speicher und Momentaufnahme; Eintrag über 256 KiB wird nicht geschrieben;
  - Quelltexttest **auf dem Code ohne Kommentare** (Block- und Zeilenkommentare werden vor der Prüfung entfernt, damit ein
    Satz wie „kein localStorage“ im Kommentar nicht trifft; nit N3): das Modul nennt weder `fetch`, `BroadcastChannel`,
    `sendBeacon`, `serviceWorker`, `localStorage`, `innerHTML`
    noch importiert es `mode`, `http`, `actor`, `auth`; die drei Konstanten enden nicht auf `KEY`/`Key`.
- **U2 `draft.test.ts`, `restoreDraft`:** Eintrag vor Vorbelegung; Eintrag gleich Basis → keine Wiederherstellung, löschen;
  neuere Version gleich Eintrag → Basis nachgezogen, unverändert; neuere Version über verändertem Eintrag → `rebase`;
  **Basis aus dem Datensatz:** Eintrag mit `baseVersion` 1 und dem Wortlaut von Version 1, Datensatz mit Version 1 → keine
  Wiederherstellung, und ein Entwurf mit demselben Wortlaut bleibt für `canSave` gesperrt (die takt-048-Sperre greift); ein
  manipulierter Eintrag, dessen Text von Version 1 abweicht, wird mit der Basis aus Version 1 (nicht aus dem Eintrag)
  wiederhergestellt und ist verändert; `baseVersion` über der neuesten Version (Zukunft) → abgelehnt und gelöscht; `baseVersion`
  bei einer Verweigerung → Basis leer wie `draftBase`; ohne
  `answer.draft` → keine Wiederherstellung, bleibt; nach `roles_changed` ohne `answer.draft` → löschen; Eintrag eines anderen
  Akteurs → nie verwendet; späte Momentaufnahme über unverändertem Entwurf → `generation + 1`, über verändertem → keine Änderung.
- **U3 `draft.test.ts`, `conflictAfterRefusal`:** neuere abweichende Version → `compare`; neuere gleiche → `rebase-silent`; keine
  neuere → `retry`; Verweigerung als neueste Version → `compare` mit leerer rechter Spalte und Hinweis wie heute.
- **U4 `draft.test.ts`, `keepMine`:** Basis = gezeigte Version n, nicht die des Datensatzes; Datensatz schon bei n+1 → nach dem
  folgenden `onRecord` steht `rebase` wieder; Datensatz bei n → `rebase` falsch, Entwurf verändert gegenüber n.
- **U5 `CompareVersions.test.tsx`:** beide Spalten, Version und Zeit in Mono, genau eine primäre Schaltfläche, Hinweis unter
  „übernehmen“, `compare-title` mit `tabIndex=-1`, Diff geschlossen; rechte Spalte rendert die übergebene neuere Version
  (Nummer im Satz folgt); Texte aus dem Wörterbuch (de und en); kein `dangerouslySetInnerHTML`; die linke Spalte rendert einen
  Entwurf mit Eingabeform (Lauf ohne `marks`, leerer Absatz) über `previewAnswer` korrekt (N1); geschlossenes `<details>` →
  `wordDiff` nicht aufgerufen (Spion), geöffnet → einmal (N2).
- **U6 `QuestionDetail.test.tsx`:** mit `rebase` ruft Speichern `onAction` nicht und zeigt den Vergleich; Band trägt
  „Vergleichen“; wiederhergestellter Entwurf → `draft-restored`; Eingabe ruft den Puffer, programmatischer Neuaufbau nicht.
- **U7 `WritingMode.test.tsx`:** Strg+Enter bei `rebase` öffnet den Vergleich statt zu speichern; `canSave` unverändert; Escape im
  Vergleich setzt `defaultPrevented` und verlässt den Schreibmodus nicht.
- **U8 `DraftNote.test.tsx`:** die drei Zustände, Zeit in Mono, kein `aria-live` an `draft-kept`; `draft-kept` trägt die Hilfe
  `common.draft.keptHelp` über `aria-describedby` (N4).
- **U9 `parity.test.ts`:** 636 Schlüssel in de und en.

e2e `060-entwurfspuffer-praesenz.spec.ts` (Rolle über `asRole`, Belege über `support/evidence.ts`, axe über `support/axe.ts` ohne
neue Ausnahme; Fragen nach `_actions` gewählt; „beide“ = in-process und http):

- **E1 Neuladen (beide):** Beantwortung, Frage mit Version; Text anhängen; warten auf `draft-kept`; `page.reload()` → Feld mit dem
  angehängten Text, `draft-restored` sichtbar, Speichern offen; speichern → eine Version mehr; erneut neu laden → Feld = neue
  Version, kein `draft-restored`. Screenshots `060-wiederhergestellt-de.png`/`-en.png`, axe.
- **E2 Schreibmodus und neuer Tab (beide):** `/my`, Schreibmodus, tippen, `draft-kept`; Tab schließen, neue Seite im selben
  Kontext → Schreibmodus der Frage zeigt den Text und `draft-restored`.
- **E3 Verbindungsabbruch beim Tippen (beide; Kern des Plans):** tippen, mitten im Wort `context.setOffline(true)`, weiter tippen;
  `draft-kept` aktualisiert sich weiter. Nur http: Speichern offline → Ablehnung als Toast, Text bleibt, Sperre löst sich; danach
  **erneute Anmeldung** derselben Person (Sitzungscookie entfernt, Anmeldung über den Harness-Weg) → nach dem Laden ist der Text
  wiederhergestellt (Sitzungsverlust löscht nicht). `context.setOffline(false)`, `page.reload()` → vollständiger Text inklusive
  des offline Getippten; speichern → genau eine neue Version (in-process über einen Zähler um `draftAnswer`, http über die Zahl der
  Versionen im gelesenen Datensatz).
- **E4 Inhalt des Eintrags (in-process):** über `page.evaluate` den Objektspeicher lesen (Konstanten aus dem Modul importiert):
  genau die Felder aus Entscheidung 2; weder Fragetext noch Fragenummer noch ein Anzeigename im serialisierten Eintrag. Danach
  einen manipulierten Eintrag (Blocktyp `script`, Schlüssel `html` im Block) hineinschreiben, neu laden → kein
  `draft-restored`, Feld = Datensatz, Eintrag gelöscht. Variante: gültiger Eintrag mit `baseVersion` = neueste Version + 5 → neu
  laden → kein `draft-restored`, Eintrag gelöscht. Variante: Eintrag mit dem unveränderten Wortlaut der neuesten Version →
  Speichern bleibt `aria-disabled`.
- **E5 Akteurwechsel und Abmelden (beide):** in-process: tippen, `draft-kept`, über den Rollenumschalter wechseln → beim ersten
  Zugriff kein Eintrag des vorigen Akteurs mehr im Objektspeicher; zurück, neu laden → Feld = Datensatz, kein `draft-restored`,
  der Text nirgends in `#main`; zusätzlich: Neuladen ohne Wechsel behält den Eintrag (der Start mit `seedIfEmpty` löscht nichts).
  http: tippen, `draft-kept`, abmelden → Objektspeicher leer (geprüft vor dem nächsten Laden); Eintrag anlegen, Cookie-Wechsel zu
  einer anderen Person über `asRole`, neu laden → Einträge der vorigen Person gelöscht.
- **E5b Ohne Rolle und entzogener Strom (http, mit `page.route`-Doubles nach dem Muster aus 030 und 036b m5):** Ein Rollenverlust
  mitten in der Sitzung lässt sich im Harness nicht echt erzeugen (031 H7: kein Test schreibt Rollenereignisse am Dienst vorbei).
  (a) Eintrag anlegen, dann beantwortet ein Double `GET /auth/me` mit der Antwort „keine aktive Rolle“, Seite neu prüfen lassen →
  Seite „Keine aktive Rolle“, Objektspeicher leer. (b) Eintrag anlegen, ein Double des Stroms sendet `end` mit `forbidden` →
  Objektspeicher leer. (c) Gegenprobe: ein Double beantwortet einen Lesevorgang mit 401, danach erneute Anmeldung derselben Person
  → Eintrag noch da. Läuft nur in `e2e-http`; der Nachweis nennt das CI-Artefakt (E56).
- **E6 Fassungsvergleich nach 412 (in-process):** Muster aus `028-konflikte.spec.ts`: `api.draftAnswer` wird für den ersten Aufruf
  so umwickelt, dass er zuerst eine abweichende Version derselben Frage schreibt (gleicher Akteur, „zweites Fenster“) und dann 412
  wirft. Speichern → Vergleich öffnet, Fokus auf `compare-title`, kein „Stand veraltet“-Band; links eigener Text, rechts neue
  Version. „Version n übernehmen“ → Feld = Version n, Eintrag gelöscht. Zweiter Durchgang: „Mit meiner Fassung weiter“ → Feld =
  eigener Text, speichern → nächste Version mit eigenem Text. Escape kehrt ohne Entscheidung zurück und lässt den Schreibmodus
  offen (im Schreibmodus geprüft). Screenshots `060-vergleich-de.png`/`-en.png`, axe.
- **E7 Live-Vergleich (http):** zweiter Kontext als Recht speichert eine Version, während der Fachbereich verändert hat → Band mit
  „Vergleichen“, Fokus bleibt im Feld; Speichern → Vergleich, **keine** neue Version; zweiter Kontext speichert noch eine Version
  → rechte Spalte zeigt sie, Fokus unverändert; „Mit meiner Fassung weiter“ → kein Band (Basis = jüngste gezeigte).
- **E8 Doppelklick (beide):** Doppelklick auf „Entwurf speichern“ → genau eine neue Version, Fokus auf dem Knopf; Doppelklick auf
  „Mit meiner Fassung weiter“ → kein Schreiben, Text einmal im Feld.
- **E9 Verlassen mit Text (in-process):** im Schreibmodus tippen, `draft-kept`; die Frage über die Schreibtür eines anderen Schritts
  aus „Meine Fragen“ nehmen (Muster 054 F-Fälle) → Toast mit `focus.write.goneKept`; die Frage zurückholen (Rückgabe durch eine
  berechtigte Rolle) → Text wiederhergestellt oder, bei neuerer Version, Band „Vergleichen“.

## Akzeptanzkriterium

1. U1–U9 und E1–E9 mit E5b grün; rot vor der Änderung mindestens U1–U4 (Modul bzw. Funktionen fehlen), U6, E1, E3, E6 (Bericht nennt
   Commit und Fehlerzeile); die gelisteten bestehenden e2e-Dateien grün, angepasste Zeilen benannt.
2. **Puffer je Akteur und Versammlung:** E4 und E5 belegen nur Entwurfsfelder, kein Eintrag eines anderen Akteurs nach dem Wechsel,
  leerer Speicher nach dem Abmelden, kein Löschen beim Demo-Start; U1 belegt Ablauf nach 14 h, `purgeOthers`, write-through,
  Ablehnung manipulierter Einträge und „synchronisiert nie“.
3. **Kein stilles Überschreiben:** E6, E7, U3, U4, U6, U7: bei neuerer fremder Version entsteht ohne ausdrückliche Wahl im
   Vergleich keine Version.
4. Keine neue axe-Ausnahme; axe grün auf den Zuständen „wiederhergestellt“ und „Vergleich“ in de und en; vier Screenshots unter
   `docs/evidence/` (`060-wiederhergestellt-*`, `060-vergleich-*`, je de und en).
5. Kein Vertrags-, Kern- oder Dienstdiff; kein Aufruf von `claimQuestion`/`releaseQuestion`; `pnpm role-literals`,
   `pnpm vocabulary`, `pnpm i18n-literals` grün; kein neuer gitleaks-Befund im CI-Schritt.
6. Design-Kritik D1–D10 als Tabelle im Bericht, vor dem Review, in frischem Kontext.
7. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich); `pnpm --filter @hv/web e2e` für die berührten Dateien grün; CI des PR
   grün einschließlich `e2e-http`; für die nur in http laufenden Teile (E3 Speichern offline und erneute Anmeldung, E5 Abmelden und
   Personenwechsel, E5b, E7) nennt der Nachweis Artefaktname, Run-id, Artefakt-id und Digest (AGENTS.md R2, E56).

## Nachweise

- `docs/evidence/060-wiederhergestellt-de.png`, `docs/evidence/060-wiederhergestellt-en.png` (Feld mit wiederhergestelltem Text,
  Zeile „wiederhergestellt“, Speichern offen)
- `docs/evidence/060-vergleich-de.png`, `docs/evidence/060-vergleich-en.png` (beide Spalten, primär „Mit meiner Fassung weiter“)
- CI-Artefakt des Laufs `e2e-http` für E3/E5/E5b/E7 (Angaben wie im Akzeptanzkriterium 7)

## Design-Kritik (Pflicht vor dem Review)

In frischem Kontext gegen `docs/design-prinzipien.md`, Ergebnis als Tabelle D1–D10 im Bericht. Mindestens:

- **D1:** Versteht man den Vergleich in 30 Sekunden — welche Fassung ist meine, welche neu, was passiert bei jeder Wahl?
- **D2:** genau eine primäre Aktion im Vergleich; im Feld bleibt die Regel aus takt-048.
- **D4:** Bernstein nur im Konfliktband; keine neue Farbe.
- **D5:** Uhrzeiten und Versionsnummern in Mono.
- **D6:** Zustände Puffer nicht verfügbar, offline, wiederhergestellt, Vergleich mit live nachgezogener Version gestaltet.
- **D8:** Vergleich per Tastatur vollständig bedienbar, Fokus auf der Überschrift nur bei eigener Handlung, Escape zurück ohne den
  Schreibmodus zu verlassen, keine Fokusverschiebung durch Live-Aktualisierung; 200 % Zoom (Spalten untereinander).
- **D10:** ruhig: keine Animation außer den vorhandenen 120 ms, keine Toastflut (die Zeile „gesichert“ ist kein Toast).

Ein Blocker der Kritik wird vor dem Review behoben; minor und nit gehen in die Folgeliste (Lean-Modus).

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch
Ausgelöst: [x] personenbezogene oder vertrauliche Daten (Gerätespeicher) [x] Oberfläche, Barrierefreiheit [x] Nebenläufigkeit
(412, Live-Version) [ ] Fachregel, Status [ ] Vertrag, Ereignis [ ] Rolle, Recht
Perspektive(n) und Rolle: Datenschutz und Security (Reviewer), UX (Design-Kritik) · Nachweise: siehe Akzeptanzkriterium ·
Offene Entscheidung: E33 Geräterichtlinie (Standard: lokaler Speicher wird nicht gelöscht; der Ablauf von 14 h gilt trotzdem);
Eigentümerfragen 2–4

## Wirkung und Risiko

| Risiko | Abfang | Beleg |
|---|---|---|
| Entwurf einer Person erscheint bei einer anderen am selben Gerät | Kennung je Akteur; `purgeOthers` bei jedem Laden für einen bestätigten Akteur (auch nach Neuladen); Löschen bei Abmelden, ohne Rolle, bei `forbidden` | U1, E5 |
| Demo löscht bei jedem Start (Wechsel in `seedIfEmpty`) | kein Löschen in `setActor`; Löschen nur beim Laden für den bestätigten Akteur | E5 |
| Unveröffentlichte Antwort bleibt auf dem Gerät (T-G1-I-08) | 14 h Ablauf, Löschen nach Speichern/Verwerfen/Abmelden; nur der Entwurf; Restrisiko benannt (Entscheidung 11) | U1, E4 |
| Manipulierter Eintrag als Einschleusung (Gerätezugriff oder XSS an anderer Stelle) | `sanitizeEntry` strukturell, Normalisierung, Obergrenzen; nur `bodyToDom` und `AnswerText` als Wege | U1, E4 |
| Puffer stellt veralteten Text über eine neuere Version | `restoreDraft` gleicht mit `onRecord` ab, sonst Band und Vergleich | U2, E6 |
| Stilles Überschreiben einer fremden Version | Speichern bei `rebase` öffnet den Vergleich; 412 mit neuer Version öffnet ihn; `keepMine` prüft erneut | U3, U4, U6, E6, E7 |
| „gesichert“ zeigt einen Stand, der nicht liegt | Zeit erst nach `oncomplete`; kein Flush beim Entladen versprochen | U1 |
| Fehlalarm gitleaks | Konstantennamen ohne `KEY`, Kennung aus Funktion | U1, CI |
| Speicher voll oder gesperrt | Abschalten mit Zeile, keine Ausnahme | U1 |

**Missbrauchsfall MF-16 „Entwurf aus dem Gerätespeicher lesen oder einschleusen“** (neu im Bedrohungsmodell, SC-06):
- *Ablauf:* eine Person mit Zugriff auf ein nicht abgemeldetes oder nach Sitzungsablauf verlassenes Gerät liest über die
  Entwicklerwerkzeuge des Browsers den Objektspeicher und damit unveröffentlichte Entwürfe der vorigen Person; oder sie schreibt
  einen präparierten Eintrag, der bei der nächsten Anmeldung derselben Person als „ihr“ Entwurf erscheint.
- *Verhindert bzw. begrenzt durch:* Ablauf 14 h; Löschen bei Abmelden, ohne Rolle, `forbidden`, anderem Akteur; `sanitizeEntry`
  und die zwei Renderwege (keine Skriptausführung); ein präparierter, gültiger Text erscheint nur als ungespeicherter Entwurf mit
  der Zeile „wiederhergestellt“ und wird nie ohne Speichern der Person zu einer Version.
- *Erkennung und Empfänger:* im Werkzeug kein Signal (der Browserspeicher liegt außerhalb des Dienstes; ein Zähler je Person
  wäre unzulässig, ADR 0013). Organisatorisches Signal: Meldung eines unbeaufsichtigten oder verlorenen Geräts an das
  Versammlungsbüro, Empfänger Konzern-IT nach Geräterichtlinie (E33). Technischer Rest: ein abgelehnter Eintrag wird ohne Inhalt
  verworfen; kein Log mit Pufferinhalt.

Betriebswirkung: keine (kein Dienst, keine Konfiguration). Doku-Wirkung: DSFA V5, Bedrohungsmodell T-G1-I-08 und MF-16, Glossar,
Tor-Zeile 412.

## Aufwand

**3,5 AStd** (Fassung 2: 3,2; der Re-Check brachte die testbare Verdrahtung, den Eigentümer über `getActor`, die Basis aus dem
Datensatz und E5b; Fassung 1: 3,8 mit Präsenz und Erfassung; Plan: 2 AStd ohne Klasse hoch):

| Teil | AStd |
|---|---|
| Puffermodul: Kern, `sanitizeEntry` mit `checkAnswerBodyInput`, Momentaufnahme mit write-through, Eigentümer über `getActor`, Adapter, U1 | 0,9 |
| Antwortansichten: Wiederherstellen an allen Entstehungsstellen mit `baseAt` (Basis aus dem Datensatz), Schreiben nur auf Eingabe, Löschen, Toast beim Verlassen, U2, U6 | 0,6 |
| Fassungsvergleich, 412-Einordnung über `onProblem`, Live-Spalte, `keepMine`, Escape, U3–U5, U7 | 0,7 |
| `wireDraftBuffer` mit Einheitstests und Einbau in `index.ts` (Abmelden mit Zeitgrenze, `noRole` über `subscribe`, `forbidden`, `roles_changed`, Demo-Reset, erstes Laden) | 0,3 |
| e2e beider Projekte E1–E9 mit E5b (Doubles), Prüfung der gelisteten Dateien | 0,75 |
| Screenshots, axe, Doku-Zeilen (DSFA, Bedrohungsmodell, Glossar, Tor-Zeile), Design-Kritik, Bericht | 0,3 |

060b (Präsenz) schätzt nach heutigem Stand rund 1,0 AStd, 060c (Erfassung) rund 0,7 AStd; beide neu zu schätzen in ihrer Spec.

## Offene Eigentümerfragen

1. **(für 060b, blockiert 060b)** **Präsenz erzeugt ein benanntes Tätigkeitsprotokoll.** Jede Übernahme, Verlängerung und Rückgabe
   schreibt `QuestionClaimed`/`QuestionReleased`; Zeitleiste der Historie und Ereignistabelle zeigen sie mit Akteur und Zeit. Wer
   `history.read` hat, sieht damit, wer wann an welcher Frage geschrieben hat (E13, E36). Optionen: (a) die Historienansichten
   blenden Übernahme-Ereignisse aus oder fassen sie zusammen („in Bearbeitung von … bis …“ ohne Einzelzeiten), das Log bleibt
   unverändert (Regel 7); (b) hinnehmen und dem Betriebsrat so vorlegen; (c) Präsenz nicht bauen. Kein Standard für den Bau: 060b
   startet erst nach der Antwort. Ein Name in der Präsenz (Vertragsfeld `Claim.displayName`) wäre eine weitere Frage in 060b.
2. **Aufbewahrung im Puffer?** Standard: **14 Stunden** nach der letzten Änderung, Restrisiko wie Entscheidung 11. Optionen: bis
   zum Schließen der Versammlung; 24 Stunden; kürzer (z. B. 2 Stunden, dann verliert eine lange Unterbrechung den Text).
3. **Puffer verschlüsseln?** Standard: **nein** (der Schlüssel läge auf demselben Gerät; Schutz kommt aus E33 und 029). Option:
   AES-GCM über WebCrypto mit nicht exportierbarem Schlüssel je Sitzung, +0,5 AStd (der Text wäre nach Sitzungsende nicht mehr
   lesbar, also auch nicht wiederherstellbar).
4. **Geschützte Fragen vom Puffer ausnehmen?** Standard: **ja, sobald die Vertraulichkeitsstufe an der Frage steht** (047); heute
   nicht anwendbar.

## Lesebefund zu Fassung 1 (`a3a2dae`) und was sich änderte

| Befund | Änderung in Fassung 2 |
|---|---|
| Blocker 1 (Löschen in `setActor` löscht bei jedem Demo-Start) | Entscheidung 4: kein Löschen in `setActor`; `purgeOthers` beim Laden der Momentaufnahme für einen bestätigten Akteur; `actor.ts` nicht mehr erlaubt; E5 prüft „Neuladen löscht nichts“ |
| Blocker 2 und major 10 (Umfang, Präsenz als Tätigkeitsprotokoll) | geteilt: Präsenz und Übernahmen nach 060b mit Eigentümerfrage 1 (E13/E36), Erfassung nach 060c |
| major 1 (HTTP-Neuladen kennt die vorige id nicht; `noRole`, `forbidden`) | `purgeOthers` beim Laden; Löschen bei `noRole` und `forbidden` (Tabelle Entscheidung 4) |
| major 3 (Momentaufnahme veraltet nach Schreiben) | write-through bei jedem `put`/`delete`, Rücksetzen bei Fehler; U1 |
| major 4 (Wartesperre wegen eigener Übernahme) | entfällt mit 060b |
| major 5 („Mit meiner Fassung weiter“ auf welche Basis) | Basis = in der Spalte gezeigte Version, danach `onRecord`; rechte Spalte folgt live ohne Fokuswechsel; `keepMine`, U4, E7 |
| major 6 (`sanitizeEntry` zu schwach) | strukturelle Prüfung, Normalisierung, Obergrenzen, nur `bodyToDom`/`AnswerText`; U1 und E4 mit manipuliertem Eintrag |
| major 7 (wer schreibt/löscht; Wiederherstellen nur beim Aufbau) | nur Eingabe bzw. Handlung der Person schreibt/löscht; programmatische Neuaufbauten nie; Wiederherstellen an allen Entstehungsstellen, späte Momentaufnahme mit `generation + 1` |
| major 8 (betroffene e2e-Dateien) | Liste in Files allowed mit „nur falls rot, keine Zusicherung schwächer“ |
| major 9 (DSFA) | nur V5; V2/V3 mit 060c |
| minor 1 (412-Einordnung) | beim 412 und beim nächsten Datensatz, über `onProblem`, ohne `useWriteDoor` |
| minor 2 (Reihenfolge Abmelden, Demo-Reset) | `store.clear()` vor der Abmeldeanfrage; Reset wartet auf `oncomplete`; `clear` statt Einzellöschungen |
| minor 3 (Restrisiko Aufbewahrung) | Entscheidung 11, T-G1-I-08, DSFA V5, Eigentümerfrage 2 |
| minor 4–5 (Präsenz; laut Orchestrator „4–6“, Überschneidung mit 6) | nach 060b |
| minor 6 (Missbrauchsfall nach SC-06) | MF-16 mit Erkennung und Empfänger |
| minor 7 („gesichert“ vor dem Abschluss; `pagehide`-Flush ungetestet; E3 ohne erneute Anmeldung) | Zeit erst nach `oncomplete`; Flush beim Entladen gestrichen; E3 mit erneuter Anmeldung |
| minor 8 (Escape verlässt zusätzlich den Schreibmodus) | `preventDefault()` im Vergleich; U7, E6 |
| minor 9 (Quelle von `meetingId`) | `question.meetingId`, ohne sie kein Puffer |
| minor 10 (`canSave` im Schreibmodus) | `canSave` unverändert, Speicheraktion prüft `rebase` zuerst |
| minor 11 (`focus.write.gone` ohne Rückfall; Text vor dem Abbau) | `focus.write.goneKept` nur nach erfolgreichem Schreiben, sonst der alte Toast; sofortiges Schreiben vor dem Abbau; E9 |
| minor 12 (`draftBuffer.ts` importiert `mode.ts`) | Modul ohne `mode`/`http`/`actor`/`auth`; Quelltexttest |
| minor 13 (Absicht bei `roles_changed`) | löschen nur, wo Entwerfen nicht mehr angeboten wird (Merker „nachprüfen“) |
| nit N1 (`AnswerText` erwartet Speicherform, der Entwurf hält Eingabeform) | linke Spalte über `previewAnswer(draft.body)`, rechte über `answerBodyOf`; U5 |
| nit N2 (`wordDiff` O(n·m) im Speicher) | erst beim Öffnen des `<details>` berechnet; U5 mit Spion |
| nit N3 (Quelltexttest trifft Wörter in Kommentaren) | Prüfung auf Code ohne Kommentare; U1 |
| nit N4 (privates Fenster: „auf diesem Gerät gesichert“ überzeichnet) | Wortlaut „in diesem Browser zwischengespeichert“ plus Hilfesatz, keine Erkennung; Schlüssel 15, Zahl 636; Glossar; U8 |
| Nachtrag (Orchestrator) | MF-15 ist durch Spec 046 belegt; der Missbrauchsfall heißt MF-16 (nächste freie Nummer, geprüft über alle Zweige) |
| Re-Check major 1 (Löschverdrahtung nicht erkennbar und ungetestet) | `noRole` über `sessionAuth.subscribe`/`getState`; `getActor` in `createDraftBuffer` injiziert, Neuladen und `purgeOthers` bei abweichender id (deckt den Rollenumschalter ab, ohne `actor.ts`); erstes Laden am Ende von `seedIfEmpty` bzw. in `onActorChange(actor)`; exportierte `wireDraftBuffer` mit Einheitstests (U1); E5b mit Doubles; E5 Titel und Inhalt berichtigt |
| Re-Check major 2 (Basis aus dem Eintrag umgeht Sperre und Abgleich) | Basis nur noch aus dem Datensatz bei `entry.baseVersion` (`baseAt`); `baseBody`/`baseSources` nicht mehr gespeichert; Eintrag mit zukünftiger oder fehlender Version abgelehnt und gelöscht; U2, E4-Varianten |
| Re-Check minor 1 (Prüfung lehnt legitime Eingabeform ab) | `checkAnswerBodyInput` des Kerns statt eigener Regel; U1 mit legitimer Eingabeform |
| Re-Check minor 2 (Quellen sind eine Zeichenkette) | Teilungsregel wie `splitSources` für die Grenze benannt |
| Re-Check minor 3 (Rücksetzen überschreibt neueren Wert) | Rücksetzen nur, wenn die Momentaufnahme noch den gescheiterten Wert hält; U1 |
| Re-Check minor 4 (Lebensdauer des Merkers `roles_changed`) | nur im Arbeitsspeicher; gesetzt beim Streamende; zurück bei Neuladen, anderer id, `clear` |
| Re-Check minor 5 (Abmelden darf nicht hängen) | `clear` vor der Anfrage mit 1 s Grenze und `catch`; U1 |
| Re-Check minor 6 (zweiter Kontext gehört zu E7) | Files allowed und Vor dem Bau 5 auf E7 berichtigt |

## Hinweise an den Orchestrator

- Plan §5 Eintrag 060 führt „mittel · 2 AStd“; diese Spec führt **hoch · 3,5 AStd** (Begründung „Warum hoch“). Plan-Zeile angleichen;
  Lanes web-api und web-components ergänzen; Plan-Zeilen 060b (Präsenz, hoch, nach Eigentümerfrage 1) und 060c (Erfassung, hoch)
  anlegen. Lesebefund der Fassung 2 vor dem Bau.
- Eigentümerfragen ins Register (1 an E13/E36, 2 und 3 an E14/DSB, 4 an 047).
- `e2e-http`: die neue Datei kommt in die geteilte Liste nach 055b; Mehrzeit höchstens 0:45.

## Hinweise an Folgescheiben

- **060b (Präsenz):** Fassung 1 Entscheidung 8 ist der Entwurf; der Eintrag dieses Puffers bleibt unberührt; eine Übernahme
  erhöht `version`, daher die Wartesperre vor dem Speichern; die Vergleichsansicht dieser Scheibe deckt das 412 einer fremden
  Übernahme bereits ab (`retry`).
- **060c (Erfassung):** erweitert `entryId` um eine Art (`contribution`, `free_question`) mit neuer `BUFFER_SCHEMA`-Nummer; alte
  Einträge fallen über `sanitizeEntry` weg; DSFA V2/V3.
- **047 (Vertraulichkeit):** Ausnahme für `protected` in `restoreDraft` und beim Schreiben (Eigentümerfrage 4).
- **058 (Podium offline):** eigener Datenbankname; `BufferStore` als Muster.
- **029 (Sitzungssperre):** eine Bildschirmsperre löscht den Puffer nicht; ein gesperrtes Subject wird über den nächsten bestätigten
  Akteur bereinigt.

## Bericht (nach Bau ausfüllen)

```
Slice: 060-entwurfspuffer-praesenz
Done: <Puffer der Antwortansichten je Akteur und Versammlung (IndexedDB, 14 h, Löschstellen), Wiederherstellen nach Neuladen,
      Verbindungsabbruch und erneuter Anmeldung; Fassungsvergleich bei 412 und Live-Version; Doppelklick belegt>
Evidence: pnpm gates auf <commit> (Exit 0), Schluss unten; docs/evidence/060-{wiederhergestellt,vergleich}-{de,en}.png;
      e2e in-process <n bestanden>; CI e2e-http Run <id>, Artefakt <name>/<id>, Digest <sha256>
Open: <Laufzeit e2e-http vorher/nachher; Befunde>
Touched: <Dateiliste>
```

Zusätzlich: rot vorher (Commit, Fehlerzeilen), Design-Kritik-Tabelle D1–D10, angepasste Zeilen in den gelisteten e2e-Dateien
falls nötig, Folgeliste-Einträge.

## Review findings

(leer)
