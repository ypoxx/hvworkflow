# Zielbild Oberfläche — UI-Bewertung und Prototyp als Quelle für die Beta

**Quelle:** Bewertung der Demo auf Stand `429632d` (alle acht Rollen, 1440, 1280 und 1024 px) und ein
klickbarer Prototyp mit drei Ansichten, beides am 25.09.2026 auf Wunsch des Eigentümers in einer
Agentensitzung erstellt. **Prototyp:** `docs/zielbild/` (Anleitung dort), Bilder
`docs/evidence/089-*.png`. **Übernahme:** Scheibe 089. **Zweck:** Jeder Punkt hat eine ID und genau einen
Ort im Plan (Abdeckungsmatrix, Plan 5.0): eine Scheibe, die Takt-Spur, eine offene Registerzeile oder ein
bewusstes Nein. Scheiben-Specs zitieren die IDs.

**Statusschlüssel** (wie `2026-09-quickview-projektleitung.md`): `ist` gebaut · `plan` in der genannten
Scheibe vorgesehen · `neu` nicht vorgesehen, wird der genannten Scheibe zugeschlagen · `umbau` vorhanden,
gehört anders · `E..` offen im Entscheidungsregister, gebaut wird die Standardannahme · `nein` bewusst
nicht im Produkt. **Aufwand:** S unter einem halben Tag, M ein bis zwei Tage (Agentenzeit).

---

## 1. Befunde der UI-Bewertung (U1–U11)

Was heute stört, unabhängig vom Zielbild. Die `neu`-Punkte sind S-Punkte für die Takt-Spur (Plan 5.9); jeder
bekommt beim Bau seine Mini-Spec `docs/slices/takt-NNN-*.md`.

