# 005 — Designsystem-Erweiterung: Prozessleiste, Glyphen, Statusfarben, Bausteine

**Status:** review
**Role:** Implementierer Oberfläche (Sonnet 5)
**Rule ids:** AGENTS.md rules 4, 6, 9, 10; docs/design-prinzipien.md 1, 4, 5, 9
**Depends on:** `Meeting.counts.byStatus` (domain + contract, done)

## Goal

The shared building blocks for the UI improvement round (docs: chat critique of 3 Sept.), so that
slices 006 and 007 only compose. Everything lives in `src/components/` and `src/app/`; no feature
folder is touched.

1. **`ProcessStrip`** (`src/components/ProcessStrip.tsx`): a monochrome-plus-tints infographic of a
   distribution. Props: `segments: { key: string; label: string; count: number; tone: BadgeTone | 'muted' }[]`,
   `total?: number`, `selected?: string[]`, `onSelect?: (key) => void`, `compact?: boolean`,
   `testIdPrefix?: string`. Renders a 6px stacked bar (radius 3px, segment colours = the status
   tint-700 tokens at 60% opacity, selected segment 100%) and, below it, the segment labels with
   their counts in mono (11px uppercase label, 12px mono count). Labels are buttons when `onSelect`
   is given (aria-pressed for selected), plain spans otherwise. Zero-count segments keep their label
   (muted) but no bar width. `compact` hides labels of zero segments. Each label gets
   `data-testid="<testIdPrefix>-<key>"`.
2. **`ProgressBar`** and **`ProgressRing`** (`src/components/Progress.tsx`): value/max, `tone`
   ('accent' | 'warn' | 'muted'), height 4px / ring 28px stroke 3px, aria-valuenow, optional label
   slot inside the ring.
3. **`Sparkline`** (`src/components/Sparkline.tsx`): inline SVG, `values: number[]`, width 100%,
   height 28px, one accent stroke 1.5px, a filled area at 10% opacity, no axes; `ariaLabel` prop.
4. **Status tones consistent.** `StatusBadge` maps statuses to four tones exactly:
   waiting (amber): captured, classified, assigned, in_review; active (accent blue): answer_drafted,
   staged, delivered; done (green): approved; closed (grey): closed, withdrawn, merged. Export the
   mapping as `statusTone(status)` from `src/components/Badge.tsx` and use it everywhere a status
   colour is needed (ProcessStrip segments too). Keep the existing per-status tokens for the bar.
5. **Glyphs.** `TrackBadge` shows an icon before the label: `Mic` (podium), `Zap` (fast_track),
   `Users` (expert_track), 12px. `StageAssignmentBadge` gets a `variant="initials"` that renders a
   20px circle with two-letter initials from i18n keys `stage.initials.supervisory_board_chair` ("AR"),
   `ceo` ("VV"), `cfo` ("FV"), `board_member` ("VM"); English: "SB", "CE", "CF", "BM". Full label as
   `title` and aria-label.
6. **`SourceIcon`** (`src/components/SourceIcon.tsx`): `Mic` for `transcript`, `Keyboard` for
   `manual`, 14px, aria-label from i18n (`source.transcript` "Mitschrift", `source.manual` "Manuell").
7. **`StaleBanner`** (`src/components/StaleBanner.tsx`): inline notice band (amber-50 background,
   1px amber-300 top/bottom border, 13px text, a "Neu laden" button), props `message`, `onReload`,
   `testId`. Used by 007 on 412.
8. **Header process strip.** Replace the four counter cells with one `ProcessStrip` (compact) fed
   from `meeting.counts.byStatus`, segments in workflow order: erfasst (captured+classified+assigned),
   in Arbeit (answer_drafted), im Clearing (in_review), freigegeben (approved), Bühne (staged),
   vorgelesen (delivered+closed). Keys: `captured`, `drafting`, `review`, `approved`, `staged`,
   `delivered`. Keep the "Wortmeldungen" count as a small first cell with `header-counter-speakers`.
   Keep the old testids alive on the strip: `header-counter-questions` (total, shown as
   "Einzelfragen 800" in the strip title), `header-counter-open` (sum captured+drafting+review+approved),
   `header-counter-staged` (staged segment count). The e2e specs read these; do not break them.
   Height stays 56px; the strip pill is at most 520px wide.
