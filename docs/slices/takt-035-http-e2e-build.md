# takt-035 — HTTP-e2e gegen einen Produktions-Build statt gegen den Vite-Dev-Server

**Status:** spec · **Risikoklasse:** mittel (nur Testinfrastruktur, kein Produktivcode; verändert aber, wogegen die HTTP-Beweise laufen, und berührt die Header-Prüfung H3 aus 031a; kein Hoch-Auslöser nach Leitplanken §4: keine Identität, keine Rechte, keine Secrets, keine Netzgrenze des Produkts) · **Lanes:** e2e, infra
**Regeln:** AGENTS.md R1, R2, R12; Leitplanken §4 (Risikoklasse), Nachweis mit Ausgabe
**Ausgangspunkt:** Befund vom 30.09.2026 aus PR #87 (takt-033b) und PR #83 (031b). Das Projekt `http`
(`apps/web/playwright.config.ts`, gestartet von `scripts/e2e-http-031.mjs`, Spec 031a) startet `pnpm exec vite --port … --strictPort`,
also den Entwicklungsserver. `apps/web/src/main.tsx` rendert in `<StrictMode>`: im Dev laufen alle Mount-Effekte
doppelt (H10 in takt-033b sah 2× `GET /v1/stage` je Mount, Produktion 1×), und Module werden auf Anforderung
kompiliert, was Zeitprüfungen aufbläht (031b, Abnahme `/stage` nach Navigation: 2374 und 3402 ms gegen Grenze 1500 ms).
Die HTTP-Beweise sollen das Produktionsverhalten zeigen.
**Depends on:** 031a (gemergt); Reihenfolge zu takt-033b siehe „Abhängigkeit“.

## Ziel

1. Das Projekt `http` bedient ein Produktions-Bundle: `vite build` (mit `HV_WEB_MODE=http`, das ist ein Build-Zeit-`define`
   in `vite.config.ts`, der Wert muss also schon beim Bauen gesetzt sein), danach `vite preview` auf `E2E_HTTP_PORT`
   (`--port ${httpPort} --strictPort`). Die `webServer`-Zeile bleibt ein Eintrag mit `reuseExistingServer: false`;
   Befehl als `pnpm exec vite build --outDir <Ausgabe> --emptyOutDir && pnpm exec vite preview --outDir <Ausgabe> --port … --strictPort`.
2. Ausgabeverzeichnis: unter `E2E_HTTP_STATE_DIR` (privat, je Lauf; ohne diese Variable Fallback auf ein Verzeichnis
   unter `apps/web/` außerhalb von `dist/`), damit der Build weder `apps/web/dist` (Gates-Build, parallele Agenten) berührt
   noch dort Reste hinterlässt. Sourcemaps bleiben wie in `vite.config.ts` (`build.sourcemap: true`); keine Änderung des Produkt-Builds.
3. Gleicher Proxy gleicher Herkunft wie heute: `/v1` und `/auth` an `HV_API_ORIGIN`. Vite übernimmt `preview.proxy`
   standardmäßig aus `server.proxy`; der Umsetzer prüft das in der installierten Version. Trifft es zu, bleibt
   `vite.config.ts` unverändert; sonst trägt `preview` dieselbe, aus einer gemeinsamen Konstante gebildete Proxy-Tabelle
   (keine zweite Kopie der Pfade). Ports, Umgebung (`HV_WEB_MODE: 'http'`, `HV_API_ORIGIN`) und die Steuervariablen
   (`E2E_HTTP*`) bleiben unverändert.
4. Header und CSP unverändert: der Preview-Server setzt keine eigenen Sicherheitsheader; die Header der Antworten von
   `/auth` und `/v1` kommen weiterhin vom Dienst durch den Proxy (031a H3: kein `Access-Control-Allow-Origin`,
   `Content-Security-Policy` mit `default-src 'none'`, `X-Server-Time`). H3 bleibt unverändert grün. Die CSP des
   Web-Dokuments bleibt Nicht-Ziel (037).
