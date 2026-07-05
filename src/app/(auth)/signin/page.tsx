"use client";

import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 px-4 dark:bg-black">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Discord Widget Manager
        </h1>
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          Sign in to link and update your Discord profile widget.
        </p>
      </div>
      <button
        onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
        className="flex h-11 items-center gap-2 rounded-full bg-[#5865F2] px-6 text-sm font-medium text-white transition-colors hover:bg-[#4752C4]"
      >
        Sign in with Discord
      </button>
    </div>
  );
}
