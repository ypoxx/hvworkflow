/**
 * The registry of all features in the tool — one entry per phase of the meeting.
 *
 * This single source of truth drives the router, navigation, keyboard shortcuts,
 * and help text. Each feature is identified by a unique id, has a path, navigation
 * label and icon, optional keyboard shortcuts (Alt+1…6) and help text, and an
 * optional permission requirement. The visibility of a route can be filtered by
 * `visibleRoutes()` based on granted permissions.
 */
import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Focus, History, ListOrdered, PencilLine, Presentation, ScrollText, SlidersHorizontal, Waypoints } from 'lucide-react';
import type { Permission } from '@hv/domain';
import type { Meeting } from '@hv/domain';
import type { TKey } from '../i18n';
import { SpeakersPage } from '../features/speakers/Page';
import { CapturePage } from '../features/capture/Page';
import { SteeringPage } from '../features/steering/Page';
import { AnswersPage } from '../features/answers/Page';
import { FocusPage } from '../features/focus/Page';
import { StagePage } from '../features/stage/Page';
import { HistoryPage } from '../features/history/Page';
import { AdminPage } from '../features/admin/Page';

/** The header and navigation show only the scalar counters; `byStatus` feeds the process strip. */
export type NumericCounter = Exclude<keyof Meeting['counts'], 'byStatus' | 'byUnit' | 'bySeat'>;

export interface Feature {
  /** Unique identifier for this feature */
  id: string;
  /** URL path when navigating to this feature */
  path: string;
  /** i18n key for the navigation label */
  labelKey: TKey;
  /** Icon shown in the navigation */
  icon: LucideIcon;
  /** Stable hook for tests and for the keyboard shortcut list */
  testId: string;
  /** Which of the meeting counters belongs next to this entry, if any */
  counter?: NumericCounter;
  /** i18n key for the feature's help text (in page.* namespace) */
  helpKey: TKey;
  /** i18n module name for this feature (used to organize translations) */
  i18nModule: string;
  /** Permission required to access this feature, if any; undefined means no restriction */
  requires?: Permission;
  /** The Alt+1…6 keyboard shortcut to navigate here, 1-indexed */
  shortcutKey?: number;
  /** The React component to render when this feature is active */
  Component: ComponentType;
}

export const FEATURES: readonly Feature[] = [
  {
    id: 'speakers',
    path: '/speakers',
    labelKey: 'nav.speakers',
    icon: ListOrdered,
    testId: 'nav-speakers',
    counter: 'speakers',
    helpKey: 'page.speakers.description',
    i18nModule: 'speakers',
    shortcutKey: 1,
    Component: SpeakersPage,
  },
  {
    id: 'capture',
    path: '/capture',
    labelKey: 'nav.capture',
    icon: PencilLine,
    testId: 'nav-capture',
    counter: 'questions',
    helpKey: 'page.capture.description',
    i18nModule: 'capture',
    shortcutKey: 2,
    Component: CapturePage,
  },
  {
    // Scheibe 053: the steering view. `requires` is data, not a role name; until the interface knows the person's
    // rights (no source yet, owner question 3), the navigation shows it to everyone like every other view. No
    // shortcut: Alt+6 is reserved for 054.
    id: 'steering',
    path: '/steering',
    labelKey: 'nav.steering',
    icon: Waypoints,
    testId: 'nav-steering',
    helpKey: 'page.steering.description',
    i18nModule: 'steering',
    requires: 'question.classify',
    Component: SteeringPage,
  },
  {
    id: 'answers',
    path: '/answers',
    labelKey: 'nav.answers',
    icon: ScrollText,
    testId: 'nav-answers',
    counter: 'open',
    helpKey: 'page.answers.description',
    i18nModule: 'answers',
    shortcutKey: 3,
    Component: AnswersPage,
  },
  {
    // Scheibe 054: the focus view ("Meine Fragen"), right after the shared Beantwortung. `requires` is data, not a role
    // name; until the interface knows the person's rights (no source yet, as for steering), the navigation shows it to
    // everyone. No counter: a count per person would need a source of its own.
    id: 'focus',
    path: '/my',
    labelKey: 'nav.focus',
    icon: Focus,
    testId: 'nav-focus',
    helpKey: 'page.focus.description',
    i18nModule: 'focus',
    requires: 'answer.draft',
    shortcutKey: 6,
    Component: FocusPage,
  },
  {
    id: 'stage',
    path: '/stage',
    labelKey: 'nav.stage',
    icon: Presentation,
    testId: 'nav-stage',
    counter: 'staged',
    helpKey: 'page.stage.description',
    i18nModule: 'stage',
    shortcutKey: 4,
    Component: StagePage,
  },
  {
    id: 'history',
    path: '/history',
    labelKey: 'nav.history',
    icon: History,
    testId: 'nav-history',
    helpKey: 'page.history.description',
    i18nModule: 'history',
    shortcutKey: 5,
    Component: HistoryPage,
  },
  {
    // Scheibe 041: the administration (Verwaltung), after the history — it is no phase of the day. `requires` is data,
    // not a role name; until the interface knows the person's rights (089b), the navigation shows it to everyone and
    // the page shows its locked state. No shortcut, no counter.
    id: 'admin',
    path: '/admin',
    labelKey: 'nav.admin',
    icon: SlidersHorizontal,
    testId: 'nav-admin',
    helpKey: 'page.admin.description',
    i18nModule: 'admin',
    requires: 'admin.roles.manage',
    Component: AdminPage,
  },
];