5. Zeitbudget (031a): Projekt `http` ≤ 6 min, Job ≤ 12 min (harte Grenze 15). Der Build (Vite, erwartet wenige Sekunden;
   Gates-Build zuletzt 1,7–2,5 s) zählt in die 120 s `webServer.timeout` und in die Harness-Gesamtfrist. Die gemessene
   Dauer des Build-Schritts steht im Nachweis. Überschreitet sie 60 s, ist das ein Befund an dieser Spec, kein stilles Anheben der Fristen.
6. Das Projekt `in-process` bleibt auf dem Dev-Server (Port `E2E_PORT`/4173, `reuseExistingServer: true`), unverändert.
7. Kommentar in `playwright.config.ts` und Kopfkommentar von `e2e-http-031.mjs`/`031a` „HTTP-Modus = Vite-Entwicklungsserver“
   werden auf „Produktions-Build hinter `vite preview`“ berichtigt (Warum: StrictMode-Doppelung, Kompilierzeit).

## Nicht-Ziele

Kein Produktivcode (`apps/web/src`, `apps/api/src`, Vertrag). Keine Umstrukturierung der CI-Jobs oder Schrittgrenzen in
`.github/workflows/gates.yml`. Keine Änderung an Keycloak, Realm, Anmeldeablauf, Cookie- oder CSP-Logik. Kein Deploy, kein
Netlify-Build. Kein neuer Zeit-Tor (084). Keine Änderung des `in-process`-Projekts.

## Abhängigkeit zu takt-033b (H10)

H10 auf `claude/takt-033b-einhaengen-ohne-doppelabruf` (noch nicht gemergt) verzweigt heute über `/@vite/client`: Dev erwartet
2 `GET /v1/stage` je Mount, Build 1. Nach takt-035 gibt es im Projekt `http` keinen Dev-Server mehr, der Dev-Zweig ist tot.
**Der Dev-Zweig von H10 wird in dem der beiden Takte entfernt, der als zweiter gemergt wird** (H10 erwartet dann fest 1):
wird 035 zuerst gemergt, entfernt 033b ihn beim Rebase; wird 033b zuerst gemergt, entfernt 035 ihn. Dann ist in 035
`apps/web/e2e/…` (die Datei mit H10) ausnahmsweise Teil von Files allowed; die Entscheidung trifft der Orchestrator beim Merge,
der Umsetzer prüft zuerst, welcher Fall gilt, und vermerkt es im Bericht. Ein toter Zweig darf nicht stehen bleiben.

## Files allowed

- `docs/slices/takt-035-http-e2e-build.md`
- `apps/web/playwright.config.ts`
- `apps/web/vite.config.ts` (nur falls `preview.proxy` nicht von `server.proxy` übernommen wird)
- `scripts/e2e-http-031.mjs`
- `scripts/e2e-http-031.test.mjs`
- `docs/folgeliste.md`
- `apps/web/e2e/031-http-betriebsart.spec.ts` (nur: Prüfung „ausgelieferte Seite ist der Build“ als Zusicherung in H1 — kein `/@vite/client`, kein `/@react-refresh`, Skript unter `/assets/` —, und der Rückbau des H10-Dev-Zweigs, falls takt-033b vorher gemergt ist)

## Abnahme

1. `scripts/e2e-http-031.test.mjs` deckt den neuen `webServer`-Befehl und die Umgebung ab: Befehl enthält `vite build`,
   danach `vite preview` mit `--port <E2E_HTTP_PORT> --strictPort` und gleichem `--outDir`; kein `vite --port` (Dev) mehr im
   HTTP-Zweig; `env` bleibt genau `{ HV_WEB_MODE: 'http', HV_API_ORIGIN: … }`; der Demo-Zweig (ohne `E2E_HTTP`) bleibt
   `vite --port`. Bestehende Tests (Port-Vorgabe 4174, Steuervariablen) bleiben grün.
2. Prüfung, dass die ausgelieferte Seite der Build ist: ein Test im Projekt `http` (in einem eigenen Test der Harness-Tests
   oder als Zusicherung in einer bestehenden HTTP-Spec, ohne Produktcode) ruft `/` und den Modulverweis ab und stellt sicher:
   kein `/@vite/client`, kein `/@react-refresh`, Skript unter `/assets/…`. Fällt auf Dev zurück, schlägt er fehl.
