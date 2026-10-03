# takt-042 — zeitkritische Postgres-Tests deterministisch (034a-Grenze, 035b Test 28)

**Status:** spec · **Risikoklasse:** niedrig (nur Testcode in zwei Testdateien, kein Produktivcode, kein Vertrag, keine Persistenz, kein Betrieb; Leitplanken §4. Bräuchte der Bau doch eine Naht im Produktivcode, wäre das ein Befund und die Scheibe würde mittel; die Spec braucht keine, der Prototyp unten belegt es) · ca. 3 AStd · **Lanes:** service (Test)
**Rolle:** builder; Review in frischem Kontext (Perspektive: beweist jeder Test noch dasselbe?), Modell nur in `.claude/agents/` (takt-012)
**Regeln:** AGENTS.md R1, R2, R3, R8 (Zeit nie aus der Wanduhr im Kern; hier: kein Test-Urteil aus Wanduhr-Abständen), R12; 034a T-G2-I-02, N3, „COMMIT gewinnt gegen den Timer“; 035b Test 28 (Entscheidung 4: keine gehaltene Verbindung außerhalb der Fenster)
**Quellen-IDs:** lokale Fehlschläge unter Last (Owner-Meldung vom 03.10.2026); takt-036 (gleiche Datei, andere Ursache)
**Depends on:** keine
**Perspektive:** Test-Determinismus · **Glossar: neue Begriffe:** nein

## Befund (gelesen auf `6146251`)

Beobachtet nur lokal, unter Last durch parallele Docker- oder Gates-Läufe; einzeln je 3/3 grün, CI grün:

1. `apps/api/src/__tests__/postgres-limits034a.test.ts`
   - „a query that hangs past the service timer before the COMMIT answers 503; …“ (einmal, Last etwa 4,5);
   - „a COMMIT that is already on its way wins over the timer: 201, not 408“ (zweimal).
2. `apps/api/src/__tests__/postgres-stream035.test.ts`, Test 28: `busy` war 1 statt 0 (einmal).

**Nachstellung beim Schreiben dieser Spec** (lokales Postgres 16, 16 Kerne, 24 Node-Leerlaufschleifen, Last etwa 25):

| Aufbau | 034a-Datei | Ergebnis |
|---|---|---|
| ein Prozess nach dem anderen, nur CPU-Last | 6 Läufe | 6/6 grün |
| drei Prozesse gleichzeitig, **je eigene Datenbank** | 12 Läufe | 12/12 grün |
| drei Prozesse gleichzeitig, **dieselbe Datenbank** | 12 Läufe | 12/12 rot: beide gemeldeten Tests, dazu N3, der 408-Test und T-G2-D-01 |

Test 28 ließ sich nicht nachstellen: 0 von 27 Läufen rot (15 Läufe nur Test 28, 12 Läufe ganze Datei, je drei Prozesse
gleichzeitig auf derselben Datenbank, gleiche Last).

## Ursachen

### U1: Die globale Schreibsperre gilt für die ganze Datenbank, die Tests legen Wanduhr-Timer darüber (034a, nachgestellt)

Der Dienst nimmt bei jedem Schreiben `pg_advisory_xact_lock(27027, 1)` (`postgresBoundary` in `apps/api/src/app.ts`).
Advisory Locks gelten für die ganze Datenbank, nicht je Schema. Jede Testdatei legt zwar ein eigenes Schema an, aber
gleichzeitige Prozesse auf derselben Datenbank (parallele Gates-Läufe) teilen sich diese eine Sperre. 034a hält sie
selbst lange: `holdWriteLock()` im Test T-G2-D-01 mindestens 3 s, die Hooks `SELECT pg_sleep(1.5)` hinter der Sperre,
und eine zerstörte Verbindung hält sie, bis der Server die Trennung bemerkt (`client_connection_check_interval` 1 s).
Das Warten auf die Sperre läuft unter genau dem kurzen Timer, über den der Test eine Aussage macht:

- **„COMMIT gewinnt“:** `requestTimeoutMs: 200` ist ein echter `setTimeout` in `createRequestTimeout`
  (`apps/api/src/limits/middleware.ts`), gestartet beim Eingang der Anfrage. Wartet der POST länger als 200 ms auf eine
  fremde Sperre (oder dauern Vorprüfungen und Snapshot-Laden unter CPU-Last so lange), läuft der Timer ab, **bevor** die
  Grenze `committing` setzt. Dann ist 408 die richtige Antwort, und der Test prüft einen anderen Zweig als den, den sein
  Name verspricht. Nachgestellt: `expected 408 to be 201`.
