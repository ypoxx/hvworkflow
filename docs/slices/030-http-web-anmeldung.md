# Scheibe 030 — HTTP-Client und Web-Anmeldung für den internen Betabereich

**Status:** Spec vor Bau · **Risikoklasse:** hoch · **Lanes:** web-api, web-shell  
**Rolle:** Implementierer-Oberfläche; unabhängiges Review in frischem Kontext zu Vertrag, Anmeldung, CSRF, Rollengrenze, Datenschutz und Demo-Kontinuität.  
**Grundlage:** AGENTS.md R1–R12; `docs/produktplan-beta.md` §5.4/030; ADR 0001, 0002 und 0004; OpenAPI 0.3.7 und `HvApi` nach 029b; 028 für ETag/If-Match/Idempotency-Key. Der Integrationsstand ist Merge-Commit `ccc8725` (029b). Kein weiterer Branch wird eingemischt.

## Ziel und Entscheidungen vor Bau

Das Web startet aus einer **Build-Konfiguration** in genau einer Betriebsart: `demo` (Standard für die bestehende Netlify-Demo) oder `http` (interner Betabereich). Ein unbekannter Wert bricht den Build ab. Die HTTP-Betriebsart spricht denselben Ursprung wie das Web: `/v1/*` und `/auth/*`; ein Reverse Proxy beziehungsweise die 031-Testumgebung liefert beides unter einer Origin. Sie lädt nie den Demo-Event-Store als Fallback, vertraut keinem `X-Actor` und schreibt keine Sitzung, kein CSRF-Token und keine IdP-Daten in `localStorage` oder `sessionStorage`. Die Demo behält ihr bisheriges In-Process-Verhalten, inklusive Persona-Umschalter, synthetischem Korpus und Reset-Banner bei altem Protokoll. Die HTTP-Betriebsart zeigt weder Persona-Umschalter noch Demo-Reset.

**Vertragsadapter.** `apps/web/src/api/` bleibt die einzige Tür der Oberfläche zu `HvApi`. Ein aus den vorhandenen `openapi-typescript`-Typen abgeleiteter Fetch-Wrapper implementiert **alle** aktuellen `HvApi`-Methoden über die in OpenAPI deklarierten Pfade und Methoden; die Ansichten selbst ändern ihren Datenzugriff nicht. Pfadsegmente und Querywerte werden kodiert. Nur der Wrapper ruft `fetch` auf; außerhalb von `apps/web/src/api/http.ts` steht in `apps/web/src` kein `fetch(`. Der Wrapper verwendet `credentials: 'same-origin'`, nimmt `ETag` aus Antworten auf, reicht `If-Match` aus `WriteOptions` durch und erzeugt für jeden neuen Schreibversuch einen Idempotency-Key, sofern der Aufrufer keinen mitgibt. Ein Wiederholversuch derselben Nutzeraktion verwendet denselben Schlüssel; ein neuer Versuch einen neuen. Der letzte erfolgreiche Schreib-ETag steht über `lastWriteEtag()` bereit. `204` hat keinen JSON-Body. Fehler werden aus `application/problem+json` in `ApiProblem` mit Status, Titel, Detail und optionaler Regel-ID übersetzt; technische oder IdP-Daten werden nicht ergänzt. Ein ungültiger oder fremder Fehlerbody führt zu einer generischen, lokalisierten Fehlermeldung ohne Rohtext.

**Sitzung und CSRF.** Ein `AuthAdapter`-Port kapselt `demoPersona` oder `session`. Im HTTP-Modus liest der Start `/auth/me` und vor Anmeldung `/auth/transparency-notice`. Eine gültige Sitzung liefert Actor und CSRF-Token ausschließlich in flüchtigen Speicher. Schreibaufrufe tragen `X-CSRF-Token`; fehlt eine bestätigte Sitzung, wird nichts geschrieben. `401` aus Auth- oder Fachaufrufen beendet den lokalen Sitzungszustand einmalig und zeigt die Anmeldeseite mit sicherem relativem Rückweg. `403` aus einem Fachrecht bleibt ein Fachfehler und startet keine Anmeldung. Solange ein sichtbarer Tab angemeldet ist, ruft ein Timer `/auth/me` vor Ablauf der 30-Minuten-Leerlaufgrenze erneut ab; beim Wieder-Sichtbarwerden geschieht das sofort. Das erneuert nur den serverseitigen Leerlauf innerhalb der absoluten 14 Stunden aus 029b. Bei IdP-Ausfall gibt es keinen Demo- oder Header-Rückfall. Abmelden ist `POST /auth/logout` mit CSRF; erst eine bestätigte Antwort zeigt „abgemeldet", ein Netzwerkfehler bleibt als solcher sichtbar. Nach `401` ist erneutes Anmelden möglich, ohne in eine Endlosschleife zu geraten.

**Anmeldeseite.** Vor dem Anmeldeknopf sind der versionierte Transparenzhinweis in Deutsch und American English und, falls vom Dienst geliefert, ein sicherer Link zur DSFA-Zusammenfassung lesbar. Die Oberfläche kennzeichnet den Hinweis bis E15 als noch ungeprüft. Bei fehlendem oder unvollständigem Hinweis bietet die Seite keine Anmeldung an und erklärt den vorübergehenden Ausfall in beiden Sprachen. Der Anmeldeknopf navigiert zum serverseitigen `/auth/login?returnTo=...`; das Web verarbeitet weder Code noch Token. Nach Rückkehr stellt `/auth/me` die Sitzung fest. Im Header zeigt die HTTP-Betriebsart die aktuelle, vom Dienst gelieferte Actor-Rolle und „Abmelden", aber keine Rollenwahl. Weitere aktive Rollen aus 029b werden nicht als auswählbare Identität ausgegeben; eine Mehrrollenwahl bleibt nach der internen Beta eine eigene Vertragsscheibe.

