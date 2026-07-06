"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WidgetLayoutMapping } from "@/lib/discord/widgetConfigBuilder";

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

export function WidgetLayoutEditor({
  fieldMap,
  initialMapping,
}: {
  fieldMap: FieldOption[];
  initialMapping: WidgetLayoutMapping;
}) {
  const router = useRouter();
  const [titleField, setTitleField] = useState(initialMapping.titleField ?? NONE);
  const [subtitleField, setSubtitleField] = useState(initialMapping.subtitleField ?? NONE);
  const [imageField, setImageField] = useState(initialMapping.imageField ?? NONE);
  const [stats, setStats] = useState(initialMapping.stats);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const imageFields = fieldMap.filter((f) => f.fieldType === 3);
  const labelFor = (fieldName: string) => fieldMap.find((f) => f.fieldName === fieldName)?.label ?? fieldName;

  function addStat() {
    if (stats.length >= 6) return;
    const used = new Set([titleField, subtitleField, imageField, ...stats.map((s) => s.fieldName)]);
    const next = fieldMap.find((f) => !used.has(f.fieldName));
    if (!next) return;
    setStats([...stats, { fieldName: next.fieldName, label: next.label }]);
  }

  function updateStat(index: number, patch: Partial<{ fieldName: string; label: string }>) {
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
          titleField: titleField || null,
          subtitleField: subtitleField || null,
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
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-medium">Customize widget layout</h2>
      <p className="text-sm text-zinc-500">
        Pick which field feeds each slot in your widget. This only affects the layout script below
        — re-run it after changing anything here.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="w-24 shrink-0">Hero image</span>
          <FieldSelect value={imageField} onChange={setImageField} options={imageFields} placeholder="None" />
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="w-24 shrink-0">Title</span>
          <FieldSelect value={titleField} onChange={setTitleField} options={fieldMap} placeholder="None" />
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="w-24 shrink-0">Subtitle</span>
          <FieldSelect value={subtitleField} onChange={setSubtitleField} options={fieldMap} placeholder="None" />
        </label>
      </div>

      <div className="mt-4">
        <p className="text-xs text-zinc-500">Stats ({stats.length}/6)</p>
        <ul className="mt-2 flex flex-col gap-2">
          {stats.map((stat, i) => (
            <li key={i} className="flex items-center gap-2">
              <FieldSelect
                value={stat.fieldName}
                onChange={(v) => updateStat(i, { fieldName: v, label: v ? labelFor(v) : stat.label })}
                options={fieldMap}
                placeholder="Choose field"
              />
              <input
                value={stat.label}
                onChange={(e) => updateStat(i, { label: e.target.value })}
                placeholder="Label shown on the widget"
                className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
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
      {saved && <p className="mt-1 text-xs text-zinc-500">Saved — the script below now reflects this.</p>}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </section>
  );
}
