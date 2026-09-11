/**
 * Deterministic display identifier for public review artifacts.
 * This is deliberately non-cryptographic and has no authorization role.
 */
export function stableId(value: string, words = 3): string {
  return Array.from({ length: words }, (_, index) =>
    fnv1a(`${index}:${value}`).toString(16).padStart(8, "0"),
  ).join("");
}

function fnv1a(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