| Nr. | Befund | Stelle | Status | Ort |
|---|---|---|---|---|
| U1 | In der Beantwortungsliste bleiben vom Fragetext zwei, drei Wörter, bei 1280 px eines; der Name der Rednerin hat Vorrang. Bei 1024 px überlagern sich die Spaltenköpfe. | `apps/web/src/features/answers/WorkList.tsx` (Zeile mit `maxWidth: 96`) | neu | Takt-Spur |
| U2 | Die Kopfzeile läuft ab 1280 px über: Demo-Kennzeichen und Zurücksetzen fallen heraus, bei 1024 px auch die Sprachwahl. | `apps/web/src/app/Header.tsx` | neu | Takt-Spur |
| U3 | Die Leertaste setzt auf der Bühne sofort „vorgelesen"; der einzige Rückweg ist „Zurückgeben" bis „klassifiziert", die Freigabe geht verloren. | `apps/web/src/features/stage/Page.tsx` (Tastenhandler) | E52 | 056, 058 |
| U4 | Drei verschiedene Restzahlen auf der Bühne (Navigation 9, „Offen 332", „noch 8"); die Zahl unter dem Balken der Kopfzeile trägt keine Beschriftung. | Bühne, `apps/web/src/app/HeaderStrip.tsx` | neu | Takt-Spur |
| U5 | Eine erfasste Einzelfrage bietet in der Beantwortung keinen nächsten Schritt; in der Rolle Versammlungsbüro ist „Antwort zurückgeben" das größte Element der Bühne. | Beantwortung, Bühne | umbau | 021/053 (Klassifizierung), 056 (Z22) |
| U6 | Der rote Randbalken der Liste hängt nur am Alter und ist ab 45 Minuten immer rot, ohne Legende. | `apps/web/src/features/answers/lib.ts` (`urgencyLevel`) | neu | Takt-Spur (Legende) |
| U7 | Die Kürzel-Kreise (FV, AR, VV, VM) in der Bühnen-Warteschlange werden nirgends erklärt. | `apps/web/src/features/stage/` | neu | Takt-Spur |
| U8 | Die Kürzel-Hilfe (`?`) nennt nur die globalen Tasten, nicht `Alt+Q`, Leertaste und `R`. | `apps/web/src/app/ShortcutsDialog.tsx`, Feature-Register | neu | Takt-Spur |
| U9 | In der Detailansicht steht der Stand doppelt; „keine Angabe" erscheint dreimal untereinander. | `apps/web/src/features/answers/QuestionDetail.tsx` | neu | Takt-Spur |
| U10 | Der Fachbereich sieht die Klarnamen der Redner in Liste und Detail (Recherche Z.116, Register S4 „Standard an"). | Beantwortung | plan | 026, 054 (Z8) |
| U11 | Rückmeldungen #14 (Korpus 118/800) und #15 (Redezeit, Art) sind noch sichtbar. | Wortmeldungen | plan | 080 |

## 2. Zielbild (Z1–Z26)

### Schreibraum — Fachbereich schreibt eine Antwort

| Nr. | Vorschlag | Begründung | Status | Ort | Aufwand |
|---|---|---|---|---|---|
| Z1 | Nur eigene Zuweisungen, älteste oben, Fragetext zweizeilig lesbar, Treffer-Kennzeichen an der Frage | Rückmeldungen #24, #28; U1 | plan | 054 | — |
| Z2 | Vorbereitete Antwort aus der Erwartungskarte über dem Editor: Übereinstimmung in Prozent, „Ganz lesen", „Übernehmen" mit Rückgängig, Hinweis „Dein Entwurf weicht ab: 45 Prozent statt 47 Prozent" | Recherche Z.175 (Fragenprognose), B-Liste „Vorbereitung §7" | E50 | 054 nach E50 | M |
| Z3 | Zahlenprüfung im Editor: belegt (durchgezogen unterstrichen), ohne Beleg (gepunktet), Widerspruch zu einer schon vorgelesenen Antwort (rot hinterlegt); Liste „Prüfung vor Legal Clearing" und „Belege zur Antwort"; Legal sieht dieselben Markierungen | Recherche SOLL Z.240; Engpass Rechtsfreigabe (Recherche Z.27) | E51 | 054, 059 nach E51 | M |
| Z4 | Korrektur per Klick für bekannte Werte („47 Prozent einsetzen"), mit Rückgängig | wie Z3 | E51 | mit Z3 | — |
| Z5 | Vorlesezeit aus der Wortzahl (130 Wörter je Minute), Ziel zwei Minuten, Hinweis bei Überschreitung | Antwortrunde 20 × 2 min (Feedback Abschnitt 1) | neu | 054 | S |
| Z6 | Werkzeugleiste Hausformat: fett, kursiv, Hervorhebung, Aufzählung; Hinweis „Schrift und Größe kommen von der Ansicht" | #27, #30, #31, E6 | plan | 055 | — |
| Z7 | Vollbild blendet Liste und Prüfung aus | #29 | plan | 054 | — |
| Z8 | „Wortmeldung 15" statt Name für den Fachbereich | Recherche Z.116, S4; U10 | plan | 054 (Anzeige), 026 (Standard) | — |
| Z9 | „Weiterleiten an Legal Clearing" als einzige primäre Aktion, `Strg+Enter`, Rückfrage bei Widerspruch, Rückgängig; danach öffnet die nächste Frage | #32, E5 | umbau | 054 (Rückfrage erst mit E51) | S |

### Lagebild — Versammlungsbüro sieht den ganzen Fluss

| Nr. | Vorschlag | Begründung | Status | Ort | Aufwand |
|---|---|---|---|---|---|
| Z10 | Eine große Zahl: älteste unbeantwortete Frage mit Station und Einheit, darunter die drei nächstältesten | Recherche Z.247 | plan | 061 | — |
| Z11 | Prognosen aus dem Tempo: „Legal abgebaut ca. 16:05 bei 9 Freigaben je 15 min", „nächste Antwortrunde voll ca. 16:02" | Recherche Z.27 | neu | 061 | S |
| Z12 | Flussbild: ein Punkt je Einzelfrage in ihrer Station, Alter als Farbe und Form, Tempo je Station („+14 in 15 min"), Kennzeichen „Engpass", Tabelle mit denselben Zahlen | #11, #25 | neu | 061 | M |
| Z13 | Faden je Frage: Stationen mit Uhrzeit, aktuelle Station mit Verweildauer, Absprung in den Schreibraum | Recherche Z.21 (Nachweisführung) | neu | 061 (Drill-down) | S |
| Z14 | Rednerwand mit Abschluss-Check: Wortmeldungen mit offenen Fragen zuerst, vollständige in einer Zeile eingeklappt, aufgeklappt jede Antwort mit Uhrzeit und Vorstandsmitglied | Recherche Z.78 | plan (Ansicht neu) | 087 | S |
| Z15 | Widerspruch zur Niederschrift als eigener Kanal über dem Lagebild, „An Notar übergeben" mit Empfangsvermerk | Recherche Z.74 | plan | 050, 085 | — |

### Teleprompter — ein Gerät je Vorstandsmitglied

| Nr. | Vorschlag | Begründung | Status | Ort | Aufwand |
|---|---|---|---|---|---|
| Z16 | Eigene Setliste mit Fortschritt („3 von 6"), Restzeit, Vorschau ohne „vorgelesen" | #7, #10, E7 | plan | 056 (Runde: 057) | — |
| Z17 | Jeder Satz beginnt in einer neuen Zeile; kein Scrollen der Antwort | Recherche Z.250 | neu | 056 | S |
| Z18 | Weiter erst nach 0,6 s Halten (Finger, Maus, Leertaste), danach 5 s „Rückgängig"; ein Presenter-Klicker schaltet sofort, ebenfalls mit Rückgängig; Rückmeldung „Etwas länger halten" | U3; ändert Designprinzip 7 | E52 | 056, 058 | S |
| Z19 | Anzeige je Gerät: Schriftgröße, Zeilenabstand, Saallicht, im Gerät gemerkt | #6 | plan | 056 | — |
| Z20 | Dunkler Bühnenmodus als Standard des Podiums, „Saallicht" schaltet hell | Blendung unter Bühnenlicht; heute „nur hell" (`index.css`) | E53 | 056 | S |
| Z21 | Ruhige Zeile aus dem Versammlungsbüro über dem Text, verdeckt ihn nie | Recherche Z.253, Z.261 (Souffleur-Kanal, B-Liste) | E54 | — | — |
| Z22 | „Antwort zurückgeben" als leiser Textknopf mit Grundauswahl, nicht als zweitgrößte Fläche | U5 | neu | 056 | S |
| Z23 | „Nur Bühne" blendet alles außer der Bühne aus | #3, #9 | ist | 020 | — |

### Übergreifend

| Nr. | Vorschlag | Begründung | Status | Ort | Aufwand |
|---|---|---|---|---|---|
| Z24 | Rundgang in neun Schritten mit echten Klicks | Vorführung für die Projektleitung | nein (Produkt) | Vorführhilfe in Feedback-Runden (022, 063) | — |
| Z25 | Zeitraffer im Lagebild | nur Prototyp | nein | — | — |
| Z26 | Hinweise je Ansicht, die beim Überfahren die Stelle markieren | Kontexthilfe | plan | 062 | — |

## 3. Neue Entscheidungen (E50–E54)

Fünf Vorschläge widersprechen dem heutigen Plan oder den Designprinzipien. Sie stehen im Register mit
Standardannahme; gebaut wird der Standard, bis eine Antwort da ist. Vorschlag: in der Feedback-Runde 2 am
09.10.2026 zusammen mit dem Prototyp zeigen, Antworten bis Prüfpunkt 2 (16.10.2026).

| Nr. | Frage an die Projektleitung | Standardannahme |
|---|---|---|
| E50 | Soll der Fachbereich schon in der Beta vorbereitete, vor der HV freigegebene Antworten angeboten bekommen (Erwartungskarte)? | Nein, bleibt Teil der B-Liste „Vorbereitung §7"; Z2 bleibt Bild. |
| E51 | Soll das Tool Zahlen im Antworttext gegen eine Faktentabelle und gegen schon vorgelesene Antworten prüfen, bevor Legal freigibt? Wer pflegt die Faktentabelle? | Nein in der Beta; Z3 und Z4 bleiben Bild. |
| E52 | Soll „vorgelesen" auf der Bühne erst nach kurzem Halten gelten, mit fünf Sekunden zum Zurücknehmen? | Ja, als lokal gehaltene Absicht (058), ohne neues Ereignis im Kern; Designprinzip 7 wird angepasst. |
| E53 | Soll die Bühne dunkel sein können? | Ja, nur die Bühne, als Anzeigeeinstellung je Gerät, Standard hell; alle übrigen Ansichten bleiben hell. |
| E54 | Braucht die Bühne einen Rückkanal für kurze Hinweise des Versammlungsbüros? | Nein in der Beta, bleibt B-Liste „Rollen-Chat, Souffleur-Kanal". |

## 4. Wie die Scheiben das Zielbild nutzen

- Jede betroffene Scheibe im Plan trägt eine Zeile *Zielbild (089)* mit ihren Z-Nummern. Ihre Spec
  übernimmt die Punkte als Text; der Prototyp ist Gestaltungsreferenz, nicht Spec.
- Implementierer öffnen `docs/zielbild/` (Anleitung in der README dort) und bauen die Ansicht mit den
  Mitteln des Produkts: `HvApi`, `_actions`, Übergangstabelle, i18n DE/EN.
- Die Design-Kritik vergleicht den Screenshot der gebauten Ansicht mit `docs/evidence/089-*.png`.
- Wer einen Punkt baut, setzt hier den Status nach (`plan` → `ist`) und nennt die Scheibe.
