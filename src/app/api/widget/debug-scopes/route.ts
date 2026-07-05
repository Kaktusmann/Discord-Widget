import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFreshAccessToken } from "@/lib/discord/tokenRefresh";

/**
 * Temporary diagnostic: calls Discord's real, documented GET /oauth2/@me to
 * show exactly which scopes the current access token was actually granted.
 * Useful for confirming whether Discord recognized/granted sdk.social_layer
 * at all, since the widget-link 401s could otherwise be caused by several
 * different things. Safe to remove once the link flow is confirmed working.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = await getFreshAccessToken(session.user.id);

  const res = await fetch("https://discord.com/api/v10/oauth2/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json().catch(() => null);

  return NextResponse.json({ status: res.status, body });
}
