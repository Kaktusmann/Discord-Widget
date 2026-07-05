"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface FieldMapEntry {
  fieldName: string;
  label: string;
  fieldType: number;
}

interface FieldValueEntry {
  fieldName: string;
  value: string | null;
  dataSource: string;
  updatedAt: string;
}

function formatValue(value: string | null): string {
  if (value === null) return "—";
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null && "url" in parsed) return parsed.url as string;
    return String(parsed);
  } catch {
    return value;
  }
}

export function FieldsTable({
  fieldMap,
  fieldValues,
}: {
  fieldMap: FieldMapEntry[];
  fieldValues: FieldValueEntry[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const valueByField = new Map(fieldValues.map((f) => [f.fieldName, f]));

  function pushNow() {
    setResult(null);
    startTransition(async () => {
      const res = await fetch("/api/widget/push-test", { method: "POST" });
      const data = await res.json();
      setResult(res.ok ? `${data.reason}` : (data.detail ?? data.error ?? "Failed"));
      router.refresh();
    });
  }

  if (fieldMap.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">Fields</h2>
        <p className="text-sm text-zinc-500">
          No fields configured yet — an admin needs to add them on the{" "}
          <a href="/admin" className="underline">
            admin page
          </a>{" "}
          first, matching the field names from your widget_config.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Fields</h2>
        <button
          disabled={isPending}
          onClick={pushNow}
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          Push now
        </button>
      </div>
      {result && <p className="mt-1 text-xs text-zinc-500">Result: {result}</p>}
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="pb-2 font-normal">Field</th>
            <th className="pb-2 font-normal">Value</th>
            <th className="pb-2 font-normal">Source</th>
          </tr>
        </thead>
        <tbody>
          {fieldMap.map((f) => {
            const current = valueByField.get(f.fieldName);
            return (
              <tr key={f.fieldName} className="border-t border-zinc-100 dark:border-zinc-900">
                <td className="py-2">{f.label}</td>
                <td className="py-2">{formatValue(current?.value ?? null)}</td>
                <td className="py-2 text-zinc-500">{current?.dataSource ?? "unset"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
