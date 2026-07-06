"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WidgetConfigPanel({
  script,
  discordWidgetConfigId,
}: {
  script: string;
  discordWidgetConfigId: string | null;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [configId, setConfigId] = useState(discordWidgetConfigId ?? "");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function copy() {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function publishNow() {
    setError(null);
    setResult(null);
    setIsPending(true);
    try {
      const res = await fetch("/api/widget/publish-layout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(
          (data.detail ? data.detail + " — " : "") +
            (data.error ?? "Failed") +
            ". Try the console script below instead.",
        );
        return;
      }
      setResult(`Published (config_id=${data.configId}).`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPending(false);
    }
  }

  async function saveConfigId() {
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch("/api/widget/config-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordWidgetConfigId: configId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ? JSON.stringify(data.detail) : data.error);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-medium">Widget layout</h2>
      <p className="text-sm text-zinc-500">
        Generated from the site&apos;s shared field map and your customizations above. This tries
        to publish it directly (via your bot token, server-side) — unconfirmed whether Discord
        actually allows that for this endpoint, so if it fails, use the console script fallback
        below instead.
      </p>

      <button
        disabled={isPending}
        onClick={publishNow}
        className="mt-2 rounded bg-[#5865F2] px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {isPending ? "Publishing…" : "Publish now"}
      </button>
      {result && <p className="mt-1 text-xs text-zinc-500">{result}</p>}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-zinc-500">
          Fallback: console script (if &quot;Publish now&quot; failed above)
        </summary>
        <p className="mt-2 text-xs text-zinc-500">
          Open{" "}
          <a href="https://discord.com" target="_blank" rel="noreferrer" className="underline">
            discord.com
          </a>
          , open devtools (F12) → Console, paste this, and press Enter. This covers the main widget
          content; the &quot;add widget&quot; preview icon isn&apos;t included (it needs an
          uploaded image asset we haven&apos;t automated) — see SETUP.md if you want to add one
          manually via the hidden editor.
        </p>
        <div className="mt-2 flex items-start gap-2">
          <pre className="max-h-40 flex-1 overflow-auto rounded bg-zinc-900 p-2 text-xs text-zinc-100">
            {script}
          </pre>
          <button
            onClick={copy}
            className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            value={configId}
            onChange={(e) => setConfigId(e.target.value)}
            placeholder="Widget config ID (paste after the script's first run)"
            className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-xs dark:border-zinc-700"
          />
          <button
            disabled={isPending}
            onClick={saveConfigId}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-zinc-700"
          >
            Save
          </button>
        </div>
      </details>
    </section>
  );
}
