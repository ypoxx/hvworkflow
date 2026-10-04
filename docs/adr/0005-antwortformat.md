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

**Eingabe- und Speicherform (Scheibe 055, Vertrag 0.4.4).** Zwei Formen im Vertrag: Die
**Eingabeform** `AnswerBodyInput` (nur in `AnswerDraft.body`) trägt Blockart und Marke als
begrenzte Zeichenketten; der Editor wendet die Whitelist nicht an. Die **Speicherform** `AnswerBody`
(in `AnswerVersion.body`, im Ereignis, in `EventRead`) ist geschlossen: `paragraph`, `list`; Marken als
Enum `AnswerMark`; `language` nur `de`. Der Kern normalisiert in einer **Schreibvariante** (darf 422
werfen: Gestalt, einsames Ersatzzeichen, andere Sprache, Klartext über 20 000 Code-Punkte, kein Text
übrig) und einer **Lesevariante** für die Projektion (wirft nie; Unbrauchbares fällt weg, ein einsames
Ersatzzeichen wird U+FFFD; weicht ihr Klartext vom gespeicherten `text` ab oder überschreitet sie eine
Strukturgrenze, nimmt die Projektion die Herleitung L aus `text`). Regeln N1–N10: Blockarten auf
Absatz/Liste abbilden, Marken filtern und kanonisch ordnen, `\p{White_Space}` → Leerzeichen, `\p{Cc}`
und `\p{Cf}` entfernen, Leerraum zusammenfassen, Läufe zusammenführen, NFC je Lauf, leere Blöcke weg,
benachbarte Listen zusammenführen; idempotent. Klartextprojektion P: Läufe aneinander, Punkte mit
`\n`, Blöcke mit `\n\n`, NFC über das Ganze. Herleitung L für Versionen ohne Dokument: eine nicht leere
Zeile (getrennt an CR LF, CR, LF) je Absatz ohne Marke. Auch `text` neuer Versionen und die Begründung
einer Verweigerung verlieren `\p{Cc}` (außer Tab, LF, CR) und `\p{Cf}` und kommen in NFC an; alte
Ereignisse bleiben, wie sie sind (R7).

## Konsequenzen

**Positiv.** Einfügen aus Word wird auf die Whitelist normalisiert; eine unbekannte Marke wird
Klartext, nichts geht verloren. Der Diff läuft auf der Klartextprojektion und bleibt lesbar. Die
Fokusansicht (B8) normalisiert das begrenzte Format beim Speichern. Erweitern ist additiv.

**Negativ.** Editor und Renderer sind eigene Komponenten; das Antwortformat-Schema ist eine
Vertragsänderung (043). Ein Blockdokument ist im Ereignis größer als reiner Text.

**Risiko.** Wird eine Marke später entfernt, dürfen bestehende Versionen nicht neu geschrieben
werden — eine neue Version würde Freigaben zurücksetzen (R-TRANS-03). Der Renderer verengt seine
Whitelist stattdessen.
Ab 055: Die Lesevariante der Normalisierung wirft nie und verengt gespeicherte Dokumente beim Lesen;
eine gestrichene Marke bleibt im Vertrag als Enum-Wert beschrieben, weil `EventRead` die gespeicherte
Nutzlast wiedergibt.

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
Geteilt: **055** (Vertrag 0.4.4, Kern, Dienst: verbotene Marke entfernt, Idempotenz, Lesbarkeit alter
Versionen), **055b** (Renderer, Editor, Screenshots Bühne und Historie mit Format).

## Offene Registerzeilen

- **E6** Formatierungsumfang — reichen fett, kursiv, Hervorhebung und Aufzählung; ist Schriftwahl
  bewusst nicht gewünscht?
- **E21** Antwortformat DE/EN-Kopplung, Inhaltssprache — Feld `language` reserviert, keine Kopplung.
