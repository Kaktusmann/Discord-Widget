"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LinkPanel({
  published,
  lastError,
  lastPushedAt,
  consoleSnippet,
}: {
  published: boolean;
  lastError: string | null;
  lastPushedAt: string | null;
  consoleSnippet: string | null;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handle(action: "link" | "unlink") {
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch(`/api/widget/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? data.error ?? "Request failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPending(false);
    }
  }

  async function copySnippet() {
    if (!consoleSnippet) return;
    await navigator.clipboard.writeText(consoleSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Widget link</h2>
          <p className="text-sm text-zinc-500">
            {published ? "Linked to your Discord profile" : "Not linked yet"}
          </p>
          {lastPushedAt && (
            <p className="text-xs text-zinc-400">Last pushed {new Date(lastPushedAt).toLocaleString()}</p>
          )}
        </div>
        <button
          disabled={isPending}
          onClick={() => handle(published ? "unlink" : "link")}
          className="rounded-full bg-[#5865F2] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {published ? "Unlink" : "Link"}
        </button>
      </div>
      {(error ?? lastError) && (
        <p className="mt-2 text-sm text-red-500">{error ?? lastError}</p>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-zinc-500">
          Widget not showing up on your profile?
        </summary>
        {consoleSnippet ? (
          <>
            <p className="mt-2 text-xs text-zinc-500">
              The <strong>Link</strong> button above just tells this app you&apos;re ready to
              receive data — actually attaching the widget to your profile has to happen from your
              own browser&apos;s Discord session, which this server can&apos;t do on your behalf.
              Open{" "}
              <a href="https://discord.com" target="_blank" rel="noreferrer" className="underline">
                discord.com
              </a>
              , open devtools (F12) → Console, paste the script below, and press Enter. Re-run it
              any time the widget disappears from your profile.
            </p>
            <div className="mt-2 flex items-start gap-2">
              <pre className="max-h-40 flex-1 overflow-auto rounded bg-zinc-900 p-2 text-xs text-zinc-100">
                {consoleSnippet}
              </pre>
              <button
                onClick={copySnippet}
                className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            Enter your own Discord Application ID above first (under &quot;Your Discord
            application&quot;) — the attach script is generated once that&apos;s set.
          </p>
        )}
      </details>
    </section>
  );
}
