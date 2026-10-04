# takt-044 — H13: Klassifizierungsfenster erst nach dem Erfassungs-Lesezugriff öffnen

**Status:** angenommen (gemergt `d7020da`, PR #154) · **Risikoklasse:** niedrig (nur Testcode in einer e2e-Datei, kein Produktivcode, kein Vertrag, keine Persistenz)
**Rolle:** builder; Review in frischem Kontext (Perspektive: beweist H13 noch, dass nur berührte Schlüssel gelesen werden?)
**Regeln:** AGENTS.md R1, R2, R3, R12; 036b (H13: zweiter Browser sieht eine Änderung in unter 2 s und liest nur berührte Schlüssel)
**Quellen-IDs:** `docs/folgeliste.md` (H13-Eintrag, 036b); CI-Läufe 37155605584 (#139), 37224478746 (#149), 37235698670 (#153)
**Depends on:** keine · **Perspektive:** Test-Determinismus · **Glossar: neue Begriffe:** nein

## Befund (gelesen auf `ea3eb9a`)

H13 Schritt 2 (`apps/web/e2e/031-http-betriebsart.spec.ts`, Klassifizierung) war dreimal rot im CI-Job `e2e-http`: ein
`GET /v1/speakers` fiel in A's Klassifizierungsfenster. Tabelle aus Lauf 37235698670 (Job 111534292313):

```
[H13] step 2 (classification): 3 request(s) in A
[H13] | GET | /v1/meeting | - | 179 |
[H13] | GET | /v1/speakers | - | 346 |
[H13] | GET | /v1/meeting | - | 471 |
```

Das ist genau das Lesemuster von `readStableSpeakerList` (`apps/web/src/features/speakers/useSpeakers.ts`: Sitzung, Liste,
Sitzung), also A's Reaktion auf die **Erfassung** unmittelbar vor Schritt 2, nicht auf die Klassifizierung.

## Ursache

- `quiet(trace, ms)` wartet, bis A seit seinem **letzten Lesezugriff** `ms` lang nichts gelesen hat. A's letzter Lesezugriff vor
  Schritt 2 stammt aus Schritt 1b, der schon mit `quiet(trace, 1_000)` endete; dazwischen liegen nur die vier
  Erfassungsanfragen aus einem dritten Kontext. `quiet(trace, 1_500)` vor der Klassifizierung wartet deshalb oft kaum noch.
- Die Erfassung (`ContributionCaptured`, `QuestionCaptured`) macht A's Sprecherliste zu Recht ungültig
  (`packages/domain/src/stream.ts` `EVENT_TOPICS`, `speakerListVersion`). Auf dem Postgres-Dienst kommt die Lieferung später als
  der Rest der Wartezeit (Hub-Neuladen mit 250 ms Abstand und 1-s-Takt, Client-Bündel 100 ms).
- Ausgeschlossen (Diagnose): die Klassifizierung macht Sprecher nicht ungültig (`QuestionClassified` hat die Themen meeting,
  questions, stage; `liveStore.test.ts` (d) pinnt das); kein Poll bei offenem Strom; kein Fokus-Neuladen.
- Im Projekt `in-process` nicht nachstellbar (H13 läuft nur im Projekt `http` mit IdP; die Demo liefert synchron).

## Ziel

In H13 Schritt 2 wird **vor** den Erfassungsanfragen ein Warten auf A registriert: A hat eine Antwort `GET /v1/speakers` (200)
erhalten, in der die neu angelegte Wortmeldung bereits die erfasste Einzelfrage zählt (`questionCount >= 1`). Nach dieser
Bedingung folgt das bestehende `quiet(trace, 1_500)`, dann öffnet das Klassifizierungsfenster wie bisher. Die Prüfung von Schritt 2
(kein Sprecher- und kein Beitrags-Lesezugriff nach der Klassifizierung) bleibt **unverändert**.

Gestalt der Antwort `/v1/speakers` (Liste oder `{ items }`) und den Feldnamen der Zählung aus `packages/contract/openapi.yaml`
lesen und genau eine Form behandeln. Zeitlimit des Wartens 5 s, Meldung bei Ablauf mit festem Text („A hat die Erfassung nicht
gelesen“).

## Nicht-Ziele

- Keine Änderung an Produktivcode (Store, Strom, Hub, Sprecherseite), keine `data-*`-Attribute.
- Keine längere feste Wartezeit (`waitForTimeout`), kein Lockern der Prüfung, keine Wiederholung des Tests.
- Andere Schritte von H13 und andere Tests in der Datei bleiben unverändert.

## Files allowed

- `apps/web/e2e/031-http-betriebsart.spec.ts` (nur H13 Schritt 2: das Warten vor `quiet(trace, 1_500)` und seine Registrierung)
- `docs/folgeliste.md` (nur den H13-Eintrag als erledigt markieren)
- diese Spec (Bericht, Review findings)

## Ausdrücklich nicht erlaubt

Produktivcode unter `apps/` und `packages/`, andere e2e-Dateien, `playwright.config.ts`, `scripts/`.

## Akzeptanzkriterium

1. Der CI-Job `e2e-http` des PR ist grün, H13 eingeschlossen; im Log zeigt die Tabelle „step 2 (classification)“ keinen
   Sprecher- und keinen Beitrags-Lesezugriff.
2. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).
3. Der Bericht nennt: die gelesene Form der Antwort `/v1/speakers`, die Stelle der Registrierung vor den Erfassungsanfragen und
   dass die Prüfung von Schritt 2 unverändert ist.

## Tests

Kein neuer Test; H13 selbst ist der Test. Rot vorher: die drei genannten CI-Läufe (nicht lokal nachstellbar, siehe Ursache).

## Wirkung und Risiko (niedrig)

Nur die Wartebedingung im Test ändert sich. Risiko: die Bedingung wird nie wahr (falsche Feldnamen) → Ablauf nach 5 s mit
klarer Meldung, im CI sichtbar. Laufzeit: höchstens die Zeit bis zur ohnehin kommenden Lieferung, im Mittel unter 1 s.

## Aufwand

0,5 AStd.

## Bericht

```
Slice: takt-044-h13-erfassungsfenster
Done: H13 Schritt 2 registriert vor den Erfassungsanfragen ein Warten auf A's GET /v1/speakers (200), dessen Liste die neue
      Wortmeldung mit questionCount >= 1 enthält (5 s, Meldung „A hat die Erfassung nicht gelesen“); danach das bestehende
      quiet(trace, 1_500). Prüfung von Schritt 2 unverändert. Folgeliste-Eintrag H13 als erledigt markiert.
Evidence: pnpm gates auf ba3193c (Exit 0), Schluss siehe unten; e2e-http (H13) nur im CI-Job des PR, kein Screenshot (Testcode).
Open: Akzeptanzkriterium 1 (CI-Job e2e-http grün, Tabelle step 2 ohne Sprecher-/Beitragslesen) erst mit dem PR; lokal nicht
      nachstellbar (H13 läuft nur im Projekt http mit IdP).
Touched: apps/web/e2e/031-http-betriebsart.spec.ts, docs/folgeliste.md, diese Spec
```

- Form der Antwort: `packages/contract/openapi.yaml`, `GET /v1/speakers` 200 → `type: array, items: Speaker`; `Speaker.questionCount`
  ist `integer` und nicht in `required`, daher `(row.questionCount ?? 0) >= 1`. Nur die Array-Form wird behandelt.
- Registrierung: direkt nach dem `GET /v1/speakers/{id}` des Erfassungskontexts und vor `POST /v1/contributions`; das Versprechen wird
  sofort zu `true/false` aufgelöst (keine unbehandelte Ablehnung, wenn ein früherer Schritt scheitert) und nach der Antwort von
  `POST .../questions` abgewartet, vor `quiet(trace, 1_500)`.
- Prüfung von Schritt 2 (`no speaker or contribution read after a classification`) unverändert.

Schluss von `pnpm gates` auf `ba3193c` (Exit 0):

```
slice-scope: 3 changed file(s), all within "docs/slices/takt-044-h13-erfassungsfenster.md"'s "Files allowed" list (3 pattern(s)).
...
✓ built in 1.51s
mark-test-run: wrote /home/user/wt/takt044/.claude/state/last-test-run (clean tree) at commit ba3193c, tree 5ad128ea8315…
```

## Nachweis CI (nach dem Bau)

- `e2e-http`, Lauf 37236866412 auf `5bcdee9`: H13 grün; die Tabelle von Schritt 2 enthält nur `GET /v1/meeting` (+276 ms), kein
  Sprecher- oder Beitragslesen.
- Auf `0505ce3`: alle 56 Fälle grün.
- Die Sonde `postgres-restart` des Stack-Jobs (stack-037a) war dort rot (bekannte Lücke beim Neustart von Postgres, nicht
  Ursache dieser Scheibe); Wiederholung grün. Eintrag in `docs/folgeliste.md`.
- Status: angenommen, gemergt als `d7020da` (#154). Akzeptanzkriterium 1 damit erfüllt.

## Review findings

Review in frischem Kontext: kein Blocker, kein Major.

- Minor: Die 5-s-Frist des Wartens beginnt bei der Registrierung und umfasst die drei Erfassungsanfragen. → `docs/folgeliste.md`
  (bei Rot die Frist nach dem Fragen-POST neu starten).
