/**
 * Builds the `surfaces` payload for POST /applications/{id}/widget-configs
 * from a user-editable layout mapping (see WidgetLayoutEditor.tsx), confirmed
 * against a real, working, published widget_config (captured via
 * GET /applications/{id}/widget-configs on an already-working app) plus three
 * other real published configs (Marvel Rivals, Wuthering Waves, Arknights
 * Endfield) — all following the same pattern this replicates.
 *
 * Each slot (title, subtitle, a stat's value) is a `SlotBinding`: either
 * static text (value_type "custom_string", never changes) or a live field
 * (value_type "data", `value` set to the field's own name — the exact same
 * reference key later pushed under `dynamic[].name` in profilePush.ts). Image
 * slots stay field-only: Discord images need either an uploaded
 * `application_asset` (no confirmed upload endpoint here) or a live "data"
 * URL, and the latter is what profilePush.ts already sends.
 *
 * `add_widget_preview` IS generated (unlike earlier versions of this file) —
 * Discord's create/update endpoint rejects the request outright with
 * WIDGET_CONFIG_SURFACES_REQUIRED if it's missing, confirmed via a real 400
 * from a live publish attempt. We still don't have a confirmed asset-upload
 * endpoint, so its icon is left unset (banking on the same "falls back to the
 * app's own icon" behavior documented for mini_profile) and title/description
 * use custom_string text only. This is an unconfirmed guess at the component
 * shape — if Discord's next error names different required fields, fix it
 * here based on that real error, the same way every other surface here was
 * derived.
 */

export interface FieldMapEntry {
  fieldName: string;
  fieldType: number; // 1=string, 2=number, 3=image
  label: string;
  sortOrder: number;
}

/** Either fixed text that never changes, or a reference to a live admin-defined field. */
export type SlotBinding = { mode: "static"; text: string } | { mode: "field"; fieldName: string };

export interface StatBinding {
  value: SlotBinding;
  label: string; // caption under/next to the value — always static text
}

/** Which field (or static text) feeds which widget slot — the part a user customizes in WidgetLayoutEditor.tsx. Cheap to store as JSON (User.widgetLayoutJson). */
export interface WidgetLayoutMapping {
  title: SlotBinding | null;
  subtitle: SlotBinding | null;
  imageField: string | null;
  stats: StatBinding[]; // up to 6
}

interface LegacyLayoutMapping {
  titleField: string | null;
  subtitleField: string | null;
  imageField: string | null;
  stats: { fieldName: string; label: string }[];
}

function isLegacyMapping(raw: object): raw is LegacyLayoutMapping {
  return "titleField" in raw || "subtitleField" in raw;
}

/** Accepts either the current shape or the pre-SlotBinding flat shape (fieldName-only) some users may already have saved, normalizing both to the current WidgetLayoutMapping. */
export function normalizeLayoutMapping(raw: unknown, fields: FieldMapEntry[]): WidgetLayoutMapping {
  if (!raw || typeof raw !== "object") return defaultLayoutMapping(fields);

  if (isLegacyMapping(raw)) {
    return {
      title: raw.titleField ? { mode: "field", fieldName: raw.titleField } : null,
      subtitle: raw.subtitleField ? { mode: "field", fieldName: raw.subtitleField } : null,
      imageField: raw.imageField ?? null,
      stats: (raw.stats ?? [])
        .slice(0, 6)
        .map((s) => ({ value: { mode: "field", fieldName: s.fieldName } as SlotBinding, label: s.label })),
    };
  }

  const m = raw as Partial<WidgetLayoutMapping>;
  return {
    title: m.title ?? null,
    subtitle: m.subtitle ?? null,
    imageField: m.imageField ?? null,
    stats: Array.isArray(m.stats) ? m.stats.slice(0, 6) : [],
  };
}

type PresentationType = "text" | "number" | "image";

interface DataField {
  value_type: "data";
  presentation_type: PresentationType;
  value: string;
}

interface CustomStringField {
  value_type: "custom_string";
  presentation_type: "text";
  value: string;
}

function presentationTypeFor(fieldType: number): PresentationType {
  if (fieldType === 2) return "number";
  if (fieldType === 3) return "image";
  return "text";
}

