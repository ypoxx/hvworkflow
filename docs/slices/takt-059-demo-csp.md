# takt-059 — Content-Security-Policy und keine Quellkarten für die öffentliche Demo

**Status:** in Arbeit · **Risikoklasse:** mittel (Sicherheitsheader einer öffentlichen, rein statischen Demo ohne Dienst, ohne
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
2. **Keine Quellkarten im Demo-Build**: `build.sourcemap` ist im Modus `demo` aus. Der HTTP-Modus bleibt, wie er ist (nginx
   blockiert `.map` dort bereits).
3. **Prüfung gegen den gebauten Stand, nicht den Dev-Server** (der injiziert Inline-Skripte): ein Playwright-Projekt
   `demo-build`, das den Demo-Modus mit `vite build` baut und mit `vite preview` ausliefert, die CSP **aus `netlify.toml`
   gelesen** (eine Quelle, kein Abschreiben) an jede Dokumentantwort hängt und über die Kernansichten geht: Wortmeldungen,
   Erfassung, Steuerung, Beantwortung, Meine Fragen, Bühne, Historie, Leitstand, Verwaltung, Sprachwechsel, Rollenwechsel,
   Tastaturkürzel-Dialog. Ein Test sammelt `securitypolicyviolation`-Ereignisse und Konsolenfehler und verlangt **null**.
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
