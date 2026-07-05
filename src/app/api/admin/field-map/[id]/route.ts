import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  fieldName: z.string().min(1).optional(),
  fieldType: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  label: z.string().min(1).optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", detail: parsed.error.flatten() }, { status: 400 });
  }

  const field = await prisma.adminFieldMap.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ field });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.adminFieldMap.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
