export function withUnusedLocal(a: number): number {
  const unused = a * 2;
  return a;
}
