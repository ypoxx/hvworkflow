# ADR 0002 — Demo-Betriebsart: Anwendungskern im Browser hinter dem Vertrag

**Status:** angenommen (2. September 2026), gilt für die Demo; wird durch die Produktivbetriebsart abgelöst.

## Kontext

Die Demo muss innerhalb eines Tages stehen, auf Netlify laufen und den Workflow Ende zu Ende zeigen.
Ein gehosteter Anwendungskern mit Datenbank ist in dieser Zeit nicht ohne Betriebsrisiko
aufzusetzen, und er würde Zugangsdaten in Reichweite der Agenten bringen (R9). Zugleich darf die
Demo die Architektur nicht vorwegnehmen oder verbauen (ADR 0001: Oberfläche koppelt an den Vertrag,
nicht an Logik).

## Entscheidung

- Der Anwendungskern (`packages/domain`) ist framework- und I/O-frei und läuft in Node **und** im
  Browser.
- Die Oberfläche spricht ausschließlich das Interface `HvApi`, das den OpenAPI-Vertrag 1:1 abbildet.
- In der Demo implementiert `createInProcessApi` dieses Interface im Browser; das Ereignisprotokoll
  wird im `localStorage` des Geräts gehalten. Jeder Browser hat damit seinen eigenen Stand.
- `apps/api` implementiert denselben Vertrag als HTTP-Dienst über demselben Kern. Der Wechsel der
  Oberfläche von In-Process auf HTTP ist ein Adaptertausch (`apps/web/src/api/`), keine Änderung
  an Ansichten oder Logik.
- Die Demo zeigt sichtbar „Demo-Betriebsart, Daten synthetisch, nur dieses Gerät".

## Folgen

- Die Demo ist ohne Server, ohne Datenbank, ohne Zugangsdaten lauffähig und unter Last schnell.
- Mehrere Personen sehen in der Demo nicht denselben Stand. Für die Vorführung an einem Bildschirm
  ist das unerheblich; für den Piloten ist der HTTP-Dienst mit Datenbank Voraussetzung.
- Nichts aus der Demo-Betriebsart darf in die Produktivbetriebsart übernommen werden außer dem
  Kern und dem Vertrag. Der `localStorage`-Adapter ist ausdrücklich Wegwerfcode.

## Verworfen

- **Netlify Functions mit Blob-Speicher als Backend.** Bringt einen zweiten, plattformspezifischen
  Persistenzpfad und Deployment-Risiko in der Nacht vor der Demo; gewinnt nur Mehrnutzer-Sicht.
- **Gehostete Postgres-Instanz.** Richtig für den Piloten, zu viel Betriebsaufwand und
  Zugangsdatenrisiko für die Demo.

## Ergänzung (vorgeschlagen, 23.09.2026; Annahme Prüfpunkt 1; e2e-Suite und Nachweis präzisiert 30.09.2026, Scheibe 031b)

**Status der Ergänzung:** vorgeschlagen · **Entscheider:** Eigentümer (Plan 4, Zeile 0002) · Der
bisherige Text dieses ADR bleibt unverändert; „angenommen" gilt für den bisherigen Teil.

