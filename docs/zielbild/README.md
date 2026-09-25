# Zielbild Oberfläche — Prototyp

**Herkunft:** Scheibe 089 (`docs/slices/089-zielbild-oberflaeche.md`) · **Stand:** 25.09.2026 ·
**Quelle mit IDs:** `docs/feedback/2026-09-zielbild-oberflaeche.md` (Z1–Z26, U1–U11) ·
**Bilder:** `docs/evidence/089-*.png`

Ein klickbarer Prototyp mit drei Ansichten auf synthetischen Daten: **Schreibraum** (Fachbereich
Finanzen), **Lagebild** (Versammlungsbüro), **Teleprompter** (Finanzvorstand auf der Bühne). Er zeigt,
wie die Oberflächen-Scheiben aus M4 aussehen und sich bedienen lassen sollen. Die veröffentlichte Fassung
beim Eigentümer (privater Link) entspricht diesem Stand.

## Was er ist und was nicht

**Bild, nicht Spec.** Verbindlich ist die Spec der jeweiligen Scheibe. Sie übernimmt die Z-Punkte,
die sie umsetzt, als Text, weil der Reviewer nur Spec und Diff sieht (Regel 3). Maßstab der
Design-Kritik bleibt `docs/design-prinzipien.md` (D1–D10); wo der Prototyp davon abweicht, steht eine
offene Registerzeile (E50–E54), und bis zur Antwort gilt deren Standardannahme.

**Übernehmen** dürfen die Scheiben:

- Aufbau, Raster und Abstände der Ansichten, Hierarchie, genau eine primäre Aktion je Ansicht
- Wortlaut der Beschriftungen und Hinweise (Hausvokabular), Leer- und Hinweiszustände
- Interaktionsmuster: Übernehmen mit Rückgängig, Korrektur per Klick, Halten statt Tippen,
  Vorschau ohne Folgen, Faden als Drill-down, eingeklappte erledigte Zeilen
- die Token-Werte in `zielbild.css`; sie spiegeln `apps/web/src/styles/index.css` und ergänzen einen
  dunklen Satz (nur nach E53 und nur für die Bühne)

**Nicht übernehmen**, weil der Prototyp an diesen Stellen die Hausregeln bewusst auslässt:

| Prototyp | Im Produkt |
|---|---|
| verschiebt Fragen direkt zwischen Stationen (`q.st = …`) | Übergänge nur über die Tabelle in `packages/domain/src/transitions.ts` (Regel 5) |
| zeigt jede Schaltfläche, keine Rechte | die Oberfläche rendert, was `_actions` erlaubt (Regel 4) |
| deutsche Texte als Literale im Code | jeder Text über das i18n-Wörterbuch, DE und EN (Regel 10) |
| eigene Uhr `S.now`, Zeitraffer | Zeit aus der injizierten Uhr des Dienstes (Regel 8, Scheibe 032) |
| ein globaler Zustand, Vanilla-JS, `innerHTML` für Symbole | React-Komponenten aus `apps/web/src/components`, Daten über `HvApi` (Regel 6) |
| Faktentabelle, Erwartungskarte, Rückkanal als feste Daten | erst nach E50, E51, E54; Quelle und Vertrag klärt die jeweilige Scheibe |
| Rundgang, Hinweisspalte, Zeitraffer | Vorführhilfen; im Produkt höchstens die Kontexthilfe aus 062 |

## Öffnen

Die Schriften kommen aus `apps/web/src/styles/fonts/` und werden relativ geladen. Deshalb aus der
Wurzel des Repositoriums über einen lokalen Webserver öffnen, nicht per `file://`:

```
python3 -m http.server 8089 --bind 127.0.0.1
# dann http://127.0.0.1:8089/docs/zielbild/  (#schreibraum, #lagebild, #teleprompter)
```

Beim ersten Öffnen bietet die Seite einen Rundgang in neun Schritten an. „Was ist neu" oben rechts zeigt
je Ansicht die Punkte mit ihrer Rückmeldungsnummer und markiert die Stelle.

## Aufbau

| Datei | Inhalt | Zielscheiben | Z-Punkte |
|---|---|---|---|
| `index.html` | Kopfzeile, drei Ansichten, Hinweisspalte | — | — |
| `zielbild.css` | Tokens hell und dunkel, alle Ansichten, Telefon-Layout | alle | — |
| `js/core.js` | Hilfsfunktionen, kleiner Ausschnitt des Seeds, gemeinsamer Zustand, Tooltip, Toast | — | — |
| `js/schreibraum.js` | Liste, Frage, vorbereitete Antwort, Editor mit Zahlenprüfung, Weiterleiten | 054, 055 | Z1–Z9 |
| `js/lagebild.js` | Kennzahlen, Flussbild, Faden, Rednerwand, Widerspruch, Zeitraffer | 061, 087, 050 | Z10–Z15 |
| `js/teleprompter.js` | Setliste, Antwort mit Satzumbruch, Halten, Anzeige je Gerät, Nur Bühne | 056, 057, 058 | Z16–Z23 |
| `js/shell.js` | Hinweise je Ansicht, Ansichtswechsel, Tasten, Start | 062 | Z26 |
| `js/rundgang.js` | geführter Rundgang | — (Vorführung) | Z24 |

## Für Design-Kritik und Review

Die Bilder `docs/evidence/089-*.png` sind die Vergleichsgrundlage: Die Design-Kritik legt den
Screenshot der gebauten Ansicht daneben und benennt Abweichungen als Befund. Eine Abweichung ist erlaubt,
wenn die Spec sie begründet oder D1–D10 sie verlangt.

## Pflege

Das Zielbild ändert sich nur über eine Scheibe (Regel 1). Wer einen Z-Punkt baut, setzt in der Quelle
den Status nach; Abweichungen vom Bild stehen im Bericht der Scheibe.