- **T-G2-I-02 (503) und N3 (500):** `queryTimeoutMs: 500` gilt für **jede** Abfrage der Anfrage: Warm-up-GET, ETag-GET,
  Migrationsstatus, Rechteprüfung, `BEGIN` und auch `pg_advisory_xact_lock` selbst (`timedQuery` in
  `apps/api/src/persistence/postgres.ts`). Wartet die Sperrabfrage länger als 500 ms, feuert der Timer dort, also vor dem
  Hook: 503 ohne `reached` (nachgestellt `expected false to be true`), bei N3 503 statt 500 (die Phase ist noch nicht
  `committing`; nachgestellt `expected 503 to be 500`). Scheitert schon das Warm-up-GET, schlägt
  `expect(pool.totalCount).toBe(1)` fehl.

### U2: Wanduhr-Spielräume in denselben Tests (034a, angelegt, nicht allein nachgestellt)

Auch ohne fremde Sperre beweisen die drei Tests ihr Ergebnis nur über Abstände: 200 ms gegen etwa ein Dutzend Roundtrips
vor `committing`, 500 ms gegen jede einzelne Abfrage, 1,5 s `pg_sleep` gegen 500 ms. Steht die Ereignisschleife (die
Kette wird beim Laden synchron gehasht), läuft der Timer in der Timer-Phase vor der schon eingetroffenen Antwort. Allein
mit CPU-Last ist das hier nicht rot geworden. Die Ursache ist dieselbe: Der Test entscheidet nicht selbst, wann der
Timer feuert. Der Kommentar in T-G2-I-02 („above the 200 ms timer“) ist zudem veraltet, der Test nutzt 500 ms.

### U3: Test 28 tastet zwei Quellen nicht-atomar ab (035b, nicht nachgestellt)

Die Schleife liest `runtime.totalCount - runtime.idleCount` im Zeitpunkt T0 und fragt danach asynchron
`pg_stat_activity` ab (Zeitpunkt Ts, irgendwann während des `await`). Ob die Stichprobe zählt, entscheiden nur die
Fenster-Hooks dieser App, vorher und nachher. Gelesen wurde Folgendes:

- App-Seite: Jede Nutzung von `runtime` während der Abtastung liegt in einem Fenster. Die Verteiler-Ladung
  (`readSnapshotEvents`, Freigabe im `finally` vor `onWindow('end')` in `apps/api/src/stream/hub.ts`) und die
  Sitzungsprüfung (`pooledQuery`, Freigabe vor `window('end')` in `apps/api/src/stream/sessionCheck.ts`) geben die
  Verbindung zurück, **bevor** das Fenster endet. `pg-pool` 3.14 führt `totalCount`/`idleCount` synchron.
- Server-Seite: Postgres meldet `idle` vor `ReadyForQuery`, `pg` 8.23 löst eine Abfrage erst bei `ReadyForQuery` auf.
- Die Server-Sicht zählt aber jede Verbindung mit Rolle `hv_runtime` und `application_name = schema`. Dazu gehört auch
  `runtime2` (Sitzungsablage des Tests), dessen Nutzung kein Fenster-Hook sieht. Und die Stichprobe hält nicht fest,
  welche der beiden Quellen ausgeschlagen hat.

Eine Lücke im Produktivcode ist damit nicht belegt. Die Messung selbst ist die Schwachstelle: zwei Quellen zu zwei
Zeitpunkten, und darüber urteilt eine Wanduhr-Schleife (4 s, 15 ms Takt). Eine einzelne `1` lässt sich weder
nachstellen noch zuordnen.

## Ziel

Jeder der vier Tests entscheidet selbst, **wann** das zeitkritische Ereignis eintritt. Er hängt nicht mehr von
Lastspitzen, fremden Sperrhaltern oder Abtastglück ab, und er beweist mindestens dasselbe wie vorher. Kein Timeout wird
nur verlängert. Werkzeug sind Vitest-Fake-Timer (`vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })`, nur
diese zwei, sonst nichts), die vorhandenen `testHooks` als Synchronisationspunkte und die öffentlichen Ereignisse von
`pg.Pool` (`'acquire'`, `'release'`) zusammen mit `PoolClient.getTransactionStatus()`. Das sind Server-Angaben aus dem
letzten `ReadyForQuery`, getypt in `@types/pg`.

