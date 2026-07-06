import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";

/**
 * Starts the real OAuth2 Authorization Code flow that registers this user's
 * own Discord Application against their account for sdk.social_layer_presence
 * — confirmed as the actual mechanism (not the browser-console "fake authorize
 * POST" this project tried first, which 400s) by discordwidgets.com's own
 * setup flow, which likewise asks for a redirect URI and a client secret.
 *
 * `state` is an encrypted, self-verifying token (userId + issued-at) rather
 * than a row in a new table — /api/widget/oauth-callback decrypts it and
 * checks both freshness and that it matches the session completing the
 * flow, which is enough CSRF protection for this without extra storage.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/signin", env.NEXTAUTH_URL));

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { discordAppId: true },
  });
  if (!user.discordAppId) {
    return NextResponse.redirect(new URL("/dashboard?identity=missing_app", env.NEXTAUTH_URL));
  }

  const state = encrypt(JSON.stringify({ userId: session.user.id, iat: Date.now() }));

  const params = new URLSearchParams({
    client_id: user.discordAppId,
    redirect_uri: `${env.NEXTAUTH_URL}/api/widget/oauth-callback`,
    response_type: "code",
    scope: "sdk.social_layer_presence",
    state,
  });

  return NextResponse.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
}
