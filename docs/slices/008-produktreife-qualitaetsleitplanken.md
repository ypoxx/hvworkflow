# 008 — Produktreife: Qualitätsleitplanken und Reviewkatalog

**Status:** superseded by 009 (konsolidiert am 23.09.2026; übernommen vom Codex-Branch `codex/bewertungsbericht-zum-hv-tool-erstellen`, e4ef4e1)
**Role:** Architektur und Qualität
**Rule ids:** AGENTS.md § Hard rules 1, 2, 3 and 12

## Goal

Create `docs/qualitaetsleitplanken-produktreife.md` as a complementary review guide for the path
from demo to production. It must help planning and reviewing agents identify quality impacts,
required evidence and escalation points without duplicating or overriding the existing requirements,
contract, rule tables, ADRs or working method.

The guide must:

- define its place in the repository and the authority of existing source documents;
- distinguish demo, pilot and production readiness;
- provide a lightweight change classification and risk classification;
- provide actionable checks for architecture, data, APIs, security, privacy, operations,
  administration, UX, documentation, AI integrations and simplicity;
- provide readiness and acceptance aids, review triggers and milestone checks without replacing the
  existing working method;
- distinguish binding rules, recommendations and open decisions;
- list unresolved productisation decisions rather than silently deciding them.

## Non-goals

- No change to product code, OpenAPI, domain rules, permissions, transitions or CI.
- No second copy of the requirements, API operations, transition table or permission matrix.
- No choice of hosting platform, identity provider, database topology or AI provider.
- No assertion of legal approval or production readiness.

## Files allowed

- `docs/qualitaetsleitplanken-produktreife.md`
- `docs/slices/008-produktreife-qualitaetsleitplanken.md`
- `README.md` (documentation index entry only)

## Acceptance criterion

1. The guide identifies the status of source documents and does not promote research or proposals to
   approved rules. Existing normative product or repository rules are referenced rather than copied.
2. An agent can use the guide to classify a proposed slice, determine required reviewers and
   evidence, and decide whether an unresolved decision blocks implementation.
3. The guide includes concise checklists that support `yes / no / not applicable / blocked`
   answers and does not prescribe unnecessary microservices or infrastructure.
4. `pnpm gates` passes.

## Evidence

`pnpm gates` completed with exit 0 after the document was created: OpenAPI valid with nine existing
warnings; all four workspaces typechecked and linted; 39 domain, 25 API and 9 web tests passed;
vocabulary check and production web build completed. A final run after review rework produced the same
successful result.

## Review findings

Independent review found two blockers: the first draft treated the unverified requirements research
as authoritative, and it introduced a second mandatory working method that conflicted with the
fresh-context review rule. Major findings concerned non-deterministic risk classification, unclear
exceptions, missing maturity-specific scope and an incomplete open-decision list. Rework must make
the guide advisory, preserve Spec+Diff-only review, add source status, deterministic triggers and a
compact maturity matrix, and record the missing product decisions.

After two rework passes, the independent reviewer accepted the slice with no remaining blocker or
major finding. It confirmed the source-status distinction, advisory character, four answer values,
deterministic risk default, maturity-specific selection, Spec-and-Diff-only review and the expanded
open-decision register.
