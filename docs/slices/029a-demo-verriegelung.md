# 029a — Demo-Verriegelung des Dienstes (BF-01)

**Status:** spec
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

## Review findings
