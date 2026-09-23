# Vorlage zur Annahme von ADR 0001 — Schichtung und Kopplung

**Für:** Prüfpunkt 1 am 09.10.2026 (Registerzeile E42) · **Vorbereitet:** Scheibe 009 am 23.09.2026
**Entscheider:** Umsetzer und Projektleitung · **Gegenstand:** [`0001-schichtung-und-vertragskopplung.md`](0001-schichtung-und-vertragskopplung.md)
in unveränderter Fassung

## Worum es geht

ADR 0001 steht auf „vorgeschlagen". Seit Scheibe 009 gilt er operativ als Leitplanke
(`docs/qualitaetsleitplanken-produktreife.md`, Abschnitt 1.3): Jede Scheibe hält die drei Grenzen ein,
eine Verletzung ist im Review ein Blocker. Die Annahme macht daraus eine Entscheidung mit Datum und Namen;
danach verschiebt nur ein neuer ADR eine Grenze.

## Was angenommen wird

1. **Oberfläche gegen Anwendung — der Vertrag.** Die Oberfläche spricht nur über den versionierten Vertrag
   (`packages/contract/openapi.yaml`, im Browser über `HvApi`). Sie enthält keine Geschäftsregel, keine
   Rechtelogik, keine Statusmaschine; erlaubte Aktionen liefert der Dienst je Vorgang (`_actions`).
2. **Fachlichkeit gegen Technik — Ports und Adapter.** Der Kern (`packages/domain`) kennt weder Datenbank
   noch HTTP noch Dateisystem; Technisches hängt an Ports, die der Kern definiert.
3. **Eigenes gegen Fremdes — ein Adapter je Nachbarsystem.** Transkription, KI, Aktienregister und
   künftige Nachbarn sprechen je über einen Adapter hinter einem kanonischen Vertrag; kein Fremdformat
   erreicht den Kern.
4. **Bewusst nicht gezogen:** eine n-Schichten-Aufteilung mit Service-, Manager- und Repository-Ebene je Entität.

## Was nicht angenommen wird

- Keine Technologiewahl (Persistenz, Identität, Hosting, Realtime): Das sind ADR 0003–0016, die Scheibe 015
  als „vorgeschlagen" vorlegt; sie werden an den Prüfpunkten 3 bis 5 einzeln angenommen.
- Keine inhaltliche Änderung am ADR; nur Status, Datum und Entscheider werden eingetragen.

## Was für die Projektleitung daraus folgt (Frage aus E42)

*Ist die Architekturgrenze (Vertrag, Ports, ein Adapter je Nachbarsystem) auch für die Projektleitung verbindlich?*

- Wünsche an die Oberfläche (z. B. zwei Beantwortungsansichten, Bühne je Person) werden ohne Umbau der Regeln
  gebaut; Wünsche an Regeln (wer darf was wann) werden Tabellenänderungen im Kern, sichtbar als
  Wahrheitstabellen-Diff.
- Andere Werkzeuge des Hauses (Transkription, Aktienregister, künftig KI) bekommen je einen Anschluss über den
  Vertrag. Direkter Datenbankzugriff eines Fremdsystems ist ausgeschlossen, auch als Abkürzung vor der HV.
- Der Vertrag kostet laufend Pflege (Versionierung, Changelog, Vertragstests); das ist der Preis dafür, dass die
  Oberfläche jährlich überarbeitet werden kann, ohne die Anwendung anzufassen.

## Nachweise zum Prüfpunkt

| Grenze | Heute belegt | Bis Prüfpunkt 1 ergänzt |
|---|---|---|
| 1 | Oberfläche nutzt nur `apps/web/src/api` (kein `fetch(` in `apps/web/src`); Rollenvergleich-Scan im Vokabular-Tor (`scripts/vocabulary-check.mjs`); Vertragstests für jede operationId (`apps/api`) | Antwort-Schema-Validierung und Rollenliteral-Scan über `apps/api` und `packages/domain` (012) |
| 2 | `packages/domain/src` importiert nur relativ, kein Framework, keine I/O; Uhr ist injiziert (`api.ts:153`) | dependency-cruiser „Domäne importiert nichts aus apps/*" und statischer now()-Check (012); offener Befund für 012: `api.ts:122` erzeugt eine Ersatz-ID mit `Date.now()` |
| 3 | Noch kein Nachbarsystem angeschlossen; Redebeitrag kennt `source: transcript` nur als Kennzeichen | Adapter folgen in 064 (Ingest), 066 (KI-Port), 067 (Aktienregister) |

## Beschluss

| | |
|---|---|
| Status | ☐ angenommen ☐ angenommen mit Änderungsauftrag ☐ nicht angenommen |
| Datum | __________ |
| Umsetzer | __________ |
| Projektleitung | __________ |
| Änderungsauftrag oder Begründung | __________ |

Nach der Annahme trägt der Orchestrator Status, Datum und Namen in ADR 0001 ein, stellt Abschnitt 1.3 der
Leitplanken von „operativ bindend" auf „angenommen" um und schließt E42 im Register.
