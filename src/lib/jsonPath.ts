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

const TEMPLATE_PLACEHOLDER = /\{\{\s*([^}]+?)\s*\}\}/g;

/** A jsonPath value is treated as a template (rather than a single bare path) if it contains a "{{ }}" placeholder, e.g. "{{days_watched}} days". */
export function isTemplate(pathOrTemplate: string): boolean {
  return pathOrTemplate.includes("{{");
}

/**
 * Substitutes every "{{path}}" placeholder in a template string with the
 * value resolved at that path in the source JSON, e.g. resolving
 * "{{days_watched}} days" against `{ days_watched: 83.5 }` produces
 * "83.5 days". Missing paths resolve to an empty string rather than leaving
 * the placeholder or throwing.
 */
export function resolveTemplate(data: unknown, template: string): string {
  return template.replace(TEMPLATE_PLACEHOLDER, (_match, path: string) => {
    const resolved = resolveJsonPath(data, path);
    if (resolved === undefined || resolved === null) return "";
    if (typeof resolved === "object") return JSON.stringify(resolved);
    return String(resolved);
  });
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

/**
 * True only if every "{{path}}" placeholder in the template resolves to a
 * defined value. Used to gate auto-detected suggestions — resolveTemplate
 * itself degrades missing paths to an empty string (fine for a field a user
 * deliberately mapped), but that same behavior would make a template whose
 * data simply isn't present in this JSON look like a valid suggestion.
 */
export function templateResolvesFully(data: unknown, template: string): boolean {
  let allDefined = true;
  template.replace(TEMPLATE_PLACEHOLDER, (_match, path: string) => {
    if (resolveJsonPath(data, path) === undefined) allDefined = false;
    return "";
  });
  return allDefined;
}

/**
 * Resolves a field's stored `jsonPath` against the source JSON and coerces it
 * to the field's configured type — transparently handling both a bare path
 * ("days_watched") and a "{{path}} literal text" template. Shared by the
 * mapping endpoint and the poller so both interpret jsonPath identically.
 *
 * A template counts as resolved only if every placeholder it references is
 * present in this JSON — same "missing data means skip, don't write a
 * degraded value" behavior a bare path already has. Without this, a response
 * missing the underlying field (e.g. an API's error payload swapped in for
 * its real body) would still "resolve" to something like " days" instead of
 * being treated as absent.
 */
export function resolveFieldValue(
  data: unknown,
  jsonPath: string,
  fieldType: number,
): string | number | { url: string } | undefined {
  if (isTemplate(jsonPath)) {
    if (!templateResolvesFully(data, jsonPath)) return undefined;
    return coerceResolvedValue(resolveTemplate(data, jsonPath), fieldType);
  }
  return coerceResolvedValue(resolveJsonPath(data, jsonPath), fieldType);
}