3. `E2E_HTTP_IDP=none pnpm e2e:http` lokal (H1–H3 und die Tests aus `030` ohne `@idp`) grün; CI-Job `e2e-http` grün auf dem letzten Commit des PR.
4. Gemessene Dauer des Build-Schritts (Sekunden) und des Projekts `http` gesamt stehen im Nachweis; zum Vergleich die
   031b-Zeiten für `/stage` nach Navigation, falls 031b gemergt ist.
5. `pnpm gates` grün auf sauberem Commit (`slice-scope` akzeptiert die Dateiliste); Nachweis in eigenem Doku-Commit.
6. Folgeliste: Eintrag streichen bzw. ergänzen, falls ein Rest bleibt (etwa Deckung der CSP des Web-Dokuments, 037).

## Nachweis

Gates-Commit: `80f85ca` (`pnpm gates` Exit 0). Wörtlicher Schluss:

```
✓ built in 1.58s
mark-test-run: wrote /home/user/wt/t035/.claude/state/last-test-run (clean tree) at commit 80f85ca, tree 94f012a8ef4b…
```

- `vite preview` übernimmt `preview.proxy ?? server.proxy` (Vite 8.2.2, `chunks/node.js`); `vite.config.ts` bleibt unverändert.
- Build-Schritt (`vite build`, HTTP-Modus, ohne Cache-Vorwärmung): 3,3 s (Gates-Build 1,58 s, dort mit `tsc -b` davor).
- Lokal `E2E_HTTP_IDP=none pnpm e2e:http` grün: 8 Tests (G1 als erwarteter Fehlschlag), Projekt `http` 14,2 s, Harness gesamt 22 s.
- H1-Zusicherung gegen Dev geprüft: der Dev-Server liefert `/@vite/client` und `/@react-refresh` aus, die Zusicherung würde also fehlschlagen.
- In-process-Suite (`E2E_PORT=4235`): 127 grün, 8,0 min.
- Nur CI (Keycloak) beweist: `@idp`-Tests H4–H8 und `http-setup` gegen den Build, die Gesamtdauer des Jobs `e2e-http` und die Lauf-ID
  (noch offen, PR folgt).
- 031a-Spec Zeile 29 („Vite-Entwicklungsserver“) liegt außerhalb der Files allowed und ist nicht berichtigt.
- H10 (takt-033b) nicht angefasst: 033b ist noch nicht gemergt; der Dev-Zweig ist von dem der beiden Takte zu entfernen, der zuletzt gemergt wird.

**Orchestrator-Entscheidungen (30.09.2026) zu den offenen Fragen:** (1) H10 steht in `apps/web/e2e/031-http-betriebsart.spec.ts`
(Files allowed korrigiert). (2) Die Build-Prüfung ist eine Zusicherung in H1 derselben Datei, keine neue Spec-Datei.
(3) `.github/workflows/gates.yml` bleibt außerhalb; reicht das Zeitbudget nicht, ist das ein Befund mit Spec-Änderung.

## Review findings

Ergebnis: APPROVE, kein Blocker/Major.

1. Minor: Pfad im `webServer`-Befehl in einfachen Anführungszeichen (Injektionsnähe). Erledigt: `playwright.config.ts` wirft beim Laden, wenn der Build-Pfad `'` enthält; Test in `e2e-http-031.test.mjs`.
2. Minor: Fallback-Ausgabeverzeichnis ohne `E2E_HTTP_STATE_DIR` von parallelen Läufen geteilt. Erledigt: Suffix `process.pid` (`.e2e-http-build-<pid>`); Test prüft das Muster. Reste im ignorierten `node_modules` werden nicht aufgeräumt (nur lokaler Fallback, der Harness setzt immer das State-Verzeichnis).
3. Minor: 031a-Spec Zeile 29 nennt noch den Entwicklungsserver. Folgeliste (außerhalb Files allowed).
4. Nit: H1-Regex prüft `modulepreload`-Links nicht. Folgeliste (harmlos).

