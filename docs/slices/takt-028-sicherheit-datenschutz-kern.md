# takt-028 — Sicherheit und Datenschutz im Kern: Umschlag, Rollenfelder, Maskierung, Fehlertexte

**Status:** Bau · **Risikoklasse:** hoch (personenbezogene Daten, Audit/Ereignislog, Leitplanken §4) · **Lanes:** core,
service (nur `eventLog.ts`), web-api (nur Demo-Log-Laden und Startfehler) · **Perspektive:** Datenschutz, Security
**Regeln:** AGENTS.md R1–R3, R7, R8, R12; ADR 0009, ADR 0011; Sicherheits-Checkliste SC-07, SC-11, SP-2
**Ausgangspunkt:** Nachprüfung der Codex-Scheiben (29.09.2026), Befunde, die nach AGENTS.md R3 nicht auf die Folgeliste
gehören (Codex P1 auf #66; Liste am Ende von `docs/folgeliste.md`, Abschnitt „Sicherheit und Datenschutz aus der
Nachprüfung“). Dieser Takt nimmt die Kern- und Protokollpunkte; die Anmeldepunkte folgen in takt-029, Grenzen und
Timeouts in 034, die Vertragsbeschreibung von `Claim.personId` in 033b.

## Ziel

1. **Umschlag aus benannten Feldern (024, SC-07).** `stampEvent` in `packages/domain/src/envelope.ts` übernimmt heute
   `...rest` des Aufrufer-Ereignisses ungefiltert in Umschlag und Hash. Neu: der Umschlag wird per Whitelist aus den im
   Ereignistyp benannten Feldern gebaut; unbekannte Felder werden abgewiesen (fester Fehler, kein stilles Verwerfen, damit
   ein Programmfehler auffällt). Optionale Umschlagfelder (`personId`, `causationId`, `idempotencyKey`, `commandId`,
   `commandOperation`, `commandResource`) werden auf Typ und Länge geprüft (Grenzen am Code festlegen, z. B. 128 Zeichen;
   `idempotencyKey` 1–128 wie in der Domäne). Hash und Kette bestehender Ereignisse ändern sich nicht (Fingerabdruck-
   und Paritätstests prüfen).
2. **Fehlertexte ohne Rohdaten (024, SC-11).** Ein `JSON.parse`-Fehler beim Laden des Ereignislogs
   (`apps/api/src/eventLog.ts`, Demo-Log in `apps/web/src/api/index.ts`, Anzeige im Startbildschirm) wird auf einen
   festen Text mit Zeilen- bzw. `seq`-Angabe abgebildet; der V8-Text mit Auszug der Rohzeile erscheint nirgends.
3. **Rollenfelder ohne Klartext-PII (026).** `assignRole`: `deputyForSubjectId` bekommt dieselbe Pseudonym-Prüfung wie
   `subjectId` (keine `@`, keine Leerzeichen, Länge). `revokeRole.reason`: Länge begrenzt (am Code festlegen, z. B. 500)
   in der Domäne mit 422; keine Vertragsänderung in diesem Takt, die Vertragsgrenze (`maxLength`) zieht 034 nach.
4. **Rekursive Maskierung (026).** `maskEvent` in `packages/domain/src/api.ts` entfernt Klarnamen und `personId` heute
   nur auf der obersten Payload-Ebene. Neu: rekursiv in allen verschachtelten Objekten und Arrays der Payload
   (`displayName`, `organisation`, `pii`, `personId`), mit Test je Ereignisform, die verschachtelte Akteure trägt
   (Freigabe, Rechtsfreigabe, Antwort). Ein Ereignis ohne `hash` wirft keinen ungefangenen Fehler mehr, sondern führt zu
   einem definierten Integritätsfehler (fester Text, `seq`), der Abonnenten nicht abbricht.

## Nicht-Ziele

Keine Vertragsänderung, keine Änderung an `apps/api/src/app.ts` (Anmeldepunkte in takt-029), keine Rechteänderung, keine
Migration bestehender Ereignisse (R7: nichts wird umgeschrieben), keine Grenzen für HTTP-Bodies (034).

## Files allowed

- `docs/slices/takt-028-sicherheit-datenschutz-kern.md`
- `packages/domain/src/envelope.ts`, `packages/domain/src/api.ts`, `packages/domain/src/events.ts` (nur Typen für die Whitelist, falls nötig)
- `packages/domain/src/__tests__/**` (neue und betroffene Tests; feste Fingerabdrücke nur ändern, wenn nachweislich unverändert gültig)
- `apps/api/src/eventLog.ts`, `apps/api/src/__tests__/eventLog024.test.ts`
- `apps/web/src/api/index.ts`, `apps/web/src/app/BootScreen.tsx` (nur Fehlertext), `apps/web/src/i18n/shell.de.ts`, `apps/web/src/i18n/shell.en.ts`, `apps/web/src/i18n/parity.test.ts`, `apps/web/src/api/*.test.ts`

## Abnahme

1. Tests zuerst, je Ziel mindestens ein Negativtest: unbekanntes Umschlagfeld → fester Fehler, kein Ereignis; zu langes
   optionales Feld → Fehler; kaputte JSONL-Zeile → Fehlertext ohne Rohinhalt (Marker in der Zeile taucht nicht auf);
   `deputyForSubjectId` mit E-Mail → 422, kein Ereignis; zu langer `reason` → 422; verschachtelter `displayName` in einer
   Ereignis-Payload erscheint in `listEvents`/Historie nicht; Ereignis ohne `hash` → definierter Fehler, Abonnent läuft weiter.
2. Seed-Fingerabdruck, Hash-Testvektor und Paritätstests unverändert grün (Nachweis, dass bestehende Ereignisse gleich
   gehasht werden).
3. `pnpm gates` grün auf sauberem Commit; Abschnitt „Nachweis“ mit Gates-Commit und wörtlichem Schluss (eigener
   Doku-Commit, kein Amend danach).

## Vor dem Bau prüfen

`envelope.ts` (`stampEvent`, `verifyEventChain`, Hash-Vektor), `api.ts` (`maskEvent`, `assignRole`, `revokeRole`,
`subscribe`), `eventLog.ts`, `apps/web/src/api/index.ts`, `BootScreen.tsx`, alle Tests mit festen Zahlen
(`grep -rn toMatchFileSnapshot`, Seed-Fingerabdruck, i18n-Parität). Weicht der Code ab oder fehlt eine Datei in „Files
allowed“: melden und anhalten.

## Nachweis

`pnpm gates` lief auf Commit `7687e0cddd36b30d198bd2883f67b9c79fd05d59` (sauberer Baum, Exit 0). Schluss der Ausgabe, wörtlich:

```
dist/assets/index-CA8a643A.css                        42.33 kB │ gzip:   9.09 kB
dist/assets/index-Mf8hIXSv.js                        619.40 kB │ gzip: 181.39 kB │ map: 2,557.45 kB

[plugin @tailwindcss/vite:generate:build] [33m[SOURCEMAP_BROKEN] [0mSourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 2.84s
mark-test-run: wrote /home/user/wt/takt-028/.claude/state/last-test-run (clean tree) at commit 7687e0c, tree 9443a37e6b57…
```

## Review findings

folgt
