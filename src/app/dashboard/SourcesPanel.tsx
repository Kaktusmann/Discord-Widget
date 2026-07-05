"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface FieldOption {
  fieldName: string;
  label: string;
  defaultJsonPath: string | null;
}

interface SourceEntry {
  id: string;
  url: string;
  enabled: boolean;
  lastFetchedAt: string | null;
  lastError: string | null;
  fields: { fieldName: string; jsonPath: string | null }[];
}

function TestFetchAndMap({ source, fieldOptions }: { source: SourceEntry; fieldOptions: FieldOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [testResult, setTestResult] = useState<{ json?: unknown; error?: string } | null>(null);
  const [fieldName, setFieldName] = useState(fieldOptions[0]?.fieldName ?? "");
  const [jsonPath, setJsonPath] = useState(fieldOptions[0]?.defaultJsonPath ?? "");

  function selectField(name: string) {
    setFieldName(name);
    setJsonPath(fieldOptions.find((f) => f.fieldName === name)?.defaultJsonPath ?? "");
  }

  function testFetch() {
    startTransition(async () => {
      const res = await fetch(`/api/sources/${source.id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult(res.ok ? { json: data.json } : { error: data.detail ?? data.error });
      router.refresh();
    });
  }

  function mapField() {
    if (!fieldName || !jsonPath) return;
    startTransition(async () => {
      const res = await fetch(`/api/sources/${source.id}/map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldName, jsonPath }),
      });
      const data = await res.json();
      if (!res.ok) setTestResult({ error: data.detail ?? data.error });
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await fetch(`/api/sources/${source.id}`, { method: "DELETE" });
      router.refresh();
    });
  }

  return (
    <li className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm">{source.url}</span>
        <div className="flex shrink-0 gap-2">
          <button
            disabled={isPending}
            onClick={testFetch}
            className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
          >
            Test fetch
          </button>
          <button disabled={isPending} onClick={remove} className="text-xs text-red-500">
            Remove
          </button>
        </div>
      </div>

      {source.lastError && <p className="mt-1 text-xs text-red-500">{source.lastError}</p>}
      {source.lastFetchedAt && (
        <p className="mt-1 text-xs text-zinc-400">
          Last fetched {new Date(source.lastFetchedAt).toLocaleString()}
        </p>
      )}

      {source.fields.length > 0 && (
        <ul className="mt-2 text-xs text-zinc-500">
          {source.fields.map((f) => (
            <li key={f.fieldName}>
              {f.fieldName} ← {f.jsonPath}
            </li>
          ))}
        </ul>
      )}

      {testResult?.json !== undefined && (
        <pre className="mt-2 max-h-32 overflow-auto rounded bg-zinc-900 p-2 text-xs text-zinc-100">
          {JSON.stringify(testResult.json, null, 2)}
        </pre>
      )}
      {testResult?.error && <p className="mt-1 text-xs text-red-500">{testResult.error}</p>}

      {fieldOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={fieldName}
            onChange={(e) => selectField(e.target.value)}
            className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
          >
            {fieldOptions.map((f) => (
              <option key={f.fieldName} value={f.fieldName}>
                {f.label}
              </option>
            ))}
          </select>
          <input
            value={jsonPath}
            onChange={(e) => setJsonPath(e.target.value)}
            placeholder="json path, e.g. data.stats.wins, or a template like {{days_watched}} days"
            className="min-w-48 flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
          />
          <button
            disabled={isPending || !jsonPath}
            onClick={mapField}
            className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
          >
            Map field
          </button>
        </div>
      )}
    </li>
  );
}

export function SourcesPanel({
  fieldMap,
  sources,
}: {
  fieldMap: FieldOption[];
  sources: SourceEntry[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newUrl, setNewUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addSource() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? data.error ?? "Failed");
        return;
      }
      setNewUrl("");
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-medium">JSON URL sources</h2>
      <p className="text-sm text-zinc-500">
        Point a field at your own API URL and a JSON path. The server polls it on a timer and
        pushes changes automatically. Use a plain path (e.g. <code>days_watched</code>) to pass
        the value through as-is, or wrap it in a template like{" "}
        <code>{"{{days_watched}} days"}</code> to combine it with literal text (string fields
        only).
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://example.com/api/status"
          className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
        />
        <button
          disabled={isPending || !newUrl}
          onClick={addSource}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          Add
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}

      <ul className="mt-3 flex flex-col gap-2">
        {sources.map((s) => (
          <TestFetchAndMap key={s.id} source={s} fieldOptions={fieldMap} />
        ))}
      </ul>
    </section>
  );
}
