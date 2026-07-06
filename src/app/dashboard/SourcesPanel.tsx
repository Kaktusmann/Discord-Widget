"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FieldOption {
  fieldName: string;
  label: string;
  defaultJsonPath: string | null;
}

interface Suggestion {
  fieldName: string;
  jsonPath: string;
  value: unknown;
}

interface SourceEntry {
  id: string;
  url: string;
  enabled: boolean;
  lastFetchedAt: string | null;
  lastError: string | null;
  fields: { fieldName: string; jsonPath: string | null }[];
}

function labelFor(fieldOptions: FieldOption[], fieldName: string): string {
  return fieldOptions.find((f) => f.fieldName === fieldName)?.label ?? fieldName;
}

function TestFetchAndMap({ source, fieldOptions }: { source: SourceEntry; fieldOptions: FieldOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"test" | "map" | "remove" | null>(null);
  const [testResult, setTestResult] = useState<{ json?: unknown; error?: string } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [fieldName, setFieldName] = useState(fieldOptions[0]?.fieldName ?? "");
  const [jsonPath, setJsonPath] = useState(fieldOptions[0]?.defaultJsonPath ?? "");
  const isPending = loading !== null;

  function selectField(name: string) {
    setFieldName(name);
    setJsonPath(fieldOptions.find((f) => f.fieldName === name)?.defaultJsonPath ?? "");
  }

  async function testFetch() {
    setLoading("test");
    try {
      const res = await fetch(`/api/sources/${source.id}/test`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({ error: data.detail ?? data.error });
        setSuggestions([]);
      } else {
        setTestResult({ json: data.json });
        setSuggestions(data.suggestions ?? []);
      }
      router.refresh();
    } catch (err) {
      setTestResult({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  }

  async function mapField() {
    if (!fieldName || !jsonPath) return;
    setLoading("map");
    try {
      const res = await fetch(`/api/sources/${source.id}/map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldName, jsonPath }),
      });
      const data = await res.json();
      setTestResult(res.ok ? null : { error: data.detail ?? data.error });
      router.refresh();
    } catch (err) {
      setTestResult({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  }

  async function mapSuggested() {
    if (suggestions.length === 0) return;
    setLoading("map");
    try {
      const res = await fetch(`/api/sources/${source.id}/map-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappings: suggestions.map(({ fieldName, jsonPath }) => ({ fieldName, jsonPath })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({ error: data.detail ?? data.error });
      } else {
        setSuggestions([]);
      }
      router.refresh();
    } catch (err) {
      setTestResult({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  }

  async function remove() {
    setLoading("remove");
    try {
      await fetch(`/api/sources/${source.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <li className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm">{source.url}</span>
        <div className="flex shrink-0 gap-2">
          <button
            disabled={isPending}
            onClick={testFetch}
            className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
          >
            {loading === "test" ? "Fetching…" : "Test fetch"}
          </button>
          <button
            disabled={isPending}
            onClick={remove}
            className="text-xs text-red-500 disabled:opacity-50"
          >
            {loading === "remove" ? "Removing…" : "Remove"}
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

      {suggestions.length > 0 && (
        <div className="mt-2 rounded border border-zinc-200 p-2 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">
            Auto-detected {suggestions.length} matching field{suggestions.length > 1 ? "s" : ""}:
          </p>
          <ul className="mt-1 text-xs text-zinc-500">
            {suggestions.map((s) => (
              <li key={s.fieldName}>
                {labelFor(fieldOptions, s.fieldName)} ← {s.jsonPath} ({JSON.stringify(s.value)})
              </li>
            ))}
          </ul>
          <button
            disabled={isPending}
            onClick={mapSuggested}
            className="mt-2 rounded bg-[#5865F2] px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            {loading === "map" ? "Mapping…" : `Map all ${suggestions.length}`}
          </button>
        </div>
      )}

      {fieldOptions.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-zinc-500">Map a field manually</summary>
          <p className="mt-2 text-xs text-zinc-500">
            A plain path (e.g. <code>data.stats.wins</code>) passes the value through as-is. Wrap
            it in <code>{"{{ }}"}</code> to combine it with literal text, e.g.{" "}
            <code>{"{{days_watched}} days"}</code> → &quot;83.5 days&quot;. If the API just returns
            a bare value like <code>{"{ \"value\": 42 }"}</code>, use <code>{"{{value}}"}</code>{" "}
            the same way, e.g. <code>{"{{value}} wins"}</code>.
          </p>
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
              {loading === "map" ? "Mapping…" : "Map field"}
            </button>
          </div>
        </details>
      )}
    </li>
  );
}

export function SourcesPanel({
  fieldMap,
  sources,
  defaultSourceUrlTemplate,
}: {
  fieldMap: FieldOption[];
  sources: SourceEntry[];
  defaultSourceUrlTemplate: string | null;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [username, setUsername] = useState("");
  const [advanced, setAdvanced] = useState(!defaultSourceUrlTemplate);
  const [error, setError] = useState<string | null>(null);

  const resolvedUrl =
    !advanced && defaultSourceUrlTemplate
      ? defaultSourceUrlTemplate.replace("{username}", encodeURIComponent(username))
      : newUrl;

  async function addSource() {
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: resolvedUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? data.error ?? "Failed");
        return;
      }
      setNewUrl("");
      setUsername("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-medium">JSON URL sources</h2>
      <p className="text-sm text-zinc-500">
        Enter your Anilist username below to pull your stats automatically. After <strong>Test fetch</strong>, fields whose JSON key matches a field
        name (or its admin-set default path) are auto-detected, so one click on{" "}
        <strong>Map all</strong> maps everything at once. Need a different source entirely (not
        Anilist)? Use <strong>Advanced</strong> to enter a raw URL instead.
      </p>

      {defaultSourceUrlTemplate && !advanced ? (
        <>
          <div className="mt-3 flex gap-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Anilist Username"
              className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
            />
            <button
              disabled={isPending || !username}
              onClick={addSource}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
            >
              Add
            </button>
          </div>
          {username && <p className="mt-1 text-xs text-zinc-400">{resolvedUrl}</p>}
          <button
            onClick={() => setAdvanced(true)}
            className="mt-1 text-xs text-zinc-500 underline"
          >
            Advanced: use a custom URL instead
          </button>
        </>
      ) : (
        <>
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
          {defaultSourceUrlTemplate && (
            <button
              onClick={() => setAdvanced(false)}
              className="mt-1 text-xs text-zinc-500 underline"
            >
              Use username instead
            </button>
          )}
        </>
      )}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}

      <ul className="mt-3 flex flex-col gap-2">
        {sources.map((s) => (
          <TestFetchAndMap key={s.id} source={s} fieldOptions={fieldMap} />
        ))}
      </ul>
    </section>
  );
}
