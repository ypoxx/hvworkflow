# ADR 0009 — Aufbewahrung, Vertraulichkeit, Krypto-Umschlag und Personentabelle

**Status:** vorgeschlagen · **Datum:** 23.09.2026 · **Entscheider:** Recht und DSB (Aufbewahrung, Löschung, Krypto-Umschlag, E16); Recht (Vertraulichkeitsstufe, E17); Projektleitung und DSB (Pseudonymisierung) · **Annahme:** Prüfpunkt 4, ergänzt nach 073 (Plan 4)

## Kontext

Das Ereignislog wird nur angehängt (Regel 7). Löschen, Berichtigen oder Verschlüsseln darf deshalb
nie eine Änderung am Log sein. Zugleich verlangen Recherche Z.116 (Pseudonymisierung gegenüber
Fachbereichen, MUSS) und das Rechtekonzept (Abschnitt 2.3 Vertraulichkeitsstufe, Abschnitt 4 keine
physische Löschung, Abschnitt 6 Klarnamenauflösung als eigene protokollierte Berechtigung), dass
Personenbezug und Vertraulichkeit von Anfang an im Datenmodell liegen. Aufbewahrungsfristen,
Löschverfahren und Schlüsselverwahrung sind Entscheidungen von Recht und DSB, die vor der
Produktion fallen (E16), nicht vor der Beta.

## Entscheidung

