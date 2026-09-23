# ADR 0012 — Zustandsmodell und Verweigerung

**Status:** vorgeschlagen · **Datum:** 23.09.2026 · **Entscheider:** Umsetzer und Recht (Plan 3 „Zustandsmodell und Verweigerung", Plan 4); Recht (E30); Projektleitung, Vorstand, Recht (Letztverantwortung und Rechtstor, E25) · **Annahme:** Prüfpunkt 4, Umsetzer und Recht (Plan 4). Dieser ADR geht mit dem Regelregister an Recht, bevor 044 baut (Vorabzug nach 011, Anfang Oktober); sonst trägt 044 den Vermerk „auf Standard gebaut".

## Kontext

Die Einzelfrage kennt heute elf Zustände (`packages/domain/src/types.ts`): `captured`,
`classified`, `assigned`, `answer_drafted`, `in_review`, `approved`, `staged`, `delivered`,
`closed`, `withdrawn`, `merged`. Die Übergänge sind eine Tabelle (`transitions.ts`, Regel 5); jede
Zeile trägt eine Regel-ID und einen Test.

Die Beta braucht die Verweigerung (B6): Verweigerungspfad A „kein Auskunftsanspruch" und
Verweigerungspfad B „Verweigerung trotz Anspruchs" mit Grundkatalog als Daten (nicht zu verwechseln
mit den Antwortpfaden A/B/C des Glossars). Recherche Z.24 nennt sie zwei Nichtbeantwortungen mit
zwei Rechtsfolgen (Verweigerungspfad B: § 131 Abs. 3 AktG — ungeprüft (E15)). Dazu kommen
Nebenaspekte: Zurückstellen, Korrektur nach dem Vorlesen, Nachfragen. Die Risikotabelle des Plans
warnt vor einem Zustandsautomaten mit über 15 Zuständen. Das Rechtekonzept (Abschnitt 2.4) zeigt
eine Beispieltabelle mit einem Zustand `refused`; seine Invariante Ersteller ≠ Freigeber
(Abschnitt 4) gilt unabhängig vom gewählten Modell. Ob die Invariante „keine Verweigerung ohne
zugeordneten Grund und Begründung" (Abschnitt 4) auch für Verweigerungspfad A gilt — laut 044
verlangt nur Verweigerungspfad B Katalogtreffer und Begründung, `refusal_no_claim` hat beides
nicht —, legt der Plan nicht fest: offen, Frage an Recht mit dem Vorabzug vor 044 (E15).

## Entscheidung

Standardannahme aus Plan 3 („Zustandsmodell und Verweigerung", „Letztverantwortung Freigabe und
Rechtstor") und Plan 4 (Zeile 0012). Zwei Modelle stehen zur Wahl; der Plan baut **Modell A**.

### Modell A — Verweigerung als Antwortart (Standard)

- **Keine Reform in der Beta; die elf Zustände bleiben.** Ein neuer Zustand entsteht nur mit ADR.
- **Verweigerung ist eine Antwortart**, kein Zustand: `answerKind: answer | refusal_no_claim |
  refusal_with_ground` auf der Antwortversion, bei Verweigerungspfad B mit `refusalGroundId` (Pflichtauswahl
  aus dem Grundkatalog als Daten, jeder Grund mit `legalRef` und `verified: false`) und
  Pflichtbegründung.
- **Sie läuft durch die bestehende Kette** `in_review → approved → staged → delivered`. Damit gelten
  Vier-Augen (R-GUARD-06) und Rechtstor (R-GUARD-07) automatisch; dazu die Guards R-GUARD-08
  „Verweigerung nur mit Rechtsfreigabe-Ereignis" und R-GUARD-09 Grundpflicht (Verweigerungspfad B ohne
  `refusalGroundId` oder Begründung → 409; `_actions` enthält die Verweigerung erst, wenn der Guard
  erfüllbar ist).
- **Rechte:** `question.refuse.propose` (Standard `legal`, `coordination`) und
  `question.refuse.approve` (Standard `approver`). Die Rolle `approver` trägt die Freigabe; Recht
  empfiehlt (`question.legal.clear` als eigenes Ereignis) und gibt nicht frei (E25). Das
  Rechtekonzept (Abschnitte 2.1 und 2.4) kennt dafür noch `answer.approve.legal` als Rechtsfreigabe;
  die Trennung in Empfehlung und Freigabe zieht das umbasierte Rechtekonzept (052) nach.
- **Rechtstor vor der Bühne:** Geltungsbereich als Datentabelle `LEGAL_GATE_BY_TRACK` (Standard:
  alle drei Antwortpfade), zur Laufzeit nicht abschaltbar; kein Eilpfad an der Freigabe vorbei.
- **Nebenaspekte sind Kennzeichen, keine Zustände:** `deferred` (Pflichtgrund, Wiedervorlage),
  `correctionOpen` (aus `delivered` mit Grund; geschlossen durch eine neue freigegebene Version und
  erneutes Vorlesen; Frist aus dem Ereignis `VotingOpened` des Tagesordnungspunkts), `followUp`
  (Nachfrage als Thread: `parentQuestionId`, `relation follow_up | clarification`, Verknüpfung nur
  innerhalb desselben Jahrgangs). Jedes Kennzeichen ist ein Guard oder eine Zeile in
  `transitions.ts` mit Regel-ID (R-TRANS-14..16) und Test.
- **Fünf Anzeigegruppen** fassen die elf Zustände in der Oberfläche zusammen (Plan 4). Welche
  Zustände welche Gruppe bilden, legt der Plan nicht fest; dieser ADR legt es nicht fest (offen;
  der Plan führt dazu keine Registerzeile — Registerzeile folgt (Übergabe an 014)).
