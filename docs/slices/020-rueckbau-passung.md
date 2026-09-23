# 020 — Oberfläche: Rückbau und Passung (S-Punkte der Projektleitung)

**Status:** spec
**Risikoklasse:** niedrig · 2 AStd · Kalender 02.10.2026 (W1) · Lanes: web-answers, web-capture, web-stage,
web-history, web-speakers, web-shell (+ e2e: eigene Datei und, nur wo diese Spec es verlangt, die Alt-Specs;
deshalb läuft 013 nicht gleichzeitig)
**Rolle/Modell:** Implementierer-Oberfläche · Sonnet 5; Design-Kritik Fable 5.1 vor dem Review; Review Opus 5.5
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 9, 10, 12; docs/design-prinzipien.md D1–D10
**Quellen-IDs:** Feedback-Auswertung (docs/feedback/2026-09-quickview-projektleitung.md) Punkte #3, #9, #10, #13,
#17, #21, #23, #26, #28, #32; Plan 5.3 Scheibe 020; Plan 6.6 (Takt); Register E5 (Weiterleiten nur Anzeige)
**Depends on:** 017 (gemergt)
**Perspektive:** UX, Barrierefreiheit · **Glossar: neue Begriffe:** nein („Weiterleiten" ist Anzeige, Glossarzeile in 018)

## Ziel

Wörtlich die folgenden Feedback-Punkte, jeder mit `data-testid` und Screenshot-Nachweis. Rechte kommen nur aus
`_actions` (Regel 4); kein Rollenname in Komponenten. Alle Texte über das i18n-Modul des Features (017), DE und en-US.

1. **#13 Uhr klein, ohne Sekunden.** `apps/web/src/app/Clock.tsx`: Anzeige HH:MM, klein und gedämpft; Aktualisierung
   höchstens einmal je Minute (heute viermal je Sekunde), zeitlich auf den Minutenwechsel ausgerichtet.
2. **#17 Griff sichtbar, Hinweis im Rundenkopf.** Wortmeldeliste: Ziehgriff dauerhaft sichtbar (nicht nur bei Hover),
   Cursor `grab`; ein kurzer Hinweis „Zum Umsortieren am Griff ziehen" (oder gleichwertig, Hausvokabular) im Kopf jeder
   Runde statt nur über der Liste; Tastaturweg bleibt.
3. **#21 Erfassungskarte schlank.** Die Karte einer Einzelfrage in der Erfassung zeigt nur Nummer, Wortlaut und Stand.
   Die Klassifizierung (Pfad, Bühnenzuordnung, Zuweisung) verschwindet von der Karte und ist nur noch über eine
   ausdrückliche Aktion „Klassifizieren" (Dialog) erreichbar, und nur wenn `_actions` sie enthält — bis 053 sie in die
   Steuerungsansicht verlegt. Kein Funktionsverlust.
4. **#23 TOP optional und ausgeblendet.** In der Erfassung ist der Tagesordnungspunkt standardmäßig ausgeblendet; er
   bleibt im Modell (optionales Feld im Vertrag) und wird nicht mehr abgefragt. Eine sichtbare Einstellung zum
   Einblenden ist nicht nötig (Nicht-Ziel).
5. **#26 Lesehinweis.** In der Beantwortung zeigt das Detail einer Einzelfrage „In dieser Rolle nur lesen" (en-US: „Read
   only in this role"), wenn `_actions` keine Bearbeitungsaktion für diese Frage enthält; gleichartig in Erfassung und
   Wortmeldeliste, wo eine Person ohne Schreibrecht heute stumm keine Knöpfe sieht.
6. **#32 „Weiterleiten" als Anzeige.** Die Aktion `question.submit_review` heißt in der Oberfläche „Weiterleiten"
   (en-US „Forward"); Ereignis und Operation bleiben unverändert (E5, nur i18n). Historie zeigt das Ereignis
   entsprechend.
7. **#3/#9 „Nur Bühne" als Standard, wenn die Person nur vorliest.** Der Standard von „Nur Bühne" wird aus den Rechten
   abgeleitet, nie aus dem Rollennamen: gleiches Muster wie `deskActions` in `features/capture/Page.tsx` (Aktionen aus
   `_actions` einer Probefrage bzw. der Bühnenfragen). Enthält die Rechtemenge das Vorlesen und keine Erfassungs-,
   Klassifizierungs-, Entwurfs- oder Freigabeaktion, startet die Bühne in „Nur Bühne". Eine bewusste Wahl der Person
   (bestehender localStorage-Schlüssel) hat Vorrang.
8. **#10 Warteschlange anklickbar mit Vorschau.** Auf der Bühne öffnet ein Klick (und Enter) auf eine Frage der
   Warteschlange eine Vorschau mit Frage und freigegebener Antwort, **ohne** Zustandsänderung (kein Vorgelesen, keine
   Schreiboperation); Escape schließt. Ein Zähler „noch n" zeigt, wie viele Fragen nach der aktuellen noch kommen.
9. **#28 TOP und Erfassungszeit aus der Beantwortung.** Im Detail der Beantwortung entfallen TOP und Erfassungszeit
   (heute `features/answers/QuestionDetail.tsx`); die Historie behält sie.
10. **Leere Listen (Fehlerpfad-Tor, Entwicklungsplan 5.3, dieser Scheibe zugeordnet).** Die e2e-Datei prüft den
    gestalteten Leerzustand mindestens für: Beantwortung mit einem Filter ohne Treffer, Bühne ohne Warteschlange (Rolle
    oder Zustand, in dem nichts auf der Bühne steht), Erfassung ohne Redebeitrag. Fehlt ein Leerzustand, wird er in
    der betroffenen Ansicht ergänzt (i18n, Hausvokabular).
11. **prefers-reduced-motion.** Globale Regel in `apps/web/src/styles/**`: Übergänge und Animationen werden bei
    `prefers-reduced-motion: reduce` abgeschaltet oder auf ≤ 0,01 s gesetzt.

## Nicht-Ziele

- Keine Entfernung von Redezeit, Ring, Timer, Spalte „Art" (080). Kein Korpuswechsel (080).
- Keine Steuerungs- oder Fokusansicht (053, 054), kein Weiterleiten an eine andere Einheit (048), keine
  Bühne je Gerät (056), keine Anzeigeeinstellungen je Gerät (056).
- Keine Änderung an Kern, Vertrag, Dienst, Rechten. Keine neue Route.
- Keine Takt-Zeile schreiben: die Live-Zeit entsteht erst mit einem Deploy nach Go des Eigentümers; der
  Orchestrator trägt Nachrichtenzeit und Stand im Tagesbericht ein.

## Files allowed

- `apps/web/src/app/Clock.tsx` und, falls für die Kopfzeile nötig, `apps/web/src/app/Header*.tsx`
- `apps/web/src/features/{speakers,capture,answers,stage,history}/**`
- `apps/web/src/i18n/{shell,speakers,capture,answers,stage,history}.{de,en}.ts`
- `apps/web/src/styles/**` (nur Punkt 11)
- `apps/web/e2e/020-rueckbau-passung.spec.ts` (neu)
- Alt-Specs `apps/web/e2e/002-speakers-capture.spec.ts`, `003-answers-stage.spec.ts`, `abnahme.spec.ts`: nur
  Selektor-Anpassungen, die Punkt 3 (Klassifizieren über Aktion) oder Punkt 6 (Beschriftung) erzwingen
- `docs/evidence/020-*.png` (neu)
- diese Datei (`docs/slices/020-rueckbau-passung.md`, Abschnitt „Bericht")

## Akzeptanzkriterium

1. `apps/web/e2e/020-rueckbau-passung.spec.ts` prüft je Punkt 1–10 das beobachtbare Verhalten, u. a.: Uhr ohne
   Sekunden; Griff sichtbar ohne Hover; Karte ohne Klassifizierungsfelder, Dialog „Klassifizieren" erreichbar mit
   Recht und nicht erreichbar ohne; TOP nicht sichtbar in der Erfassung; Lesehinweis in einer Rolle ohne
   Bearbeitungsrecht; Beschriftung „Weiterleiten"; Bühne startet in „Nur Bühne" in der Vorlese-Rolle (Rollenwahl über
   den Demo-Rollenumschalter) und nicht in einer Rolle mit Entwurfsrecht; Vorschau aus der Warteschlange ändert keinen
   Zustand (Zähler und Status vorher = nachher, keine neue Ereignisnummer); „noch n" stimmt.
2. axe (`@axe-core/playwright`, bereits installiert) in dieser e2e-Datei auf den fünf geänderten Ansichten: 0 Verstöße
   „serious" oder „critical".
3. Alle fünf bestehenden Playwright-Szenarien und die neue Datei grün; `pnpm gates` grün.
4. Screenshots `docs/evidence/020-<ansicht>-{de,en}.png` für Wortmeldeliste, Erfassung, Beantwortung, Bühne (mit
   Vorschau) und Kopfzeile; der Bericht nennt je Bild die Feedback-Nummern.

## Nachweise

`pnpm gates`-Ende, Playwright-Ausgabe (alle Szenarien), axe-Ergebnis, Screenshots DE/EN mit Feedback-Nummern.

## Arbeitsweise

- Worktree `/home/user/wt/020`, Branch `claude/slice-020-rueckbau`. Absolute Pfade. Playwright mit eigenem Port
  (`E2E_PORT=43xx`), Chromium liegt unter `/opt/pw-browsers`.
- Jeder Commit nennt die Scheibe und endet in der Betreffzeile mit `[skip netlify]`.
- Playwright-Läufe erzeugen die Bilder unter `docs/evidence/` neu: nur `docs/evidence/020-*` committen, alle anderen
  Änderungen dort vor dem Commit zurücksetzen (`git checkout -- docs/evidence/0[0-1]*` o. ä.). Nicht pushen.

## Bericht

(vom Implementierer)

## Design-Kritik

(Fable)

## Review findings

(vom Reviewer)
