"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ApiKeyPanel({ exists, keyPrefix }: { exists: boolean; keyPrefix: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/widget/apikey", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? data.error ?? "Failed");
        return;
      }
      setRawKey(data.apiKey);
      router.refresh();
    });
  }

  const exampleKey = rawKey ?? "<API_KEY>";

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Push API key</h2>
          <p className="text-sm text-zinc-500">
            {exists ? `Active key: ${keyPrefix}…` : "No key generated yet"}
          </p>
        </div>
        <button
          disabled={isPending}
          onClick={regenerate}
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          {exists ? "Regenerate" : "Generate"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {rawKey && (
        <p className="mt-2 rounded bg-zinc-100 p-2 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {rawKey} — copy this now, it won&apos;t be shown again.
        </p>
      )}
      <pre className="mt-3 overflow-x-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100">
        {`curl -X POST ${origin}/api/widget/push \\
  -H "Authorization: Bearer ${exampleKey}" -H "Content-Type: application/json" \\
  -d '{"fields": {"stat_1": "42 wins", "title": "Currently grinding ranked"}}'`}
      </pre>
    </section>
  );
}
