/** Joins class names; keeps conditional Tailwind classes readable without pulling in a dependency. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