### 1. „a COMMIT that is already on its way wins over the timer: 201, not 408“ (034a)

**Beweist:** Läuft der Anfrage-Timer ab, während die Grenze in `committing` ist, antwortet die Middleware nicht 408. Sie
wartet auf den COMMIT und gibt dessen Ergebnis zurück: 201, genau ein neues Ereignis, im Zugriffslog eine 201 und keine
408.

**Umbau:**
- Das ETag liest der Test wie bisher über eine App mit Standardgrenzen und echten Timern.
- Direkt vor `postSpeaker(...)` schaltet er Fake-Timer ein (nur `setTimeout`/`clearTimeout`). Im `finally` nach der
  Antwort schaltet er sie wieder aus (`vi.useRealTimers()`), vor jeder Zusicherung. Während des POST feuert damit kein
  Timer der Anfrage von selbst. Das Warten auf die Sperre und alle Roundtrips dürfen beliebig lange dauern
  (nur durch den serverseitigen `lock_timeout` begrenzt, siehe Nicht-Ziele).
- Der Hook `beforeCommit` (läuft nachweislich nach dem synchronen `context.phase = 'committing'`) liest
  `vi.getTimerCount()`, ruft `vi.advanceTimersByTime(200)` auf und liest die Zahl noch einmal. Danach wartet er einen
  Makrotask ab (`await new Promise((resolve) => setImmediate(resolve))`, `setImmediate` bleibt echt), damit die
  Fortsetzung des `Promise.race` in der Middleware läuft, **solange** die Transaktion noch offen ist. Der bisherige
  `pg_sleep(0.6)` entfällt.
- Neue Zusicherung: In diesem Hook ist genau ein Timer gefeuert (Differenz der beiden `getTimerCount()`-Werte = 1). Das
  ist der 200-ms-Anfrage-Timer. Abfrage-Timer (6 s) und Pool-Leerlauf-Timer sind dann nicht fällig. Dazu kommen die
  bisherigen Zusicherungen unverändert.

**Beweis bleibt, und zwar strenger:** Bisher traf der Timer `committing` nur, wenn alles vor dem COMMIT schneller als
200 ms lief. Jetzt feuert er nachweislich in `committing`. Gegenprobe (Prototyp, siehe unten): Wird der Zweig
`context?.phase === 'committing'` in `createRequestTimeout` stillgelegt, wird der Test rot (`expected 408 to be 201`).

### 2. „a query that hangs past the service timer before the COMMIT answers 503; …“ (T-G2-I-02, 034a)

**Beweist:** Läuft eine Anweisung in der Schreibtransaktion vor `committing` über den eigenen Abfrage-Timer des Dienstes
hinaus, antwortet der Dienst 503 `Persistence is busy.` mit `Retry-After: 2`. Die Verbindung wird zerstört statt
zurückgegeben (`pool.totalCount` 0), es entsteht kein Ereignis, und der Hook wurde erreicht.

**Umbau:**
- `queryTimeoutMs` bleibt auf dem Standardwert (kein `limits`-Override). Warm-up, ETag-Lesen, Vorprüfungen und das Warten
  auf die Sperre laufen also unter dem Produktionswert (`DEFAULT_LIMITS.queryTimeoutMs`, 6 000 ms, aus
  `apps/api/src/limits/config.ts` importiert, nicht als Zahl abgeschrieben). Das ist keine Verlängerung um des Grüns
  willen: Den Timer, über den der Test urteilt, steuert der Test jetzt selbst, s. u.
- Im Hook `afterLock`: `reached = true`, Fake-Timer an, `const pending = run('SELECT pg_sleep(1.5)')`. `run` ruft
  `timedQuery` synchron bis zum `setTimeout` auf, der Timer ist also gesetzt, wenn `run` zurückkehrt. Danach folgen
  `getTimerCount()` (erwartet 1), `vi.advanceTimersByTime(q - 1)`, `getTimerCount()` (erwartet 1),
  `vi.advanceTimersByTime(1)`, `getTimerCount()` (erwartet 0). Die Fake-Timer gehen im `finally` **synchron** wieder
  aus, erst dann folgt `await pending`. Der Hook wirft damit `QueryTimeoutError` in die Grenze. Die Zählwerte sammelt
  der Test und prüft sie nach der Antwort auf `[1, 1, 0]`.
