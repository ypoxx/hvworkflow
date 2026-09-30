# takt-030 — Eigene Schreibvorgänge im HTTP-Modus sofort sichtbar

**Status:** gebaut, Review durch · **Risikoklasse:** mittel (Verhaltensänderung im Web, ohne Hoch-Auslöser; Leitplanken §4) · **Lanes:** web, e2e · **Perspektive:** Qualität/Betrieb
**Regeln:** AGENTS.md R2 (Nachweis), R4 (kein Rollenname), R6 (nur `HvApi`, kein Ad-hoc-`fetch`), R8, R12; ADR 0002 (zwei Betriebsarten, gleiches Verhalten)
**Depends on:** 031a (gemergt; Projekt `http`, Datei `031-http-betriebsart.spec.ts`). Der Unit-Test hängt nicht davon ab; der e2e-Test schon.
**Ausgangspunkt:** 031a-Test H8 musste die Seite neu laden, um die eigene neue Wortmeldung zu sehen. 031b lässt fünf
gemeinsame Szenarien in beiden Betriebsarten laufen und braucht dafür sichtbare eigene Schreibvorgänge ohne Neuladen.
Kein Eintrag im Produktplan nötig: Takts stehen dort nicht (plan-graph prüft nur nummerierte Scheiben).

## Befund (Ist-Stand, gelesen)

- Ansichten holen ihre Daten neu, wenn `useApiVersion()` (`apps/web/src/api/useApiVersion.ts`) zählt; der Zähler hängt an
  `subscribeToChanges` → `HvApi.subscribe` (`apps/web/src/api/index.ts`). Beispiele: `features/speakers/useSpeakers.ts`,
  `capture`, `answers`, `history`, `stage`, `app/useMeeting.ts`.
- Im Demo-Adapter (`packages/domain/src/api.ts`, `subscribe`) meldet der Speicher jedes angehängte Ereignis sofort.
  Deshalb sehen Demo-Nutzer ihren Schreibvorgang ohne Zutun.
- Im HTTP-Adapter (`apps/web/src/api/http.ts`, `createHttpApi.subscribe`) ruft nur ein 30-s-Takt die Hörer mit `[]`
  auf (nur sichtbarer Tab, nur mit bestätigter Sitzung). Nach einem eigenen erfolgreichen Schreiben ruft nichts die Hörer.
  Die Ansicht bleibt bis zu 30 s veraltet.

## Ziel

1. **Benachrichtigung nach erfolgreichem Schreiben.** In `createHttpApi` ruft der Hilfsaufruf `write` nach einer
   erfolgreichen Antwort (2xx) alle registrierten Hörer mit `[]` auf, dieselbe Form wie der 30-s-Takt. Reihenfolge: erst
   `writeEtag` setzen (geschieht schon in `perform`), dann Hörer aufrufen, damit `lastWriteEtag()` beim Neuladen aktuell ist.
2. **Nie bei Fehlschlag.** Kein Aufruf bei 4xx/5xx, Netzfehler, fehlender Sitzung (lokal abgelehntes Schreiben) oder
   abgelehntem `updateSpeaker` mit `reason` (422 ohne Anfrage). Ein 412 darf die Ansicht nicht verändern; das Veraltet-Banner
   und der unbestätigte Text bleiben, wie 031a H8 es prüft.
3. **Ein Hörer, der wirft, bricht weder das Schreiben noch die übrigen Hörer ab** (try/catch je Hörer, Fehler wird
   verschluckt; der Schreibvorgang gilt als erfolgreich, denn der Server hat ihn angenommen).
4. **Kein Vertrag, kein Domänencode, keine Übergangstabelle.** Die Ansichten bleiben unverändert; sie reagieren schon auf
   den Zähler. Nur lesende Aufrufe lösen nichts aus (keine Schleife: Neuladen ist ein GET und benachrichtigt nicht).

## Nicht-Ziele

- Keine Live-Aktualisierung durch andere Nutzer (Polling schneller stellen, SSE): eigene spätere Scheibe. Der 30-s-Takt bleibt unverändert.
- Keine Vertragsänderung. Offene Frage nur dann, wenn der Bau zeigt, dass ein Lesepfad fehlt (nach Lesen: `listSpeakers`,
  `listQuestions`, `listContributions`, `getStage` und `listEvents` genügen; nichts fehlt).
