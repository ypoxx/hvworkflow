# 900 — Fixture spec for scripts/slice-scope.test.mjs

**Status:** spec

## Ziel

Fixture only, not a real slice: exercises the "Files allowed" parser (`**`, `*`, `{a,b}`) without
touching the real product plan or a real spec.

## Files allowed

- `scripts/fixtures/slice-scope/**`
- `apps/*/package.json`
- `packages/{domain,contract}/src/*.ts`
- `package.json` (Root, nur Skripte)
- diese Datei (`scripts/fixtures/slice-scope/900-fixture.md`)

## Akzeptanzkriterium

None — this file is test input, not a real slice.
