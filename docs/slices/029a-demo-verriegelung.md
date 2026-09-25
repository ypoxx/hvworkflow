# 029a — Demo-Verriegelung des Dienstes (BF-01)

**Status:** review bestanden (25.09.)
**Risikoklasse:** hoch (Sicherheit) · 0,5 AStd · 25.09.2026 (W0, aus 029 vorgezogen) · Lanes: service
**Rolle:** Implementierer-Backend; Review in frischem Kontext (Perspektive Security, Sicherheits-Checkliste des Reviewers) (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 11, 12; ADR 0004 (Demo-Verriegelung); `docs/sicherheit/bedrohungsmodell.md` BF-01
**Quellen-IDs:** Plan-Scheibe 029 (Nachweise „X-Actor ohne Demo 401“, „HV_DEMO=1 mit Issuer → Start verweigert“); 039 Probe P1
**Depends on:** 010 (gemergt `d4c7393`), 023 (gemergt `daece57`)
**Perspektive:** Security · **Glossar: neue Begriffe:** nein

## Festlegung des Architekten

BF-01 (kritisch): `apps/api/src/app.ts` liest `X-Actor` bei jedem Aufruf, unabhängig von `HV_DEMO`; wer den Port
erreicht, ist jede Rolle. 029 baut den OIDC-Adapter, hängt aber an 026 und an E11 (IdP des Konzerns). Dieser Teil
braucht beides nicht und wird vorgezogen: **der Dienst schließt ohne Demo, statt zu vertrauen.**

- Ohne `HV_DEMO=1` gibt es heute **keinen** Anmeldeweg. Jeder Aufruf unter `/v1` antwortet 401 (Problem Details,
  Text nennt, dass `X-Actor` nur im Demo-Betrieb gilt und kein anderer Anmeldeweg eingerichtet ist). Der Header wird
  dann **nicht gelesen** (auch nicht zum Validieren). Beim Start ohne Demo schreibt `server.ts` einen Hinweis ins Log.
- `HV_DEMO=1` zusammen mit gesetztem `HV_OIDC_ISSUER` → `createApp` wirft beim Aufbau (Start verweigert), Text nennt
  beide Variablen. Das ist die Verriegelung aus ADR 0004, damit eine Umgebung mit echten Anmeldungen nie den
  Demo-Header annimmt. Option `oidcIssuer` in `CreateAppOptions` (Standard `process.env.HV_OIDC_ISSUER`), analog zu
  `demoEnabled`, damit Tests keine Umgebungsvariablen setzen.
- Die Auswahl steckt in `actor.ts` als kleiner Port: eine Funktion, die aus Optionen den Adapter wählt (`demoHeader`
  oder „keiner → 401“). 029 hängt später `sessionCookie` und `localBreakGlass` an dieselbe Stelle. Kein Rollenname im
  Code (Regel 4).
- Keine Vertragsänderung: 401 ist für die Operationen bereits beschrieben; falls der Vertragstest eine Operation ohne
  401 findet, im Bericht nennen, nicht den Vertrag ändern.

## Ziel

1. `app.ts`/`actor.ts`: Demo-Header nur bei Demo; sonst 401 ohne den Header zu lesen; Verriegelung Demo + Issuer.
2. `server.ts`: Log-Hinweis beim Start ohne Demo.
3. Tests (vor der Änderung rot, wo sinnvoll): `X-Actor` mit gültiger Rolle ohne Demo → 401 auf einem Lese- und einem
   Schreibpfad (Problem Details gegen den Vertrag geprüft); `createApp({ demoEnabled: true, oidcIssuer: '…' })` wirft;
   `createApp({ demoEnabled: false, oidcIssuer: '…' })` wirft nicht; Demo unverändert 200. Der bestehende Test
   „403: POST /v1/demo/seed … unless HV_DEMO=1“ antwortet ohne Demo nun 401; anpassen und im Namen sagen, dass die
   Anfrage schon an der Anmeldung scheitert.
4. `docs/sicherheit/bedrohungsmodell.md`: BF-01 Status „behoben (029a)“, geschlossene Stellen nennen; Rest (OIDC,
   Sperrliste, Notfallkonten) bleibt bei 029.

## Nicht-Ziele

Kein OIDC, keine Sitzung, kein Cookie, keine Sperrliste, keine Notfallkonten, kein Keycloak (alles 029). Keine Änderung
an Kern, Vertrag, Oberfläche. Die Web-Demo läuft In-Process (ADR 0002) und ist nicht betroffen.

## Files allowed

- `apps/api/src/app.ts`, `apps/api/src/actor.ts`, `apps/api/src/server.ts`
- `apps/api/src/__tests__/negative.test.ts`, `apps/api/src/__tests__/demo-lock.test.ts` (neu), `apps/api/src/__tests__/helpers.ts`
- `docs/sicherheit/bedrohungsmodell.md` (nur Zeile BF-01)
- `docs/slices/029a-demo-verriegelung.md`

## Akzeptanzkriterium

1. Neue Tests vor der Änderung rot (Ausgabe im Bericht), danach grün.
2. Probe P1 aus 039 wiederholt: `pnpm --filter @hv/api start` (ohne `HV_DEMO`) und `curl -H 'X-Actor: x:admin'
   localhost:PORT/v1/meeting` → 401; mit `HV_DEMO=1` → 200 (Ausgabe im Bericht; eigener Port).
3. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich). Wahrheitstabelle unverändert.