- Kein Eingriff in den Demo-Adapter, in `index.ts`, in `useApiVersion` oder in einzelne Seiten. Demo-Verhalten unverändert.
- Keine Änderung am ETag- und 412-Ablauf und keine optimistische Anzeige (die Anzeige kommt aus der neu geholten Projektion).

## Files allowed

- `docs/slices/takt-030-eigene-schreibvorgaenge.md`
- `apps/web/src/api/http.ts` (nur `write` und ein Hilfsaufruf zum Benachrichtigen in `createHttpApi`)
- `apps/web/src/api/http.test.ts` (neue Tests zu Ziel 1–3)
- `apps/web/e2e/031-http-betriebsart.spec.ts` (neuer Test H9; in H8 nur ein etwaiges Neuladen zum Sichtbarmachen entfernen)
- `docs/folgeliste.md` (nur der 031a-Eintrag zum Neuladen in H8 als erledigt; nicht blockierende Reviewbefunde)
- `docs/evidence/031-h9-eigene-schreibvorgaenge.png` (Screenshot H9; Präfix 031-, damit der Upload `docs/evidence/031-*.png` im Job e2e-http ihn mitnimmt)

Weitere Dateien sind Scope-Befunde.

## Akzeptanzkriterium

1. **Unit-Test zuerst rot, dann grün** (`apps/web/src/api/http.test.ts`, gefälschter `fetcher` und Hörer per `vi.fn()`):
   (a) `registerSpeaker` mit 201 → Hörer genau einmal mit `[]` aufgerufen, erst nach dem Antworten; `lastWriteEtag()` ist
   dann bereits gesetzt (der Hörer liest ihn selbst);
   (b) je ein Schreibaufruf mit 403, 412, 500, Netzfehler und ohne CSRF-Token → Hörer nicht aufgerufen;
   (c) ein GET (`listSpeakers`) → Hörer nicht aufgerufen; ohne Hörer kein Fehler;
   (d) zwei Hörer, der erste wirft → der zweite wird aufgerufen, das Schreiben löst auf;
   (e) der 30-s-Test („emits polling impulses …“) bleibt unverändert grün.
2. **e2e (Projekt `http`, in `031-http-betriebsart.spec.ts`, Test H9):** Rolle mit Recht zum Anlegen legt auf der
   Wortmeldungsseite über die Oberfläche eine Wortmeldung an; sie erscheint in der Liste **ohne** `page.reload()` und
   ohne Warten auf den 30-s-Takt (Erwartung mit Timeout deutlich unter 30 s, z. B. 5 s). Kein `page.reload()`, kein
   `page.goto` zwischen Anlegen und Prüfen. Screenshot `docs/evidence/031-h9-eigene-schreibvorgaenge.png`. Der e2e-Lauf
   ist Sache der PR-CI (`e2e-http`); lokal nur, was die Bauumgebung ohne Keycloak zulässt (31a Entscheidung 15).
3. **Demo unverändert:** Projekt `in-process` und alle vorhandenen Web-Unit-Tests grün, kein Diff in
   `packages/domain/`, `apps/web/src/api/index.ts`, `useApiVersion.ts`.
4. `pnpm gates` grün auf sauberem Commit, Abschnitt „Nachweis“ mit Gates-Commit und wörtlichem Schluss (eigener
   Doku-Commit, gezielt stagen, kein Amend). Vor dem PR: `slice-scope` akzeptiert nur die Dateien oben.

## Wirkung und Risiko (Leitplanken §4, mittel)

- Betrieb: ein zusätzliches Lesen pro sichtbarer Ansicht nach jedem eigenen erfolgreichen Schreiben. Mehrfache
  Ansichten (z. B. Wortmeldungen plus Verlauf) laden je einmal neu; das liegt weit unter den Grenzen aus 034a/034b
  (Schreib- und Lesegrenze je Sitzung). Falls der 429-Wächter aus 031a in e2e anschlägt, ist das ein Befund, kein Grund,
  die Grenze zu erhöhen.
- Nebenläufigkeit: Nach dem Neuladen hält die Ansicht die neue Version und damit den neuen ETag. Das ist gewollt; ein
  zweiter Schreiber mit altem ETag bekommt weiter 412 (H8 schreibt über einen getrennten Request-Kontext und ist unberührt).
