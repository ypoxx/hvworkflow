/**
 * The nine synthetic persons of the test realms (slice 031a built the list in `scripts/e2e-http-031.mjs`, slice 037a
 * moved it here so the local stack fills the same persons). `role` is the assignment the bootstrap writes; `norole`
 * has none. The keys double as readable user names in the local stack (`scripts/stack.mjs`).
 */
export const PERSONS = [
  { key: 'moderation', role: 'moderation' },
  { key: 'capture', role: 'capture' },
  { key: 'coordination', role: 'coordination' },
  { key: 'expert', role: 'expert', unitId: 'unit-fin' },
  { key: 'legal', role: 'legal' },
  { key: 'approver', role: 'approver' },
  { key: 'podium', role: 'podium' },
  { key: 'norole' },
  // Only H6 signs this person in and blocks it; a second capture person keeps every other test unharmed.
  { key: 'revoke', role: 'capture' },
];