## Arbeitsweise

- Worktree `/home/user/wt/s029a`, Branch `claude/slice-029a-demo-verriegelung`.
- Logdateien nur über `mktemp`. Jeder Commit nennt „Scheibe 029a“ und endet mit `[skip netlify]`. Nicht pushen.

## Bericht

```
Slice: 029a-demo-verriegelung
Done: Ohne HV_DEMO=1 wählt selectAuthAdapter (actor.ts) den Adapter "keine Anmeldung": jeder /v1-Aufruf → 401,
      X-Actor wird nicht gelesen; HV_DEMO=1 + HV_OIDC_ISSUER → createApp wirft (Start verweigert), Option oidcIssuer.
      server.ts warnt beim Start ohne Demo; Tests in demo-lock.test.ts; BF-01 im Bedrohungsmodell "behoben (029a)".
Evidence: pnpm gates auf Commit 7fe34c3 (exit 0), Schluss siehe unten; keine Oberfläche, daher kein Screenshot.
Open: siehe unten (Vertragslücke 401, Rest von BF-01 bei 029).
Touched: apps/api/src/actor.ts, apps/api/src/app.ts, apps/api/src/server.ts,
         apps/api/src/__tests__/demo-lock.test.ts (neu), apps/api/src/__tests__/negative.test.ts,
         docs/sicherheit/bedrohungsmodell.md (Zeile BF-01), docs/slices/029a-demo-verriegelung.md
```

**Rot vor der Änderung** (`vitest run demo-lock.test.ts negative.test.ts`, Stand b33231b + neue Tests):

```
× 401: POST /v1/demo/seed without HV_DEMO=1 already fails at sign-in, before the demo check (slice 029a)
× 401 without demo: a valid X-Actor on a read path is not accepted
× 401 without demo: a valid X-Actor on a write path is not accepted
× 401 without demo does not read the header: a malformed X-Actor gets the same answer, not a parse error
× createApp refuses to start with demo mode and an OIDC issuer, naming both variables
Tests  5 failed | 19 passed (24)
AssertionError: expected 404 to be 401     (Lesepfad: Actor akzeptiert, nur noch keine Versammlung)
AssertionError: expected 201 to be 401     (Schreibpfad: Wortmeldung ohne Demo angelegt, BF-01 belegt)
AssertionError: expected 'Malformed X-Actor header "no-role-her…' to be 'No meeting exists yet.'
AssertionError: expected [Function] to throw an error
AssertionError: expected 403 to be 401
```

"createApp starts with an OIDC issuer when demo mode is off" und "demo mode is unchanged … 200" waren vorher schon
grün (sie sichern unverändertes Verhalten). Danach: `apps/api` 63/63 grün.

**Probe P1 wiederholt** (Ports 8911/8912/8913, Prozesse danach beendet):

