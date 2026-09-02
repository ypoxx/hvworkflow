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
