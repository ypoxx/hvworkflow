# ADR 0006 — Bühne je Person und Gerät, Antwortbündel

**Status:** vorgeschlagen · **Datum:** 23.09.2026 · **Entscheider:** Projektleitung (Antwortbündel, E2); Projektleitung und Vorstand (Podium-Sichtbarkeit, E7); Konzern-IT und Projektleitung (Endgeräte, E33) · **Annahme:** Prüfpunkt 5 (Plan 4)

## Kontext

Heute gibt es eine Bühne für alle und `stageAssignment` als Enum mit vier Werten. B7 verlangt je
Podiumsmitglied einen Bühnenplatz mit eigener Warteschlange, Vorblättern ohne „Vorgelesen",
Geräteeinstellungen und eine Ansicht, die 20 s Verbindungsverlust übersteht. ADR 0001 hat den
serverseitig gerenderten Monolithen genau deshalb verworfen: die Bühne muss ein eigenständiger,
netzunabhängig gepufferter Client sein. Zwei Fragen an die Projektleitung sind offen: wer die
Antwortrunde zusammenstellt (Frage 3, E2) und ob das Podium nur eigene Fragen sieht (Frage 8, E7).

## Entscheidung

Standardannahme aus Plan 3 („Zusammenstellung der Antwortrunde", „Sieht das Podium nur eigene
Fragen") und Plan 4 (Zeile 0006):

- **Bühnenplatz statt Enum.** `stageAssignment` wird eine Bühnenplatzliste je Jahrgang
  (`{id, label, personId?, deviceId?}`), administriert in 040; die vier heutigen Enum-Werte werden
  die Standardplätze im Seed.
- **Warteschlange je Bühnenplatz als Filter in `getStage`.** Der Kontext (Rollenzuordnung,
  Bühnenplatz) wird im Dienst aufgelöst, nie aus einer Angabe des Clients. Meeting-Konfiguration
  `podiumVisibility = own | all_marked`, Standard `own`, als Attributfilter in `can()` und `getStage`.
- **Sortierstrategie als Daten** (Standard `stagePosition`); das Antwortbündel liefert nur eine
  zweite Strategie.
- **Vorblättern ohne Zustandswechsel.** Geräteeinstellungen (Schrift, Zeilenabstand, Gewicht) je
  Gerät im Browser — eine legitime Per-Viewer-Bequemlichkeit. Der Inhalt wird beim Öffnen
  eingefroren; eine Korrektur erscheint als Hinweisstreifen.
- **Eigenes, minimal gebündeltes Podium-Modul.**
- **Offline liest die Bühne weiter, schreibt aber nichts selbst:** die nächsten 20 freigegebenen
  Antworten sind lokal gepuffert, ein Hinweisstreifen zeigt „Stand HH:MM:SS". „Vorgelesen" wird
  offline nur als Absicht gepuffert; der Status bleibt `staged`, bis der Dienst die Absicht
  angewendet hat, und die Ansicht zeigt bis dahin „nicht bestätigt". Der Zustandswechsel geschieht
  immer im Dienst (ADR 0001, Regel 5). „Vorgelesen" prüft den Hash der vorgelesenen Antwortversion
  statt If-Match (B9).
- **Antwortbündel als eigene Entität** `AnswerBundle` (`meetingId, number, questionIds[], strategy,
  assembledBy, closedAt`), manuell durch die Koordination, Zielgröße 20, Standardreihenfolge nach
  Bühnenplatz, dann Nummer; getrennt von `Speaker.round`, das unverändert bleibt. Das Bündel
  referenziert Fragen-IDs und berührt die Zustandsmaschine nicht. Glossarzeile „Antwortbündel" in 018.

## Konsequenzen

**Positiv.** Ein Vorstandsmitglied sieht nur seine Warteschlange, ohne dass ein Rollenname im Code
steht; die Sichtbarkeit ist eine Konfiguration plus Attributregel. Die Bühne überlebt eine
Partition, ohne Statuslogik in den Client zu holen. Das Bündel ist additiv.

**Negativ.** Ein zweites Client-Bundle mit Größen-Tor, lokaler Puffer, Absichtswarteschlange mit
Idempotenzschlüssel und Wiederaufnahme über den SSE-Strom (ADR 0014). Die Geräteklasse, der Browser
und die Speicherrichtlinie im Saal sind eine Anfrage an die Konzern-IT (E33); der Test auf der
realen Geräteklasse liegt in der Anpassungsphase.

**Risiko.** Wenn die Oberfläche anfängt, den Bühnenplatz selbst zu bestimmen, ist der Filter
wertlos; eine Client-Behauptung wird im Dienst ignoriert und mit einem Negativtest belegt (047).

## Kosten bei Änderung

- Neue Sortierstrategie: < 1 AStd (Plan 3).
- Bündel = bestehende Runde: das Bündel wird ein Filter auf `round`, 1 AStd; Wegfall: Ansicht
  ausblenden, Entität bleibt (Plan 3).
- `podiumVisibility` umstellen: Minuten; Recht auf „nur eigene" einschränken: eine
  Wahrheitstabellenzeile (Plan 3).
- Endgeräte (E33): 058 baut auf Standard; Test auf der realen Geräteklasse in der Anpassungsphase.

## Verworfene Alternativen

- **Bühnensicht aus einer Angabe des Clients** (das Gerät nennt seinen Platz). Verworfen: der
  Kontext wird im Dienst aufgelöst; eine fremde Platzangabe wird ignoriert (Plan 3).
- **Statuswechsel offline im Client** („Vorgelesen" lokal setzen und später abgleichen). Verworfen:
  keine Statuslogik im Client (ADR 0001, Regel 5); offline gibt es nur die Absicht.
- **Bündel als Sicht auf die bestehende Runde.** Nicht gewählt, bleibt Option mit Preis (E2).
- **Geräteeinstellungen serverseitig je Person.** Verworfen: Plan 4 stuft sie als Per-Viewer-
  Bequemlichkeit im Browser ein; der Dienst hält keine Anzeigepräferenzen.
- **Gemeinsame Bühne für alle Podiumsmitglieder wie heute.** Verworfen: B7.

## Nachweis

Scheiben **056** und **058** (Plan 4): Test „podium auf Platz ceo sieht keine cfo-Fragen im
Standard"; Playwright Vorblättern ohne Zustandsänderung, Korrektur zeigt Streifen; Screenshots je
Einstellung; Bündelgröße; Zeitbudget Bühnenwechsel; Playwright `setOffline` 20 s → „Vorgelesen"
als Absicht → online → der Dienst wendet an, Ereignis trägt `occurredAt` mit Quelle `device` und
`recordedAt` vom Dienst; keine Doppelanlage nach Wiederverbindung; Screenshot vom Podiumsgerät (B7).
Bühnenplätze aus 040, Attributfilter aus 047, Bündel-Vertragsform aus 043 und Verhalten aus 057 (E2).

## Offene Registerzeilen

- **E2** Zusammenstellung der Antwortrunde — Bündel getrennt von der Runde oder dieselbe Runde.
- **E7** Podium sieht nur eigene Fragen — `podiumVisibility=own` als Standard.
- **E33** Endgeräte und Browser-Richtlinie (Podium, Erfassung, Externe), Saalnetz.
- **E41** Performance-Ziel D9 — das Zeitbudget für den Bühnenwechsel steht bei 150 ms, bis E41
  entschieden ist.
