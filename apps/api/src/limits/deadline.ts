/**
 * A deadline for one external call (slice 034a: 5 000 ms per OIDC call). The call is not cancelled here
 * (the real adapter also sets the driver-level timeout in `auth/oidc.ts`); the caller stops waiting and
 * answers with its fixed "unavailable" text, so nothing after the deadline creates a session.
 */
export class DeadlineError extends Error {
  constructor() {
    super('Deadline exceeded.');
    this.name = 'DeadlineError';
  }
}

export async function withDeadline<T>(run: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  run.catch(() => undefined);
  try {
    return await Promise.race([
      run,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new DeadlineError()), ms); }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
