# 902 — Fixture spec, status review with an unrelated checkbox

**Status:** review

Used only by `scripts/hooks/task-completed.test.mjs` — proves a stray `- [x]` elsewhere in the file
(e.g. in a checklist that has nothing to do with acceptance) never counts as acceptance on its own
(review rework round 1, m3).

## Nachweise

- [x] some unrelated checklist item, ticked, but not an acceptance mark