**Änderungssignal bis 035.** `HvApi.subscribe()` bleibt synchron abonnierbar. Ohne SSE (kommt in 035) löst der HTTP-Adapter höchstens alle 30 Sekunden einen Refetch-Impuls ohne Ereignisinhalt aus; jede Ansicht liest ihre zugelassenen Daten neu. Er ruft dazu keine nur für Admin freigegebene Ereignisliste ab. Der Timer endet beim Abmelden oder Unmount. 035 ersetzt den Impuls durch einen echten, inkrementellen SSE-Kanal. Diese Zwischenstufe ist kein Anspruch auf Echtzeit oder vollständige Mehrnutzer-Synchronität.

## Bedrohungen und Grenzen

- Browser darf keine Provider-Tokens, Code-Verifier, Session-Cookie-Werte oder CSRF-Tokens in Logs, URLs, Storage, Screenshots oder Fehlertexten ablegen. Das Cookie bleibt HttpOnly; `credentials: 'same-origin'` und CSRF-Header sind der einzige Schreibpfad.
- Ein fremder `returnTo`-Wert, eine fremde API-Origin und ein unsicherer DSFA-Link dürfen nicht zur Navigation führen. Der Dienst prüft den Rückweg ebenfalls; das Web verwendet nur relative Pfade.
- Ein abgelaufener/gesperrter Subject-Zugang führt bei der nächsten Anfrage auf die Anmeldeseite; der Client zeigt nie einen Demo-Actor als Ersatz. Die serverseitige Entscheidung aus 029b bleibt maßgeblich.
- Keine produktive Konzern-IdP-Anbindung (E11), keine echten Nutzer, kein Deployment, keine Notfallkonten. 031 testet beide Betriebsarten gegen Hono/Postgres/Keycloak; 035 liefert SSE; 040 liefert den auditierbaren Erst-Admin und Jahrgangs-Bootstrap. Eine bloße statische HTTP-Seite macht die Beta noch nicht betriebsbereit.

## Files allowed

- `docs/slices/030-http-web-anmeldung.md`, `docs/evidence/030-*.png`, `docs/folgeliste.md` (letztere nur für nicht blockierende unabhängige Reviewbefunde)
- `apps/web/src/api/**` (nur Moduswahl, Auth-Port, Vertragsadapter und zugehörige Tests)
- `apps/web/src/app/{App.tsx,AppShell.tsx,Header.tsx,RoleSwitcher.tsx,DemoControls.tsx,LoginPage.tsx,LoginPage.test.tsx}` (nur Start-/Anmelde-/Headerfluss; neue Dateien nur für diese Funktionen)
- `apps/web/src/i18n/{de.ts,en.ts,shell.de.ts,shell.en.ts,types.ts}` (nur Anmelde-, Sitzungs- und Fehlermeldungen in DE/EN)
- `apps/web/src/styles/index.css` (nur Anmeldeseite, Fokus- und responsive Darstellung)
- `apps/web/vite.config.ts`, `apps/web/src/vite-env.d.ts` (nur Build-Modus und lokale Same-Origin-Proxy-Konfiguration)
- `apps/web/e2e/030-anmeldung.spec.ts` (nur 030-Browsernachweise mit synthetischen Antworten; der echte Dual-Mode-Lauf folgt in 031)

Weder Server- noch Domänen- oder Vertragsdateien werden in 030 geändert. Wenn der vorhandene `HvApi`-/OpenAPI-Stand die geforderte Abbildung nicht trägt, ist das ein Spec-Code-Befund: anhalten und melden, nicht einen zweiten Vertrag erfinden oder den Scope still erweitern.

## Tests zuerst und Abnahme

1. Rote Adaptertests: jeder `HvApi`-Aufruf trifft den deklarierten HTTP-Pfad und die Methode; Pfadkodierung, Query, JSON und `204`; ETag/If-Match, neuer versus wiederholter Idempotency-Key; Problem-Details; `403` bleibt Fachfehler, `401` wechselt einmalig zur Anmeldung; kein Schreiben ohne CSRF.
2. Rote Auth-/UI-Tests: DE/EN-Hinweis und optionaler DSFA-Link vor dem Login, Login bei fehlendem Hinweis gesperrt, sicherer Rückweg, `/auth/me` beim Start und bei Sichtbarwerden, stiller Refresh, Logout mit CSRF, Netzwerkfehler ohne vorgetäuschten Logout. In HTTP-Betriebsart sind Demo-Persona, Demo-Reset und Demo-Storage unerreichbar; Demo-Betriebsart läuft unverändert weiter.
3. Browsernachweis mit synthetischen Daten: Anmeldeseite Deutsch und Englisch, 401-Behandlung, Tastaturpfad, schmale Breite; Screenshots `docs/evidence/030-*.png`. Keine echten Zugangsdaten in Screenshots. Vollständige verfügbare E2E-Suite; `grep fetch(` außerhalb `apps/web/src/api/http.ts` liefert keinen Treffer.
4. `pnpm gates` auf sauberem Baucommit grün; Commit und wörtlicher Schluss einmal im Bericht. Unabhängiges Review in frischem Kontext nach Spec und Diff. P0/P1 und jeder Security-/Legal-/Privacy-Befund vor Merge, übrige Punkte nach AGENTS.md. PR-CI auf dem letzten Commit grün. Jeder Commit nennt „Scheibe 030“ und endet `[skip netlify]`; PR-Titel und Merge-Commit tragen ebenfalls `[skip netlify]`. Kein Deploy.

## Bericht (nach Bau ausfüllen)

Slice: 030-http-web-anmeldung  
Done: —  
Evidence: —  
Open: —  
Touched: —
