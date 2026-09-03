# 006 — Wortmeldeliste und Erfassung: Priorisierung, Zeitbudget, Marker, Verdichtung

**Status:** rework
**Role:** Implementierer Oberfläche (Sonnet 5)
**Rule ids:** AGENTS.md rules 4, 6, 9, 10; docs/design-prinzipien.md 1, 2, 5, 7
**Depends on:** 005 (ProgressBar, ProgressRing, SourceIcon, TrackBadge glyphs, StageAssignmentBadge initials)

## Goal

### A. Wortmeldeliste (`src/features/speakers/`)

1. **Zeitbudget sichtbar.** In "Am Mikrofon" a `ProgressRing` (elapsed / requestedMinutes) next to
   the mm:ss timer; tone `accent` until the budget, `warn` after. The ring carries
   `data-testid="speaker-timer-ring"` with `aria-valuenow`.
2. **Rundenfortschritt.** Each `RoundSection` header shows a `ProgressBar` finished/total and the
   text "12 von 29 beendet" (i18n with params); `data-testid="round-progress-<n>"`.
3. **Handlungsrelevante Zeilen zuerst ins Auge.** Finished speakers: text ink-500, no "beendet"
   badge, a 14px `Check` icon in the Stand column; withdrawn: ink-400 and `Minus` icon; waiting:
   normal weight, the position number in mono ink-900; the speaking row: accent-50 background with
   a 3px accent bar on the left. The Stand column keeps its width; the badge component stays for
   "spricht" (accent tone) and "wartet" (muted text, no badge).
4. **Art als Icon plus Kurzlabel.** `User` (Aktionär/-in), `Briefcase` (Vertretung), `Users`
   (Vereinigung), 14px, label unchanged. Organisation stays next to the name.

### B. Erfassung (`src/features/capture/`)

5. **Nummerierte Marker.** In `ContributionText`, every covered span is prefixed with a superscript
   marker (number = index of the question in the card list, 1-based, 10px mono in a 16px accent-100
   circle) `data-testid="capture-marker-<n>"`. Hovering a question card highlights its span
   (accent-100 → accent-200) and hovering a span highlights the card (2px accent outline); shared
   `hoveredQuestionId` in `useCapture`. Keyboard: focusing a card triggers the same highlight.
6. **Klassifizierung einklappen.** A card whose question is beyond `captured` shows one summary line:
   TrackBadge (with glyph), agenda item "TOP 2", StageAssignmentBadge initials, and a ghost button
   "Ändern" (`data-testid="card-classification-toggle"`) that expands the existing controls. Cards in
   status `captured` show the controls expanded as today. All classify-* testids stay in the DOM when
   expanded.
7. **Quelle als Icon.** The contribution header shows `SourceIcon` instead of the text badge; the time
   badge stays.
8. Coverage bar: use the shared `ProgressBar` (keeps `capture-coverage` text with the percentage).

## Non-goals

No changes to the answering screens, the shell or the kit (if a kit piece is missing, compose it
locally in the feature folder and report it).

## Files allowed

`apps/web/src/features/speakers/**`, `apps/web/src/features/capture/**`, i18n `de.ts`/`en.ts`
(new keys inside the existing `// --- 002 speakers & capture ---` block), `apps/web/e2e/002-speakers-capture.spec.ts`
(extend: ring visible, marker count equals card count, toggle expands), `docs/evidence/006-*`, this file.

## Acceptance criterion

`pnpm gates` green; `E2E_PORT=<port> pnpm --filter @hv/web e2e` all specs green, including
`abnahme.spec.ts` (it classifies a captured card, which stays expanded). Screenshots
`docs/evidence/006-speakers.png` and `006-capture.png` (capture with at least five cards and markers).

## Evidence

`pnpm gates` (real tail):

```
apps/web test:  Test Files  1 passed (1)
apps/web test:       Tests  6 passed (6)
apps/web test:    Start at  08:21:12
apps/web test:    Duration  247ms (transform 80ms, setup 0ms, import 95ms, tests 8ms, environment 0ms)
apps/web test: Done
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  25 passed (25)
apps/api test:    Start at  08:21:12
apps/api test:    Duration  1.55s (transform 1.09s, setup 0ms, import 2.31s, tests 1.20s, environment 0ms)
apps/api test: Done

> hvworkflow@0.1.0 vocabulary /home/user/hvworkflow/.claude/worktrees/agent-ab39ff455662a0169
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> @hv/web@0.0.0 build /home/user/hvworkflow/.claude/worktrees/agent-ab39ff455662a0169/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1702 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/index-DTqWyNH5.css                        38.14 kB │ gzip:   8.30 kB
dist/assets/index-D2n2Mfb4.js                        513.63 kB │ gzip: 150.86 kB │ map: 2,115.58 kB
✓ built in 1.15s
```

