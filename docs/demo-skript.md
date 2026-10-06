# Demo-Skript — erste lauffähige Version

**Ziel des Termins:** Die Projektleitung sieht in zwölf Minuten, dass das Werkzeug den Workflow der
Hauptversammlung so abbildet, wie sie ihn kennt — flüssig, in der Sprache des Hauses, unter echtem
Volumen. Nicht: Funktionsvollständigkeit.

**Aufbau:** Laptop mit Chrome, Adresse `https://hvtool.netlify.app`, Fenster 1440 × 900 oder größer.
Vorher einmal „Demo zurücksetzen" im Kopf der Seite drücken, damit der Korpus frisch ist (230 Fragen,
28 Wortmeldungen, vier Runden, Nachmittag der Generaldebatte).

**Was vorab gesagt wird (30 Sekunden):** Alles, was zu sehen ist, sind synthetische Daten. Die
Anwendung läuft in dieser Demo vollständig im Browser; der Anwendungskern ist derselbe, der später
als Dienst mit Datenbank läuft. Die Oberfläche kennt keine Rollen, nur die Rechte, die der Kern ihr
je Vorgang mitgibt — deshalb ändert der Rollenschalter oben rechts sofort, was bedienbar ist.

## Ablauf

| Min | Szene | Rolle | Was zu sehen ist | Satz dazu |
|---|---|---|---|---|
| 0–1 | Kopf und Zähler | Erfassung | 230 Fragen, 28 Wortmeldungen, offen / auf der Bühne, Uhr | „Das ist der Stand um halb drei am HV-Tag." |
| 1–3 | Wortmeldeliste | Versammlungsbüro | Runde 3 aktiv, eine Person spricht mit laufender Redezeit, Liste per Drag-and-drop umsortieren, nächste Person aufrufen | „Die Liste ist das Werkzeug des Versammlungsbüros; Reihenfolge und Aufruf sind ein Handgriff." |
| 3–6 | Erfassung und Atomisierung | Erfassung | Redebeitrag links, Text markieren, „Als Einzelfrage erfassen", Restabdeckung steigt, sieben Fragen rechts, Klassifizierung auf Pfad C | „Aus einem Redebeitrag werden Einzelfragen — mit Nachweis, welcher Teil des Beitrags abgedeckt ist." |
| 6–8 | Beantwortung | Fachbereich → Recht | Arbeitsvorrat nach Status filtern, Antwortentwurf schreiben, zur Prüfung geben; Rolle wechseln: Legal Clearing gibt Version 1 frei | „Die Freigabe hängt an der Textversion. Eine spätere Änderung lässt sie erlöschen — das sieht man." |
| 8–10 | Bühne | Freigabe → Podium | „Auf die Bühne“, dann Podiumsansicht: große Schrift, freigegebene Antwort, „Als Nächstes“ vorbereitet, Warteschlange mit Bühnenzuordnung, „Nur Bühne“ mit Kontrastmodus, „Vorgelesen, weiter“, „Zurückgeben“ | „Das ist das Gerät auf dem Podium. Zwei Tasten." |
| 10–11 | Historie | Beobachtung | Vorgangshistorie der eben bearbeiteten Frage: jeder Schritt mit Zeit und Person; Suche über 230 Fragen | „Jeder Schritt ist ein unveränderliches Ereignis. Das ist die Nachweisführung für § 131." |
| 11–12 | Rechte | Beobachtung | Rolle „Beobachtung": alles sichtbar, nichts bedienbar; Rolle „Podium": nur die Bühne bedienbar | „Rechte sind Daten, nicht Code. Ein neues Jahr ist eine neue Tabelle, kein neuer Release." |

### Zusatzszenen (Stand 06.10.2026)

Je nach Zeit nach der Historie (Minute 10–11) einschieben; jede Szene dauert etwa eine Minute. Die Rollen wechselt der
Rollenschalter oben rechts.