- Kein Hoch-Auslöser: keine Identität, Rechte, Daten oder Persistenz berührt. Ist das beim Bau anders, gilt hoch und
  das ist ein Scope-Befund.

## Vor dem Bau prüfen

`apps/web/src/api/http.ts` (`write`, `subscribe`, `perform` mit `onWriteEtag`), `features/speakers/useSpeakers.ts`
(`reload`, `useApiVersion`), `031-http-betriebsart.spec.ts` nach dem Merge von 031a (H8). Weicht der Code ab oder fehlt eine
Datei: melden und anhalten.

## Nachweis

Gates-Commit: 04180a5 (sauberer Baum)

Wörtlicher Schluss von `pnpm gates`: 

```
✓ built in 1.53s
mark-test-run: wrote /home/user/wt/t030/.claude/state/last-test-run (clean tree) at commit 04180a5, tree e9af3e2072fb…
(Exit-Status 0)
```

Lokal gelaufen: Unit-Tests `http.test.ts` (58 grün), Projekt `in-process` (127 grün), Projekt `http` ohne Keycloak (`E2E_HTTP_IDP=none`, 8 Tests, H1–H3 grün, G1 wie vorgesehen rot). H9 und H8 tragen `@idp` und laufen nur in der PR-CI (kein Docker-Daemon lokal); H9 ist per `--list` gelistet und typgeprüft. Screenshot `031-h9-eigene-schreibvorgaenge.png` kommt aus dem CI-Artefakt `evidence-031-http`.

Nachweis PR-CI (Keycloak): Job `e2e-http` im Lauf 36659515442 auf `a4eb67a` grün, darin H8 (ohne Neuladen der Liste) und H9.
Screenshot `031-h9-eigene-schreibvorgaenge.png` im Artefakt `evidence-031-http` (ID 11074490024,
`sha256:1fb2514d517b1dc0a39f6052c1b0dce6551c1179b3cf8f87887fb4719a50906b`, gültig bis 29.12.2026). Offen: die PNG-Datei
liegt nur im Artefakt, nicht unter `docs/evidence/` (Download-Host durch den R11-Hook gesperrt; der Eigentümer kann sie
aus dem Lauf übernehmen).

## Review findings

Review in frischem Kontext (Opus, nur Spec und Diff), Urteil: mergefähig nach grünem `e2e-http` und Befund 1.

1. major (Nachweis) · Screenshot H9 fehlte im Diff · H9 und H8 liefen grün im PR-Job `e2e-http` (Lauf 36659515442, Commit a4eb67a); der Screenshot liegt im Artefakt `evidence-031-http` (Nachweis unten). Die PNG-Datei selbst ist nicht im Repo: das Herunterladen vom Artefakt-Host sperrt die Repo-Richtlinie (R11-Hook), wie schon bei 031a · offen, siehe Nachweis.
2. minor · Kommentar vor dem zweiten `page.reload()` in H8 war veraltet · Kommentar neu gefasst; das Neuladen selbst bleibt auf der Folgeliste.
3. minor · Test (a) prüft „nicht vor der Antwort“ nur synchron; Reihenfolge bei 204 nicht festgenagelt · Folgeliste.
4. minor (vorbestehend) · 2xx mit nicht lesbarem Rumpf setzt das ETag, lehnt ab und benachrichtigt nicht · Folgeliste.
5. nit · Polling-Schleife ruft Hörer ohne try/catch (anders als der Schreibpfad) · Folgeliste.
6. nit · Dateikopf nannte nur H8 als schreibend · behoben.
7. nit · Status und Review-Abschnitt der Spec · behoben.

Nachlauf nach der Umbenennung des Screenshots (Orchestrator): `pnpm gates` auf `54cf368` (sauberer Baum), Exit 0. Wörtlicher Schluss:

```
✓ built in 1.88s
mark-test-run: wrote /home/user/wt/t030/.claude/state/last-test-run (clean tree) at commit 54cf368, tree 86559f330497…
```

Nachlauf nach den Review-Befunden: `pnpm gates` auf `9b019c4` (sauberer Baum), Exit 0. Wörtlicher Schluss:

```
✓ built in 1.66s
mark-test-run: wrote /home/user/wt/t030/.claude/state/last-test-run (clean tree) at commit 9b019c4, tree 439c14f46f0c…
```
