import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { buildWidgetConfigSurfaces, defaultLayoutMapping } from "@/lib/discord/widgetConfigBuilder";
import { publishWidgetConfig } from "@/lib/discord/widgetConfigApi";

/** Server-side attempt at creating/updating + publishing the widget_config via bot token — see widgetConfigApi.ts for why this might not work, in which case the console script stays the fallback. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [user, fieldMap] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    prisma.adminFieldMap.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  if (!user.discordAppId || !user.discordBotTokenEnc) {
    return NextResponse.json(
      { error: "Enter your Discord application ID and bot token first" },
      { status: 400 },
    );
  }

  const mapping = user.widgetLayoutJson ? JSON.parse(user.widgetLayoutJson) : defaultLayoutMapping(fieldMap);
  const displayName = "My Widget";
  const surfaces = buildWidgetConfigSurfaces(mapping, fieldMap);
  const botToken = decrypt(user.discordBotTokenEnc);

  try {
    const result = await publishWidgetConfig(
      user.discordAppId,
      botToken,
      user.discordWidgetConfigId,
      displayName,
      surfaces,
    );
    await prisma.user.update({
      where: { id: user.id },
      data: { discordWidgetConfigId: result.configId },
    });
    return NextResponse.json({ ok: true, configId: result.configId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to publish widget layout server-side — use the console script below instead", detail: message },
      { status: 502 },
    );
  }
}
