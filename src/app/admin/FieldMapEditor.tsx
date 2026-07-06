"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Field {
  id: string;
  fieldName: string;
  fieldType: number;
  label: string;
  defaultJsonPath: string | null;
  sortOrder: number;
}

const TYPE_LABELS: Record<number, string> = { 1: "string", 2: "number", 3: "image" };

function EditableRow({
  field,
  isPending,
  setIsPending,
  onDone,
}: {
  field: Field;
  isPending: boolean;
  setIsPending: (v: boolean) => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(field.label);
  const [fieldType, setFieldType] = useState(field.fieldType);
  const [defaultJsonPath, setDefaultJsonPath] = useState(field.defaultJsonPath ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch(`/api/admin/field-map/${field.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, fieldType, defaultJsonPath: defaultJsonPath || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ? JSON.stringify(data.detail) : data.error);
        return;
      }
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <tr className="border-t border-zinc-100 dark:border-zinc-900">
      <td className="py-2 font-mono text-xs">{field.fieldName}</td>
      <td className="py-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full rounded border border-zinc-300 bg-transparent px-1.5 py-1 text-xs dark:border-zinc-700"
        />
      </td>
      <td className="py-2">
        <select
          value={fieldType}
          onChange={(e) => setFieldType(Number(e.target.value))}
          className="rounded border border-zinc-300 bg-transparent px-1.5 py-1 text-xs dark:border-zinc-700"
        >
          <option value={1}>string</option>
          <option value={2}>number</option>
          <option value={3}>image</option>
        </select>
      </td>
      <td className="py-2">
        <input
          value={defaultJsonPath}
          onChange={(e) => setDefaultJsonPath(e.target.value)}
          className="w-full rounded border border-zinc-300 bg-transparent px-1.5 py-1 font-mono text-xs dark:border-zinc-700"
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </td>
      <td className="py-2 text-right whitespace-nowrap">
        <button disabled={isPending} onClick={save} className="text-xs text-[#5865F2]">
          Save
        </button>
        <button disabled={isPending} onClick={onDone} className="ml-2 text-xs text-zinc-500">
          Cancel
        </button>
      </td>
    </tr>
  );
}

export function FieldMapEditor({ fields }: { fields: Field[] }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldName, setFieldName] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState(1);
  const [defaultJsonPath, setDefaultJsonPath] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function addField() {
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch("/api/admin/field-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldName,
          label,
          fieldType,
          defaultJsonPath: defaultJsonPath || undefined,
          sortOrder: fields.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ? JSON.stringify(data.detail) : data.error);
        return;
      }
      setFieldName("");
      setLabel("");
      setFieldType(1);
      setDefaultJsonPath("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPending(false);
    }
  }

  async function removeField(id: string) {
    setIsPending(true);
    try {
      await fetch(`/api/admin/field-map/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function moveField(index: number, direction: -1 | 1) {
    const other = index + direction;
    if (other < 0 || other >= fields.length) return;
    // Rewrites every row's sortOrder to its new sequential index, rather than
    // swapping the two rows' existing values — fields added before this
    // reordering UI existed may all share sortOrder 0, and swapping two equal
    // values is a silent no-op.
    const reordered = [...fields];
    [reordered[index], reordered[other]] = [reordered[other], reordered[index]];
    setIsPending(true);
    try {
      await Promise.all(
        reordered.map((f, i) =>
          fetch(`/api/admin/field-map/${f.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: i }),
          }),
        ),
      );
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-medium">Field map</h2>
      <p className="text-sm text-zinc-500">
        Each row must match a dynamic field name from your widget_config exactly. The default json
        path prefills the mapping box on the dashboard, since most users&apos; source JSON shares
        the same shape — they can still override it. Field name can&apos;t be edited (it&apos;s
        used to link existing values) — remove and re-add if you need to rename one.
      </p>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="pb-2 font-normal">Field name</th>
            <th className="pb-2 font-normal">Label</th>
            <th className="pb-2 font-normal">Type</th>
            <th className="pb-2 font-normal">Default json path</th>
            <th className="pb-2 font-normal" />
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) =>
            editingId === f.id ? (
              <EditableRow
                key={f.id}
                field={f}
                isPending={isPending}
                setIsPending={setIsPending}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <tr key={f.id} className="border-t border-zinc-100 dark:border-zinc-900">
                <td className="py-2 font-mono text-xs">{f.fieldName}</td>
                <td className="py-2">{f.label}</td>
                <td className="py-2 text-zinc-500">{TYPE_LABELS[f.fieldType]}</td>
                <td className="py-2 font-mono text-xs text-zinc-500">{f.defaultJsonPath ?? "—"}</td>
                <td className="py-2 text-right whitespace-nowrap">
                  <button
                    disabled={isPending || i === 0}
                    onClick={() => moveField(i, -1)}
                    className="text-xs text-zinc-500 disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    disabled={isPending || i === fields.length - 1}
                    onClick={() => moveField(i, 1)}
                    className="ml-1 text-xs text-zinc-500 disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => setEditingId(f.id)}
                    className="ml-2 text-xs text-zinc-500"
                  >
                    Edit
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => removeField(f.id)}
                    className="ml-2 text-xs text-red-500"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={fieldName}
          onChange={(e) => setFieldName(e.target.value)}
          placeholder="fieldName (e.g. stat_1)"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label shown on dashboard"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
        />
        <select
          value={fieldType}
          onChange={(e) => setFieldType(Number(e.target.value))}
          className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
        >
          <option value={1}>string</option>
          <option value={2}>number</option>
          <option value={3}>image</option>
        </select>
        <input
          value={defaultJsonPath}
          onChange={(e) => setDefaultJsonPath(e.target.value)}
          placeholder="Default json path (optional)"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
        />
        <button
          disabled={isPending || !fieldName || !label}
          onClick={addField}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          Add field
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </section>
  );
}
