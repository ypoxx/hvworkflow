/**
 * The route table of the tool — one entry per phase of the meeting, in the order the day runs.
 * Navigation, keyboard shortcuts and the router all read this list, so a later slice only swaps the
 * page component of a row and nothing else has to be touched.
 */
import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import { History, ListOrdered, PencilLine, Presentation, ScrollText } from 'lucide-react';
import type { Meeting } from '@hv/domain';
import type { TKey } from '../i18n';
import { SpeakersPage } from '../features/speakers/Page';
import { CapturePage } from '../features/capture/Page';
import { AnswersPage } from '../features/answers/Page';
import { StagePage } from '../features/stage/Page';
import { HistoryPage } from '../features/history/Page';

/** The header and navigation show only the scalar counters; `byStatus` feeds the process strip. */
export type NumericCounter = Exclude<keyof Meeting['counts'], 'byStatus'>;

export interface AppRoute {
  path: string;
  labelKey: TKey;
  icon: LucideIcon;
  /** Stable hook for tests and for the keyboard shortcut list. */
  testId: string;
  /** Which of the meeting counters belongs next to this entry, if any. */
  counter?: NumericCounter;
  Component: ComponentType;
}

export const APP_ROUTES: readonly AppRoute[] = [
  {
    path: '/speakers',
    labelKey: 'nav.speakers',
    icon: ListOrdered,
    testId: 'nav-speakers',
    counter: 'speakers',
    Component: SpeakersPage,
  },
  {
    path: '/capture',
    labelKey: 'nav.capture',
    icon: PencilLine,
    testId: 'nav-capture',
    counter: 'questions',
    Component: CapturePage,
  },
  {
    path: '/answers',
    labelKey: 'nav.answers',
    icon: ScrollText,
    testId: 'nav-answers',
    counter: 'open',
    Component: AnswersPage,
  },
  {
    path: '/stage',
    labelKey: 'nav.stage',
    icon: Presentation,
    testId: 'nav-stage',
    counter: 'staged',
    Component: StagePage,
  },
  {
    path: '/history',
    labelKey: 'nav.history',
    icon: History,
    testId: 'nav-history',
    Component: HistoryPage,
  },
];

/** The day starts at the speakers list. */
export const DEFAULT_ROUTE = '/speakers';
