# takt-041 — hono auf 4.13.7+ (Sicherheitshinweis GHSA-hxh3-vqpv-xpqv)

**Status:** spec · **Risikoklasse:** mittel (Abhängigkeitsänderung der Laufzeitbibliothek des Dienstes; Leitplanken §4: nicht „niedrig“, weil „niedrig“ nur Änderungen ohne Verhalten und Betrieb umfasst; kein Hoch-Auslöser: keine Rechte, kein Personenbezug, keine Persistenz, kein Deployment) · **Lanes:** api (nur Abhängigkeit) · **Perspektive:** Security
**Rolle:** builder; Review in frischem Kontext
**Regeln:** AGENTS.md R1, R2, R3, R11, R12; Plan 5.2 (Statische Sicherheitsanalyse, `pnpm audit:check`)
**Depends on:** keine
**Glossar: neue Begriffe:** nein

## Befund (gelesen auf `82ee43b`)

CI `gates` scheitert an `pnpm audit:check` (`scripts/audit-check.mjs`):
`#1240640 moderate hono (hono/jsx renders plain strings unescaped in boundary components, leading to XSS) — no exception entry`.
Der Hinweis ist GHSA-hxh3-vqpv-xpqv: verwundbar `<4.13.7`, behoben ab `>=4.13.7`. `apps/api/package.json` verlangt
`"hono": "^4.13.5"`, die Lockdatei löst 4.13.5 auf. Das Repository nutzt `hono/jsx` nicht (Suche nach `hono/jsx`
ohne Treffer außerhalb der Lockdatei); die Lücke ist also nicht erreichbar, der Weg ist trotzdem die Versionsanhebung.

## Ziel

`hono` in `apps/api/package.json` auf `^4.13.7` anheben; die Lockdatei ändert nur die hono-Einträge (und die
Peer-Auflösung von `@hono/node-server`). `pnpm audit:check` meldet den Hinweis nicht mehr.

## Nicht-Ziele

- Keine anderen Abhängigkeitsänderungen.
- Kein Ausnahmeeintrag in `scripts/audit-exceptions.json`.
- Kein Anwendungscode, kein Vertrag, keine Tests.

## Files allowed

- `apps/api/package.json`
- `pnpm-lock.yaml`
- diese Spec

## Akzeptanzkriterium

1. `apps/api/package.json` nennt `"hono": "^4.13.7"`; `pnpm-lock.yaml` löst hono auf eine Version `>=4.13.7` auf; der
   Lockdatei-Diff berührt nur hono und `@hono/node-server(hono@…)`.
2. `pnpm audit:check` ist grün (kein Hinweis zu hono, keine neue Ausnahme).
3. `pnpm gates` mit Postgres-Variablen ist grün, einschließlich slice-scope; der Schluss steht unter „Bericht“.

## Wirkung und Risiko (Leitplanken §4, mittel)

- **Kompatibilität:** Patch-/Minor-Anhebung innerhalb von 4.x; die vorhandenen API-Tests (HTTP, Strom, Postgres) laufen in `pnpm gates`.
- **Risiko:** Verhaltensabweichung in hono. Gegenmittel: die bestehende Testsuite des Dienstes.
- **Doku- und Betriebswirkung:** keine.

## Bericht

(folgt)

## Review findings
