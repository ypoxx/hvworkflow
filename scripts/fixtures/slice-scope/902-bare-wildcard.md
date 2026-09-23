# 902 — Fixture spec with a dangerous bare wildcard

**Status:** spec

Used only by `scripts/slice-scope.test.mjs` — round 1, m4: a bare `*`/`**` (not `dir/*`) must be
rejected outright, not silently interpreted as "everything".

## Files allowed

- `*`
- diese Datei (`scripts/fixtures/slice-scope/902-bare-wildcard.md`)
