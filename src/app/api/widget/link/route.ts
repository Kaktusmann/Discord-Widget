import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAccessToken } from "@/lib/discord/tokenRefresh";
import { discordConfig } from "@/lib/discord/config";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Confirms the stored OAuth token is still valid/refreshable; no separate
    // Discord-side "attach" call is made — see src/lib/discord/oauth.ts for
    // why. "Linked" here just means "the user has authorized sdk.social_layer
    // and we're allowed to start pushing profile data for them."
    await getFreshAccessToken(userId);

    const link = await prisma.widgetLink.upsert({
      where: { userId },
      create: {
        userId,
        widgetConfigId: discordConfig.widgetConfigId,
        published: true,
        linkedAt: new Date(),
      },
      update: {
        widgetConfigId: discordConfig.widgetConfigId,
        published: true,
        linkedAt: new Date(),
        unlinkedAt: null,
        lastError: null,
      },
    });

    return NextResponse.json({ ok: true, link });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.widgetLink.upsert({
      where: { userId },
      create: { userId, widgetConfigId: discordConfig.widgetConfigId, published: false, lastError: message },
      update: { lastError: message },
    });
    return NextResponse.json({ error: "Failed to link widget", detail: message }, { status: 502 });
  }
}