`E2E_PORT=4192 pnpm --filter @hv/web e2e` (real tail, all five specs including `abnahme.spec.ts`):

```
Running 5 tests using 2 workers

  ✓  1 [chromium] › e2e/001-shell.spec.ts:16:1 › shell: counters, role switch, language switch @screenshot (2.8s)
  ✓  3 [chromium] › e2e/001-shell.spec.ts:76:1 › header strip on the answers desk @screenshot (1.6s)
  ✓  2 [chromium] › e2e/002-speakers-capture.spec.ts:61:1 › speakers list and capture desk @screenshot (7.8s)
[timing] /answers list after status filter click: 109.0 ms
[timing] /stage view after navigation: 98.5 ms
[timing] stage-next presses to reach F-0801: 9
  ✓  5 [chromium] › e2e/abnahme.spec.ts:86:1 › @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (36.3s)
  ✓  4 [chromium] › e2e/003-answers-stage.spec.ts:43:1 › backlog, approval, podium and history @screenshot (43.7s)

  5 passed (51.2s)
```

Screenshots: `docs/evidence/006-speakers.png` (Wortmeldeliste with the time-budget ring next to
"Am Mikrofon"'s timer, the finished/total `ProgressBar` on every round header, Art icons, and the
Check/Minus Stand column), `docs/evidence/006-capture.png` (Erfassung with eight captured cards,
seven numbered markers in the Redebeitrag, and the first card classified into Pfad C, still
expanded). Other evidence PNGs the e2e run rewrote were restored with `git checkout` — only the
`006-*` files carry this slice's new output.

## Open findings (kit gap, reported per the non-goals clause)

The kit's `ProgressRing` and `ProgressBar` (`apps/web/src/components/Progress.tsx`, out of this
slice's allowed files) accept no `data-testid` or other pass-through DOM attribute on their root
node. Point 1 requires the ring itself to carry both `data-testid="speaker-timer-ring"` and
`aria-valuenow` on the *same* element, which the kit component cannot do. Composed a small
`TimerRing` in `apps/web/src/features/speakers/TimerRing.tsx` instead, mirroring the kit's visual
constants (28 px, 3 px stroke, the same tone tokens) exactly, so the two stay indistinguishable —
only the attribute contract differs. Suggest the kit component gain prop pass-through in a later
slice so features stop needing to duplicate it. (Point 2's round-progress `ProgressBar` needed no
such duplication — its `data-testid` sits on a wrapping `<span>` around the unmodified kit
component, since that point does not require `aria-valuenow` on the same node.)

While wiring the round-progress `ProgressBar` in, a second kit-usage pitfall turned up and was
fixed before it shipped: passing a sizing class (`className="w-20"`) straight into `ProgressBar`
collided with its own built-in `w-full` (both plain utility classes of equal specificity, so the
winner is cascade-order, not JSX order) and rendered the bar at 0 px width in the real browser even
though it reported a non-zero bounding box to Playwright's `toBeVisible()`. Fixed by sizing a
wrapping `<span className="w-20">` instead and leaving `ProgressBar` unmodified — the pattern to
follow whenever a consumer needs to constrain this component's width.

## Review findings

### Design-Kritik (Fable, Screenshots 006-speakers.png, 006-capture.png)

1. **major** — `features/speakers/NowSpeaking.tsx`: der Zeitbudget-Ring sitzt zwischen Name und Timer und
   nimmt dem Namen die Breite ("Vera Reh…" wird abgeschnitten). Erwartet: Ring unmittelbar links neben
   dem mm:ss-Timer in derselben Gruppe; die Namensspalte bekommt `flex-1 min-w-0` und wird bei 1440 px
   nicht abgeschnitten (Playwright: `scrollWidth === clientWidth` des Namens).
2. **minor** — Erfassung: eine soeben klassifizierte Karte bleibt aufgeklappt (gewollt, kein
   Auto-Einklappen während der Bearbeitung). Nach einem Neuladen der Seite muss sie eingeklappt sein;
   bitte im e2e-Test prüfen.
3. Alles Übrige entspricht der Spec: Marker, Hover-Kopplung, Rundenfortschritt, gedämpfte Zeilen,
   Art-Icons, Quellen-Icon, Restabdeckung über den Kit-Balken.

### Review of the UI improvement round (adversarial review, slices 005–007 together)

