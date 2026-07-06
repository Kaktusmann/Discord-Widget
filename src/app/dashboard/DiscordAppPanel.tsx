"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DiscordAppPanel({
  discordAppId,
  hasBotToken,
}: {
  discordAppId: string | null;
  hasBotToken: boolean;
}) {
  const router = useRouter();
  const [appId, setAppId] = useState(discordAppId ?? "");
  const [botToken, setBotToken] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setError(null);
    setSaved(false);
    setIsPending(true);
    try {
      const res = await fetch("/api/widget/discord-app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordAppId: appId, discordBotToken: botToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ? JSON.stringify(data.detail) : data.error);
        return;
      }
      setBotToken("");
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
      <h2 className="font-medium">Your Discord application</h2>
      <p className="text-sm text-zinc-500">
        Attaching a widget to a profile only works for the account that owns the Discord
        Application it belongs to — a single shared app can&apos;t serve multiple people. Create
        your own application in the{" "}
        <a
          href="https://discord.com/developers/applications"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Developer Portal
        </a>{" "}
        (enable Social SDK, generate a bot token), then enter its details below. See SETUP.md for
        the full walkthrough.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <input
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          placeholder="Application ID"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
        />
        <input
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder={hasBotToken ? "Bot token (already saved — enter a new one to replace it)" : "Bot token"}
          type="password"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
        />
        <button
          disabled={isPending || !appId || !botToken}
          onClick={save}
          className="self-start rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {saved && <p className="mt-1 text-xs text-zinc-500">Saved.</p>}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {!hasBotToken && (
        <p className="mt-2 text-xs text-amber-500">
          No bot token saved yet — the widget link panel below needs this before it can push data.
        </p>
      )}
    </section>
  );
}
