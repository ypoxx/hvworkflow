# Demo-Skript — Stand 06.10.2026

**Ziel des Termins:** Entwicklung, Produktverantwortung, Betrieb und Finanzen sehen in zwölf Minuten, dass das Werkzeug den
Workflow der Hauptversammlung so abbildet, wie das Haus ihn kennt — flüssig, in seiner Sprache, unter echtem Volumen.
Nicht: Funktionsvollständigkeit.

**Aufbau:** Laptop mit Chrome, Adresse `https://hvtool.netlify.app`, Fenster 1440 × 900 oder größer. Die Seite zeigt den
Stand nach dem Deployment vom 06.10.; falls die Seite einen älteren Stand zeigt: lokal starten mit `pnpm install` und
`pnpm --filter @hv/web dev`. Unmittelbar vor dem Termin im Kopf der Seite „Demodaten zurücksetzen" drücken (Pfeilsymbol neben
dem Zeichen „Demo") und mit „Zurücksetzen und neu aufbauen" bestätigen. Die Zeiten des Korpus liegen in den 90 Minuten vor
dem Zurücksetzen; nach etwa einer Stunde ist der Zulauf im Leitstand leer. Frisch stehen 230 Einzelfragen, 28 Wortmeldungen
in vier Runden und sechs Einzelfragen auf der Bühne bereit, Runde 3 läuft. Rollen wechselt der Rollenschalter oben rechts.

**Was vorab gesagt wird (30 Sekunden):** Alles, was zu sehen ist, sind synthetische Daten. Die Anwendung läuft in dieser Demo
vollständig im Browser; der Anwendungskern ist derselbe, der später als Dienst mit Datenbank läuft. Die Oberfläche
vergleicht keine Rollennamen, sie zeigt nur, was der Kern ihr je Vorgang erlaubt — deshalb ändert der Rollenschalter sofort,
was bedienbar ist.

## Ablauf (12 Minuten)

| Min | Szene | Rolle | Was zu sehen ist | Satz dazu |
|---|---|---|---|---|
| 0–1 | Kopf und Zähler | Erfassung | Kopf: 28 Wortmeldungen, 230 Einzelfragen, Prozessleiste (Erfasst bis Vorgelesen, Aufschlüsselung beim Daraufzeigen), Ortszeit; Zähler in der Navigation: Beantwortung 100 offen, Bühne 6 | „Das ist eine laufende Generaldebatte: Runde 3, 100 Einzelfragen offen, sechs auf der Bühne." |
| 1–2 | Wortmeldeliste | Versammlungsbüro | „Am Mikrofon" eine Person mit der Zahl ihrer Einzelfragen, „Als Nächstes" mit „Aufrufen"; Reihenfolge einer Runde per Ziehen am Griff (oder Leertaste und Pfeiltasten) ändern. „Aufrufen" nur zeigen: es wechselt die Person am Mikrofon, und die Erfassung öffnet danach deren leeren Redebeitrag | „Die Liste ist das Werkzeug des Versammlungsbüros; Reihenfolge und Aufruf sind ein Handgriff." |
| 2–4 | Erfassung und Atomisierung | Erfassung | Voreingestellt ist die Person am Mikrofon: Redebeitrag links, drei Einzelfragen sind schon erfasst. Fragesatz markieren, „Als Einzelfrage erfassen", oder „Nach Sätzen vorschlagen" und „Auswahl erfassen (n)"; „Restabdeckung" steigt | „Aus einem Redebeitrag werden Einzelfragen — mit Nachweis, welcher Teil des Beitrags abgedeckt ist." |
| 4–5 | Klassifizieren und Zuweisen | Koordination | In der Erfassung bei einer Einzelfrage „Klassifizieren": „Pfad C · Expert Track", Bühnenzuordnung „Finanzvorstand". Dann „Steuerung": Nummer suchen, „Zuweisen" (voreingestellt „Finanzen und Controlling"); „Verteilung" oben: offen je Fachbereich, auf der Bühne je Bühnenplatz. Zugewiesene Fragen lassen sich „An anderen Fachbereich weiterleiten" (mit Grund) | „Erfassen und Routen sind getrennte Rechte: Die Erfassung klassifiziert nicht, die Koordination schon." |
| 5–7 | Beantwortung | Fachbereich → Recht → Freigabe | Fachbereich Finanzen (sieht nur Einzelfragen seines Fachbereichs): Einzelfrage per Nummer öffnen, Antwort schreiben, „Entwurf speichern", „Weiterleiten" an Legal Clearing. Recht: „Version 1 rechtlich freigeben". Freigabe: „Version 1 freigeben", Siegel „Freigegeben · Version 1 · Person · Uhrzeit" | „Die Freigabe hängt an der Textversion; eine neue Version lässt sie erlöschen. Wer den Entwurf schrieb, gibt ihn nicht frei." |
| 7–9 | Bühne | Freigabe → Podium | Freigabe: „Auf die Bühne". Podium (startet in „Nur Bühne"; vor dem Rollenwechsel „Nur Bühne verlassen"): große Schrift, freigegebene Antwort, „Als Nächstes", Warteschlange mit Bühnenzuordnung. Die Frage steht hinten an: bei frischem Korpus nach sechsmal „Vorgelesen, weiter" (Leertaste) ist sie dran. „Kontrast", „Antwort zurückgeben" (R) | „Das ist das Gerät auf dem Podium. Zwei Tasten." |
| 9–10 | Historie | Versammlungsbüro | „Historie & Suche": Nummer suchen, „Vorgangshistorie" der eben bearbeiteten Einzelfrage mit Uhrzeit und Person je Schritt; Suche über 230 Einzelfragen. Nicht Beobachtung und nicht Podium: beide haben kein Recht auf die Historie | „Jeder Schritt ist ein unveränderliches Ereignis. Das ist die Nachweisführung für § 131." |
| 10–12 | Rechte | Beobachtung, Podium, Administration | Beobachtung: nur Vorgelesenes und Abgeschlossenes in Beantwortung und Suche; Wortmeldungen, Erfassung, Bühne, Leitstand und die Vorgangshistorie zeigen „In dieser Rolle keine Leseberechtigung …". Podium: nur die Bühne bedienbar. Erfassung sieht „Redner n", das Versammlungsbüro den Namen. Administration: Verwaltung, „Rollenkarten" („Liest", „Darf") | „Rechte sind Daten, nicht Code: eine Tabelle, die der Kern auswertet. Wer welche Rolle hat, pflegt die Verwaltung ohne neuen Release." |