/** The day starts at the speakers list. */
export const DEFAULT_ROUTE = '/speakers';

/**
 * Filter the feature registry by granted permissions.
 *
 * When `granted` is undefined (at boot before permissions are loaded), all features are visible.
 * Once permissions are available, only features that do not have a `requires` field, or whose
 * `requires` permission is in the granted set, are included.
 *
 * This is a pure function with no side effects; it does not compare role names or read from
 * the role switcher (rules 4 and 10 of AGENTS.md).
 */
export function visibleRoutes(
  routes: readonly Feature[],
  granted?: ReadonlySet<Permission>,
): readonly Feature[] {
  if (granted === undefined) {
    return routes;
  }
  return routes.filter((feature) => feature.requires === undefined || granted.has(feature.requires));
}

/**
 * Get the minimum and maximum shortcut keys from the feature registry.
 * Used to label the navigation shortcuts row in the shortcuts dialog as "Alt 1…6".
 */
export function getNavigationShortcutRange(): { min: number; max: number } {
  const shortcuts = FEATURES
    .filter((f) => f.shortcutKey !== undefined)
    .map((f) => f.shortcutKey as number)
    .sort((a, b) => a - b);

  if (shortcuts.length === 0) {
    return { min: 1, max: 1 };
  }

  const minKey = shortcuts[0];
  const maxKey = shortcuts[shortcuts.length - 1];

  // The filter above guarantees these are defined, but TypeScript needs explicit narrowing
  if (minKey === undefined || maxKey === undefined) {
    return { min: 1, max: 1 };
  }

  return { min: minKey, max: maxKey };
}

/**
 * Verify that the feature registry is well-formed:
 * - All paths are unique
 * - All shortcut keys (1…6) are unique
 * - All labelKeys and helpKeys exist in both DE and en-US
 *
 * This should be a test, but because the invariants are static data with no async,
 * it can be run at module load to fail fast.
 */
export function checkFeatureRegistry(): Error | undefined {
  const paths = new Set<string>();
  const shortcuts = new Set<number>();

  for (const feature of FEATURES) {
    if (paths.has(feature.path)) {
      return new Error(`Duplicate path: ${feature.path}`);
    }
    paths.add(feature.path);

    if (feature.shortcutKey !== undefined) {
      if (shortcuts.has(feature.shortcutKey)) {
        return new Error(`Duplicate shortcut key: Alt+${feature.shortcutKey}`);
      }
      shortcuts.add(feature.shortcutKey);
    }
  }

  return undefined;
}
