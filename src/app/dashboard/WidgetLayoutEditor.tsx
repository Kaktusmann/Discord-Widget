"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SlotBinding, StatBinding, WidgetLayoutMapping } from "@/lib/discord/widgetConfigBuilder";

interface FieldOption {
  fieldName: string;
  label: string;
  fieldType: number;
}

const NONE = "";

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

export function WidgetLayoutEditor({
  fieldMap,
  initialMapping,
}: {
  fieldMap: FieldOption[];
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

  return (
    <section className="max-w-xl rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-medium">Customize widget layout</h2>
      <p className="text-sm text-zinc-500">
        Pick fixed text or a live field for each slot. This only affects the layout script/publish below —
        re-run it after changing anything here.
      </p>

      <div className="mt-3 flex flex-col gap-2">
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
      </div>

      <div className="mt-4">
        <p className="text-xs text-zinc-500">Stats ({stats.length}/6)</p>
        <ul className="mt-2 flex flex-col gap-2">
          {stats.map((stat, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                value={stat.label}
                onChange={(e) => updateStat(i, { label: e.target.value })}
                placeholder="Label"
                className="w-30 shrink-0 rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
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
        className="mt-4 rounded bg-[#5865F2] px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save layout"}
      </button>
      {saved && <p className="mt-1 text-xs text-zinc-500">Saved — the script/publish below now reflects this.</p>}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </section>
  );
}