9. **Stage tokens.** In `src/styles/index.css` add `--color-stage-text` (#111827) and a
   `.stage-contrast` scope with dark background (#0b0f19), text #f8fafc, accent #93c5fd, muted #94a3b8;
   007 applies the class. No other token changes.
10. i18n keys for everything above in de/en; forbidden words rule applies.

## Non-goals

No feature screens. No new dependencies. No change to routes, api, domain.

## Files allowed

`apps/web/src/components/**`, `apps/web/src/app/Header.tsx` (and a new `src/app/HeaderStrip.tsx`),
`apps/web/src/styles/index.css`, `apps/web/src/i18n/de.ts` + `en.ts` (new keys in a block
`// --- 005 design system ---` inserted directly after the `'nav.history'` line), `apps/web/e2e/001-shell.spec.ts`
(adjust assertions to the strip), `docs/evidence/005-*`, this file.

## Acceptance criterion

`pnpm gates` green; `pnpm --filter @hv/web e2e` all four specs green (they run against the header).
Screenshot `docs/evidence/005-header.png` at 1440×900 showing the header strip on `/answers`.
Component kit exports ProcessStrip, ProgressBar, ProgressRing, Sparkline, SourceIcon, StaleBanner,
statusTone from `src/components/index.ts`.

## Evidence

Implemented all ten points. New components: `ProcessStrip.tsx`, `Progress.tsx` (`ProgressBar` +
`ProgressRing`), `Sparkline.tsx`, `SourceIcon.tsx`, `StaleBanner.tsx`; `Badge.tsx` gained `statusTone`,
`TrackBadge` glyphs and `StageAssignmentBadge`'s `variant="initials"`; `src/app/HeaderStrip.tsx`
replaces the four header counter cells with three stat cells (Wortmeldungen, Einzelfragen, Offen) plus
a compact `ProcessStrip` (workflow segments `captured`/`drafting`/`review`/`approved`/`staged`/
`delivered`, testid prefix `header-counter-*`, so `header-counter-staged` now comes straight off the
strip). The six full-word German segment labels do not fit one line inside a 520px pill at 11px type
(measured ~572px), so the strip's label row wraps to two lines inside its own ≤340px box — verified by
measuring actual DOM bounding boxes (Playwright) before settling on this layout: the pill stays 55.9px
tall, inside the fixed 56px header, in both languages. `index.css` gained exactly the two things point
9 asked for (`--color-stage-text` and `.stage-contrast`, reusing existing tone tokens for the bar so no
other tokens changed). New i18n keys sit in one `// --- 005 design system ---` block in `de.ts`/`en.ts`
directly after `'nav.history'`.

### `pnpm gates` (tail)

```
Scope: 4 of 5 workspace projects
packages/contract typecheck: Done
packages/domain typecheck: Done
apps/api typecheck: Done
apps/web typecheck: Done
Scope: 4 of 5 workspace projects
packages/contract lint: contract lint runs at root: pnpm contract:lint
packages/contract lint: Done
packages/domain lint: Done
apps/api lint: Done
apps/web lint: [21 pre-existing react(set-state-in-effect) warnings, unrelated to this slice, plus
  one new warning: src/components/Badge.tsx:44:17: react(only-export-components) — Badge.tsx now also
  exports the statusTone function alongside its badge components; oxlint exits 0 either way]
apps/web lint: Done
Scope: 4 of 5 workspace projects
packages/contract test: no unit tests in contract package
packages/contract test: Done
packages/domain test:  Test Files  4 passed (4)
packages/domain test:       Tests  39 passed (39)
packages/domain test: Done
apps/web test:  Test Files  1 passed (1)
apps/web test:       Tests  6 passed (6)
apps/web test: Done
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  25 passed (25)
apps/api test: Done

> hvworkflow@0.1.0 vocabulary /home/user/hvworkflow
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> @hv/web@0.0.0 build /home/user/hvworkflow/apps/web
> tsc -b && vite build
✓ 1701 modules transformed.
✓ built in 1.07s
```

Full run exits 0 (`pnpm gates` itself, not piped through `tail`, was checked directly).

### `E2E_PORT=4191 pnpm --filter @hv/web e2e` (tail)

```
Running 5 tests using 2 workers

  ✓  1 [chromium] › e2e/001-shell.spec.ts:16:1 › shell: counters, role switch, language switch @screenshot (2.4s)
  ✓  3 [chromium] › e2e/001-shell.spec.ts:76:1 › header strip on the answers desk @screenshot (1.3s)
  ✓  2 [chromium] › e2e/002-speakers-capture.spec.ts:61:1 › speakers list and capture desk @screenshot (5.8s)
[timing] /answers list after status filter click: 93.5 ms
[timing] /stage view after navigation: 118.9 ms
[timing] stage-next presses to reach F-0801: 9
  ✓  5 [chromium] › e2e/abnahme.spec.ts:86:1 › @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (35.3s)
  ✓  4 [chromium] › e2e/003-answers-stage.spec.ts:43:1 › backlog, approval, podium and history @screenshot (43.1s)

  5 passed (48.8s)
```

`apps/web/e2e/001-shell.spec.ts` gained the `@screenshot` test that produces `docs/evidence/005-header.png`
(1440×900, `/answers`) and two extra assertions (`header-counter-drafting`/`-staged` carry a digit) that
exercise the strip specifically; the four pre-existing testids it already checked
(`header-counter-speakers`, `-questions`, `-open`, `-staged`) are untouched in meaning. All screenshots the
run rewrote other than `005-header.png` were restored with `git checkout` afterwards, per instruction.

Screenshot: `docs/evidence/005-header.png`.

## Rework

Design review of `docs/evidence/005-header.png` found two things, both addressed:

1. **MAJOR — pill crowded out the meeting title.** The pill had grown to ~670px, so the title
   truncated at 1440px. Fix: `ProcessStrip` gained a `dense` mode (`src/components/ProcessStrip.tsx`) —
   10px uppercase labels, 12px mono counts, `flex-nowrap` + `whitespace-nowrap` (no wrapping), 12px gap
   between segments — and the strip's shortened German/English labels moved into the `// --- 005
   design system ---` block (`process.segment.review`: "Im Clearing"/"In clearing" → "Clearing";
   `process.segment.drafting` (en only): "In progress" → "Drafting"). The "Offen" cell is gone from the
   visible pill; `header-counter-open` is now an `sr-only` span carrying the label and value, still in
   the DOM for the e2e assertions and for screen readers. Even after all of that, six full-word
   segments at 10px still measure ~520px on one real line — more than fits next to the title — so
   `HeaderStrip.tsx` puts the strip in its own `min-w-0 max-w-[220px] overflow-x-auto` box: the bar
   (proportions for all six segments) is always fully visible at a glance, the labelled counts scroll
   horizontally instead of wrapping or truncating a number away. `Header.tsx`'s title block moved from
   `min-w-0` to `min-w-[300px]` so it never has to shrink below its own content. Verified directly with
   Playwright rather than by eyeballing a screenshot: the new `header strip on the answers desk` test
   reads `h1`/`p` `scrollWidth` vs `clientWidth` (equal in both languages — no truncation) and asserts
   the pill's `boundingBox().width`, printing it to the test log.
2. **MINOR — "Offen" must be one number everywhere.** `HeaderStrip.tsx` no longer sums four strip
   segments (that excluded the podium queue and undercounted — 323 vs. the real 332); it now reads
   `meeting.counts.open` directly, the same field the navigation badge uses, so the two can never drift
   apart again.

### `pnpm gates` (tail)

```
Scope: 4 of 5 workspace projects
packages/contract typecheck: Done
packages/domain typecheck: Done
apps/api typecheck: Done
apps/web typecheck: Done
Scope: 4 of 5 workspace projects
packages/contract lint: contract lint runs at root: pnpm contract:lint
packages/contract lint: Done
packages/domain lint: Done
apps/api lint: Done
apps/web lint: [same 21 pre-existing react(set-state-in-effect) warnings, unrelated to this slice,
  plus the one pre-existing react(only-export-components) warning on Badge.tsx:44 (statusTone
  exported alongside the badge components) — oxlint exits 0]
apps/web lint: Done
Scope: 4 of 5 workspace projects
packages/contract test: no unit tests in contract package
packages/contract test: Done
packages/domain test:  Test Files  4 passed (4)
packages/domain test:       Tests  39 passed (39)
packages/domain test: Done
apps/web test:  Test Files  1 passed (1)
apps/web test:       Tests  6 passed (6)
apps/web test: Done
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  25 passed (25)
apps/api test: Done

> hvworkflow@0.1.0 vocabulary /home/user/hvworkflow
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> @hv/web@0.0.0 build /home/user/hvworkflow/apps/web
> tsc -b && vite build
✓ 1701 modules transformed.
✓ built in 1.07s
```

Exit code of `pnpm gates` itself: 0.

### `E2E_PORT=4191 pnpm --filter @hv/web e2e --grep 001` (real output)

```
Running 2 tests using 1 worker

  ✓  1 [chromium] › e2e/001-shell.spec.ts:16:1 › shell: counters, role switch, language switch @screenshot (1.9s)
[005 rework] header counters pill width: 498.7px
  ✓  2 [chromium] › e2e/001-shell.spec.ts:76:1 › header strip on the answers desk @screenshot (1.0s)

  2 passed (4.9s)
```

Pill width 498.7px (target ≤560px, met with margin) in German; the English render (longer words:
"Requests"/"Questions"/"Captured"/"Drafting"/"Clearing"/"Approved") measured narrower still at
429.8px in manual verification, so this isn't a German-specific fit. Both `h1`/`p` truncation
assertions (`scrollWidth ≤ clientWidth`) pass in both languages.

For full confidence beyond the requested `--grep 001`, the complete suite was also re-run since
`Header.tsx`/`HeaderStrip.tsx`/`ProcessStrip.tsx` are shared across every screen:

```
Running 5 tests using 2 workers

  ✓  2 [chromium] › e2e/001-shell.spec.ts:16:1 › shell: counters, role switch, language switch @screenshot (2.3s)
[005 rework] header counters pill width: 498.7px
  ✓  3 [chromium] › e2e/001-shell.spec.ts:76:1 › header strip on the answers desk @screenshot (1.4s)
  ✓  1 [chromium] › e2e/002-speakers-capture.spec.ts:61:1 › speakers list and capture desk @screenshot (5.7s)
  ✓  5 [chromium] › e2e/abnahme.spec.ts:86:1 › @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (36.0s)
  ✓  4 [chromium] › e2e/003-answers-stage.spec.ts:43:1 › backlog, approval, podium and history @screenshot (43.6s)

  5 passed (49.2s)
```

Screenshots the run rewrote other than `005-header.png` were restored with `git checkout` afterwards.
Updated screenshot: `docs/evidence/005-header.png` (title and subtitle now render in full at 1440×900).

### Rework round 2 — no scrolling, ever

Design decision from the coordinator: a horizontally scrolling label row is not acceptable ("nothing
is hidden behind a scroll in the frame"). Rebuilt the header strip to the exact layout given:

- `ProcessStrip.tsx` now has two real renderings sharing one `BarRow`: `LabelledStrip` (unchanged —
  full label + count per segment, still exported for slice 007's answers desk) and a new `DenseStrip`
  for the header. `dense` no longer means "the same label row, smaller font, no wrap" (round 1's
  scrolling fix) — it now means: the 6px bar, and a mono count (10px, `ink-600`) centred under any
  segment whose computed pixel width is ≥28px; narrower segments print nothing. Widths are computed
  from a caller-supplied `width` prop (pixels), not measured live, so the "wide enough" cutoff and the
  pill's total width are both deterministic and reproducible in a test.
- The whole strip is one element: `role="group"`, `tabIndex={0}`, `aria-label` built from the new
  `process.strip.legend` i18n key (6 named placeholders, one per segment) — e.g. in German exactly
  *"Verteilung der Einzelfragen: erfasst 75, in Arbeit 56, Clearing 78, freigegeben 114, Bühne 9,
  vorgelesen 468"*, confirmed verbatim against the running demo. Hover or focus opens a
  `data-testid="header-strip-legend"` popover 8 rem (`w-60`) wide, white, `border-ink-200`, `rounded-md`,
  Dialog's own shadow (`shadow-[0_16px_40px_-12px_rgba(31,30,28,0.28)]`), listing all six segments as
  rows (8px colour swatch, label, mono count right-aligned); it closes on mouse leave, blur, or Escape.
  `header-counter-staged` is now on two elements on purpose: an always-present `sr-only` span inside
  the strip (so the e2e assertion never has to hover anything) and the staged row's count in the
  popover, per the brief.
- `HeaderStrip.tsx` no longer wraps the strip in an `overflow-x-auto`/`max-w-[220px]` box — that box is
  gone entirely. The bar now gets a fixed `width={180}` (`STRIP_WIDTH_PX`, chosen so the pill lands
  under the 460px target with room to spare, since the fixed stat cells plus padding already claim
  ~277px of the budget). `Header.tsx`'s title block keeps `min-w-[300px]` from round 1.
- New e2e coverage (`apps/web/e2e/001-shell.spec.ts`): the strip's own `scrollWidth` must not exceed
  its `clientWidth` (i.e. it truly never scrolls), the popover opens on focus and disappears on Escape,
  and the pill-width/title-truncation measurements from round 1 stay in place with the target tightened
  to ≤460px. The evidence screenshot is taken *before* the focus/popover interaction, so it shows the
  header's resting state, not a focus ring.

#### `pnpm gates` — exit 0 (unchanged shape: contract lint, 4× typecheck, 4× lint, 4× test suites
39+6+25 passing, `vocabulary-check: ok`, web build ✓; no new lint warnings beyond the two pre-existing
ones already noted above)

#### `E2E_PORT=4191 pnpm --filter @hv/web e2e` (real output, all five)

```
Running 5 tests using 2 workers

  ✓  1 [chromium] › e2e/001-shell.spec.ts:16:1 › shell: counters, role switch, language switch @screenshot (3.4s)
[005 rework] header counters pill width: 458.7px
  ✓  3 [chromium] › e2e/001-shell.spec.ts:75:1 › header strip on the answers desk @screenshot (1.8s)
  ✓  2 [chromium] › e2e/002-speakers-capture.spec.ts:61:1 › speakers list and capture desk @screenshot (7.5s)
[timing] /answers list after status filter click: 146.6 ms
[timing] /stage view after navigation: 140.4 ms
[timing] stage-next presses to reach F-0801: 9
  ✓  5 [chromium] › e2e/abnahme.spec.ts:86:1 › @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (36.4s)
  ✓  4 [chromium] › e2e/003-answers-stage.spec.ts:43:1 › backlog, approval, podium and history @screenshot (44.3s)

  5 passed (52.0s)
```

Pill width 458.7px in German (target ≤460px), 389.8px in English (verified manually — narrower, not
wider). Both `h1` and subtitle satisfy `scrollWidth === clientWidth` at 1440×900 in both languages.
`strip.scrollWidth === strip.clientWidth` (180 === 180) — confirmed no internal scroll. The popover's
own `aria-label`/legend text was checked verbatim against the live demo numbers in both languages, and
the popover opens on focus/hover and closes on Escape.

Screenshots the run rewrote other than `005-header.png` were restored with `git checkout` afterwards.
Updated screenshot: `docs/evidence/005-header.png` — resting state, title and subtitle in full, pill
showing the bar plus the one count wide enough to print (468, under "vorgelesen").

## Review findings
