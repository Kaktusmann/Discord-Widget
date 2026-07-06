import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  defaultSourceUrlTemplate: z.string().optional(),
});

export async function GET() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  return NextResponse.json({ settings });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", detail: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: 1 },
    create: { id: 1, defaultSourceUrlTemplate: parsed.data.defaultSourceUrlTemplate || null },
    update: { defaultSourceUrlTemplate: parsed.data.defaultSourceUrlTemplate || null },
  });

  return NextResponse.json({ settings });
}