Checked against the spec's eight numbered points, AGENTS.md rules 4/5/6/9/10 and
docs/design-prinzipien.md, on the merged state, plus my own `pnpm gates` and
`E2E_PORT=4195 pnpm --filter @hv/web e2e` run (both green, output in the review report).

**Points 1–8: all implemented**, verified in the code and in the evidence I regenerated myself:
time-budget ring with `aria-valuenow` on the same node as the testid (`features/speakers/TimerRing.tsx:22-31`,
tone flips at the budget — `NowSpeaking.tsx:75`), round progress bar plus "17 von 29 beendet"
(`RoundSection.tsx:106-127`), the muted/Check/Minus/accent-bar row states (`SpeakerRow.tsx:228-334`,
the speaking bar is now 3px), Art glyphs (`labels.ts:299-303`), numbered markers (`ContributionText.tsx:184-194`,
seven markers for seven cards in `docs/evidence/006-capture.png`), the shared `hoveredQuestionId`
(`useCapture.ts:147-150`, card outline `QuestionCard.tsx:86`, span tint `ContributionText.tsx:181`),
the collapse/"Ändern" summary line (`QuestionCard.tsx:41,102-127`) and `SourceIcon` in the
contribution header. **Architect finding 2 is resolved**: `e2e/002-speakers-capture.spec.ts:200-212`
now leaves and re-enters the desk and asserts the card comes back collapsed.

**Rule 5 specifically:** nothing in this slice decides an action from a status — `QuestionCard.tsx:30`
still gates the controls on `_actions.includes('question.classify')`; the `question.status === 'captured'`
read at `:41` only chooses the initial collapsed/expanded state, which is what point 6 asks for.

**Selection mapping (checked line by line, no blocker):** the marker `<sup>` does **not** corrupt the
DOM-range → text-offset mapping. `data-offset` sits on the wrapper span and `offsetOf`
(`ContributionText.tsx:32-39`) adds the *text-node-local* offset to it; the `<sup>` is a separate
element node, so the segment's own text node still starts at offset 0 = `segment.start`. Both element-
node boundary cases behave exactly as they did before markers existed. See R7 for the one residual
edge.

6. **major — `apps/web/src/features/speakers/NowSpeaking.tsx:66-97`. Architect finding 1 is still
   present.** No commit touched the file after the design critique (`git log -- NowSpeaking.tsx` ends
   at a1757f1, the critique is 3d813b9), and the evidence I regenerated with my own e2e run
   (`docs/evidence/006-speakers.png`, 1440×900) still shows **"Vera Reh…"** truncated. The two halves
   of the requested fix that are cheap are in fact there — `Identity` gets `flex-1` (`:67`) on a root
   that already has `min-w-0` (`:18`), and the ring sits in the same flex group as the mm:ss timer
   (`:70-85`) — but they do not help, because the row is a `flex-wrap` line with five fixed-width
   blocks after the name (elapsed, Fragen, "angemeldet 7 min", "Zur Erfassung", "Beenden"); at 1440px
   the identity column collapses to ≈90px. Fix: give the name real priority instead of leftover space,
   e.g. `min-w-[220px] flex-1` on `Identity` and one `shrink-0` group around ring+timer+Fragen+badge,
   or drop the "angemeldet {n} min" badge (the ring already encodes the budget) — and add the check
   the architect asked for to `e2e/002-speakers-capture.spec.ts`: the name span's
   `scrollWidth === clientWidth` at 1440×900.
7. **minor — `apps/web/src/features/capture/ContributionText.tsx:184-194`.** The marker `<sup>` is
   ordinary selectable text inside the flow: copying a marked passage out of the Redebeitrag yields
   the marker digits inside the wording, and a selection that *starts* inside the digit maps to
   `segment.start + <offset inside the digit>` (`:38`), i.e. a one-character skew of the captured span.
   Fix: `select-none` on the `<sup>` (and, belt and braces, `data-offset={segment.start}` on it, so any
   offset inside it resolves to the span start).
8. **minor — `apps/web/src/features/speakers/TimerRing.tsx` (whole file) and the dead keys
   `capture.contribution.source.transcript`/`.manual` (`i18n/de.ts:122-123`, `en.ts:123-124`).** The
   duplicated ring was the right call under this slice's non-goals clause and is reported honestly, but
   it must not become permanent: once finding R1 of slice 005 lands (prop pass-through on
   `components/Progress.tsx`), delete `TimerRing.tsx` and use `ProgressRing` with `data-testid`. The two
   source keys became dead when point 7 replaced the badge with `SourceIcon`; remove them from both
   dictionaries.

**Verdict: rework** — because of R6 (major, the architect's finding 1 is unaddressed). R7 and R8 are
minors and may travel with it.
