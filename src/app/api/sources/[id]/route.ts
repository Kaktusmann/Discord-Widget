import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  url: z.string().url().optional(),
  enabled: z.boolean().optional(),
});

async function loadOwnedSource(id: string, userId: string) {
  const source = await prisma.urlSource.findUnique({ where: { id } });
  if (!source || source.userId !== userId) return null;
  return source;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await loadOwnedSource(id, session.user.id);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", detail: parsed.error.flatten() }, { status: 400 });
  }

  const source = await prisma.urlSource.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ source });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await loadOwnedSource(id, session.user.id);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.widgetFieldValue.updateMany({
      where: { urlSourceId: id },
      data: { dataSource: "manual", urlSourceId: null, jsonPath: null },
    }),
    prisma.urlSource.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
