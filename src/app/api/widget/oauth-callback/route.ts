import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { env } from "@/lib/env";

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function dashboardError(reason: string): NextResponse {
  return NextResponse.redirect(new URL(`/dashboard?identity=error&reason=${reason}`, env.NEXTAUTH_URL));
}

/**
 * Completes the OAuth2 Authorization Code exchange started by
 * /api/widget/oauth-authorize, using the user's OWN Discord Application's
 * client_id/client_secret (not the site's shared login app) — this is what
 * actually registers the sdk.social_layer_presence identity link, mirroring
 * the same client_id/client_secret token exchange already proven working for
 * site login (see auth.ts). We don't need to keep the resulting access
 * token: completing this exchange is the goal, not using the token
 * afterward — data pushes continue via the bot token (profilePush.ts).
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/signin", env.NEXTAUTH_URL));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return dashboardError("missing_code");

  let parsedState: { userId: string; iat: number };
  try {
    parsedState = JSON.parse(decrypt(state));
  } catch {
    return dashboardError("invalid_state");
  }

  if (parsedState.userId !== session.user.id) return dashboardError("state_mismatch");
  if (Date.now() - parsedState.iat > STATE_MAX_AGE_MS) return dashboardError("state_expired");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { discordAppId: true, discordClientSecretEnc: true },
  });
  if (!user.discordAppId || !user.discordClientSecretEnc) return dashboardError("missing_app");

  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: user.discordAppId,
      client_secret: decrypt(user.discordClientSecretEnc),
      grant_type: "authorization_code",
      code,
      redirect_uri: `${env.NEXTAUTH_URL}/api/widget/oauth-callback`,
    }),
  });

  if (!res.ok) {
    return dashboardError("token_exchange_failed");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { discordIdentityAuthorizedAt: new Date() },
  });

  return NextResponse.redirect(new URL("/dashboard?identity=ok", env.NEXTAUTH_URL));
}
