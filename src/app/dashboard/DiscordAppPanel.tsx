"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DiscordAppPanel({
  discordAppId,
  hasBotToken,
  hasClientSecret,
  identityAuthorizedAt,
  oauthCallbackUrl,
}: {
  discordAppId: string | null;
  hasBotToken: boolean;
  hasClientSecret: boolean;
  identityAuthorizedAt: string | null;
  oauthCallbackUrl: string;
}) {
  const router = useRouter();
  const [appId, setAppId] = useState(discordAppId ?? "");
  const [botToken, setBotToken] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyCallbackUrl() {
    await navigator.clipboard.writeText(oauthCallbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function save() {
    setError(null);
    setSaved(false);
    setIsPending(true);
    try {
      const res = await fetch("/api/widget/discord-app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordAppId: appId, discordBotToken: botToken, discordClientSecret: clientSecret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ? JSON.stringify(data.detail) : data.error);
        return;
      }
      setBotToken("");
      setClientSecret("");
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
        <input
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder={
            hasClientSecret ? "Client secret (already saved — enter a new one to replace it)" : "Client secret"
          }
          type="password"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
        />
        <button
          disabled={isPending || !appId || !botToken || !clientSecret}
          onClick={save}
          className="self-start rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {saved && <p className="mt-1 text-xs text-zinc-500">Saved.</p>}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {(!hasBotToken || !hasClientSecret) && (
        <p className="mt-2 text-xs text-amber-500">
          No bot token/client secret saved yet — the widget link panel below needs these before it
          can push data.
        </p>
      )}

      <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <h3 className="text-sm font-medium">Authorize your app for this account</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Required — without this, pushed data is accepted by Discord but never actually shows on
          your profile. First, add this exact URL as an OAuth2 redirect on{" "}
          <a
            href="https://discord.com/developers/applications"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            your application&apos;s
          </a>{" "}
          OAuth2 settings page:
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-900">
            {oauthCallbackUrl}
          </code>
          <button
            onClick={copyCallbackUrl}
            className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Then, with the app ID/bot token/client secret above saved, click authorize:
        </p>
        <a
          href="/api/widget/oauth-authorize"
          className={
            "mt-2 inline-block rounded px-3 py-1.5 text-sm text-white " +
            (hasBotToken && hasClientSecret && appId ? "bg-[#5865F2]" : "pointer-events-none bg-zinc-400")
          }
        >
          Authorize
        </a>
        <p className="mt-2 text-xs text-zinc-500">
          {identityAuthorizedAt
            ? `Authorized ${new Date(identityAuthorizedAt).toLocaleString()}.`
            : "Not authorized yet."}
        </p>
      </div>
    </section>
  );
}
