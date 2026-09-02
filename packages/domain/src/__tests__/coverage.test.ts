import { describe, expect, it } from 'vitest';
import { computeCoverage } from '../coverage.js';

describe('coverage (Restabdeckung)', () => {
  it('reports the whole text as uncovered when no question is captured', () => {
    expect(computeCoverage(100, [])).toEqual({ coveredRatio: 0, uncovered: [{ start: 0, end: 100 }] });
  });
  it('merges overlapping spans and lists the gaps', () => {
    const r = computeCoverage(100, [
      { start: 10, end: 30 },
      { start: 20, end: 40 },
      { start: 60, end: 70 },
    ]);
    expect(r.coveredRatio).toBeCloseTo(0.4);
    expect(r.uncovered).toEqual([
      { start: 0, end: 10 },
      { start: 40, end: 60 },
      { start: 70, end: 100 },
    ]);
  });
  it('clamps spans to the text', () => {
    const r = computeCoverage(10, [{ start: -5, end: 50 }]);
    expect(r).toEqual({ coveredRatio: 1, uncovered: [] });
  });
});
