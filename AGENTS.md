# AGENTS.md — how to work in this repository

Read this first. Keep it short; details live in the linked documents. Written for AI agents and
for the people who review their work.

## What this is

A web tool that manages questions and answers at the general meeting (Hauptversammlung, "HV") of
one German listed company: speakers list, capture of speeches, atomisation into questions,
classification into answer tracks, drafting, legal clearing, approval, podium, history.
Requirements: `docs/anforderungen-recherche.md`. Current process: `docs/ist-analyse-und-schnittstellen.md`.
Rights: `docs/rollen-und-rechtekonzept.md`. Architecture: `docs/adr/`. Working method: `docs/agentische-entwicklung-plan.md`.

## Layout

| Path | Role |
|---|---|
| `packages/contract/openapi.yaml` | **The contract. Single source of truth.** Interface and server both derive from it. |
| `packages/domain/` | Application core: types, event log, transition table, rights, projection, `HvApi`, seed. No framework, no I/O. |
| `apps/web/` | React interface. Talks to `HvApi` only. Demo runs the domain in-process in the browser (ADR 0002). |
| `apps/api/` | HTTP server (Hono) implementing the contract over the domain. Portable Node service. |
| `docs/slices/` | One spec per slice of work. No slice without a spec. Review findings live next to it. |
| `docs/evidence/` | Screenshots and test output that prove a slice. |
| `.claude/agents/` | Role definitions (model, tools) for the agents that build this. |

## Commands

```
pnpm install
pnpm gates            # contract lint + typecheck + lint + tests + vocabulary check + web build — green before any merge
pnpm contract:types   # regenerate packages/contract/src/types.ts after editing openapi.yaml
pnpm --filter @hv/web dev
pnpm --filter @hv/web e2e
```

Always use absolute paths or `...` in shell commands; the shell keeps
its working directory between calls.

## Hard rules (R1–R12 in docs/agentische-entwicklung-plan.md)

1. **No slice without a spec** in `docs/slices/NNN-name.md`: goal, non-goals, rule ids, acceptance
   criterion, files allowed. Work outside the allowed files is a finding, not initiative.
2. **Evidence, not claims.** A slice is done when the report contains the real output of
   `pnpm gates` and, for interface work, a screenshot in `docs/evidence/`. "Tests pass" without output
   counts as not run.
3. **Whoever builds does not review.** Reviews are done by a different model in a fresh context
   that sees only spec and diff.
4. **Rights are data.** Never compare a role name in interface or server code. The interface renders
   what `_actions` allows; the server decides through `can()` in `packages/domain/src/api.ts`.
   The only places a role name may appear: `ROLE_PERMISSIONS` and the demo role switcher.
5. **Status transitions are the table** in `packages/domain/src/transitions.ts`. No status logic
   anywhere else. Every row has a rule id and a test.
6. **The contract comes first.** New endpoint → edit `openapi.yaml`, regenerate types, then implement.
   The interface uses the `HvApi` interface, never ad-hoc fetch calls.
7. **Events are append-only.** Nothing updates or deletes an event. State is a projection.
8. **Time comes from the clock injected into the API**, never from `Date.now()` in domain code.
9. **House vocabulary** (docs/glossar.md). Forbidden in interface texts: Ticket, Assignee, Task,
   Workflow-Instanz, Issue. `pnpm gates` fails on them.
10. **Two languages.** Every interface string goes through the i18n dictionary with a German and an
    American English entry. No literals in components.
11. **No credentials, no real data.** Only the synthetic corpus from `packages/domain/src/seed.ts`.
    Deployment happens only from the pipeline, only after the owner's explicit go.
12. **Small diffs.** One slice, one merge, one commit message naming the slice.

## Code style

TypeScript strict, `exactOptionalPropertyTypes` on (write `...(x !== undefined ? { x } : {})` for
optional fields), no `enum` (erasable syntax only), `import type` for types. Comments explain *why*
in English; German house terms in parentheses on first use. Function names in English; domain
nouns follow the glossary mapping (Wortmeldung = speaker request, Redebeitrag = contribution,
Einzelfrage = question, Antwortpfad = track, Bühne = stage/podium).

## Report format for a finished slice

```
Slice: NNN-name
Done: <what, in three lines>
Evidence: <pasted tail of `pnpm gates`>, docs/evidence/NNN-*.png
Open: <anything not done, with reason>
Touched: <file list>
```
