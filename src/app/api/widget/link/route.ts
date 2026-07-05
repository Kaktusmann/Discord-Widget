import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAccessToken } from "@/lib/discord/tokenRefresh";
import { attachWidgetToProfile } from "@/lib/discord/oauth";
import { discordConfig } from "@/lib/discord/config";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const accessToken = await getFreshAccessToken(userId);
    await attachWidgetToProfile(accessToken, discordConfig.widgetConfigId);

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
