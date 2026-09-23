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

## Ergänzung (vorgeschlagen, 23.09.2026; Annahme Prüfpunkt 1)

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
- **Sie besteht dieselbe e2e-Suite wie die HTTP-Betriebsart** (Dual-Mode-e2e-Matrix, B17). Demo und
  HTTP teilen Kern, Vertrag und e2e-Suite.
- **Reset-Banner statt Upcaster.** Bei einem Schemawechsel des Ereignis-Umschlags (ADR 0011) zeigt
  die Demo bei altem `localStorage`-Protokoll ein Reset-Banner; es gibt keinen Upcaster für
  Demo-Protokolle.
- **Der `localStorage`-Adapter bleibt Wegwerfcode.** Nichts daraus geht in die Produktivbetriebsart
  außer Kern und Vertrag (unverändert aus dem bisherigen Teil).
- **Ende nach beta-1 durch Eigentümerentscheid.**

**Nachweis:** Scheibe 015 (dieser Text) und Scheibe 031 (e2e-Lauf beider Projekte grün, Test „altes
Demo-Protokoll → Reset-Banner"); der Reset-Banner-Test entsteht in 024.

**Offene Registerzeilen:** E35 (Taktfläche nach Umstellung auf HTTP), E48 (Merge-Befugnis; dauerhafte
Regel für Demo-Builds, Prüfpunkt 1).
