# Scheibe 031b — Gemeinsame e2e-Szenarien in beiden Betriebsarten und Nachweis für ADR 0002

**Status:** spec (nach Lesebefund 30.09.2026 aus der Teilung von 031)
**Risikoklasse:** mittel · 1 AStd · 28.10.2026 (W5) · Lanes: e2e; docs-adr nur Architekt
**Rolle:** Implementierer-Oberfläche; Architekt für die ADR-0002-Ergänzung (Lane docs-adr, „nur Architekt“, Plan 5.1); unabhängiges Review in frischem Kontext (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** keine neue fachliche Regel, keine Änderung an Produktcode, Vertrag, `ROLE_PERMISSIONS` oder Übergangstabelle; AGENTS.md R2 (Nachweis), R4 (Rollennamen nur in Testhilfen)
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/031b (Teil 2 der am 30.09.2026 geteilten Scheibe 031); ADR 0002 Ergänzung („besteht dieselbe e2e-Suite“, „Reset-Banner statt Upcaster“, Nachweis „Scheibe 031“); Lesebefund zu 031 vom 30.09.2026 (M4, m15, n24); Leitplanken §4
**Depends on:** 031a (gemergt; Harness, Projekte `http-setup`/`http`, Job `e2e-http`)
**Perspektive:** Qualität/Betrieb · **Glossar: neue Begriffe:** nein

## Warum mittel

031b ändert nur Testdateien und eine ADR-Ergänzung. Identität, Sitzung, Geheimnisse, CI-Job und Netzgrenze liegen in
031a; 031b nutzt sie unverändert. Verhalten wird nicht geändert, aber das Pflicht-Tor prüft danach mehr: das ist eine
Verhaltensänderung der Tore ohne Hoch-Auslöser (Leitplanken §4 „mittel“). Berührt 031b beim Bau doch Harness,
`playwright.config.ts` über die Dateiliste hinaus oder den CI-Job, ist das ein Scope-Befund.

## Ziel und Entscheidungen vor Bau

Die fünf Dateien, die Verhalten des Dienstes berühren, laufen in beiden Projekten; der ADR-0002-Nachweis steht.

1. **Gemeinsame Dateien (feste Liste):** `abnahme.spec.ts`, `002-speakers-capture.spec.ts`, `021b-koordination.spec.ts`,
   `021c-rechtsfreigabe.spec.ts`, `080-sprecher-zustand.spec.ts`. `playwright.config.ts` nimmt sie in `testMatch` des
   Projekts `http` auf (nicht im lokalen Modus `E2E_HTTP_IDP=none`, dort fehlen angemeldete Zustände) und setzt für
   `http` den Standard-`storageState` `capture` (entspricht der Standardperson der Demo, `DEMO_ACTORS[1]`); `030` und
   die Tests H1–H3 aus 031a setzen weiter ausdrücklich einen leeren Zustand, H4–H8 ihren eigenen.
2. **Rollenwechsel.** `apps/web/e2e/support/roles.ts` stellt `asRole(page, role)` bereit: `in-process` über den
   Rollenumschalter wie heute; `http` durch Ersetzen der Cookies durch die der Rolle aus `http-setup`, Neuladen und Warten
   auf die Rollenanzeige der Sitzung. Die fünf Dateien nutzen nur noch diese Hilfe (ihre eigenen `asRole`-Kopien bzw.
   Umschalterklicks entfallen). Erwartet ein Test Oberflächenzustand über einen Rollenwechsel hinweg, stellt er ihn danach
   in beiden Projekten ausdrücklich her.
3. **Nachweisbilder.** `apps/web/e2e/support/evidence.ts`: im Projekt `in-process` wie heute nach `docs/evidence/`; im
   Projekt `http` schreiben die fünf gemeinsamen Dateien in das Testausgabeverzeichnis (sonst überschrieben beide Projekte
   dieselben Bilder). Gestaged werden nur benannte Pfade, nie `git add -A`/`git add .`; neu erzeugte Bilder ohne
   inhaltliche Änderung werden mit `git restore` verworfen.
4. **Feste Reihenfolge im Projekt `http`, gepinnt.** Dateiordnung nach Pfad, ein Worker: `002-speakers-capture.spec.ts`,
   `021b-koordination.spec.ts`, `021c-rechtsfreigabe.spec.ts`, `030-anmeldung.spec.ts`, `031-http-betriebsart.spec.ts`,
   `080-sprecher-zustand.spec.ts`, `abnahme.spec.ts`. `scripts/e2e-http-031.test.mjs` erweitert die Listenprüfung aus
   031a auf genau diese Reihenfolge. Jede gemeinsame Datei muss gegen den Datenbankzustand grün sein, den ihre Vorgänger
   hinterlassen (siehe „Vor dem Bau prüfen“ 2).
5. **Halteregel Laufzeit.** Die Zeitgrenzen im Test (`answersFilterMs`, `stageNavMs` < 1 500 ms) gelten in beiden
   Projekten. Dauert `abnahme.spec.ts` im Projekt `http` länger als 120 s, wird angehalten und die Spec geklärt; kein
   Timeout und keine Grenze wird still angehoben. Das `http`-Projekt insgesamt bleibt ≤ 6 min, der Job `e2e-http` ≤ 12 min
   (Budget aus 031a).
6. **Texte für die Zugriffslog-Prüfung.** Die Fragetexte und Redebeiträge aus `abnahme.spec.ts` und
   `002-speakers-capture.spec.ts` wandern in `apps/web/e2e/support/e2e-texts.ts` (aus 031a); die Dateien importieren sie
   von dort, damit Harness-Stufe 6 sie als verbotene Texte im Zugriffslog prüft.
7. **Reset-Banner in beiden Betriebsarten (ADR 0002).** `in-process`: `024-ereignis-umschlag.spec.ts`, Test „024: old
   demo log requires an explicit reset in German and English“; `http`: H2 aus 031a. Beide stehen namentlich im Nachweis.
8. **Nicht portierte Dateien (Standard, ehrlich begründet).** Nur `in-process`, unter „Offen“ im Bericht:

   | Datei | Grund |
   |---|---|
   | `001-shell.spec.ts` | prüft den Rollenumschalter selbst (gibt es im HTTP-Modus nicht) |
   | `003-answers-stage.spec.ts` | aus Aufwand nicht portiert; ein Test > 90 s, erst nach der Teilung (eigener Takt) Kandidat für eine Folgescheibe |
   | `010b`, `010c`, `010d` | Fehlerinjektion im Browser-Kern bzw. Demo-Speicher für Lesezustände |
   | `013-tastaturpfad.spec.ts`, `020-rueckbau-passung.spec.ts`, `090-eingaben-je-akteur.spec.ts`, `takt-009-toast-kontrast.spec.ts` | Oberflächenverhalten mit Demo-Speicher oder Fehlerinjektion; aus Aufwand nicht portiert |
   | `024-ereignis-umschlag.spec.ts` | Demo-Protokoll selbst; Gegenstück H2 |
   | `028-konflikte.spec.ts` | 412 per Fehlerinjektion; echtes Gegenstück H8 |

9. **ADR-0002-Ergänzung (Architekt).** Der Architekt ersetzt in der Ergänzung „Sie besteht dieselbe e2e-Suite wie die
   HTTP-Betriebsart“ durch eine Fassung, die die Liste aus Entscheidung 1 und 8 nennt, und trägt den Nachweis ein
   (PR-CI-Lauf mit beiden Projekten, beide Reset-Banner-Tests). Die Planzeile ADR 0002 (§4) und
   `docs/produktplan-beta.md` bleiben unverändert, außer der Stand-Zeile nach dem Merge.

## Nicht-Ziele

Kein Harness-, Keycloak-, CI- oder Sicherheitsumbau (031a). Keine Portierung der Dateien aus Entscheidung 8. Keine
Teilung von 003 (eigener Takt). Keine Änderung an Produktcode. Keine neuen Screenshots als Nachweis außer der Sichtung,
dass die `in-process`-Bilder unverändert bleiben.

## Files allowed

- `docs/slices/031b-e2e-gemeinsame-szenarien.md`
- `apps/web/playwright.config.ts` (nur Dateiliste und Standardzustand des Projekts `http`)
- `apps/web/e2e/support/roles.ts` (neu)
- `apps/web/e2e/support/evidence.ts` (neu)
- `apps/web/e2e/support/e2e-texts.ts` (nur Texte der gemeinsamen Dateien ergänzen)
- `apps/web/e2e/abnahme.spec.ts`, `apps/web/e2e/002-speakers-capture.spec.ts`, `apps/web/e2e/021b-koordination.spec.ts`, `apps/web/e2e/021c-rechtsfreigabe.spec.ts`, `apps/web/e2e/080-sprecher-zustand.spec.ts` (nur Rollenwechsel- und Nachweishilfe, Texte aus der Konstante, ausdrückliches Wiederherstellen von Zustand nach Rollenwechsel)
- `scripts/e2e-http-031.test.mjs` (nur Erweiterung der Reihenfolgeprüfung)
- `docs/adr/0002-demo-betriebsart-in-process.md` (nur Abschnitt „Ergänzung“: Wortlaut zur gemeinsamen Suite und Nachweis; **geschrieben vom Architekten**, nicht vom Implementierer; steht hier, damit dessen Commit auf dem Baubranch das Scheibenumfang-Tor passiert)
- `docs/folgeliste.md` (nur nicht blockierende Reviewbefunde dieser Scheibe)
- `docs/produktplan-beta.md` (nur Stand-Zeile Etappe B nach dem Merge)

Weitere Dateien sind Scope-Befunde: erst Spec klären, nicht still ausweichen.

## Vor dem Bau prüfen

1. 031a gemergt, `e2e-http` auf dem Integrationszweig grün; Standardzustände je Rolle liegen nach `http-setup` vor.
2. **Reihenfolge gegen geteilten Zustand:** jede gemeinsame Datei in der Reihenfolge aus Entscheidung 4 grün, gegen den
   Zustand, den ihre Vorgänger hinterlassen (ein PR-CI-Lauf oder ein Probelauf im Job, Keycloak gibt es lokal nicht).
   Beispiele: `021c` wählt die erste Frage „in Prüfung“ mit Rechtsfreigabe-Knopf; `abnahme` läuft die Bühnenschlange bis
   zur eigenen Frage (höchstens 130 Runden) und darf durch in `021c` bereitgestellte Fragen nicht über die Grenze kommen.
3. `apps/web/src/api/http.ts` implementiert jede `HvApi`-Methode, die die fünf Dateien auslösen; Zählerwartungen
   (`CORPUS_DEMO.questions`) gelten gegen den Bootstrap aus 031a.
4. Die Laufzeit der fünf Dateien im Projekt `in-process` darf sich durch den Umbau nicht messbar verlängern.

## Tests zuerst und Abnahme

1. Die Reihenfolgeprüfung in `scripts/e2e-http-031.test.mjs` zuerst rot (Liste erweitert, Konfiguration noch nicht).
2. `pnpm gates` auf sauberem Baucommit grün; `in-process` vollständig grün.
3. PR-CI: `gates` und `e2e-http` grün; die fünf Dateien im Projekt `http` grün; Laufzeit von `abnahme` im Projekt `http`
   ≤ 120 s (Halteregel); Laufzeiten beider Projekte.
4. ADR-0002-Ergänzung vom Architekten vor dem Merge; liegt sie zu Baubeginn nicht vor, baut der Implementierer ohne sie,
   der Merge wartet darauf.
5. Unabhängiges Review in frischem Kontext; Blocker/Major vor Merge, übrige Befunde in `docs/folgeliste.md`. Jeder Commit
   nennt „Scheibe 031b“ und endet `[skip netlify]`.

## Nachweise

`pnpm gates`-Schluss; e2e-Laufzeiten beider Projekte mit Lauf-ID; Laufzeit von `abnahme` im Projekt `http`; die beiden
Reset-Banner-Tests; ADR-0002-Ergänzung mit Nachweis.

## Nachweis

(nach dem Bau ausfüllen)

**Gates-Commit:** `<sha>`, `pnpm gates` auf sauberem Baum, Exit 0.

```
<Schluss einfügen>
```

| Lauf | Projekt | Tests (bestanden/übersprungen) | Laufzeit |
|---|---|---|---|
| lokal | `in-process` | | |
| PR-CI Lauf `<id>`, Job `gates` | `in-process` | | Job gesamt: |
| PR-CI Lauf `<id>`, Job `e2e-http` | `http-setup` + `http` | | Job gesamt: ; `abnahme`: |

Reset-Banner: `024-ereignis-umschlag.spec.ts` › „024: old demo log requires an explicit reset in German and English“
(`in-process`), `031-http-betriebsart.spec.ts` › H2 (`http`).

## Bericht (nach Bau ausfüllen)

```
Slice: 031b-e2e-gemeinsame-szenarien
Done: <drei Zeilen>
Evidence: Baucommit <sha>; Schluss von `pnpm gates`; Laufzeiten beider Projekte; PR-CI-Lauf <id>
Open: nicht portierte Dateien (Entscheidung 8), 003 nach dem Teilungstakt Kandidat; Eigentümerfrage 1
Touched: <Dateiliste>
```

## Offene Eigentümerfragen

1. **ADR 0002, Prüfpunkt 1 (eng).** Genügt für „besteht dieselbe e2e-Suite“ die Liste aus Entscheidung 1 (fünf
   gemeinsame Dateien plus die HTTP-eigenen Tests aus 031a), oder verlangt der Eigentümer die Portierung der Dateien aus
   Entscheidung 8 als Folgescheibe? Gebaut wird auf dem ersten Fall.

## Lesebefund vor dem Bau

Aus dem Lesebefund zu Spec 031 (Opus, 30.09.2026; 5 major, 12 minor, 9 nits) gelten für 031b: M4 (feste Reihenfolge
Entscheidung 4, Prüfung gegen den Zustand der Vorgänger „Vor dem Bau prüfen“ 2, Halteregel 120 s Entscheidung 5), M5
(Teilung; 031b ist Teil 2), m15 (ehrlicher Grund für 003, Entscheidung 8), n24 (Eigentümerfrage eng gefasst), n25
(Texte der gemeinsamen Dateien in der Konstante, Entscheidung 6). Alle übrigen Befunde betreffen 031a und sind dort
abgearbeitet. Ein eigener Lesebefund zu 031b vor dem Bau ist bei Klasse mittel nicht Pflicht.

## Review findings

folgt