### Zusatzszenen

Nach der Historie einschieben oder ans Ende stellen; je Szene etwa eine Minute, die Verweigerung drei.

| Szene | Rolle | Was zu sehen ist | Satz dazu |
|---|---|---|---|
| Verweigerung | Koordination → Recht → Freigabe → Podium | Der Seed enthält keine Verweigerung, sie wird live angelegt, mit drei verschiedenen Rollen. Koordination: in der Beantwortung (oder Steuerung) eine zugewiesene Einzelfrage öffnen, „Verweigerung vorschlagen": Art „Verweigerung · Grund aus Katalog", Grund wählen (der Wortlaut für die Bühne kommt vorbelegt, daneben „Formulierungsbaustein, ungeprüft (E15)"), „Begründung (intern)" schreiben, absenden. Recht: „Version n rechtlich freigeben". Freigabe: „Verweigerung freigeben (Version n)", „Auf die Bühne". Podium: die Frage in der Warteschlange (Badge „Verweigerung") anklicken: Vorschau mit „Auskunft wird verweigert", „Grund: …", „ungeprüft". Die Begründung liest nur, wer Verweigerungen vorschlagen oder freigeben darf, in der Beantwortung; nie die Bühne, nie die Historie | „Eine Verweigerung braucht eine Begründung, die Rechtsfreigabe und eine dritte Person für die Freigabe. Die Bühne zeigt den Grund aus dem Katalog, nie die interne Begründung." |
| Nachfrage erfassen | Erfassung | In der Erfassung Alt+B drücken (außerhalb eines Textfelds) oder „Nachfrage zu …": Dialog „Bezug setzen", Nummer wie F-0012 oder Stichwort, Art „Nachfrage" oder „Klarstellung"; die nächste Einzelfrage trägt den Chip „Nachfrage zu F-n" | „Eine Nachfrage hängt fest an der Frage, auf die sie sich bezieht. Der Bezug lässt sich danach nicht mehr ändern." |
| Thread in der Historie | Versammlungsbüro | Nach „Nachfrage erfassen": die neue Einzelfrage in der Historie öffnen: Block „Bezug" mit der Bezugsfrage (war sie schon vorgelesen, steht „bezieht sich auf die vorgelesene Antwortversion"); bei der Bezugsfrage „Nachfragen und Klarstellungen (n)"; in der Zeitleiste „Als Nachfrage erfasst" | „Das ist der Beleg zum Nachfragerecht: welche Antwort gehört wurde und was darauf nachgefragt wurde." |
| Entwurf übersteht Neuladen | Fachbereich | In der Beantwortung oder unter „Meine Fragen" Text an eine Antwort hängen, ohne zu speichern; Seite neu laden: „Ungespeicherter Entwurf von HH:MM wiederhergestellt"; danach „Entwurf speichern" | „Ein Neuladen oder ein abgestürzter Browser kostet keinen Text. Der Entwurf liegt nur auf diesem Gerät, bis er gespeichert ist." |
| Fassungen vergleichen (optional) | Fachbereich und Recht | Nur mit dem lokalen Dienstpaket (`pnpm stack:up`, Docker nötig, `docs/betrieb/installation.md`; Anmeldung als `expert` und `legal`, Zugangsdaten mit `pnpm stack:credentials`) und zwei Fenstern; in der Browser-Demo hat jedes Fenster seinen eigenen Stand. Während der Fachbereich tippt, speichert Recht eine Version; beim Fachbereich erscheint „Vergleichen", Speichern öffnet „Fassungen vergleichen" mit „Ihre Fassung · nicht gespeichert", „Unterschiede Wort für Wort", Wahl „Mit meiner Fassung weiter" oder „Version n übernehmen" | „Niemand überschreibt still die Arbeit eines anderen. Wer zuletzt speichert, sieht, was inzwischen gespeichert wurde, und entscheidet." |
| Leitstand | Koordination (oder Versammlungsbüro, Administration) | `/cockpit`: „Älteste offene Einzelfrage" als Hauptwert mit „seit … in diesem Status", „Ohne Endstatus", „Legal Clearing über 10 min", „Zulauf letzte 5 min", „Stationen", „Rückstand je Fachbereich"; beim Hauptwert „Faden öffnen": die Stationen dieser Einzelfrage mit Uhrzeit; Escape schließt | „Der Leitstand zeigt, wo es staut, nie, wer langsam ist. Es gibt keine Kennzahl je Person." |
| Verwaltung | Administration | `/admin`: verwaltete Hauptversammlung im Kopf; Tabs Rollenzuordnungen (zuordnen mit Fachbereich und Ablauf, entziehen), Fachbereiche, Tagesordnung, Bühnenplätze, Rollenkarten, Hauptversammlungen; eine abgelehnte Änderung (Fachbereich entfernen, an dem noch Einzelfragen hängen) erklärt, warum | „Stammdaten und Rollen pflegt die Verwaltung selbst. Anlegen und Einfrieren einer Hauptversammlung kommen als Nächstes." |

## Für wen welche Szene

| Publikum | Szenen |
|---|---|
| Entwicklung | Historie, Ereignisstrom (Rolle Administration, „Historie & Suche", Tab „Ereignisstrom"), Rechte als Daten, Rollenkarten, Verweigerung (Vier-Augen im Kern), Repository (nächster Abschnitt) |
| Produkt | Erfassung, Beantwortung, Bühne, Verweigerung, Nachfrage |
| Betrieb | Leitstand, Verwaltung, lokales Dienstpaket (`docs/betrieb/installation.md`, Anleitung `docs/admin/anleitung.md`) |
| Finanzen | Kurz halten: der Ablauf bis zur Bühne genügt; Kosten und Aufwand stehen im Dossier, nicht in der Demo (Belege je Scheibe: `docs/messung.md`) |

## Was bewusst nicht gezeigt wird

Vorabfragen, Notar und Export der Niederschrift, Publikation, Nachbereitung, Anbindung der Nachbarsysteme. Das meiste davon
ist im Vertrag und im Kern vorbereitet, aber nicht in der Oberfläche. Wenn danach gefragt wird: „Ist geschnitten, nicht
gebaut — siehe `docs/erste-version-und-offene-fragen.md` und `docs/produktplan-beta.md`."

## Wenn Entwickler dabei sind

Repository zeigen, in dieser Reihenfolge: `AGENTS.md`, `packages/contract/openapi.yaml`, `packages/domain/src/transitions.ts`
(die Statusmaschine als Tabelle), `packages/domain/src/permissions.ts` (`ROLE_PERMISSIONS`),
`packages/domain/policy-truth-table.md` (die generierte Rechte-Tabelle), `packages/domain/src/__tests__/api.test.ts` und
`apps/web/e2e/abnahme.spec.ts` (der Abnahmesatz im Kern und im Browser), `docs/adr/0002-demo-betriebsart-in-process.md`,
`docs/slices/` (wie gebaut wurde, mit Review-Befunden), `docs/messung.md` (was es gekostet hat).

## Bekannte Punkte

- **Die Bühne arbeitet die Warteschlange in Reihenfolge ab.** Eine neu auf die Bühne gelegte Frage steht hinten an; der
  frische Korpus hält sechs Fragen auf der Bühne. Eine Bühne je Bühnenplatz mit Filter ist nicht gebaut: `getStage` liefert
  die eine globale Warteschlange (ADR 0006, Produktplan B7).
- **Jeder Browser hat seinen eigenen Stand** (ADR 0002). Zwei Geräte sehen nicht dieselben Daten.
- **Die Navigation zeigt allen Rollen alle Bereiche.** Wo das Leserecht fehlt, zeigt der Bereich eine Sperrseite.
- **Keine Redezeitmessung:** Redezeit und Art der Wortmeldung sind mit Scheibe 080 entfernt.
- **Verweigerungsgründe und Formulierungsbausteine sind rechtlich ungeprüft (E15);** die Oberfläche sagt es („ungeprüft").
- **Im Leitstand** steht „Kanarienfrage: nicht eingerichtet"; der Inhalt folgt mit Scheibe 086.
- **Pfad A (Vorstand direkt) braucht keinen Antworttext;** Pfad B und C laufen über dieselbe Beantwortung, ohne eigene
  Oberfläche je Pfad.
- **Zusammenführen und Zurückziehen** sind vorhanden, aber nicht Teil des Ablaufs oben.
- **Ereignisstrom und Historie** zeigen Ereignisse in Hausvokabular; den Ereignisstrom liest nur die Administration. Eine
  Exportfunktion für die Nachweisführung gibt es noch nicht.
