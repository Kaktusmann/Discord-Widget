"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SettingsEditor({ defaultSourceUrlTemplate }: { defaultSourceUrlTemplate: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultSourceUrlTemplate ?? "");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setError(null);
    setSaved(false);
    setIsPending(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultSourceUrlTemplate: value }),
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
      <h2 className="font-medium">Settings</h2>
      <p className="text-sm text-zinc-500">
        Default source URL template. When set, the dashboard shows a plain username box instead of
        a raw URL field — <code>{"{username}"}</code> gets substituted with whatever the user
        types. Leave blank to always require a full URL.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://anilist-widget.rinkerbel.deno.net/user/{username}"
          className="min-w-80 flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
        />
        <button
          disabled={isPending}
          onClick={save}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {saved && <p className="mt-1 text-xs text-zinc-500">Saved.</p>}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </section>
  );
}