Standardannahme aus Plan 3 („Taktfläche für Kleinänderungen") und Plan 4 (Zeile 0002):

- **Die Demo-Betriebsart bleibt bis beta-1 Taktfläche** für Kleinänderungen (E35).
  Staging-synthetisch bekommt Kleinänderungen mit dem nächsten Approval-Deploy, der Übungsmandant
  nur außerhalb des Freeze.
- **Wer mergt und wann die Demo baut, ist im Plan nicht widerspruchsfrei.** Plan 3 („Taktfläche
  für Kleinänderungen"): der Merge des Eigentümers ist das Go, die Pipeline baut die Demo. E48 und
  Plan 6.6: der Orchestrator mergt nach grünen Toren und unabhängigem Review, danach Netlify-Build.
  Übergangsregel des Eigentümers vom 23.09.2026: jeder Commit, auch der Squash-Merge des
  Orchestrators, trägt `[skip netlify]`; ein Demo-Build geschieht nur nach ausdrücklichem Go des
  Eigentümers. Die dauerhafte Regel ist offen (E35, E48, Prüfpunkt 1); ADR 0016 nennt denselben
  Konflikt.
- **Sie teilt mit der HTTP-Betriebsart eine gemeinsame e2e-Suite mit fester Dateiliste** (Dual-Mode-e2e-Matrix,
  B17; Fassung vom 30.09.2026, Scheibe 031b). Demo und HTTP teilen Kern, Vertrag und diese Suite:
  - **In beiden Projekten (`in-process` und `http`):** `abnahme.spec.ts`, `002-speakers-capture.spec.ts`,
    `021b-koordination.spec.ts`, `021c-rechtsfreigabe.spec.ts`, `080-sprecher-zustand.spec.ts`. Das sind die
    Dateien, die Verhalten des Dienstes berühren; Rollenwechsel über die gemeinsame Hilfe `asRole`.
  - **Nur im Projekt `http` (aus 031a):** `031-http-betriebsart.spec.ts` mit H1–H10 (Anmeldung, Isolation vom
    Demo-Protokoll, gleicher Ursprung, Abmeldung, Sperre, fehlende Rolle, echter 412, Aktualisierung ohne Neuladen,
    Abrufe je Einhängen) samt Wächtertest G1, und `030-anmeldung.spec.ts`.
  - **Nur im Projekt `in-process`, mit Grund:**

    | Datei | Grund |
    |---|---|
    | `001-shell.spec.ts` | prüft den Rollenumschalter selbst; den gibt es in der HTTP-Betriebsart nicht |
    | `003-answers-stage.spec.ts` | aus Aufwand nicht portiert; ein Test > 90 s, erst nach seiner Teilung (eigener Takt) Kandidat für eine Folgescheibe |
    | `010b-lesepfade.spec.ts`, `010c-lesezustand.spec.ts`, `010d-ansichtsdaten.spec.ts` | Fehlerinjektion im Browser-Kern bzw. Demo-Speicher für Lesezustände |
    | `013-tastaturpfad.spec.ts`, `020-rueckbau-passung.spec.ts`, `090-eingaben-je-akteur.spec.ts`, `takt-009-toast-kontrast.spec.ts` | Oberflächenverhalten mit Demo-Speicher oder Fehlerinjektion; aus Aufwand nicht portiert |
    | `024-ereignis-umschlag.spec.ts` | prüft das Demo-Protokoll selbst; Gegenstück in `http` ist H2 |
    | `028-konflikte.spec.ts` | 412 per Fehlerinjektion; echtes Gegenstück in `http` ist H8 |
- **Reset-Banner statt Upcaster.** Bei einem Schemawechsel des Ereignis-Umschlags (ADR 0011) zeigt
  die Demo bei altem `localStorage`-Protokoll ein Reset-Banner; es gibt keinen Upcaster für
  Demo-Protokolle.
- **Der `localStorage`-Adapter bleibt Wegwerfcode.** Nichts daraus geht in die Produktivbetriebsart
  außer Kern und Vertrag (unverändert aus dem bisherigen Teil).
- **Ende nach beta-1 durch Eigentümerentscheid.**

**Nachweis:** Scheibe 015 (dieser Text) und Scheibe 031b (Stand 30.09.2026):

- **PR-CI-Lauf 36685779155 auf Commit `a7d4d7f`:** Job `gates` mit Projekt `in-process` grün; Job `e2e-http` mit
  den Projekten `http-setup` und `http` grün, 28 Tests (G1 als erwarteter Fehlschlag), `abnahme.spec.ts` 37,8 s,
  `stageNavMs` 351,5 ms (Grenze 1 500 ms, nicht angehoben).
- **Reset-Banner, positiv (`in-process`):** `024-ereignis-umschlag.spec.ts` › „024: old demo log requires an
  explicit reset in German and English“ – bei altem Demo-Protokoll erscheint das Reset-Banner.
- **Isolation, negativ (`http`):** `031-http-betriebsart.spec.ts` › H2 („an old demo log is ignored in HTTP mode“) –
  das alte Protokoll unter `hv-demo-events-v1` wird ignoriert, es erscheint **kein** Reset-Banner. H2 ist
  ausdrücklich kein Reset-Banner-Test, sondern der Nachweis, dass die HTTP-Betriebsart das Demo-Protokoll nicht liest.

**Offene Eigentümerfrage (Prüfpunkt 1, Scheibe 031b):** Genügt die obige Liste (fünf gemeinsame Dateien plus die
HTTP-eigenen Tests aus 031a) für „dieselbe e2e-Suite“, oder sind die nur in-process laufenden Dateien in einer
Folgescheibe zu portieren? Bis zur Entscheidung gilt die Liste wie gebaut.

**Offene Registerzeilen:** E35 (Taktfläche nach Umstellung auf HTTP), E48 (Merge-Befugnis; dauerhafte
Regel für Demo-Builds, Prüfpunkt 1).
