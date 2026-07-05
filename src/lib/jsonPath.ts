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

/**
 * Coerces a raw value pulled out of a user's JSON API into the shape Discord's
 * dynamic field types expect. In particular, image fields (type 3) expect
 * `{ url: string }`, but most JSON APIs just return a bare URL string for an
 * avatar/image field — so a bare string is accepted and wrapped automatically.
 * Returns undefined if the value doesn't match the field's configured type at
 * all (e.g. a jsonPath pointing at a number for a string field).
 */
export function coerceResolvedValue(
  resolved: unknown,
  fieldType: number,
): string | number | { url: string } | undefined {
  if (resolved === undefined || resolved === null) return undefined;

  if (fieldType === 1) {
    if (typeof resolved === "string") return resolved;
    // Many JSON APIs return numbers for what a widget_config still declares
    // as a string field (e.g. AniList's `total_anime: 552` vs. a widget field
    // sample-valued as "552") — auto-stringify rather than reject, since the
    // string representation is exactly what's wanted here.
    if (typeof resolved === "number") return String(resolved);
    return undefined;
  }
  if (fieldType === 2) {
    return typeof resolved === "number" ? resolved : undefined;
  }
  if (fieldType === 3) {
    if (typeof resolved === "string") return { url: resolved };
    if (
      typeof resolved === "object" &&
      "url" in resolved &&
      typeof (resolved as { url: unknown }).url === "string"
    ) {
      return { url: (resolved as { url: string }).url };
    }
    return undefined;
  }
  return undefined;
}
