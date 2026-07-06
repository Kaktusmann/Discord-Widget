"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SlotBinding, StatBinding, WidgetLayoutMapping } from "@/lib/discord/widgetConfigBuilder";

interface FieldOption {
  fieldName: string;
  label: string;
  fieldType: number;
}

interface FieldValueEntry {
  fieldName: string;
  value: string | null;
}

const NONE = "";

function formatLiveValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return "(no data yet)";
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null && "url" in parsed) return parsed.url as string;
    return String(parsed);
  } catch {
    return value;
  }
}

function FieldSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: FieldOption[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
    >
      <option value={NONE}>{placeholder}</option>
      {options.map((f) => (
        <option key={f.fieldName} value={f.fieldName}>
          {f.label}
        </option>
      ))}
    </select>
  );
}

/** Editor for a single title/subtitle/stat-value slot: a mode toggle between fixed text and a live field. */
function SlotEditor({
  binding,
  onChange,
  fieldMap,
}: {
  binding: SlotBinding | null;
  onChange: (b: SlotBinding | null) => void;
  fieldMap: FieldOption[];
}) {
  const mode = binding?.mode ?? "field";

  function setMode(next: "static" | "field") {
    if (next === "static") onChange({ mode: "static", text: binding?.mode === "static" ? binding.text : "" });
    else onChange(binding?.mode === "field" ? binding : null);
  }

  return (
    <div className="flex flex-1 items-center gap-2">
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as "static" | "field")}
        className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
      >
        <option value="field">Live field</option>
        <option value="static">Static text</option>
      </select>
      {mode === "static" ? (
        <input
          value={binding?.mode === "static" ? binding.text : ""}
          onChange={(e) => onChange({ mode: "static", text: e.target.value })}
          placeholder="Fixed text, never changes"
          className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
        />
      ) : (
        <FieldSelect
          value={binding?.mode === "field" ? binding.fieldName : NONE}
          onChange={(v) => onChange(v ? { mode: "field", fieldName: v } : null)}
          options={fieldMap}
          placeholder="Choose field"
        />
      )}
    </div>
  );
}

function previewText(
  binding: SlotBinding | null,
  fieldMap: FieldOption[],
  valueByField: Map<string, string | null>,
): string | null {
  if (!binding) return null;
  if (binding.mode === "static") return binding.text || null;
  const label = fieldMap.find((f) => f.fieldName === binding.fieldName)?.label ?? binding.fieldName;
  return `${label}: ${formatLiveValue(valueByField.get(binding.fieldName))}`;
}

export function WidgetLayoutEditor({
  fieldMap,
  fieldValues,
  initialMapping,
}: {
  fieldMap: FieldOption[];
  fieldValues: FieldValueEntry[];
  initialMapping: WidgetLayoutMapping;
}) {
  const router = useRouter();
  const [title, setTitle] = useState<SlotBinding | null>(initialMapping.title);
  const [subtitle, setSubtitle] = useState<SlotBinding | null>(initialMapping.subtitle);
  const [imageField, setImageField] = useState(initialMapping.imageField ?? NONE);
  const [stats, setStats] = useState<StatBinding[]>(initialMapping.stats);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const imageFields = fieldMap.filter((f) => f.fieldType === 3);
  const valueByField = new Map(fieldValues.map((f) => [f.fieldName, f.value]));

  function usedFieldNames(): Set<string> {
    const used = new Set<string>();
    if (title?.mode === "field") used.add(title.fieldName);
    if (subtitle?.mode === "field") used.add(subtitle.fieldName);
    if (imageField) used.add(imageField);
    for (const s of stats) if (s.value.mode === "field") used.add(s.value.fieldName);
    return used;
  }

  function addStat() {
    if (stats.length >= 6) return;
    const used = usedFieldNames();
    const next = fieldMap.find((f) => !used.has(f.fieldName));
    if (!next) return;
    setStats([...stats, { value: { mode: "field", fieldName: next.fieldName }, label: next.label }]);
  }

  function updateStat(index: number, patch: Partial<StatBinding>) {
    setStats(stats.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeStat(index: number) {
    setStats(stats.filter((_, i) => i !== index));
  }

  async function save() {
    setError(null);
    setSaved(false);
    setIsPending(true);
    try {
      const res = await fetch("/api/widget/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle,
          imageField: imageField || null,
          stats,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ? JSON.stringify(data.detail) : data.error);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPending(false);
    }
  }

  const imagePreview = imageField ? formatLiveValue(valueByField.get(imageField)) : null;
  const titlePreview = previewText(title, fieldMap, valueByField);
  const subtitlePreview = previewText(subtitle, fieldMap, valueByField);

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-medium">Customize widget layout</h2>
      <p className="text-sm text-zinc-500">
        Pick fixed text or a live field for each slot. This only affects the layout script/publish below —
        re-run it after changing anything here.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="w-16 shrink-0">Image</span>
            <FieldSelect value={imageField} onChange={setImageField} options={imageFields} placeholder="None" />
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="w-16 shrink-0">Title</span>
            <SlotEditor binding={title} onChange={setTitle} fieldMap={fieldMap} />
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="w-16 shrink-0">Subtitle</span>
            <SlotEditor binding={subtitle} onChange={setSubtitle} fieldMap={fieldMap} />
          </label>

          <div className="mt-2">
            <p className="text-xs text-zinc-500">Stats ({stats.length}/6)</p>
            <ul className="mt-2 flex flex-col gap-2">
              {stats.map((stat, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    value={stat.label}
                    onChange={(e) => updateStat(i, { label: e.target.value })}
                    placeholder="Label"
                    className="w-24 shrink-0 rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
                  />
                  <SlotEditor
                    binding={stat.value}
                    onChange={(b) => updateStat(i, { value: b ?? { mode: "static", text: "" } })}
                    fieldMap={fieldMap}
                  />
                  <button onClick={() => removeStat(i)} className="text-xs text-red-500">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button
              disabled={stats.length >= 6}
              onClick={addStat}
              className="mt-2 rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
            >
              Add stat
            </button>
          </div>

          <button
            disabled={isPending}
            onClick={save}
            className="mt-2 w-fit rounded bg-[#5865F2] px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save layout"}
          </button>
          {saved && <p className="mt-1 text-xs text-zinc-500">Saved — the script/publish below now reflects this.</p>}
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="mb-2 text-[10px] uppercase tracking-wide text-zinc-400">Preview (approximate)</p>
          <div className="overflow-hidden rounded-md border border-zinc-300 bg-white text-xs dark:border-zinc-700 dark:bg-zinc-900">
            {imagePreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="" className="h-24 w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
            )}
            <div className="flex flex-col gap-1 p-2">
              <p className="font-medium">{titlePreview ?? <span className="text-zinc-400">No title set</span>}</p>
              <p className="text-zinc-500">{subtitlePreview ?? <span className="text-zinc-400">No subtitle set</span>}</p>
              {stats.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {stats.map((s, i) => (
                    <div key={i} className="rounded bg-zinc-100 p-1 dark:bg-zinc-800">
                      <p className="text-[10px] text-zinc-500">{s.label}</p>
                      <p className="font-medium">
                        {s.value.mode === "static" ? s.value.text || "—" : formatLiveValue(valueByField.get(s.value.fieldName))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
