import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

const updateSchema = z.object({
  discordAppId: z.string().min(1),
  discordBotToken: z.string().min(1),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { discordAppId: true, discordBotTokenEnc: true },
  });

  return NextResponse.json({
    discordAppId: user.discordAppId,
    hasBotToken: Boolean(user.discordBotTokenEnc),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", detail: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      discordAppId: parsed.data.discordAppId,
      discordBotTokenEnc: encrypt(parsed.data.discordBotToken),
    },
  });

  return NextResponse.json({ ok: true });
}