- **Reform des Zustandsmodells erst nach der Beta**, dann über eine Projektion.

### Modell B — zwei Hauptzustände (Alternative mit Preis)

Verweigerung als eigene Zustände `refusal_proposed` und `refused` neben den elf bestehenden, wie
die Beispieltabelle des Rechtekonzepts (Abschnitt 2.4) sie andeutet. Preis laut Plan 3: **2,5 AStd**
für den Wechsel. Was dabei nicht mehr automatisch gilt: Vier-Augen, Rechtstor und die Bühnenkette
müssten für die neuen Zustände als eigene Zeilen und Guards nachgezogen werden, Export und
Anzeigegruppen brauchen eine eigene Behandlung, und der Automat wächst auf dreizehn Zustände. Was
dafür spricht: die beiden Nichtbeantwortungen wären als Zustandspfade sichtbar, so wie Recherche
Z.24 es formuliert („getrennte Statuspfade"). Ob die Trennung als Antwortart (Modell A) den
Nachweis rechtlich gleichwertig trägt, ist die Frage an Recht.

## Konsequenzen

**Positiv (Modell A).** Kennzeichen sind additiv und brechen keine Tests; die Übergangstabelle
bleibt Daten. Eine Verweigerung erreicht die Bühne nur freigegeben und rechtlich geprüft, ohne dass
dafür neue Regeln nötig sind. Der Export markiert Verweigerungen mit Grund (B12); die Bühne zeigt
einen Formulierungsbaustein aus dem Katalog; der Katalog zeigt „ungeprüft", bis Recht freigibt
(E15).

**Negativ.** Eine Verweigerung ist technisch eine Antwortversion; Historie, Bühne und Export müssen
die Antwortart sichtbar machen, damit aus einer Verweigerung nie eine „Antwort" wird. Die
Beispieltabelle des Rechtekonzepts (`refused` als Zustand, `answer.approve.legal` als
Rechtsfreigabe) ist eine Illustration; das umbasierte Rechtekonzept (052) passt sie an dieses Modell
und an die Trennung von Empfehlung (`question.legal.clear`) und Freigabe (`approver`, E25) an.

**Risiko.** Baut 044, bevor Recht gelesen hat, trägt es „auf Standard gebaut"; ein späterer Wechsel
kostet den Preis aus Modell B.

## Kosten bei Änderung

- Wechsel auf Modell B (`refusal_proposed`/`refused`): 2,5 AStd (Plan 3).
- Zustandsreform nach der Beta über eine Projektion: 3–6 AStd (Plan 3).
- Kennzeichen ergänzen oder entfernen: eine Zeile oder ein Guard mit Regel-ID und
  Wahrheitstabellen-Diff (Plan 3 beziffert eine Übergangszeile mit 0,5 AStd).
- Grundkatalog und Normzitate: Datenpflege (076 und Kleinänderungsspur), kein Code (Plan 3).

## Verworfene Alternativen

- **Modell B in der Beta.** Nicht gewählt; steht oben mit Preis, Entscheidung mit Recht (Plan 4).
- **Zustandsreform in der Beta.** Verworfen: erst nach der Beta über Projektion, 3–6 AStd (Plan 3).
- **Zurückstellen, Korrektur, Nachfrage als eigene Zustände.** Verworfen: der Automat würde die
  Risikoschwelle von 15 Zuständen reißen; Kennzeichen sind additiv (Plan 3).
- **Verweigerung am Rechtstor vorbei oder ein Eilpfad.** Verworfen: B6, E25 (kein Eilpfad; die
  offene Option ist eine beschleunigte Rechtsfreigabe mit verkürzter Prüfliste, nie eine Umgehung).
- **Statuslogik in der Oberfläche** (etwa den Verweigerungsknopf nach Rolle einblenden).
  Verworfen: ADR 0001, Grenze 1; die Oberfläche rendert `_actions`.
- **Vier-Augen nur organisatorisch.** Verworfen: Rechtekonzept Abschnitt 4 (Invariante im Code).

## Nachweis

Scheibe **044** (Plan 4): Test je neuer Regel-ID inklusive Vier-Augen-Negativtest;
Wahrheitstabellen-Diff freigegeben; Katalog mit 0 verified sichtbar als „ungeprüft"; `pnpm gates`.
Kennzeichen und Threads aus 046 (E30), Vertragsform aus 043, umbasiertes Rechtekonzept aus 052,
Katalogpflege in 076. Aus B6: Test je Regel-ID, generiertes `docs/legal-trace.md`; zu Prüfpunkt 4:
Verweigerungsdialog- und Bühnen-Screenshots, Übergabevermerk an Recht.

## Offene Registerzeilen

- **E15** Legal-Verifikation: Normzitate und Verweigerungskatalog (`verified: false`, „ungeprüft");
  dazu die Frage an Recht, ob Grund- und Begründungspflicht auch für Verweigerungspfad A gilt (mit
  dem Vorabzug vor 044).
- **E25** Letztverantwortung Freigabe, Vertretungen, Rechtstor; Option beschleunigte
  Rechtsfreigabe; Trennung Empfehlung/Freigabe gegenüber Rechtekonzept 2.1/2.4.
- **E30** Zurückstellen und Korrektur nach dem Vorlesen.
- **E37** Freigabetiefe je Pfad und Kapazität Recht (Prüfliste je Pfad als Daten).
- **E40** Eine oder zwei Rechtsrollen — eine zweite Freigabe wäre ein weiterer Guard.
- Fünf Anzeigegruppen (Zuordnung Zustand → Gruppe): keine E-Nummer; Registerzeile folgt (Übergabe
  an 014).
