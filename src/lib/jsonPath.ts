/**
 * Tiny dot-path resolver for pulling a value out of an arbitrary JSON object,
 * e.g. "data.stats.wins" or "items[0].name". Not a full JSONPath implementation
 * on purpose — this only needs to support "pick one value out of a JSON blob".
 */
export function resolveJsonPath(data: unknown, path: string): unknown {
  const segments = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean);

  let current: unknown = data;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