Standardannahme aus Plan 3 („Aufbewahrung, Löschung, Krypto-Umschlag", „Vertraulichkeitsstufe und
geschützte Fragen", „Pseudonymisierung gegenüber Fachbereichen", „Notiz-/Rückfragefeld") und Plan 4
(Zeile 0009):

- **Aufbewahrung als Attribut.** Jedes Ereignis trägt `retentionClass (record | working |
  technical)` und `legalHold: false`. Keine Löschlogik in der Beta.
- **Personentabelle statt Klarnamen.** Personenbezogene Felder liegen nur in der getrennten
  Personentabelle (`personId` in Ereignissen) und im markierten Payload-Teil `pii` mit `keyId` je
  Jahrgang hinter einer Codec-Schicht. Beta: Identitäts-Codec, aber `keyId` ab dem ersten Ereignis.
- **Jeder Bestand vor eingeschaltetem Codec gilt als wegwerfbar.** Umkodieren erzeugt nie eine
  Änderung am Log: es ist ein Export in eine neue Datenbank. Der Schlüsselverwahrer wird in 073
  benannt. Der Übungsbestand wird gelöscht, indem der Plattformbetreiber die getrennte Datenbank
  entfernt (nie die Dienstrolle), mit Löschprotokoll (ADR 0010).
- **Vertraulichkeitsstufe.** Attribut `confidentiality (internal | restricted | protected)` auf
  `QuestionRecord`, Standard `internal`. `can()` erhält den Kontext `{unit, seat, confidentiality,
  timeWindow}`, im Dienst aufgelöst. Setzen: `legal`, `approver`, `admin`. `protected` lesen:
  `legal`, `approver`, `admin` und die Fachkräfte der zugewiesenen Einheit; das Podium sieht
  geschützte Fragen erst, wenn sie auf der Bühne stehen. Deny by default; die Stufen sind ein Enum
  und eine zweite generierte Wahrheitstabelle Attribut × Aktion. Zähler bleiben lückenlos
  (Existenz sichtbar, Inhalt nicht); der verdeckte Bestand (Ethical Wall, Recherche Z.332) ist
  Nach-Beta.
- **Personenbezogene Historie** (`event.read.personal`) nur mit zweiter Freigabe
  (`AuditAccessGranted` mit Zweck und Frist); im Standardlesepfad ist `personId` maskiert (ADR 0013).
- **Pseudonymisierung gegenüber Fachbereichen** ist Standard an (`pseudonymiseForUnits = true`);
  Klarnamen sieht, wer `question.identity.reveal` hält (Standard: `coordination`, `moderation`,
  `legal`, `approver`, `podium`; 026). Ein Recht, kein Rollenname; Umschalten ist Konfiguration.
  Ab 067 erzeugt das Aufdecken per Lookup ein Ereignis `IdentityRevealed` mit Grund (067); bis dahin
  löst die Projektion den Namen beim Lesen über das Recht auf (026).
- **Notizfeld** `note` mit Ereignis `QuestionNoteAdded` im Vertrag, hinter der Meeting-Konfiguration
  `notes=off`, nie im Export, nie auf der Bühne, kein Chat; ohne Schalter entsteht kein
  personenbezogener Freitext im Log (E4).

## Konsequenzen

**Positiv.** Verschlüsselung später einzuschalten ändert weder Domäne noch Vertrag; Regel 7 bleibt
unberührt. Die Rechtsgrundlagen-Matrix lässt sich feldgenau aus den Typen generieren (073). Die
Antwort auf E16 kostet Konfiguration und einen Export, keinen Umbau.

**Negativ.** Die Personentabelle ist ein zweiter Speicherort mit eigenem Zugriffspfad; der
Codec-Port durchzieht Persistenz und Export. Bis E16 entschieden ist, kann nichts gelöscht werden —
deshalb ist der Übungsbestand als Ganzes wegwerfbar und die Beta läuft nur mit synthetischen
Fragen (E13/E14).

**Abgrenzung zum Rechtekonzept.** Abschnitt 2.3 nennt als Wirkung der Vertraulichkeitsstufe die
Existenz („nicht einmal sichtbar"). Die Beta liefert davon die Inhaltsverdeckung mit lückenlosen
Zählern; der verdeckte Bestand folgt nach der Beta in einer eigenen Scheibe (Plan 3). Das umbasierte
Rechtekonzept (052) hält diese Stufung fest.

**Abgrenzung zu Recherche Z.116 und Rechtekonzept Abschnitt 6.** Z.116 verlangt die
Re-Identifikation nur für Recht, IR und Vorstandsbüro im Vier-Augen-Prinzip mit Protokolleintrag;
Abschnitt 6 nennt die Klarnamenauflösung eine eigene, protokollierte Berechtigung. Der Plan baut
davon das Recht `question.identity.reveal` mit fünf Standardrollen (026) und die Protokollierung
als Ereignis `IdentityRevealed` erst mit 067. Ein engerer Rollenkreis und eine Vier-Augen-Regel für
die Auflösung stehen nicht im Plan: offen, Entscheider Projektleitung und DSB; Registerzeile folgt
(Übergabe an 014).

## Kosten bei Änderung

- Ohne Umschlag: Neuaufbau des Logs. Mit Umschlag: Schlüssel einschalten und den Bestand einmal in
  eine neue Datenbank exportieren, < 3 AStd (Plan 3).
- Vertraulichkeitsstufe ergänzen: Enum plus Tabellenzeilen; verdeckter Bestand: eigene Scheibe
  nach der Beta (Plan 3).
- Pseudonymisierung abschalten: Konfiguration plus Registerzeile (Plan 3).
- Notizfeld einschalten: Konfiguration; Ausbau zu einem Thread: additiv < 1,5 AStd (Plan 3).
- Krypto-Shredding und Löschung: vor der Produktion, Blocker für Leitplanken 9.3 (E16).

## Verworfene Alternativen

- **Klarnamen in Ereignissen.** Verworfen: `personId` und Personentabelle; Test „kein displayName in
  Ereignissen" (Prüfpunkt 3).
- **Löschlogik im Ereignislog** (physisches Löschen einzelner Ereignisse oder Fragen). Verworfen:
  Regel 7; Rechtekonzept Abschnitt 4 (keine physische Löschung, für niemanden). Abgrenzung: Der
  Übungsbestand ist synthetisch und wird als Ganzes durch den Plattformbetreiber außerhalb der
  Anwendung entfernt (Plan 3, B15, 042); ob Rechtekonzept Abschnitt 4 (keine physische Löschung) diesen
  Bestand erfasst, legt der Plan nicht fest: offen (E16), Frage an Recht und DSB mit dem Rechtekonzept aus 052.
- **Umkodieren an Ort und Stelle.** Verworfen: jede Umkodierung ist ein Export in eine neue
  Datenbank (Leitplanken 1.3).
- **Krypto-Umschlag erst nachrüsten, wenn Recht entschieden hat.** Verworfen: ohne `keyId` ab dem
  ersten Ereignis kostet die Antwort einen Neuaufbau des Logs.
- **Verdeckter Bestand schon in der Beta.** Verschoben: eigene Scheibe nach der Beta (Z.332).
- **Eigene Rollen je Vertraulichkeitsstufe.** Verworfen: Stufen sind Attribute, keine Rollen
  (Rechtekonzept Abschnitt 5).

## Nachweis

Scheiben **047** und **073** (Plan 4): `policy-attribute-table.md` eingecheckt; Negativtests
`expert` anderer Einheit → 403, `observer` auf `protected` → 403, Client behauptet einen fremden
Platz → wird ignoriert; Test `personId`-Auswertung ohne zweite Freigabe → 403; Test Export ohne
Notiz; generierte Rechtsgrundlagen-Matrix und Auswertungskatalog; Löschkonzept-Vorlage mit
benanntem Schlüsselverwahrer; Löschprotokoll-Vorlage. Umschlag und Codec-Port aus 024 (ADR 0011);
Personentabelle als Entität aus 026 (Test „kein displayName in Ereignis-Payloads"), Speicherung in
027 (ADR 0003).

## Offene Registerzeilen

- **E16** Aufbewahrung, Löschung, Krypto-Shredding, Schlüsselverwahrer.
- **E17** Vertraulichkeitsstufen und geschützte Fragen — reichen drei Stufen, wer setzt und liest
  `protected`?
- **E14** DSFA als Vorbedingung für Personenidentitäten auf Staging.
- **E4** Notiz-/Rückfragefeld je Frage.
- **E29** Veröffentlichungsumfang — `publicationVersion` und `internal | external` sind reservierte
  Attributnamen (Plan 3), keine Veröffentlichung in der Beta.
- **E40** Insider-Kennzeichen als Attribut (eine Rechtsrolle) — 047 baut auf Standard.
- Klarnamenkreis und Vier-Augen bei der Auflösung (Recherche Z.116, Rechtekonzept Abschnitt 6):
  nicht im Plan; Entscheider Projektleitung, DSB; Registerzeile folgt (Übergabe an 014).
