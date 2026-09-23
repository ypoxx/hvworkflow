# ADR 0005 — Antwortformat: Blockdokument mit Whitelist

**Status:** vorgeschlagen · **Datum:** 23.09.2026 · **Entscheider:** Projektleitung (Plan 3 „Formatierungsumfang", E6, E21) · **Annahme:** Prüfpunkt 5 (Plan 4)

## Kontext

Antworten entstehen heute als Klartext und kommen in der Praxis aus Word. Bühne, Historie und
Export müssen denselben Text gleich darstellen; die Freigabe ist an die Textversion gebunden
(R-TRANS-03, Rechtekonzept Abschnitt 4: keine Freigabe ohne Bindung an die Textversion). Frage 7 an
die Projektleitung (Formatierungsumfang) ist offen; die Standardannahme muss so gebaut sein, dass
die Antwort eine Enum-Änderung kostet.

## Entscheidung

Standardannahme aus Plan 3 („Formatierungsumfang") und Plan 4 (Zeile 0005):

- **Whitelist:** Blöcke `paragraph` und `list`; Marken `bold`, `italic`, `highlight`. Keine
  Schriftwahl. Der Markensatz ist ein Enum im Vertrag.
- **Speicherform:** `AnswerVersion.body` als kleines Blockdokument plus `text` als
  Klartextprojektion für Suche und Diff.
- **Normalisierung in der Domäne** (Whitelist anwenden, leere Blöcke zusammenführen, idempotent)
  beim Speichern und beim Weiterleiten — nicht im Editor.
- **Ein Renderer** für Bühne, Historie und Export.
- **Reserviertes Feld `language`** (Standard `de`); keine DE/EN-Kopplung freigegebener Antworten in
  der Beta (E21).

## Konsequenzen

**Positiv.** Einfügen aus Word wird auf die Whitelist normalisiert; eine unbekannte Marke wird
Klartext, nichts geht verloren. Der Diff läuft auf der Klartextprojektion und bleibt lesbar. Die
Fokusansicht (B8) normalisiert das begrenzte Format beim Speichern. Erweitern ist additiv.

**Negativ.** Editor und Renderer sind eigene Komponenten; das Antwortformat-Schema ist eine
Vertragsänderung (043). Ein Blockdokument ist im Ereignis größer als reiner Text.

**Risiko.** Wird eine Marke später entfernt, dürfen bestehende Versionen nicht neu geschrieben
werden — eine neue Version würde Freigaben zurücksetzen (R-TRANS-03). Der Renderer verengt seine
Whitelist stattdessen.

## Kosten bei Änderung

- Marke ergänzen: < 1 AStd (Plan 3).
- Marke entfernen: Renderer-Whitelist verengen (unbekannte Marke wird Klartext); keine neuen
  Versionen (Plan 3).
- DE/EN-Kopplung oder zweite Inhaltssprache: Nach-Beta (E21).

## Verworfene Alternativen

- **Freies HTML oder unbegrenzter Rich-Text.** Verworfen: der Formatumfang ist eine Whitelist,
  damit Bühne, Historie und Export aus einem Renderer kommen und Erweiterungen additiv bleiben.
- **Schriftwahl.** Verworfen als Standardannahme: keine Schriftwahl (Plan 3); ob das Hausformat der
  Grund ist, fragt E6 die Projektleitung.
- **Normalisierung im Editor (Client).** Verworfen: Normalisierung ist eine Regel des Kerns; die
  Oberfläche enthält keine Geschäftsregel (ADR 0001, Grenze 1).
- **Nur Klartext ohne Format.** Verworfen: die Whitelist Absatz, Aufzählung, fett, kursiv,
  Hervorhebung ist die Standardannahme (Plan 3); ob sie reicht, fragt E6.
- **Mehrere Renderer je Ansicht.** Verworfen: ein Renderer, damit Bühne und Export nicht
  auseinanderdriften.

## Nachweis

Scheibe **055** (Plan 4): Test „verbotene Marke wird entfernt", Idempotenz der Normalisierung;
Screenshots Bühne und Historie mit Format; `pnpm gates` und e2e. Vertragsform (Blockdokument plus
`text`) in 043.

## Offene Registerzeilen

- **E6** Formatierungsumfang — reichen fett, kursiv, Hervorhebung und Aufzählung; ist Schriftwahl
  bewusst nicht gewünscht?
- **E21** Antwortformat DE/EN-Kopplung, Inhaltssprache — Feld `language` reserviert, keine Kopplung.
