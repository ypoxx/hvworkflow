/**
 * Scheibe 061 (part B): shared test data for the control desk (Leitstand) tests. Synthetic only (AGENTS.md R11): the
 * figures follow the sketch of the spec (oldest open question 50 min, 6 in legal clearing over 10 min, Finanzen with
 * 23 open). Not imported by the page.
 */
import type { Cockpit, CockpitOldestRef, CockpitReviewRef, QuestionStatus, Unit } from '@hv/domain';

export const UNITS: readonly Unit[] = [
  { id: 'unit-fin', name: 'Finanzen und Controlling', shortName: 'Finanzen' },
  { id: 'unit-hr', name: 'Personal und Organisation', shortName: 'Personal' },
  { id: 'unit-esg', name: 'Nachhaltigkeit', shortName: 'ESG' },
];

export function oldestRef(
  id: string, number: string, status: QuestionStatus, unitId: string | undefined, ageSeconds: number, statusAgeSeconds: number,
): CockpitOldestRef {
  return { id, number, status, ...(unitId !== undefined ? { unitId } : {}), ageSeconds, statusAgeSeconds };
}

export function reviewRef(id: string, number: string, unitId: string, ageSeconds: number, reviewAgeSeconds: number): CockpitReviewRef {
  return { ...oldestRef(id, number, 'in_review', unitId, ageSeconds, reviewAgeSeconds), reviewAgeSeconds };
}

export const INFLOW_BINS: readonly number[] = [2, 3, 0, 5, 3, 2, 1, 2, 3, 2, 1, 3];

export function cockpitFixture(over: Partial<Cockpit> = {}): Cockpit {
  return {
    meetingId: 'hv-2026',
    asOf: '2026-06-15T13:42:10.000Z',
    meetingStatus: 'running',
    totals: { captured: 171, open: 55, staged: 8, answered: 124 },
    openByStatus: { captured: 5, classified: 3, assigned: 12, answer_drafted: 9, in_review: 14, approved: 4, staged: 8 },
    openByUnit: { 'unit-fin': 23, 'unit-hr': 9, 'unit-esg': 0 },
    openUnassigned: 5,
    oldestOpen: {
      ageSeconds: 3000,
      items: [
        oldestRef('q-125', 'F-0125', 'assigned', 'unit-fin', 3000, 840),
        oldestRef('q-126', 'F-0126', 'approved', 'unit-fin', 2940, 300),
        oldestRef('q-127', 'F-0127', 'answer_drafted', 'unit-hr', 2760, 120),
        oldestRef('q-128', 'F-0128', 'in_review', undefined, 2700, 60),
      ],
    },
    inflow: { binSeconds: 300, bins: [...INFLOW_BINS], last5m: 3 },
    legalReview: {
      over10m: 6,
      items: [
        reviewRef('q-141', 'F-0141', 'unit-fin', 3120, 1440),
        reviewRef('q-142', 'F-0142', 'unit-hr', 2900, 1200),
        reviewRef('q-143', 'F-0143', 'unit-fin', 2500, 1000),
        reviewRef('q-144', 'F-0144', 'unit-esg', 2000, 900),
        reviewRef('q-145', 'F-0145', 'unit-fin', 1800, 700),
        reviewRef('q-146', 'F-0146', 'unit-hr', 1700, 650),
      ],
    },
    ...over,
  };
}
