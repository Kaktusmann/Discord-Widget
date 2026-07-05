import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  fieldName: z.string().min(1),
  fieldType: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  label: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  const fields = await prisma.adminFieldMap.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ fields });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", detail: parsed.error.flatten() }, { status: 400 });
  }

  const field = await prisma.adminFieldMap.create({ data: parsed.data });
  return NextResponse.json({ field }, { status: 201 });
}
