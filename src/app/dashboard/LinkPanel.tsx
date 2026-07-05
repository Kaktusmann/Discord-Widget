"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LinkPanel({
  published,
  lastError,
  lastPushedAt,
}: {
  published: boolean;
  lastError: string | null;
  lastPushedAt: string | null;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    </section>
  );
}
