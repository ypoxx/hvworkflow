# Übergabe an die nächste Orchestrator-Sitzung (29.09.2026, abends)

Fortschreibung von `docs/bautage/uebergabe-2026-09-25-abend.md`. **Rolle, Grenzen und Arbeitsweise gelten
unverändert:** Orchestrator und Architekt, kein Deploy ohne Go, jeder Commit und jeder Squash mit `[skip netlify]`,
keine echten Daten, keine Zugangsdaten, schlanker Review-Modus (AGENTS.md R3), `git push` nur mit Remote und Branch.
Bau bevorzugt mit Sonnet, Reviews von Hochrisiko-Scheiben mit Opus.

## Stand

- Codex hat am 27.–29.09. zwölf PRs gebaut (021c bis 030); die Nachprüfung und die Reparaturen stehen in
  `docs/bautage/2026-09-27-29.md`. Vertrag jetzt **0.3.8** (takt-023).
- Gemergt in dieser Sitzung: takt-021 (#60), takt-022 (#59), takt-023 (#64), takt-025 (#61), takt-026 (#63),
  Spec 033a/033b (#65). **Nightly grün** seit Lauf 8.
- takt-024 (#62, `bc60ab8`) Postgres-Schreibsperre erst nach Routentreffer und Vertragsprüfung ebenfalls gemergt;
  alle sechs Reparatur-Takte sind drin. Integrationsbranch-Kopf nach #62: `bc60ab8`.
- Später am Abend gemergt: 033a (#68), takt-027 (#67), takt-028 (#69, `f357693`), takt-029 (#70, `ebf0ae2`).
  Spec 034a/034b als PR #71 (baureif nach drei Lesebefund-Runden). 033b gebaut, Review läuft.
- Doku-PR für Tagesbericht, Folgeliste, diese Übergabe und den Zielpfad-Stand: Branch `claude/bautag-2026-09-27-29`.

## Nächste Schritte

0. **Jetzt:** 033b nach Review/PR mergen; Spec-PR #71 mergen; dann 034a bauen (Opus-Review, Risikoklasse hoch),
   danach 034b. E55 (Patch-Stufe für engere Anfrageschemas) beim Eigentümer, Standard Patch.
1. (Erledigt bis auf 033b/034:) takt-027 ist gemergt (#67, `4daa317`). **033a** bauen (Bau am 29.09. abends gestartet). Vor 033b **takt-028**: gebündelte Sicherheits- und
   Datenschutzbefunde aus der Nachprüfung (Liste am Ende von `docs/folgeliste.md`); Grenzen und Timeouts gehen in 034.
   Regel: Sicherheits-, Rechts- und Datenschutzbefunde nie auf die Folgeliste. (Spec `docs/slices/033a-serverzeit-health-zugriffslog.md`; Branch
   `claude/slice-033a-…`; ADR-Absätze sind schon geschrieben). Danach **033b** (Vertrag 0.3.9 zuerst), dann **034**
   mit der harten Vorbedingung aus 029b: `/auth/login` braucht Obergrenze/Rate-Limit und ein Aufräumen abgelaufener
   Login-Zustände (Folgeliste, Befund 029b major).
2. Etappe B: 031 (e2e gegen Hono/Postgres/Keycloak; dabei den HTTP-Modus der e2e-Suite in CI verdrahten, Folgeliste 030),
   035, 036. Dann Etappe C (043 zuerst) und D (064–066 nach 043).

## Arbeitshilfen

- Lokaler Postgres 16: `/usr/lib/postgresql/16/bin`, Cluster unter `/var/tmp/pgtest` (nach frischem Container neu:
  `initdb` als Nutzer `postgres`, Rollen `hv_owner`/`hv_runtime` wie in `gates.yml`). Je Scheibe eine eigene Datenbank.
- gitleaks 8.24.3 lässt sich in die Sandbox laden (GitHub-Release); Semgrep-Registry (`p/typescript`) und Netlify-Doku
  sind gesperrt.
- e2e lokal: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`, eigener `E2E_PORT`; `003-answers-stage` braucht unter Last
  `--timeout=240000`.

## Beim Eigentümer offen

1. **ADR 0015:** 0.3.4 und 0.3.6 brechen die Kompatibilität in Patch-Stufen. Vorschlag: Ergänzung „Beta-Zyklus 0.3.x
   darf Brüche in Patch-Stufen tragen, solange kein externer Partner 0.3.x nutzt; ab 064–066 gilt ADR 0015 voll“.
2. **Netlify-Projekt:** Deploy Previews und Branch deploys auf „None“ (vollständige Sperre; takt-022 sperrt nur aus dem Repo).
3. **Selbstzuordnung durch `admin`** (026, MF-01) im Entscheidungsregister vermerken.
4. **E55:** Engere Anfrageschemas (034a, `maxLength`) als Patch-Stufe nach ADR 0015? Fällig 27.10.2026, Standard Patch.
5. Aus der früheren Übergabe unverändert offen: Abrechnung der Subagenten-Token prüfen.