function dataField(fieldName: string, fieldType: number): DataField {
  return { value_type: "data", presentation_type: presentationTypeFor(fieldType), value: fieldName };
}

function labelField(label: string): CustomStringField {
  return { value_type: "custom_string", presentation_type: "text", value: label };
}

function resolveSlot(
  binding: SlotBinding | null | undefined,
  byName: Map<string, FieldMapEntry>,
): DataField | CustomStringField | undefined {
  if (!binding) return undefined;
  if (binding.mode === "static") {
    return binding.text.trim() ? labelField(binding.text) : undefined;
  }
  const field = byName.get(binding.fieldName);
  return field ? dataField(field.fieldName, field.fieldType) : undefined;
}

/** Sensible starting point: first image field -> image slot, next two fields -> title/subtitle, next up to 6 -> stats (using each field's own admin-defined label). Used to prefill the editor and as the fallback if a user hasn't customized anything yet. */
export function defaultLayoutMapping(fields: FieldMapEntry[]): WidgetLayoutMapping {
  const sorted = [...fields].sort((a, b) => a.sortOrder - b.sortOrder);
  const imageField = sorted.find((f) => f.fieldType === 3);
  const otherFields = sorted.filter((f) => f !== imageField);

  const fieldSlot = (f: FieldMapEntry | undefined): SlotBinding | null =>
    f ? { mode: "field", fieldName: f.fieldName } : null;

  return {
    title: fieldSlot(otherFields[0]),
    subtitle: fieldSlot(otherFields[1]),
    imageField: imageField?.fieldName ?? null,
    stats: otherFields
      .slice(2, 8)
      .map((f) => ({ value: { mode: "field", fieldName: f.fieldName } as SlotBinding, label: f.label })),
  };
}

export function buildWidgetConfigSurfaces(
  mapping: WidgetLayoutMapping,
  fields: FieldMapEntry[],
  displayName: string,
): Record<string, unknown> {
  const byName = new Map(fields.map((f) => [f.fieldName, f]));
  const titleSlot = resolveSlot(mapping.title, byName);
  const subtitleSlot = resolveSlot(mapping.subtitle, byName);
  const imageField = mapping.imageField ? byName.get(mapping.imageField) : undefined;
  const statSlots = mapping.stats
    .map((s) => {
      const value = resolveSlot(s.value, byName);
      return value ? { value, label: s.label } : null;
    })
    .filter((s): s is { value: DataField | CustomStringField; label: string } => s !== null)
    .slice(0, 6);

  const surfaces: Record<string, unknown> = {};

  if (titleSlot || subtitleSlot || imageField) {
    const components: Record<string, unknown> = {};
    if (titleSlot) components.title = { fields: { text: titleSlot } };
    if (subtitleSlot) components.subtitle_1 = { fields: { text: subtitleSlot } };
    if (imageField)
      components.hero_image = { fields: { image: dataField(imageField.fieldName, imageField.fieldType) } };
    surfaces.widget_top = { layout: "widget_top_hero", components };
  }

  if (statSlots.length > 0) {
    const components: Record<string, unknown> = {};
    statSlots.forEach(({ value, label }, i) => {
      components[`stat_${i + 1}`] = { fields: { value, label: labelField(label) } };
    });
    surfaces.widget_bottom = { layout: "widget_bottom_stats", components };
  }

  if (subtitleSlot || imageField) {
    const components: Record<string, unknown> = {};
    if (subtitleSlot) components.stat = { fields: { text: subtitleSlot } };
    if (imageField)
      components.hero_image = { fields: { image: dataField(imageField.fieldName, imageField.fieldType) } };
    surfaces.mini_profile = { layout: "mini_profile_hero_stat", components };
  }

  if (subtitleSlot) {
    surfaces.activity_accessory = {
      layout: "activity_accessory_stat",
      components: { stat: { fields: { text: subtitleSlot } } },
    };
  }

  surfaces.add_widget_preview = {
    layout: "add_widget_preview_default",
    components: {
      title: { fields: { text: labelField(displayName) } },
      description: {
        fields: {
          text: labelField(mapping.subtitle?.mode === "static" ? mapping.subtitle.text : "Self-updating widget"),
        },
      },
    },
  };

  return surfaces;
}
