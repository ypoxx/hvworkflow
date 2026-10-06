# takt-059 — Content-Security-Policy und keine Quellkarten für die öffentliche Demo

**Status:** gebaut · **Risikoklasse:** mittel (Sicherheitsheader einer öffentlichen, rein statischen Demo ohne Dienst, ohne
Zugangsdaten, nur synthetische Daten; Leitplanken §4) · ca. 1,5 AStd · **Lanes:** web, ops
**Rolle:** Implementierer Oberfläche baut; Review in frischem Kontext, Perspektive Sicherheit
**Regeln:** AGENTS.md R1, R2, R3, R11, R12; Bedrohungsmodell BF-06 (Web-Dokument ohne CSP), BF-25 (Quellkarten im öffentlichen
Build); Reviewer-Checkliste SP-4 (CSP).
**Depends on:** – · **Glossar: neue Begriffe:** nein

## Anlass

Der Eigentümer möchte den aktuellen Stand auf `hvtool.netlify.app` zeigen (06.10.2026). Seine Entscheidung vom 05.10.2026 lautet:
keine geteilte Umgebung vor einer Web-CSP. Auf die Frage „Erst CSP, dann live / sofort live / lokales Paket“ hat er am 06.10.2026
**„Erst CSP, dann live“** gewählt. Das ist das Go für die Veröffentlichung nach Merge dieses Takts. Die vollständige Scheibe 037b
(Pipeline mit Freigabe, CSP auch für den HTTP-Betrieb hinter nginx, Umgebungen) bleibt offen; dieser Takt deckt nur die
statische Demo auf Netlify.

## Ziel

