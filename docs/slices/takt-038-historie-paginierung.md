# takt-038 — Historie paginiert und Ereignisstrom-Reiter inkrementell

**Status:** spec · **Risikoklasse:** mittel (Verhaltensänderung im Web ohne Hoch-Auslöser; Leitplanken §4) · **Lanes:** web-history · **Perspektive:** Betrieb (Last), UX
**Rolle:** web-implementer; Review in frischem Kontext (Perspektive Lesezustand 010b/010c/010d und Last), Modell nur in `.claude/agents/`
**Regeln:** AGENTS.md R2, R4 (kein Rollenname; der Reiter richtet sich nach dem 403 aus `listEvents`), R6 (nur `HvApi`), R10 (DE/EN), R12; ADR 0002
**Depends on:** 036a (gemergt; Puffer hinter `HvApi`). Keine Abhängigkeit von 036b.
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

1. **Ergebnisliste seitenweise.** Erste Seite wie heute (`RESULT_LIMIT`). Der Knopf „Weitere laden“ holt die nächste
   Seite über `offset` und hängt sie an, bis `total` erreicht ist. Bei einer Zählung wird nur die erste Seite neu gelesen
   (aus dem Puffer, wenn `questions` nicht betroffen ist). Die weiteren Seiten bleiben sichtbar, bis eine neue Suche oder
   ein Akteurwechsel sie verwirft (010d: Ladeschlüssel je Akteur). Wurde beim Neulesen der ersten Seite `total`
   kleiner oder hat sich die Reihenfolge verschoben, werden die nachgeladenen Seiten verworfen (Zustand „zurück auf Seite
   1“ mit Hinweis), nie still zusammengesetzt.
2. **Ereignisstrom-Reiter inkrementell.**
   - Das erste Laden liest wie heute das Fenster von höchstens `STREAM_SCAN_LIMIT` Ereignissen.
   - Bei weiteren Zählungen wird nur `listEvents(letztesSeq, STREAM_SCAN_LIMIT)` gelesen und angehängt. Das Fenster
     bleibt auf höchstens `STREAM_SCAN_LIMIT` begrenzt; die ältesten fallen heraus.
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
- `apps/web/src/features/history/lib.ts` (nur neue reine Funktionen: Seiten zusammenführen, Fenster fortschreiben)
- `apps/web/src/features/history/lib.test.ts`
- `apps/web/src/i18n/history.de.ts`, `apps/web/src/i18n/history.en.ts` (nur „Weitere laden“, „Ältere laden“, Hinweis
  „zurück auf Seite 1“)
- `docs/evidence/takt-038-historie-weitere.png`
- `docs/folgeliste.md` (nur nicht blockierende Reviewbefunde)

Weitere Dateien sind Scope-Befunde.

## Akzeptanzkriterium

1. **Unit-Tests zuerst rot, dann grün** (`lib.test.ts`, reine Funktionen):
   - (a) zweite Seite wird angehängt, keine Doppel nach `id`;
   - (b) kleineres `total` oder verschobene erste Seite → nachgeladene Seiten verworfen;
   - (c) Fenster fortschreiben: Anhängen neuer Ereignisse, Obergrenze `STREAM_SCAN_LIMIT`, älteste fallen heraus;
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
