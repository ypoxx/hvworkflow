# 005 — Designsystem-Erweiterung: Prozessleiste, Glyphen, Statusfarben, Bausteine

**Status:** spec
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

## Review findings
