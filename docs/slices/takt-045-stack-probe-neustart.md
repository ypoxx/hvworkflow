# takt-045 — Stack-Probe `postgres-restart` ohne Wettlauf (stop, Ausfall gesehen, start)

**Status:** spec · **Risikoklasse:** mittel (Verhaltensänderung eines Betriebswerkzeugs: die Sonde hält Postgres im lokalen
Stack jetzt bewusst gestoppt, bis der Dienst den Ausfall gemeldet hat. Leitplanken §4: nicht „niedrig“, weil „niedrig“
Betrieb ausschließt; kein Hoch-Auslöser: nur lokaler Stack und CI-Job, kein Deployment, keine Produktivpersistenz, keine
Secrets, kein Produktivcode) · ca. 3 AStd · **Lanes:** ops (Skript `scripts/stack.mjs`)
**Rolle:** builder; Review in frischem Kontext (Perspektive: belegt die Sonde noch „Dienst bemerkt den Ausfall und erholt
sich ohne Neustart“, und kann sie das Ergebnis nicht mehr vom Abtastglück abhängig machen?), Modell nur in
`.claude/agents/` (takt-012)
**Regeln:** AGENTS.md R1, R2, R3, R11 (nur lokaler Docker-Daemon, keine Werte aus `state.json` im Protokoll), R12;
037a S16.1 (Postgres-Neustart: `/readyz` meldet `db` vorübergehend nicht `ok`, innerhalb von 60 s wieder `ok`,
`RestartCount` des Dienstes gleich)
**Quellen-IDs:** `docs/folgeliste.md` (Eintrag „037a Nachweis (PR #148, Lauf 37222611650) · Sonde `postgres-restart`“);
CI-Läufe 37222611650 (PR #148, Job 111495832673) und 37239065778 (PR #154, Job 111543913327), je Versuch 1 rot,
Wiederholung grün; 037a „Nachtrag nach CI, Runde 4“ (Vorgänger-Fix derselben Sonde)
**Depends on:** keine
**Perspektive:** Determinismus einer Betriebssonde · **Glossar: neue Begriffe:** nein

## Befund (gelesen auf `f4e0278`)

Beide roten Läufe zeigen dieselbe Zeile:
`Postgres-Neustart: db zeitweise –, wieder ok nach – s (restart-Befehl 0.4 s, Exit 0)`. `scripts/stack.mjs`, `deploy/`,
`apps/api/src/app.ts`, `apps/api/src/persistence/postgres.ts` und `.github/workflows/` sind auf beiden Head-Commits
(`8f1f287`, `0505ce3`) byte-gleich mit `f4e0278`. Beide Läufe prüfen also denselben Code. Die Job-Logs selbst sind über
die API hier nicht lesbar (Weiterleitung auf den Blob-Host). Belegt sind die Schrittzeiten aus
`GET /actions/jobs/<id>`:

| Lauf | Schritt „Postgres restart (S16.1)“ | Deutung |
|---|---|---|
| 37239065778 (PR #154) | 22:13:46 → 22:15:00, **74 s** | Der Beobachter lief seine volle Frist von 75 s ab READY und sah nie ein „nicht ok“. |
| 37222611650 (PR #148) | 18:01:45 → 18:01:46, **≤ 2 s** | Der Beobachter endete Sekundenbruchteile nach dem Neustart **ohne** brauchbare Schlusszeile. |

Es sind also **zwei verschiedene Fehlbilder** hinter derselben Zeile. `observePostgresRestart` wartet auf
`watch.done` und den Neustart gemeinsam (`Promise.all`); bei einer Schrittdauer von 2 s kann der Beobachter weder seine
Frist abgelaufen noch einen Ausfall samt Rückkehr gesehen haben (dann stünde `state` in der Zeile).

## Ursachen

### U1: Die Sonde beweist ihre Aussage über einen Wettlauf zwischen Ausfalldauer und Abtasttakt (Lauf #154, nachgestellt)

Ablauf heute: Der Beobachter (`POSTGRES_WATCH_SCRIPT`, per `docker compose exec` im Container `api`) wartet auf ein
`db ok` und meldet `READY`. Danach ruft der Host `docker compose restart postgres` auf, ohne darauf zu warten. Der
Beobachter fragt `/readyz` in einer Schleife ab: eine volle Anfrage, dann 50 ms Pause. „Nicht ok“ sieht er nur, wenn
eine der `db`-Prüfungen in das Fenster fällt, in dem Postgres neue Verbindungen ablehnt.

Dieses Fenster ist kurz und von nichts in der Sonde gesteuert. `restart` heißt stop (SIGINT, schneller Stopp, kleine
Datenbank) und sofort start (sauberer Schluss-Checkpoint, also keine Wiederherstellung). Nachgestellt beim Schreiben
dieser Spec mit Postgres 16 und `pg` 8.23 aus dem Repository, `pg_ctl restart -m fast` auf einem leeren Cluster, Abtastung
alle 2 ms mit `pool.connect()` plus `SELECT 1`:

| Lauf | Dauer des restart-Befehls | Abfragen schlagen fehl von … bis … (ms ab Befehlsbeginn) |
|---|---|---|
| 8 Läufe | 229–242 ms (einmal 333, einmal 731) | etwa 20 bis 165–176 ms, also ein Fenster von **rund 150 ms** |

Derselbe Aufbau mit einer readyz-ähnlichen Prüfung (zwei Entnahmen, drei Abfragen) und Pause P zwischen den Prüfungen,
20 Neustarts je P:

| P | Neustarts ohne ein einziges „nicht ok“ |
|---|---|
| 50 ms | 0 von 20 (je 2–3 schlechte Abfragen) |
| 150 ms | 0 von 20 |
| 250 ms | **19 von 20** |

In CI dauerte der ganze Befehl 0,4 s, einschließlich Compose- und Daemon-Aufwand vor dem Stopp und nach dem Start; das
Ablehnungsfenster ist kürzer. Der Takt des Beobachters ist dort dagegen nicht 50 ms, sondern 50 ms **plus** eine ganze
`/readyz`-Antwort: Der Dienst läuft unter `tsx`, und `/readyz` prüft nacheinander Uhr, `db` (Entnahme, Rechteabfragen,
zweite Entnahme, `SELECT 1`) und Migrationen (Entnahme, mehrere Abfragen). Nur der `db`-Teil zählt. Liegt der Takt über
dem Fenster, hängt das Ergebnis von der Phase ab. Der Beobachter sieht dann nichts, läuft 75 s und meldet `bad: null`.
Genau das zeigt die Schrittzeit von 74 s.

**Ausgeschlossen, mit Grund:**
- *`/readyz` puffert die `db`-Prüfung:* nein. `app.ts` (`app.get('/readyz', …)`) ruft bei jeder Anfrage
  `assertRuntimePrivileges` und `pooledQuery(… 'SELECT 1')` auf. Gepuffert wird nur die Uhrprüfung (30 s,
  `clock/ntp.ts`), und die ist im Stack ohne `HV_STACK_NTP_SERVERS` sofort `not_configured`.
- *`docker compose restart` kehrt zurück, bevor Postgres stoppt:* nein. `restart` wartet den Stopp ab (`stop_signal:
  SIGINT`, `stop_grace_period: 30s`) und kehrt nach dem **Start des Containers** zurück, also bevor Postgres wieder
  annimmt. Das verlängert den Ausfall nur über das Befehlsende hinaus, verkürzt ihn nicht. Gegen U1 hilft es nicht.
- *Der Beobachter endet zu früh (Lauf #154):* nein, die 74 s entsprechen seiner Frist.
- *Die Ausgabe wird nicht gelesen (Lauf #154):* nach 75 s druckt der Beobachter seine Schlusszeile als letzte Zeile;
  der Host liest die letzte Zeile von stdout. Ein Parse-Fehler hätte dasselbe Bild ergeben, ist aber nicht nötig, um es
  zu erklären. Der Bau macht das künftig sichtbar (Ziel 4).

### U2: Der Beobachter endete ohne Schlusszeile (Lauf #148, Ursache nicht belegbar, Kandidat benannt)

Der Beobachter fängt jeden Fehler einer Abfrage ab. Ein Abbruch nach READY und vor der Schlusszeile heißt also: Der
`exec`-Prozess wurde von außen beendet. Am naheliegendsten ist, dass der Container `api` endete. Die Sonde bricht beim
ersten roten `check` ab (`cmdProbe`), die Prüfung „RestartCount unverändert“ lief deshalb nie, und das Protokoll sagt
nichts darüber.

Ein Kandidat ist beim Schreiben nachgestellt (Postgres 16, `pg` 8.23, `pg-pool` 3.14): Ein **entnommener** Client
**ohne laufende Abfrage** hat keinen `error`-Zuhörer, denn `pg-pool` nimmt seinen `idleListener` bei der Entnahme ab.
Beendet Postgres die Verbindung (schneller Stopp: „terminating connection due to administrator command“, danach
„Connection terminated unexpectedly“), wirft der Client ein unbehandeltes `error`-Ereignis, und der Prozess stürzt ab.
Mit laufender Abfrage und Rückgabe gleich nach der Ablehnung stürzt er nicht ab (ebenfalls nachgestellt). Ob der Dienst
im Augenblick des Stopps einen Client zwischen zwei Abfragen hielt, ist **nicht** belegt. Dieser Takt repariert das
nicht (Produktivcode, s. Nicht-Ziele). Er sorgt dafür, dass das nächste Auftreten zuzuordnen ist (Ziel 4), und schlägt
einen Folgeliste-Eintrag vor.

## Ziel

Die Sonde beweist „der Dienst bemerkt den Postgres-Ausfall über `/readyz` und erholt sich ohne eigenen Neustart“, ohne
dass das Ergebnis vom Verhältnis zwischen Ausfalldauer und Abtasttakt abhängt. Der Weg: Der Ausfall dauert, **bis der
Beobachter ihn gemeldet hat**. Zweck, Name (`probe postgres-restart`), CI-Schritt, Grenzwert (60 s) und die
RestartCount-Prüfung bleiben gleich. Kein Takt wird nur dichter gemacht und keine Frist nur verlängert.

### 1. Ablauf: stop, Ausfall gesehen, start (statt `restart`)

`observePostgresRestart` bekommt statt `startRestart` die Injektionen `stopPostgres`, `startPostgres`, `now` und
`delay(ms)` (Wartezeit, in Tests falsch) sowie `limitMs = 60_000` und `downWaitMs = 45_000`. Reihenfolge:

1. Beobachter starten und auf `ready` warten. Ohne Grundlinie: kein Stopp, kein Start, `reason: 'watcher-not-ready'` (wie
   bisher).
2. `stopAt = now()`; `stopPostgres()` **abwarten** (Exit-Code, Dauer). Danach ist der Container beendet.
3. Auf die `DOWN`-Meldung des Beobachters warten (`watch.down`), höchstens bis `downWaitMs` ab `stopAt`, oder bis der
   Beobachter vorher endet (`watch.done`).
4. **Immer** genau einmal `startAt = now()`; `startPostgres()` abwarten. Das gilt auch, wenn der Stopp-Befehl
   scheiterte, die `DOWN`-Meldung ausblieb oder eine Injektion warf (`finally`). Ein gestopptes Postgres bleibt nach der
   Sonde nie zurück.
5. `watch.done` abwarten und bewerten (Punkt 2).

Weil Postgres gestoppt bleibt, bis `DOWN` gemeldet ist, sieht der Beobachter den Ausfall bei der nächsten Abfrage nach
dem Stopp, gleich wie langsam sein Takt ist. Endet `docker stop`, ist der Container weg. `/readyz` meldet dann
`unreachable` (Name nicht auflösbar, Verbindung abgelehnt) oder nach 2 s `timeout` (`READINESS_CHECK_TIMEOUT_MS`).
Beides ist „nicht ok“. 45 s sind die Notbremse, keine Messgröße.

**Befehle:** `docker stop <Container-ID>` und `docker start <Container-ID>` auf den Postgres-Container, die ID über das
vorhandene `containerId(plan, 'postgres')`. Nicht `docker compose stop postgres`. Grund: Je nach Compose-Version nimmt
`stop` mit Dienstnamen die abhängigen Dienste mit (hier `api` über `depends_on`). Das würde den Beobachter beenden und
den RestartCount-Befund verfälschen. `docker stop` nutzt das `StopSignal` (SIGINT) und den `StopTimeout` (30 s) aus der
Container-Konfiguration, die Compose aus `stop_signal` und `stop_grace_period` gesetzt hat. Ein Stopp per `docker stop`
gilt für die Restart-Policy `unless-stopped` als „von Hand gestoppt“, der Daemon startet den Container also nicht
dazwischen neu. Der Bau prüft beides einmal im CI-Lauf (Kriterium 3: `api` bleibt im Protokoll gesund, RestartCount
gleich).

### 2. Bewertung (rein, `evaluatePostgresRestart`)

Neue Eingaben: `{ stopAt, startAt, value, stopCode, startCode, stopMs, startMs, limitMs }`. `ok` genau dann, wenn:

- `stopCode === 0` und `startCode === 0`;
- `value.bad.at` liegt in `[stopAt, startAt]`: Der Dienst hat den Ausfall bemerkt, **während** Postgres gestoppt war.
  Ein „nicht ok“ erst nach dem Start (etwa „the database system is starting up“) beweist nicht, dass der Ausfall
  bemerkt wurde;
- `value.back` ist eine Zahl mit `back >= startAt` und `back - startAt <= limitMs`.

Rückgabe zusätzlich zu `ok`: `state`, `noticedSeconds` (`bad.at - stopAt`), `seconds` (`back - startAt`),
`stopSeconds`, `startSeconds`, `stopCode`, `startCode`, und `reason` bei den festen Fällen `'watcher-not-ready'` und
`'outage-not-seen'`. Container und Host teilen sich die Kernel-Uhr. Der bestehende Kommentar dazu bleibt.

### 3. Beobachter (`POSTGRES_WATCH_SCRIPT`)

- `READY` nach dem ersten `db ok`, wie bisher.
- Beim **ersten** „nicht ok“ nach READY genau eine Zeile `DOWN {"state":…,"at":<epoch ms>}`. Der Host löst damit
  `watch.down` aus (`onStdout`, zeilenweise wie bei `READY`).
- Nach `DOWN` beim ersten `ok`: Schlusszeile
  `{"baseline":true,"bad":{…},"back":<epoch ms>,"samples":<n>,"maxGapMs":<größter Abstand zweier Abfrage-Enden>}` und
  Ende. `samples` und `maxGapMs` sind reine Zähler ohne Wert aus dem Zustand. Sie machen den echten Takt in CI sichtbar.
- Frist ab READY 120 s (Stopp bis 30 s Gnadenfrist, `downWaitMs`, Rückkehr bis 60 s). Bei Ablauf dieselbe Schlusszeile
  mit `bad`/`back` `null`. Die `exec`-Frist im Host liegt darüber (180 s).
- Takt (50 ms Pause), Fetch-Abbruch (3 s) und die Zustandsableitung (`code || status`) bleiben unverändert. Sie tragen
  den Beweis nicht mehr.

### 4. Lesen der Ausgabe und Zuordnung eines Fehlschlags

- Eine reine, exportierte Funktion `parseWatchOutput(stdout)` liefert `{ ready, down, final }`. `down` und `final` sind
  geparste Objekte oder `undefined`. Sie ersetzt das Inline-`JSON.parse` der letzten Zeile in `startPostgresWatch`.
  Eine fremde Zeile (etwa eine Warnung) vor der Schlusszeile bricht das Lesen nicht.
- Die Protokollzeile nennt zusätzlich den Exit-Code des Beobachters, ob eine Schlusszeile gelesen wurde, `samples` und
  `maxGapMs`. Zum Beispiel:
  `Postgres-Neustart: db unreachable 0.3 s nach dem Stopp, wieder ok 1.1 s nach dem Start (stop 0.4 s, Exit 0; start
  0.3 s, Exit 0; Beobachter Exit 0, Schlusszeile ja, 41 Abfragen, größte Lücke 140 ms)`.
- Der RestartCount des Dienstes wird **vor** der ersten roten Prüfung gelesen und mit dem Zustand des Containers `api`
  (`docker inspect --format '{{.State.Status}} {{.RestartCount}}'`, nur diese Felder, R11) ins Protokoll geschrieben.
  Ein Absturz wie der Kandidat aus U2 ist dann im Protokoll erkennbar. Die beiden `check`-Zeilen und ihre Reihenfolge
  bleiben.

## Nicht-Ziele

- **Kein Produktivcode.** Insbesondere kein `error`-Zuhörer auf entnommenen Clients in `apps/api/src/persistence/` und
  keine Änderung an `/readyz`. Den Kandidaten aus U2 trägt der Bau als **Vorschlag** in die Folgeliste ein (Abschnitt
  037a, eigene Zeile: „entnommener `pg`-Client ohne `error`-Zuhörer stürzt den Prozess beim Postgres-Stopp ab,
  nachgestellt mit pg 8.23; ob der Dienst einen Client zwischen zwei Abfragen hält, ist zu prüfen; eigene Scheibe,
  Klasse mittel“). Er baut ihn nicht.
- Keine Änderung an `.github/workflows/gates.yml`, `deploy/compose/compose.yaml`, anderen Sonden (`api-crash`,
  `images`, `refusals`) oder am Stack-Start.
- Kein Wiederholen der Sonde bei Rot, kein „bis zu N Versuche“. Das würde den Wettlauf verstecken, nicht beseitigen.
- Die 037a-Spec wird nicht umgeschrieben. Sie bekommt nur einen Verweissatz unter S16.1 (Kriterium 5).
- Die Wartezeit des Dienstes beim Wiederverbinden (Folgeliste: „gehört zu 037b“) bleibt bei 037b.

## Files allowed

- `scripts/stack.mjs`
- `scripts/stack.test.mjs`
- `docs/betrieb/installation.md`
- `docs/folgeliste.md`
- `docs/slices/037a-lokales-betriebspaket.md`
- `docs/slices/takt-045-stack-probe-neustart.md`

## Tests (zuerst geschrieben)

In `scripts/stack.test.mjs`. Die Fakes laufen auf einer falschen Uhr, ohne Docker und ohne Wanduhr-Abstände.

1. **Regression, muss auf dem alten Code rot sein.** Eine falsche Welt mit falschem Postgres-Zustand über der falschen
   Uhr. Sie bietet `restart()` (Ausfall von 100 ms, beginnend 50 ms nach dem Aufruf), `stop()` und `start()`. Dazu
   kommt ein falscher Beobachter, der den Zustand **nur zu seinen Abfragezeitpunkten** liest, alle 250 ms, und dessen
   Phase so liegt, dass das ganze `restart`-Fenster zwischen zwei Abfragen fällt. Das Objekt an `observePostgresRestart`
   trägt beide Schnittstellen: `startRestart` (alt) sowie `stopPostgres`/`startPostgres`/`delay` (neu). Zusicherungen:
   `ok === true`, `state` gesetzt, Reihenfolge `watch, ready, stop, down, start, back`. Mit dem alten `stack.mjs`
   (Datei aus `f4e0278`, neuer Test) ist der Test rot (`ok` false, der Beobachter sieht nichts). Die Ausgabe steht im
   Bericht.
2. **Reihenfolge und Zeitbasis** (Umbau des Tests „Nachtrag nach CI, Runde 4: the restart starts only after …“): Ein
   langsamer `exec`-Start verzögert den Stopp, nie den Beobachter. `noticedSeconds` zählt ab `stopAt`, `seconds` ab
   `startAt`, und `stopSeconds`/`startSeconds` sind die Dauern der Befehle selbst.
3. **Ohne Grundlinie** kein Stopp und kein Start, `reason: 'watcher-not-ready'`.
4. **`DOWN` bleibt aus:** Nach `downWaitMs` wird trotzdem genau einmal gestartet. Das Ergebnis ist `ok: false` mit
   `reason: 'outage-not-seen'`.
5. **Befehle scheitern:** Stopp mit Exit ≠ 0 → Start wird trotzdem aufgerufen, `ok: false`. Start mit Exit ≠ 0 →
   `ok: false`. Wirft `stopPostgres`, wird gestartet und der Fehler weitergereicht.
6. **Grenzwert:** `back - startAt` = 60 000 ergibt `ok: true`, 60 001 ergibt `ok: false`.
7. **Reine Bewertung** (Umbau des Tests „the evaluation rejects …“): `bad.at < stopAt`, `bad.at > startAt`,
   `back < startAt`, `back: null` und `value: undefined` ergeben je `ok: false`.
8. **`parseWatchOutput`:** nur `READY`; `READY` + `DOWN {…}`; vollständig mit Schlusszeile; eine fremde Zeile zwischen
   `DOWN` und Schlusszeile; abgeschnittene Schlusszeile (`final` ist `undefined`, kein Wurf).

Die übrigen Tests der Datei bleiben unverändert. Der Test zu `stop_signal`/`stop_grace_period` bleibt ausdrücklich
bestehen, denn `docker stop` stützt sich darauf.

## Akzeptanzkriterium

1. **Rot vor Grün:** Test 1 auf dem alten `scripts/stack.mjs` (aus `f4e0278`) rot, auf dem neuen grün. Beide Ausgaben
   stehen im Bericht (`node --test scripts/stack.test.mjs`, gefiltert mit `--test-name-pattern`).
2. **Unit-Tests:** `node --test scripts/stack.test.mjs` vollständig grün.
3. **CI `stack-037a` grün auf dem letzten Commit des PR.** Dazu zwei Wiederholungen nur dieses Jobs auf demselben Commit
   (`POST /repos/{owner}/{repo}/actions/jobs/<job-id>/rerun`). Alle drei Versuche müssen grün sein. Der Bericht nennt
   Lauf-ID, Job-ID je Versuch und die Protokollzeile von S16.1 (Wert von `samples`, `maxGapMs`, `noticedSeconds`,
   `seconds`; RestartCount und Zustand von `api`). Ist das Job-Log über die API nicht lesbar, holt der Orchestrator die
   Zeilen aus der Oberfläche. Schrittdauer S16.1 deutlich unter 75 s.
4. **Installationsseite:** Die Zeile zu `probe postgres-restart` in `docs/betrieb/installation.md` beschreibt den neuen
   Ablauf (stoppt Postgres, wartet, bis `/readyz` den Ausfall meldet, startet es wieder; erwartet: `db` nicht `ok`,
   solange gestoppt, höchstens 60 s nach dem Start wieder `ok`, RestartCount gleich).
5. **037a-Verweis:** Unter S16.1 in `docs/slices/037a-lokales-betriebspaket.md` steht ein Satz: „Ablauf seit takt-045:
   stop, Ausfall gesehen, start statt `restart` (Wettlauf zwischen Ausfalldauer und Abtasttakt).“ Sonst wird dort
   nichts geändert.
6. **Folgeliste:** Der Eintrag „037a Nachweis (PR #148, Lauf 37222611650) · Sonde `postgres-restart` …“ ist
   durchgestrichen mit „→ erledigt in **takt-045**“. Der Vorschlag aus den Nicht-Zielen (U2) steht als neue Zeile darunter.
7. **`pnpm gates`** grün auf sauberem Commit, einschließlich slice-scope. Der Schluss der Ausgabe steht unter „Bericht“.

## Wirkung und Risiko (Leitplanken §4, mittel)

- **Produktivwirkung:** keine. Der Dienst und sein Image bleiben unverändert.
- **Betriebswirkung:** `probe postgres-restart` hält Postgres im lokalen Stack bis zu `downWaitMs` (45 s) gestoppt statt
  rund 0,4 s. Sie läuft nur auf Befehl und in CI auf einem frischen Stack. Das Starten im `finally` verhindert ein
  zurückgelassenes, gestopptes Postgres. Bricht der Host-Prozess selbst ab (Strg-C), bleibt Postgres gestoppt; Abhilfe
  `pnpm stack:up` (startet gestoppte Dienste). Die Installationszeile nennt das.
- **Risiko:** `docker stop` statt Compose umgeht die Projektauflösung. Ein falscher Container wäre fatal. Die ID kommt
  aber aus `docker compose ps -q postgres` des Stack-Projekts (vorhandene Funktion), nie aus einem Namen. Ist sie leer,
  bricht die Sonde vor dem Stopp ab.
- **Gegenmittel:** Tests 1–8, drei grüne CI-Versuche, RestartCount und Zustand von `api` im Protokoll.

## Aufwand

Etwa 3 AStd: Tests zuerst und Rot-Nachweis etwa 1 AStd, Umbau von Sonde, Beobachter und Leser etwa 1 AStd, CI-Versuche,
Doku und Bericht etwa 1 AStd.

## Bericht

```
Slice: takt-045-stack-probe-neustart
Done: …
Evidence: pnpm gates auf <commit> (…), Test 1 rot auf altem stack.mjs / grün auf neuem, CI stack-037a drei Versuche
          (Lauf-ID, Job-IDs, Protokollzeile S16.1)
Open: …
Touched: …
```