- Zwischen `run(...)` und dem Vorspulen liegt kein `await`. Die Antwort des Servers kann also nicht verarbeitet sein: Die
  Anweisung hängt beweisbar noch, wenn der Timer feuert. Die Dauer von `pg_sleep` trägt den Beweis nicht mehr. Sie
  bleibt 1,5 s, damit `afterEach` unverändert passt.
- Den veralteten Kommentar („200 ms timer“) berichtigen.

**Beweis bleibt, und zwar strenger:** Wie bisher sind gesichert: 503, `Retry-After`, Text, zerstörte Verbindung, kein
Ereignis, `reached`. Neu: Der Timer feuert genau nach `queryTimeoutMs` (nicht nach `q - 1`), und das auf der
gehookten Anweisung, nicht auf einer Vorprüfung. Gegenprobe (Prototyp): `client?.release()` statt
`client?.release(discard)` am Ende von `postgresBoundary` macht den Test rot (`expected 1 to be +0`).

### 3. „a COMMIT phase that hangs past the service timer answers 500 "outcome unknown" …“ (N3, 034a)

Gleiche Ursache (U1/U2), unter derselben Last nachgestellt rot (`expected 503 to be 500`), nicht gemeldet. Ohne ihn
bliebe die Datei halb repariert. **Beweist:** Feuert der Abfrage-Timer in `committing`, kommt 500
`Persistence outcome is unknown.` ohne `Retry-After`, und die Verbindung wird zerstört. **Umbau:** wie Punkt 2, aber im
Hook `beforeCommit`. Gleiche Zählwert-Zusicherung `[1, 1, 0]`, kein `limits`-Override. **Beweis bleibt, und zwar
strenger**, aus demselben Grund.

### 4. Test 28 „ten idle streams hold no pool connection and no open transaction outside the reload and check windows“ (035b)

**Beweist:** Zehn ruhende Ströme halten außerhalb der Ladefenster des Verteilers und der Sitzungsprüffenster keine
Pool-Verbindung und keine offene Transaktion.

**Umbau:** Die ereignisgetriebene Invariante ersetzt die Abtastschleife. Sie gilt zu **jedem** Zeitpunkt, nicht nur in
Stichproben:
- `Hooks` (im Testfile) bekommt einen optionalen Rückruf, den `streamWindow` in `build()` **synchron** aufruft, sobald
  nach einem `end` alle Fenster geschlossen sind (Summe von `hooks.open` = 0). In diesem Rückruf zählt der Test
  `quietEnds` hoch und hält einen Verstoß fest, wenn `runtime.totalCount - runtime.idleCount !== 0`.
- Erst **nach** dem Öffnen der zehn Ströme (Öffnen, Anmeldung und Vorprüfung nutzen den Pool rechtmäßig ohne Fenster)
  meldet der Test zwei Zuhörer an:
  - `runtime.on('acquire', …)`: Verstoß, wenn kein Fenster offen ist;
  - `runtime.on('release', (err, client) => …)`: Verstoß, wenn kein Fenster offen ist, wenn `err` gesetzt ist (eine
    zerstörte Verbindung ist in diesem Test unerwartet) oder wenn `client.getTransactionStatus() !== 'I'`.
    `getTransactionStatus()` ist der Transaktionszustand, den der Server selbst mit dem letzten `ReadyForQuery` dieser
    Verbindung gemeldet hat. Er ersetzt die nachlaufende `pg_stat_activity`-Sicht durch eine Server-Angabe, die genau
    beim Zurückgeben gilt.
- Ende der Beobachtung: `eventually(...)` aus `stream-reader035.ts`, bis `quietEnds >= 20` ist und seit der Anmeldung
  mindestens ein `session`- und ein `reload`-Fenster vorkamen. 15 s sind nur die Notbremse, keine Messgröße. Danach
  meldet der Test die Zuhörer ab.
- Zusicherungen: Die Liste der Verstöße ist leer (jeder Eintrag nennt Art und Fenster-Anlass, so ist ein künftiger
  Fehlschlag zuzuordnen); `acquire`-Zähler > 0 (die Invariante wurde wirklich ausgeübt); ein `session`-Fenster kam vor
  (wie bisher). Die Protokollzeile nennt `quietEnds`, `acquire` und `release`.
