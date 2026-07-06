import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({ discordWidgetConfigId: z.string().min(1).nullable() });

/** Lets the user record the config_id printed by the "Set up your widget layout" script's first run, so subsequent runs PATCH that same config instead of creating a new one each time. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", detail: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { discordWidgetConfigId: parsed.data.discordWidgetConfigId },
  });

  return NextResponse.json({ ok: true });
}
