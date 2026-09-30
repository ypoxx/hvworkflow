# takt-033b — Kein Doppelabruf beim Einhängen: useApiVersion zählt nur bei echtem Akteurwechsel

**Status:** spec · **Risikoklasse:** mittel (Verhaltensänderung im Web, kein Hoch-Auslöser; Leitplanken §4) · **Lanes:** web, e2e · **Perspektive:** Betrieb (Last), Qualität
**Rolle:** web-implementer; Review in frischem Kontext (Perspektive Lesezustand 010c/010d), Modell nur in `.claude/agents/`
**Regeln:** AGENTS.md R2, R4 (kein Vergleich mit einem Rollennamen), R6, R12; ADR 0002; Slice 010c (Lesezustand je Ladevorgang), 010d (Ansichtsdaten gehören dem Schlüssel des Akteurs)
**Depends on:** keine Code-Abhängigkeit. takt-030 (PR #82) ändert nur, wann die Hörer von `subscribeToChanges` feuern; `useApiVersion` und H10 sind davon unabhängig (H9 wird nicht berührt, H10 wird ans Dateiende gehängt).
**Aufgeteilt aus:** takt-033 (`docs/slices/takt-033-kette-einmal-pruefen.md`, Dienst, hoch). Die beiden Teile sind im Code unabhängig.
**Quellen-IDs:** Diagnoselauf für Scheibe 031b, gemessen gegen Postgres am 30.09.2026; `apps/web/e2e/abnahme.spec.ts:257` (Grenze 1500 ms)

## Befund (Ist-Stand, gelesen auf `5a013f9`)

- `apps/web/src/api/useApiVersion.ts:14` erhöht den Zähler in einem Effekt mit der Abhängigkeit `[actor]`. Dieser
  Effekt läuft auch beim Einhängen. Jede Ansicht lädt deshalb zweimal: einmal mit `version` 0 im ersten Render, einmal
  mit `version` 1 nach dem Effekt. Im Client wird die erste Antwort über den Ladeschlüssel verworfen (010c), aber der
  Server beantwortet beide Anfragen. Beispiel Bühne: `features/stage/Page.tsx:267-326` (`getStage`) und `:328-350`
  (`listQuestions`-Probe); dasselbe in `useSpeakers.ts`, `useCapture.ts`, `answers/lib.ts`, `answers/useBacklog.ts`,
  `history/lib.ts`, `history/Page.tsx`, `capture/Page.tsx` und `app/useMeeting.ts`.
- Im HTTP-Modus setzt `setSessionActor` (`api/actor.ts:57-61`) nach jedem `/auth/me` ein **neues** Actor-Objekt
  (`api/auth.ts:68`, Auffrischen alle 20 min und bei jedem Sichtbarwerden des Tabs, `app/App.tsx:111-121`). Der
  Effekt vergleicht nach Identität und zählt deshalb auch ohne echten Wechsel hoch. Alle sichtbaren Ansichten laden
  dann neu.
- `main.tsx` rendert in `StrictMode`. Ein „erster Lauf“-Ref allein genügt daher nicht: Im Entwicklungsmodus laufen
  Effekte beim Einhängen zweimal.
- Zusammen mit den dreifach geprüften Snapshots am Dienst (takt-033) ergibt das 2374 ms für `/stage` nach der
  Navigation im CI-Projekt `http`; die Grenze liegt bei 1500 ms.

## Ziel

1. **Kein Hochzählen beim Einhängen.** Der Zähler startet bei 0 und zählt beim Einhängen nicht. Gezählt wird nur bei
   neuen Ereignissen (`subscribeToChanges`, unverändert) und bei einem **echten** Akteurwechsel.
2. **Echter Akteurwechsel = strukturell anderer Akteur.** Die Entscheidung trifft eine reine Funktion in
   `useApiVersion.ts`, Vorschlag `actorChanged(previous, next)`. Sie vergleicht alle Felder des `Actor` (`id`, `role`,
   `displayName`, `personId`, `unitId`, `assignmentScoped`, und jedes künftig hinzukommende Feld); jedes abweichende Feld zählt als Wechsel. Verglichen werden zwei Werte
   miteinander, nie mit einem Rollen-Literal (R4, `pnpm role-literals` bleibt grün). Ein Rollenwechsel bei gleicher
   `id` zählt also als Wechsel (takt-023, Rollenverlust), ein neues, gleiches Objekt nach `/auth/me` nicht.
3. **Zeitpunkt unverändert.** Der Wechsel wird weiter im Effekt nach dem Commit gezählt, so wie heute. Der zuletzt
   gesehene Akteur liegt in einem Ref, der im Effekt verglichen und gesetzt wird; unter `StrictMode` ist das
   idempotent. Die Lücke zwischen Akteurwechsel und Hochzählen, auf die sich 010c und 010d stützen (`isCurrentLoad`,
   `keyBelongsTo`, Dialoge nach `actorId`), bleibt damit genau wie heute. Ein Zählen während des Renderns ist
   ausdrücklich nicht gewählt.
4. **Nichts sonst.** Keine Änderung an den Ansichten, an `http.ts`, am Demo-Adapter oder am Dienst.

## Nicht-Ziele

- Keine Änderung an Ladeschlüsseln, `readVerdict` oder den Kopien in den Features (010c/010d bleiben).
- Kein Zusammenlegen der drei GETs in `readStableSpeakerList`, kein Cache im Web, keine Änderung am 30-s-Takt.
- Keine Änderung an der Grenze in `abnahme.spec.ts`, keine Entscheidung zu E41.
- Keine neue Testabhängigkeit (jsdom, Testing Library). Die Logik ist eine reine Funktion, die Verdrahtung belegt der
  e2e-Test H10.

## Files allowed

- `docs/slices/takt-033b-einhaengen-ohne-doppelabruf.md`
- `apps/web/src/api/useApiVersion.ts`
- `apps/web/src/api/useApiVersion.test.ts` (neu)
- `apps/web/e2e/031-http-betriebsart.spec.ts` (nur neuer Test H10)
- `docs/folgeliste.md` (nicht blockierende Reviewbefunde)
- `docs/evidence/031-h10-einhaengen-ein-abruf.png` (Präfix 031-, damit der Upload im Job e2e-http ihn mitnimmt)

Weitere Dateien sind Scope-Befunde. Braucht eine Ansicht doch eine Anpassung, weil sie sich auf das Hochzählen beim
Einhängen verlassen hat, ist das ein Befund. Dann melden und anhalten, nicht erweitern.

## Akzeptanzkriterium

1. **Unit-Test zuerst rot, dann grün** (`useApiVersion.test.ts`, reine Funktion aus Ziel 2):
   (a) dasselbe Objekt → kein Wechsel; (b) neues Objekt mit gleichen Feldern → kein Wechsel; (c) andere `id` →
   Wechsel; (d) gleiche `id`, andere Rolle → Wechsel; (e) gleiche `id`, anderes `personId` oder `unitId` → Wechsel;
   (f) optionales Feld fehlt einmal und ist einmal gesetzt → Wechsel.
2. **e2e H10 `@idp`** (Projekt `http`, `031-http-betriebsart.spec.ts`): Angemeldet mit einer Rolle, die die Bühne
   lesen darf, navigiert der Test auf `/stage`. Er zählt per `page.on('request')` die GETs auf `/v1/stage` und auf
   `/v1/questions` ab dem Navigationsbeginn, wartet, bis die Bühne ihren Inhalt zeigt, und danach auf Ruhe im Netz.
   Erwartet wird **genau 1** `GET /v1/stage` und **genau 1** Probe `GET /v1/questions?limit=1` (heute je 2). Danach löst
   ein `visibilitychange` ein `/auth/me` ohne Akteurwechsel aus; es folgt **kein** weiterer `GET /v1/stage`.
   Screenshot `docs/evidence/031-h10-einhaengen-ein-abruf.png`. Der e2e-Lauf ist Sache der PR-CI (`e2e-http`).
3. **Demo und Rollenwechsel unverändert:** Projekt `in-process` grün, besonders `010c-lesezustand.spec.ts`,
   `010d-ansichtsdaten.spec.ts` und `090-eingaben-je-akteur.spec.ts` (Rollenwechsel lädt neu, keine Daten der
   vorigen Rolle). Alle Web-Unit-Tests grün. Kein Diff außerhalb der Dateien oben.
4. `pnpm gates` grün auf sauberem Commit, Abschnitt „Nachweis“ mit Gates-Commit und wörtlichem Schluss (eigener
   Doku-Commit, gezielt stagen, kein Amend). `slice-scope` akzeptiert nur die Dateien oben.
5. **Späterer Nachweis, nicht Teil dieser Abnahme:** Zusammen mit takt-033 hält `/stage` nach der Navigation die
   Grenze von 1500 ms im Projekt `http` (`abnahme.spec.ts:257`, Lauf aus 031b).

## Wirkung und Risiko (Leitplanken §4, mittel)

- Last: Beim Einhängen jeder Ansicht fällt ein Lesen weg, ebenso beim Auffrischen der Sitzung ohne Wechsel. Weniger
  Druck auf die Lesegrenze je Sitzung (034a).
- Korrektheit: Das Risiko ist eine Ansicht, die nach einem echten Wechsel **nicht** neu lädt. Der strukturelle
  Vergleich zählt jede Feldänderung als Wechsel und ist damit strenger als nötig, nicht lockerer. Der Rollenverlust bei
  gleicher `id` ist in Test 1 (d) abgedeckt.
- Zeitpunkt des Hochzählens unverändert (Ziel 3), deshalb keine neue Lücke im Lesezustand. Das prüfen 010c/010d-e2e.
- Kein Hoch-Auslöser: keine Rechte (die entscheidet weiter der Dienst), keine Persistenz.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: mittel
Ausgelöst: [x] Oberfläche (Ladeverhalten) [x] Betrieb (Last)
Perspektive(n): Qualität/Betrieb · Nachweise: Unit-Test, e2e H10 in der PR-CI, Screenshot · Offene Entscheidung: E41 unberührt

## Vor dem Bau prüfen

Nach dem Merge von takt-030: `useApiVersion.ts`, `api/actor.ts` (`setSessionActor`, `useActor`), `api/auth.ts`
(`onActorChange`), `app/App.tsx` (Auffrischen), `031-http-betriebsart.spec.ts` (H8, H9, Anmelde-Helfer). Außerdem
suchen, ob eine Ansicht `version === 0` oder das Hochzählen beim Einhängen als Signal nutzt (z. B. `stageRef` in
`stage/Page.tsx`). Weicht der Code ab oder fehlt eine Datei, melden und anhalten.

## Nachweis

Gates-Commit `505cfc0`, `pnpm gates` grün. Wörtlicher Schluss:

```
✓ built in 3.65s
mark-test-run: wrote /home/user/wt/t033b/.claude/state/last-test-run (clean tree) at commit 505cfc0, tree d2d931042400…
```

Unit-Test erst rot (6 von 6, `actorChanged` fehlte), dann grün. `pnpm --filter @hv/web e2e`, Projekt in-process: 127 passed. H10 läuft nur in der PR-CI (`e2e-http`); der Screenshot `031-h10-einhaengen-ein-abruf.png` entsteht dort. Diese Änderung hat keine sichtbare Oberfläche.

Nachlauf nach dem ersten PR-CI-Lauf (Lauf 36668137833: H10 sah zwei `GET /v1/stage` je Einhängen). Ursache: Das Projekt
`http` läuft gegen den Vite-Dev-Server, `<StrictMode>` führt Einhänge-Effekte dort doppelt aus; ein Produktions-Build tut
das nicht. H10 erwartet deshalb 2 im Dev- und 1 im Build-Modus (erkannt an `/@vite/client`); der alte Fehler (Zählen beim
Einhängen) ergäbe 3 und bleibt rot. Der Dev-Zweig entfällt mit takt-035 (Projekt `http` gegen Produktions-Build). Der Dev-Zweig in H10 wurde nach takt-035 entfernt; H10 erwartet genau 1 Abruf.
`pnpm gates` auf `92bcba8`, sauberer Baum, Exit 0.

Nachlauf nach Merge von takt-035 (Dev-Zweig in H10 entfernt): `pnpm gates` auf `0134d57`, sauberer Baum, Exit 0, mit
Postgres. H10 selbst braucht Keycloak und läuft nur in der PR-CI (`e2e-http`). Wörtlicher Schluss:

```
✓ built in 1.97s
mark-test-run: wrote /home/user/wt/t033b/.claude/state/last-test-run (clean tree) at commit 0134d57, tree c44d91fba931…
```

**Bildnachweis nach E56 (AGENTS.md R2, Eigentümer 30.09.2026).** H10 läuft nur gegen Keycloak im Job `e2e-http`; der
Screenshot `031-h10-einhaengen-ein-abruf.png` liegt im CI-Artefakt, nicht im Repo:
Artefakt `evidence-031-http`, Lauf `36674923822` (Commit `579d656`, Job `e2e-http` grün, H10 mit genau einem Abruf je
Einhängen), Artefakt-ID `11079413526`, Digest `sha256:ce4a7bf4aec920e95b4e801deab8bd005173f83b4fd9cc5c34c959213c6c8c24`.

## Review findings

Review in frischem Kontext (reviewer-sonnet, nur Spec und Diff, f33b1fd): **freigegeben**, kein Blocker, kein Major.
Rechte bleiben aktuell: Ein Rechtewechsel ändert `role` am Akteur und zählt; Rollenverlust läuft über `onUnauthorized`.

1. minor · `useApiVersion.ts:31-34`, `App.tsx:111-121` · Der Refresh bei `visibilitychange` lud bisher alle Ansichten neu;
   jetzt bleibt eine im Hintergrund gewesene Ansicht bis zum nächsten 30-s-Takt alt (der Takt läuft nur sichtbar) ·
   Folgeliste: Polling-Hörer einmal beim Sichtbarwerden auslösen.
2. minor · H10 · nach dem Sichtbarkeitswechsel wird nur `/v1/stage` geprüft, nicht die Probe · Folgeliste.
3. minor · H10 · `networkidle` nach `/auth/me` ist eine Ruhezeit-Heuristik (in 031b gezeigt: nach dem ersten Leerlauf
   wartet sie nicht mehr); ein Doppelabruf entstünde im selben Takt nach dem Rendern und würde gezählt · Folgeliste:
   auf ein Produktsignal statt `networkidle` warten.
4. nit · `useApiVersion.test.ts:19` `_unused` · Lint grün (Gates).
5. nit · Rot-zuerst nur in Prosa belegt · keine Änderung.

**Nachlauf auf dem integrierten Commit `f9a8409`** (Basis mit takt-034, takt-036 und Doku eingemergt), `pnpm gates` mit
Postgres-Variablen, sauberer Baum, Exit 0. Wörtlicher Schluss:

```
✓ built in 1.71s
mark-test-run: wrote /home/user/wt/t033b/.claude/state/last-test-run (clean tree) at commit f9a8409, tree 835dd5ee1624…
```
