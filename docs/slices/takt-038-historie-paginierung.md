# takt-038 — Historie paginiert und Ereignisstrom-Reiter inkrementell

**Status:** spec · **Risikoklasse:** mittel (Verhaltensänderung im Web ohne Hoch-Auslöser; Leitplanken §4) · **Lanes:** web-history · **Perspektive:** Betrieb (Last), UX
**Rolle:** web-implementer; Review in frischem Kontext (Perspektive Lesezustand 010b/010c/010d und Last), Modell nur in `.claude/agents/`
**Regeln:** AGENTS.md R2, R4 (kein Rollenname; der Reiter richtet sich nach dem 403 aus `listEvents`), R6 (nur `HvApi`), R10 (DE/EN), R12; ADR 0002
**Depends on:** 036a (Voraussetzung: der Bau von 036a, Spec #98, ist gemergt, bevor dieser Takt gebaut wird; er liefert den Puffer `liveStore` hinter `HvApi`, auf dem Ziel 1 und Test (a2) aufbauen). Bis dahin wird dieser Takt nicht begonnen. Keine Abhängigkeit von 036b.
**Aufgeteilt aus:** Scheibe 036 („Historie paginiert“), Entscheidung des Orchestrators vom 30.09.2026 nach dem Lesebefund zu Spec 036. Grund: eigene Lane (web-history), andere Reviewperspektive, sonst über einem Agententag.
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/036 (Ziel „Historie paginiert“); Scheiben 010b, 010c, 010d; Register B11

## Befund (Ist-Stand, gelesen auf `59ef4fd`)

- `apps/web/src/features/history/Page.tsx`:
  - Die Ergebnisliste lädt bei jeder Zählung von `useApiVersion` `listQuestions({limit: RESULT_LIMIT, q})` mit 200
    Einträgen (`lib.ts:9`). Einen Weg zu weiteren Einträgen gibt es nicht.
  - Der Korpus für die Kurve lädt `listQuestions({limit: 2000})`.
  - Der Ereignisstrom-Reiter liest bei jeder Zählung zuerst `listEvents(0, 1)` und danach das Fenster
    `listEvents(lastSeq - 5000, 5000)` (`STREAM_SCAN_LIMIT`, `lib.ts:20`) für Tabelle und Lastkurve.
- `listEvents` wird von 036a nie gepuffert. Nach 036a ist der 5000er-Abruf damit der größte verbleibende Abruf je Änderung.
- Der Vertrag bietet `limit`/`offset` für `listQuestions` und `after`/`limit` für `listEvents`; beides genügt.

## Ziel

1. **Ergebnisliste seitenweise.**
   - Erste Seite wie heute (`RESULT_LIMIT`). Der Knopf „Weitere laden“ holt die nächste Seite über `offset` und hängt sie
     an, bis `total` erreicht ist. Es sind höchstens 10 Seiten (2000 Einträge, Vertragsgrenze von `listQuestions`)
     geladen.
   - **Bei jeder Zählung werden alle geladenen Seiten neu gelesen, nicht nur die erste** (Codex P1). Das kostet nur dann
     Netz, wenn sich `questions` geändert hat: 036a macht bei `questions` alle `listQuestions`-Einträge zugleich ungültig
     und liefert sonst aus dem Puffer. So kann keine spätere Seite alte Objekte behalten, wenn sich eine Frage darauf
     ändert.
   - Die neuen Seiten ersetzen die alten erst, wenn alle da sind (ein Paar desselben Stands, wie takt-032 Ziel 3).
   - Passen die neu gelesenen Seiten nicht zusammen (anderes `total` zwischen den Seiten, doppelte oder fehlende `id`
     an den Seitengrenzen), werden die weiteren Seiten verworfen. Es gilt dann der Zustand „zurück auf Seite 1“ mit
     Hinweis, nie eine still zusammengesetzte Liste.
   - Neue Suche oder Akteurwechsel verwirft die weiteren Seiten (010d: Ladeschlüssel je Akteur).
2. **Ereignisstrom-Reiter inkrementell.**
   - Das erste Laden liest wie heute das Fenster von höchstens `STREAM_SCAN_LIMIT` Ereignissen.
   - Bei weiteren Zählungen wird von `letztesSeq` aus **bis zum Kopf nachgeblättert** (Codex P2): `listEvents(c,
     STREAM_SCAN_LIMIT)`, danach `c` = letztes erhaltenes `seq`, so lange, bis eine Antwort weniger als
     `STREAM_SCAN_LIMIT` Einträge liefert oder `c` den `lastSeq` der ersten Antwort erreicht. Erst danach rückt der
     Cursor des Reiters vor.
   - Liegt der Kopf mehr als `STREAM_SCAN_LIMIT` hinter `letztesSeq`, springt `c` auf `lastSeq − STREAM_SCAN_LIMIT`.
     Ältere Ereignisse fielen aus dem Fenster ohnehin heraus; das Fenster wird dann ersetzt statt angehängt.
   - Das Fenster bleibt auf höchstens `STREAM_SCAN_LIMIT` begrenzt, die ältesten fallen heraus. Scheitert eine Seite
     mittendrin, bleibt der alte Cursor, und das Fenster ändert sich nicht (kein halb vorgerückter Stand).
   - Die Tabelle zeigt 200 Zeilen je Seite, mit „Ältere laden“ innerhalb des Fensters.
   - Liefert der Nachlauf einen `lastSeq` kleiner als das letzte `seq` (Rücksicherung, 035b `reset`), wird das Fenster
     verworfen und voll neu geladen.
3. **Korpus** unverändert (`limit: 2000`); nach 036a kommt er aus dem Puffer und wird nur bei `questions` neu geholt.
4. Lese- und Fehlerzustände aus 010b/010c/010d bleiben: 403 aus `listEvents` blendet den Reiter aus wie heute.

## Nicht-Ziele

Keine Vertragsänderung, keine neue Seitengröße im Vertrag, keine Änderung an `liveStore` (036a), an anderen Seiten oder an
der Zeitgrenze der e2e-Tests. Keine unendliche Liste mit automatischem Nachladen beim Scrollen.

## Files allowed

- `docs/slices/takt-038-historie-paginierung.md`
- `apps/web/src/features/history/Page.tsx` (nur Paginierung und inkrementeller Reiter)
- `apps/web/src/features/history/lib.ts` (nur neue Funktionen: Seiten zusammenführen, alle geladenen Seiten neu lesen über `Pick<HvApi, 'listQuestions'>`, bis zum Kopf nachblättern über `Pick<HvApi, 'listEvents'>`, Fenster fortschreiben)
- `apps/web/src/features/history/lib.test.ts`
- `apps/web/src/i18n/history.de.ts`, `apps/web/src/i18n/history.en.ts` (nur „Weitere laden“, „Ältere laden“, Hinweis
  „zurück auf Seite 1“)
- `docs/evidence/takt-038-historie-weitere.png`
- `docs/folgeliste.md` (nur nicht blockierende Reviewbefunde)

Weitere Dateien sind Scope-Befunde.

## Akzeptanzkriterium

1. **Unit-Tests zuerst rot, dann grün** (`lib.test.ts`, reine Funktionen; (a2) mit der Hülle aus 036a):
   - (a) zweite Seite wird angehängt, keine Doppel nach `id`;
   - (b) kleineres `total` oder verschobene erste Seite → nachgeladene Seiten verworfen;
   - (a2) eine Frage auf Seite 2 ändert sich bei gleichem `total` und gleicher erster Seite → nach der Zählung zeigt
     Seite 2 das neue Objekt (alle geladenen Seiten neu gelesen, über die Hülle aus 036a mit gefälschtem Adapter);
   - (c) Fenster fortschreiben: Anhängen neuer Ereignisse, Obergrenze `STREAM_SCAN_LIMIT`, älteste fallen heraus;
   - (c2) 7000 neue Ereignisse zwischen zwei Zählungen (Seitengröße im Test gesenkt): Nachblättern bis zum Kopf, das
     Fenster endet genau beim Kopf ohne Lücke innerhalb des Fensters, der Cursor steht auf dem Kopf; eine scheiternde
     zweite Seite lässt Cursor und Fenster unverändert;
   - (d) `lastSeq` unter dem letzten `seq` → Fenster verworfen;
   - (e) Seiten der Tabelle zu je 200 Zeilen.
2. Die in-process-Suite ist grün, darin `010b`, `010c`, `010d` und die Historie in `abnahme.spec.ts`.
3. Screenshot `docs/evidence/takt-038-historie-weitere.png`: Ergebnisliste nach „Weitere laden“.
4. `pnpm gates` grün auf sauberem Baucommit; `slice-scope` akzeptiert nur die Dateien oben. Jeder Commit nennt
   „takt-038“ und endet mit `[skip netlify]`.

## Wirkung und Risiko

- **Last:** Je Änderung fällt der 5000er-Abruf des Reiters weg (nur Nachlauf). Die Ergebnisliste liest weiter nur die
  erste Seite.
- **Lesezustand:** Nachgeladene Seiten gehören dem Ladeschlüssel des Akteurs (010d). Nach einem Akteurwechsel werden sie
  verworfen.
- **Fehlerfall:** Eine verschobene Reihenfolge führt zurück auf Seite 1, nie zu einer still falschen Liste.

## Bericht (nach Bau ausfüllen)

```
Slice: takt-038-historie-paginierung
Done: <drei Zeilen>
Evidence: Baucommit <sha>; Schluss von `pnpm gates`; docs/evidence/takt-038-historie-weitere.png
Open: —
Touched: <Dateiliste>
```

## Review findings

folgt
