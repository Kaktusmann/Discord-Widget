import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  titleField: z.string().nullable(),
  subtitleField: z.string().nullable(),
  imageField: z.string().nullable(),
  stats: z.array(z.object({ fieldName: z.string().min(1), label: z.string().min(1) })).max(6),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", detail: parsed.error.flatten() }, { status: 400 });
  }

  const fieldNames = [
    parsed.data.titleField,
    parsed.data.subtitleField,
    parsed.data.imageField,
    ...parsed.data.stats.map((s) => s.fieldName),
  ].filter((n): n is string => n !== null);

  if (fieldNames.length > 0) {
    const known = await prisma.adminFieldMap.count({ where: { fieldName: { in: fieldNames } } });
    if (known !== new Set(fieldNames).size) {
      return NextResponse.json({ error: "One or more field names are not in the admin field map" }, { status: 400 });
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { widgetLayoutJson: JSON.stringify(parsed.data) },
  });

  return NextResponse.json({ ok: true });
}