```
$ PORT=8911 pnpm --filter @hv/api start
HV-Tool API listening on http://localhost:8911
HV-Tool API: demo mode is off (HV_DEMO is not 1) and no other sign-in is set up — every /v1 request is answered with 401; X-Actor is ignored.
$ curl -H 'X-Actor: x:admin' localhost:8911/v1/meeting
{"type":"urn:hv:problem:401","title":"Unauthorized","status":401,"detail":"No sign-in path is configured: the X-Actor header is accepted only in demo mode (HV_DEMO=1), and no other sign-in is set up."}
HTTP 401
$ HV_DEMO=1 PORT=8912 pnpm --filter @hv/api start ; curl -H 'X-Actor: x:admin' localhost:8912/v1/meeting
HTTP 200
$ HV_DEMO=1 HV_OIDC_ISSUER=https://idp.example.invalid PORT=8913 pnpm --filter @hv/api start
Error: Refusing to start: HV_DEMO=1 and HV_OIDC_ISSUER are both set. Demo mode trusts the X-Actor header and must never run next to a real sign-in; unset one of them.
exit 1
```

**`pnpm gates` auf Commit 7fe34c3** (exit 0; Testzahlen: domain 86, web 181, api 63; slice-scope: 7 Dateien, alle
in "Files allowed"), Schluss wörtlich:

```
✓ built in 2.08s
mark-test-run: wrote /home/user/wt/s029a/.claude/state/last-test-run (clean tree) at commit 7fe34c3, tree 4e63791a430e…
```

**Hinweise / offen:**

- Vertrag: die 0.2-Operationen `getMeeting`, `registerSpeaker`, `seedDemo` dokumentieren 401 nicht; das ist die
  bekannte, begründete Ausnahme `UNDOCUMENTED_STATUS_EXCEPTIONS` in `helpers.ts` (Lücke schließt 043). Vertrag nicht
  geändert. Die neuen Tests prüfen den Problem-Body mit `expectValidProblem` und laufen durch `req()` (Vertragsprüfung).
- Die Middleware hängt wie bisher an `*`: ohne Demo antwortet auch eine unbekannte Route mit 401 statt 404 (fail closed,
  verrät keine Routen).
- `server.ts` liest für den Log-Hinweis `HV_DEMO` selbst (gleiche Bedingung wie der Standard in `createApp`).
- Wahrheitstabelle (`transitions.ts`), Kern, Vertrag, Oberfläche unverändert. Rest von BF-01 (OIDC, Sperrliste,
  Notfallkonten, ADR-Nacharbeit) bleibt bei 029.

**Nachtrag des Orchestrators (Codex P1 auf PR #37):** Nach dem Review-Nachtrag (leerer Issuer verriegelt ebenfalls)
lief `pnpm gates` auf dem letzten Code-Commit `7057abb` erneut mit exit 0 (domain 86, api 63, web 181 Tests). Schluss:

```
✓ built in 2.04s
mark-test-run: wrote /home/user/wt/s029a/.claude/state/last-test-run (clean tree) at commit 7057abb, tree bbc13e281034…
```

## Review findings

Review in frischem Kontext (Security, Opus 5.5) auf `068f750`: **annehmen**, 0 Blocker, 0 Major, 5 minor, 1 nit.

- Minor 1 und 2 (leerer oder nur aus Leerzeichen bestehender `HV_OIDC_ISSUER` umging die Verriegelung; ein explizites
  `oidcIssuer: ''` verdrängte die Umgebungsvariable) betreffen die Sicherheit und werden deshalb in der Scheibe
  behoben (schlanker Modus: Sicherheitsbefunde nie auf die Folgeliste). Ein definierter Issuer zählt jetzt immer,
  auch leer; Test ergänzt. Behoben vom Orchestrator im Nachtrag-Commit.
- Minor 3–5 (Dateikopf `actor.ts`, Log-Hinweis in `server.ts` wertet `HV_DEMO` doppelt aus, Bedrohungs-ID T-G1-S-01
  und Missbrauchsfall fehlen in der Spec) und Nit 6 (401 für `seedDemo` nicht im Vertrag, 043) → `docs/folgeliste.md`.
