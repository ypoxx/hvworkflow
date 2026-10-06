/**
 * Scheibe 061 (part B): the core's control desk helpers for the interface. `features/**` may import only types from
 * `@hv/domain` (rule `web-features-i18n-domain-types-only`), so the levels, thresholds and the status trail (Faden) reach
 * the page through this module — one definition in the core, used by the service, `/metrics` and the page alike.
 */
export { cockpitLevel, COCKPIT_THRESHOLDS, statusTrail } from '@hv/domain';
export type {
  Cockpit,
  CockpitFigure,
  CockpitLevel,
  CockpitOldestRef,
  CockpitOpenStatus,
  CockpitReviewRef,
  StatusTrailEntry,
} from '@hv/domain';