- Die `pg_stat_activity`-Abfrage und die 4-s-Schleife entfallen.

**Beweis bleibt, und zwar strenger:** Vorher zählten ein paar Dutzend Stichproben zwischen Fenstern. Jetzt gilt: Jede
Entnahme und jede Rückgabe der Stream-App liegt in einem Fenster, jede Rückgabe meldet der Server als `I` (keine offene
Transaktion), und an jedem ruhigen Fensterende ist nichts entnommen. Daraus folgt die Aussage des Testnamens für den
ganzen Beobachtungszeitraum. Gegenprobe (vom Bau auszuführen): Ein `await runtime.connect()` während der Beobachtung, im
Test, nicht festgeschrieben, muss den Test mit „acquire outside a window“ rot machen. Ein `BEGIN` auf einer entnommenen
Verbindung und deren Rückgabe in einem Fenster muss ihn mit Status `T` rot machen.

**Prototyp beim Schreiben (nicht festgeschrieben):** Punkte 1 und 2 in dieser Form liefen 20/20 nacheinander unter
CPU-Last grün. Punkte 1 und 2 liefen zusätzlich in 9 Läufen mit drei Prozessen auf **derselben**
Datenbank grün, während N3, der 408-Test und T-G2-D-01 (ohne Umbau) dort weiter rot waren. Test 28 neu: 5/5 grün,
21–29 ruhige Fensterenden je Lauf, keine Verstöße. Beide Gegenproben aus Punkt 1 und 2 wurden rot wie erwartet.

## Nicht-Ziele

- **Kein Produktivcode.** Insbesondere kein einstellbarer Sperrschlüssel, keine Timer-Naht in `createRequestTimeout` oder
  `timedQuery`. Zeigt der Bau, dass doch eine Naht nötig ist: abbrechen und als Befund melden, nicht selbst einbauen.
- Der 408-Test („408 in the Postgres path: …“) und T-G2-D-01 („a write that waits longer than lock_timeout …“) sind
  unter geteilter Datenbank ebenfalls rot (U1). Sie sind nicht Teil dieser Scheibe: Der erste braucht einen
  Synchronisationspunkt „wartet auf die Sperre“ (`pg_locks`), der zweite misst die Wartezeit gegen `lock_timeout` und
  setzt eine exklusive Sperre voraus. Vorschlag: eigene Takt-Scheibe; der Orchestrator trägt sie in `docs/folgeliste.md`
  ein.
- Auch die vier Tests dieser Scheibe sind auf geteilter Datenbank nicht **garantiert** grün: Hält ein fremder Prozess die
  Schreibsperre länger als `lock_timeout` (3 s, serverseitig), antwortet der Dienst zu Recht 503. Deterministisch heißt
  hier: **ein Datenbank-Name je gleichzeitig laufendem Testprozess**. Diese Vorbedingung nennt der Kopfkommentar von
  `postgres-limits034a.test.ts` (ein Satz, mit dem Grund: die Schreibsperre gilt für die ganze Datenbank).
- Keine Änderung an anderen Tests dieser Dateien, an `stream-reader035.ts`, an der CI oder an der Liste der Pg-Dateien
  in `.github/workflows/gates.yml`.
- Die Deprecation-Warnung von `pg` („client.query() when the client is already executing a query“) kommt aus
  `tableExists` in `assertSchemaConsistent` (`apps/api/src/persistence/migrations.ts`, `Array.map` auf einem Client). Sie
  hat mit diesen Tests nichts zu tun. Vorschlag für die Folgeliste, nicht hier.

## Files allowed

- `apps/api/src/__tests__/postgres-limits034a.test.ts`
- `apps/api/src/__tests__/postgres-stream035.test.ts`
- `docs/slices/takt-042-zeitkritische-postgres-tests.md`

Ein Test-Helfer ist nicht nötig: die Warte-Funktion eventually liegt schon im Strom-Lesehelfer von 035b (unverändert),
Fake-Timer liefert Vitest.

## Akzeptanzkriterium

Gemeinsamer Aufbau (Postgres 16, Rollen wie in `.github/workflows/gates.yml`). Die CPU-Last ist reproduzierbar ohne
Zusatzpaket (`stress-ng` ist nicht vorausgesetzt):