| Szene | Rolle | Was zu sehen ist | Satz dazu |
|---|---|---|---|
| Nachfrage erfassen | Erfassung | In der Erfassung Alt+B drücken (oder „Nachfrage zu …“): Dialog „Bezug setzen“, Nummer wie F-0012 oder ein Stichwort eingeben, Art „Nachfrage“ oder „Klarstellung“ wählen; die nächste Einzelfrage trägt den Chip „Nachfrage zu F-n“ | „Eine Nachfrage hängt fest an der Frage, auf die sie sich bezieht. Der Bezug lässt sich danach nicht mehr ändern.“ |
| Thread in der Historie | Beobachtung | Die eben erfasste Einzelfrage in der Historie öffnen: Block „Bezug“ mit der Bezugsfrage (war sie schon vorgelesen, auch mit der gehörten Antwortversion); bei der Bezugsfrage „Nachfragen und Klarstellungen (n)“; in der Zeitleiste „Als Nachfrage erfasst“ | „Das ist der Beleg zum Nachfragerecht: welche Antwort gehört wurde und was darauf nachgefragt wurde.“ |
| Entwurf übersteht Neuladen | Fachbereich | In der Beantwortung (oder Fokusansicht) Text an eine Antwort anhängen, ohne zu speichern; Seite neu laden: der Text ist wieder da mit „Ungespeicherter Entwurf von HH:MM wiederhergestellt“; danach „Entwurf speichern“ | „Ein Neuladen oder ein abgestürzter Browser kostet keinen Text. Der Entwurf liegt nur auf diesem Gerät, bis er gespeichert ist.“ |
| Fassungen vergleichen | Fachbereich und Recht | Nur mit dem lokalen Dienstpaket und zwei Fenstern (in der Browser-Demo hat jedes Fenster seinen eigenen Stand): während der Fachbereich tippt, speichert Recht eine Version; beim Fachbereich erscheint „Vergleichen“, Speichern öffnet „Fassungen vergleichen“ mit „Ihre Fassung · nicht gespeichert“ neben der neuen Version, „Unterschiede Wort für Wort“, Wahl „Mit meiner Fassung weiter“ oder „Version n übernehmen“ | „Niemand überschreibt still die Arbeit eines anderen. Wer zuletzt speichert, sieht, was inzwischen gespeichert wurde, und entscheidet.“ |
| Leitstand | Koordination (oder Versammlungsbüro) | `/cockpit`: älteste offene Einzelfrage als Hauptwert mit „seit … in diesem Status“, Ohne Endstatus, Legal Clearing über 10 min, Zulauf letzte 5 min, Stationen, Rückstand je Fachbereich; beim Hauptwert „Faden öffnen“: die Stationen dieser Einzelfrage mit Uhrzeit; Escape schließt | „Der Leitstand zeigt, wo es staut, nie, wer langsam ist. Es gibt keine Kennzahl je Person.“ |
| Verwaltung | Administration | `/admin`: Kopf mit der verwalteten Hauptversammlung; Tabs Rollenzuordnungen (Rolle mit Fachbereich und Ablauf zuordnen, entziehen), Fachbereiche, Tagesordnung, Bühnenplätze, Rollenkarten, Hauptversammlungen; eine abgelehnte Änderung (etwa einen Fachbereich entfernen, an dem noch Einzelfragen hängen) erklärt, warum | „Stammdaten und Rollen pflegt die Administration selbst. Anlegen und Einfrieren einer Hauptversammlung kommen als Nächstes.“ |

Hinweis zum Leitstand: Bis PR #173 (takt-052, Seed-Zeiten) gemergt ist, liegen fast alle Zeiten des Demo-Korpus auf dem
Zeitpunkt des Zurücksetzens; der Zulauf steht dann als eine Säule, und die Uhrzeiten eines Fadens sind gleich.

## Was bewusst nicht gezeigt wird

Vorabfragen, Verweigerungspfad, Notar, Publikation, Nachbereitung, Anbindung der
Nachbarsysteme. Alles davon ist im Vertrag und im Kern vorbereitet (Ereignisprotokoll, Pfade A/B/C,
Rechte-Tabelle), aber nicht in der Oberfläche. Wenn danach gefragt wird: „Ist geschnitten, nicht
gebaut — siehe erste-version-und-offene-fragen.md."

## Wenn Entwickler dabei sind

Repository zeigen, in dieser Reihenfolge: `AGENTS.md`, `packages/contract/openapi.yaml`,
`packages/domain/src/transitions.ts` (die Statusmaschine als Tabelle),
`packages/domain/policy-truth-table.md` (die generierte Rechte-Tabelle),
`packages/domain/src/__tests__/api.test.ts` (der Abnahmesatz als Test), `docs/slices/` (wie gebaut
wurde, mit Review-Befunden), `docs/messung.md` (was es gekostet hat).

## Bekannte Punkte

- **Die Bühne arbeitet die Warteschlange in Reihenfolge ab.** Eine neu auf die Bühne gelegte Frage
  steht hinten an. Der Demo-Korpus hält die Warteschlange deshalb kurz (eine Handvoll), sodass die
  eigene Frage nach wenigen „Vorgelesen, weiter" erreicht ist. Ein Vorziehen durch das
  Versammlungsbüro ist für den Piloten vorgesehen, nicht in der Demo.
- **Jeder Browser hat seinen eigenen Stand** (ADR 0002). Zwei Geräte sehen nicht dieselben Daten.
- **Pfad A und B** sind klassifizierbar und laufen durch die Statusmaschine, haben aber keine eigene
  Oberfläche über den Expert Track hinaus.
- **Zusammenführen und Zurückziehen** sind vorhanden, aber nicht Teil des Ablaufs oben.
- **Ereignisstrom und Historie** zeigen Rohereignisse in Hausvokabular; eine Exportfunktion für die
  Nachweisführung gibt es noch nicht.
