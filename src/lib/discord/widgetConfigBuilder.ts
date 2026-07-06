/**
 * Builds the `surfaces` payload for POST /applications/{id}/widget-configs
 * from a user-editable layout mapping (see WidgetLayoutEditor.tsx), confirmed
 * against a real, working, published widget_config (captured via
 * GET /applications/{id}/widget-configs on an already-working app) plus three
 * other real published configs (Marvel Rivals, Wuthering Waves, Arknights
 * Endfield) — all following the same pattern this replicates.
 *
 * Every binding uses value_type "data" with `value` set to the field's own
 * name — the exact same reference key later pushed under `dynamic[].name` in
 * profilePush.ts. `add_widget_preview` is deliberately NOT generated: every
 * real example uses an uploaded `application_asset` for it, and we don't have
 * a confirmed asset-upload endpoint — that one surface stays a manual,
 * one-time step (SETUP.md).
 */

export interface FieldMapEntry {
  fieldName: string;
  fieldType: number; // 1=string, 2=number, 3=image
  label: string;
  sortOrder: number;
}

export interface StatBinding {
  fieldName: string;
  label: string;
}

/** Which field feeds which widget slot — the part a user customizes in WidgetLayoutEditor.tsx. Field names, not full entries, so it's cheap to store as JSON (User.widgetLayoutJson). */
export interface WidgetLayoutMapping {
  titleField: string | null;
  subtitleField: string | null;
  imageField: string | null;
  stats: StatBinding[]; // up to 6
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

/** Sensible starting point: first image field -> image slot, next two fields -> title/subtitle, next up to 6 -> stats (using each field's own admin-defined label). Used to prefill the editor and as the fallback if a user hasn't customized anything yet. */
export function defaultLayoutMapping(fields: FieldMapEntry[]): WidgetLayoutMapping {
  const sorted = [...fields].sort((a, b) => a.sortOrder - b.sortOrder);
  const imageField = sorted.find((f) => f.fieldType === 3);
  const otherFields = sorted.filter((f) => f !== imageField);

  return {
    titleField: otherFields[0]?.fieldName ?? null,
    subtitleField: otherFields[1]?.fieldName ?? null,
    imageField: imageField?.fieldName ?? null,
    stats: otherFields.slice(2, 8).map((f) => ({ fieldName: f.fieldName, label: f.label })),
  };
}

export function buildWidgetConfigSurfaces(
  mapping: WidgetLayoutMapping,
  fields: FieldMapEntry[],
): Record<string, unknown> {
  const byName = new Map(fields.map((f) => [f.fieldName, f]));
  const titleField = mapping.titleField ? byName.get(mapping.titleField) : undefined;
  const subtitleField = mapping.subtitleField ? byName.get(mapping.subtitleField) : undefined;
  const imageField = mapping.imageField ? byName.get(mapping.imageField) : undefined;
  const statFields = mapping.stats
    .map((s) => {
      const field = byName.get(s.fieldName);
      return field ? { field, label: s.label } : null;
    })
    .filter((s): s is { field: FieldMapEntry; label: string } => s !== null)
    .slice(0, 6);

  const surfaces: Record<string, unknown> = {};

  if (titleField || subtitleField || imageField) {
    const components: Record<string, unknown> = {};
    if (titleField) components.title = { fields: { text: dataField(titleField.fieldName, titleField.fieldType) } };
    if (subtitleField)
      components.subtitle_1 = { fields: { text: dataField(subtitleField.fieldName, subtitleField.fieldType) } };
    if (imageField)
      components.hero_image = { fields: { image: dataField(imageField.fieldName, imageField.fieldType) } };
    surfaces.widget_top = { layout: "widget_top_hero", components };
  }

  if (statFields.length > 0) {
    const components: Record<string, unknown> = {};
    statFields.forEach(({ field, label }, i) => {
      components[`stat_${i + 1}`] = {
        fields: { value: dataField(field.fieldName, field.fieldType), label: labelField(label) },
      };
    });
    surfaces.widget_bottom = { layout: "widget_bottom_stats", components };
  }

  if (subtitleField || imageField) {
    const components: Record<string, unknown> = {};
    if (subtitleField) components.stat = { fields: { text: dataField(subtitleField.fieldName, subtitleField.fieldType) } };
    if (imageField)
      components.hero_image = { fields: { image: dataField(imageField.fieldName, imageField.fieldType) } };
    surfaces.mini_profile = { layout: "mini_profile_hero_stat", components };
  }

  if (subtitleField) {
    surfaces.activity_accessory = {
      layout: "activity_accessory_stat",
      components: { stat: { fields: { text: dataField(subtitleField.fieldName, subtitleField.fieldType) } } },
    };
  }

  return surfaces;
}