1. **CSP für die Demo** in `netlify.toml` (`[[headers]] for = "/*"`), so streng wie der gebaute Demo-Stand zulässt. Ausgangspunkt:
   `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self';
   worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.
   Jede Lockerung (etwa `'unsafe-inline'` für Stile) nur mit nachgewiesenem Verstoß und Begründung im Bericht; `'unsafe-eval'`
   und fremde Hosts sind ausgeschlossen. Die vorhandenen Header bleiben.
   **Nachtrag nach dem Sicherheitsreview (Blocker, Entscheidung des Orchestrators, 06.10.2026):** zugelassen ist genau eine
   Lockerung, `style-src-attr 'unsafe-inline'`. Die Hervorhebung im Antwortfeld ist `execCommand('hiliteColor')`; Chrome
   schreibt dafür ein `style`-Attribut, das `style-src 'self'` sperrt (gespeichert, aber nicht gemalt). Begründung: ein
   Stilattribut führt kein Skript aus; `url()`-Abfluss bleibt durch `img-src`/`font-src 'self'` gesperrt; die Oberfläche hat
   keine HTML-Senke; eine Änderung am Editor am Vortag der Demo trägt mehr Risiko. `style-src 'self'` bleibt für Elemente und
   Dateien (keine `<style>`-Elemente, keine fremden Hosts). Die Lockerung entfällt, sobald die Hervorhebung über CSSOM oder
   eine Klasse gesetzt wird (Kandidat für die Folgeliste).
2. **Keine Quellkarten im Demo-Build**: `build.sourcemap` ist im Modus `demo` aus. Der HTTP-Modus bleibt, wie er ist (nginx
   blockiert `.map` dort bereits).
3. **Prüfung gegen den gebauten Stand, nicht den Dev-Server** (der injiziert Inline-Skripte): ein Playwright-Projekt
   `demo-build`, das den Demo-Modus mit `vite build` baut und mit `vite preview` ausliefert, die CSP **aus `netlify.toml`
   gelesen** (eine Quelle, kein Abschreiben) an jede Dokumentantwort hängt und über die Kernansichten geht: Wortmeldungen,
   Erfassung, Steuerung, Beantwortung, Meine Fragen, Bühne, Historie, Leitstand, Verwaltung, Sprachwechsel, Rollenwechsel,
   Tastaturkürzel-Dialog, dazu (Nachtrag) die Hervorhebung im Antwortfeld über die Werkzeugleiste in Beantwortung und mit
   Strg+Umschalt+H im Schreibmodus, die tatsächlich gemalt sein muss. Ein Test sammelt `securitypolicyviolation`-Ereignisse
   und Konsolenfehler und verlangt **null**.
   Ein zweiter Test belegt, dass die CSP tatsächlich greift (z. B. ein per `page.evaluate` eingefügtes Inline-Skript wird
   blockiert und erzeugt genau einen Verstoß). Ein dritter belegt, dass im gebauten `dist` keine `.map`-Datei liegt und kein
   `sourceMappingURL`-Kommentar.
4. **CI**: ein Schritt im Job `gates` nach dem bestehenden e2e-Schritt führt das Projekt `demo-build` aus (gleicher Filter für
   reine Doku-Commits wie die anderen e2e-Schritte).

## Nicht-Ziele

- Keine CSP für nginx/HTTP-Betrieb, keine Pipeline, kein Approval-Schritt (bleibt 037b).
- Keine Änderung an Netlify-Einstellungen; keine Veröffentlichung in diesem Takt (die folgt nach Merge durch den Orchestrator mit
  dem Go oben).
- Keine Änderung an Oberflächencode, außer ein Verstoß zwingt dazu (dann im Bericht begründet und minimal).

## Abnahme

- Die Tests aus Ziel 3 sind grün; der Wirksamkeitstest war ohne den Header rot.
- `pnpm gates` grün; das bestehende in-process-e2e unverändert grün.
- Screenshot `docs/evidence/takt-059-demo-csp.png` (gebauter Demo-Stand mit aktiver CSP, z. B. Leitstand).

## Files allowed

- `netlify.toml`
- `apps/web/vite.config.ts`
- `apps/web/playwright.config.ts`
- `apps/web/e2e/takt-059-demo-csp.spec.ts`
- `.github/workflows/gates.yml` (nur der neue Schritt)
- `docs/evidence/takt-059-demo-csp.png`
- `docs/slices/takt-059-demo-csp.md`

## Bericht

```
Slice: takt-059-demo-csp
Done: netlify.toml sendet für /* zusätzlich Content-Security-Policy (nur 'self'/'none'); die drei vorhandenen Header
      bleiben. vite.config.ts: build.sourcemap nur im HTTP-Modus, die Demo baut ohne .map. Playwright: E2E_DEMO_BUILD=1
      baut die Demo (vite build in node_modules/.e2e-demo-build-<pid>), liefert sie mit vite preview aus, einziges Projekt
      demo-build; e2e/takt-059-demo-csp.spec.ts liest die Header aus netlify.toml (kleiner Leser, scheitert bei
      Unbekanntem) und hängt sie per page.route an jede Dokumentantwort. D1 Kernansichten (Wortmeldungen, Erfassung,
      Historie, Steuerung, Leitstand, Beantwortung mit offenem Editor, Meine Fragen, Bühne, Verwaltung), Rollenwechsel,
      Sprachwechsel, Tastaturkürzel-Dialog und ein abgeschicktes Formular (Wortmeldung): null Verstöße, null
      Konsolenfehler. D2 Inline-Skript läuft nicht, genau ein Verstoß (script-src-elem), dazu eval verweigert (script-src).
      D3 kein .map, kein sourceMappingURL im gebauten Stand. gates.yml: ein Schritt nach dem e2e-Schritt, gleicher
      Doku-Filter. Kein Oberflächencode geändert.
CSP (final, netlify.toml):
      default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self';
      worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
      Lockerungen: keine (kein 'unsafe-inline', kein 'unsafe-eval', kein fremder Host). Eine Verschärfung gegenüber dem
      Ausgangspunkt: img-src ohne data:, weil der gebaute Stand kein data:-Bild enthält (CSS nur url(/assets/*.woff2),
      im JS kein data:image) und D1 ohne Verstoß bleibt. Stile: React setzt style-Props über CSSOM, das style-src nicht
      sperrt; Schriften liegen unter /assets. form-action 'none': alle sechs Formulare rufen preventDefault (D1 schickt
      eines ab).
Evidence: pnpm gates auf 1d56b8d (Code, Spec, Screenshot; dieser Bericht kam danach als reine Doku-Änderung hinzu):
      packages/domain test:       Tests  562 passed (562)
      apps/web test:       Tests  1162 passed (1162)
      apps/api test:       Tests  710 passed (710)
      i18n-literal check: 0 literals found under apps/web/src/features, apps/web/src/app.
      slice-scope: 7 changed file(s), all within "docs/slices/takt-059-demo-csp.md"'s "Files allowed" list (7 pattern(s)).
      # pass 359
      # fail 0
      dist/assets/index-CSiifmGG.js                        908.74 kB │ gzip: 262.96 kB
      ✓ built in 1.16s
      mark-test-run: wrote /home/user/wt/takt059/.claude/state/last-test-run (clean tree) at commit 1d56b8d, tree 7e756850da44…
      (Der Gates-Build ist der Netlify-Befehl pnpm --filter @hv/web build: keine Zeile "map:" mehr, vorher 3.632 kB map.)
      demo-build auf dem Stand von 1d56b8d (E2E_DEMO_BUILD=1 pnpm exec playwright test --project=demo-build):
        ✓  1 [demo-build] › … D1 core views, role switch, language switch, shortcuts dialog and one form: zero violations, zero console errors @screenshot (4.0s)
        ✓  2 [demo-build] › … D2 the policy is in force: an inline script and eval are refused, one violation each (648ms)
        ✓  3 [demo-build] › … D3 the demo build holds no source map and no sourceMappingURL comment (106ms)
        3 passed (9.0s)
      --repeat-each=2 und =3 ebenfalls grün; der CI-Befehl (pnpm --filter @hv/web exec playwright test --project=demo-build)
      lokal grün.
      D2 rot ohne Header (route.fulfill ohne die netlify.toml-Werte, vor dem Commit, danach zurückgesetzt):
        Error: the inline script ran
        Expected: false
        Received: true
        1 failed
      D3 rot mit build.sourcemap: true (vorübergehend, zurückgesetzt):
        Error: .map files … "…/web-build/assets/index-CSiifmGG.js.map"
        1 failed
      in-process-e2e (E2E_PORT=5259 pnpm --filter @hv/web e2e) auf cde8222, dem ersten Stand dieses Commits; 1d56b8d
      unterscheidet sich davon nur in e2e/takt-059-demo-csp.spec.ts (vom Projekt in-process ignoriert) und im PNG:
        3 skipped
        210 passed (10.4m)
      playwright test --list ohne Variable: "Total: 213 tests in 31 files", wie vor dem Takt.
      docs/evidence/takt-059-demo-csp.png: Leitstand im gebauten Demo-Stand unter der CSP (Koordination, DE).
Open: Review in frischem Kontext (Perspektive Sicherheit) steht aus. CSP für HTTP-Betrieb hinter nginx, Pipeline und
      Freigabe bleiben 037b. Die CSP kommt im Test per page.route nur an Dokumentantworten (Netlify setzt sie auf alle
      Antworten; für Skripte und Stile ohne Wirkung, Worker gibt es keine). Die Form der Konfiguration im Modus
      E2E_DEMO_BUILD ist nicht in scripts/e2e-http-031.test.mjs festgehalten (Datei nicht in Files allowed;
      Kandidat für docs/folgeliste.md).
Touched: netlify.toml, apps/web/vite.config.ts, apps/web/playwright.config.ts, apps/web/e2e/takt-059-demo-csp.spec.ts,
      .github/workflows/gates.yml, docs/evidence/takt-059-demo-csp.png, docs/slices/takt-059-demo-csp.md
```