```
# Last: 1,5 × Kernzahl Node-Leerlaufschleifen, nach dem Lauf beenden
N=$(( $(nproc) * 3 / 2 )); for i in $(seq 1 $N); do node -e 'for(;;){}' & done
# … Läufe …
pkill -f 'for\(;;\)'
```

`uptime` vor und nach den Läufen kommt in den Bericht.

1. **034a, 20 Läufe hintereinander unter Last, eigene Datenbank:**
   ```
   for r in $(seq 1 20); do
     pnpm --filter @hv/api exec vitest run src/__tests__/postgres-limits034a.test.ts \
       -t "COMMIT that is already on its way|hangs past the service timer before the COMMIT|COMMIT phase that hangs" || break
   done
   ```
   20/20 grün, je 3 Tests bestanden.
2. **034a, gleichzeitig:** dreimal gleichzeitig dieselbe Auswahl, **jeder Prozess mit eigenem Datenbank-Namen**
   (`TEST_DATABASE_URL`/`TEST_RUNTIME_DATABASE_URL` je Prozess), 20 Runden unter Last: 60/60 grün. Zusätzlich
   informativ, nicht als Abnahme: 5 Runden auf **derselben** Datenbank, Ergebnis im Bericht.
3. **035b Test 28, 20 Läufe hintereinander unter Last:** `-t "28 ten idle streams"` auf
   `src/__tests__/postgres-stream035.test.ts`, 20/20 grün. Die Protokollzeile jedes Laufs zeigt `quietEnds >= 20`.
4. **Ganze Dateien:** beide Dateien einmal vollständig grün (ohne Last), damit die übrigen Tests und `afterEach`
   unberührt bleiben.
5. **Gegenproben** (Mutation, nicht festgeschrieben, Ausgabe im Bericht): die zwei aus Punkt 1 und 2, die zwei aus Punkt 4
   des Ziels und für N3 das Stilllegen von `mustDiscardConnection(error) && phaseIs('committing')` (erwartet 503 statt
   500). Jede macht den zugehörigen Test rot, nach dem Zurücksetzen ist `git status` sauber.
6. **`pnpm gates`** mit Postgres-Variablen grün auf sauberem Commit, einschließlich slice-scope; der Schluss steht unter
   „Bericht“.

## Tests

Die vier umgebauten Tests sind die Tests dieser Scheibe. Neue Testfälle gibt es keine. Neue Zusicherungen je Test:
Punkt 1 „genau ein Timer feuert in `beforeCommit`“, Punkte 2 und 3 „Timer-Zählung `[1, 1, 0]`“, Punkt 4 „keine
Verstöße, `acquire` > 0, `quietEnds >= 20`“. Keine bestehende Zusicherung entfällt außer denen, die die Abtastung selbst
betrafen (`samples > 20`, `busy === 0`). Sie gehen in den strengeren Invarianten von Punkt 4 auf.

## Wirkung und Risiko (Leitplanken §4, niedrig)

- **Produktivwirkung:** keine.
- **Risiko:** Fake-Timer, die über Netzwerk-I/O hinweg aktiv bleiben (Punkt 1), legen auch Timer von `pg`/`pg-pool`
  still (Verbindungs-Timeout, Leerlauf-Timeout). Das ist gewollt: Keiner davon muss im Test feuern. Ein trotzdem
  hängender Roundtrip endet am Vitest-Testtimeout (20 s), laut statt falsch grün. Beim Ausschalten verworfene Fake-Timer
  von Pool-Leerlauf-Timern lassen die Verbindung bis `pool.end()` in `afterEach` offen.
- **Gegenmittel:** Fake-Timer nur für `setTimeout`/`clearTimeout`, Ausschalten immer im `finally`, Gegenproben aus
  Kriterium 5.

## Aufwand

Etwa 3 AStd: Umbau der vier Tests etwa 1 AStd (Prototyp liegt in dieser Spec beschrieben), Lastläufe nach Kriterium 1–3
etwa 1 AStd Rechenzeit, Gegenproben, Gates und Bericht etwa 1 AStd.

## Bericht

```
Slice: takt-042-zeitkritische-postgres-tests
Done: …
Evidence: pnpm gates auf <commit> (…), Lastläufe 1–3 mit uptime, Gegenproben
Open: …
Touched: …
```

## Review findings
