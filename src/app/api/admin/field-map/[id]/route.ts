import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  fieldName: z.string().min(1).optional(),
  fieldType: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  label: z.string().min(1).optional(),
  description: z.string().optional(),
  defaultJsonPath: z.string().optional(),
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

  const field = await prisma.adminFieldMap.findUnique({ where: { id } });
  if (!field) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // WidgetFieldValue rows are linked to AdminFieldMap only by matching
  // fieldName (no foreign key) — without this, a deleted/renamed field leaves
  // stale values behind that keep getting pushed as unrecognized dynamic
  // fields for every user who had it mapped.
  await prisma.$transaction([
    prisma.widgetFieldValue.deleteMany({ where: { fieldName: field.fieldName } }),
    prisma.adminFieldMap.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
