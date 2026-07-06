import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const slotBindingSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("static"), text: z.string().min(1).max(100) }),
  z.object({ mode: z.literal("field"), fieldName: z.string().min(1) }),
]);

const bodySchema = z.object({
  title: slotBindingSchema.nullable(),
  subtitle: slotBindingSchema.nullable(),
  imageField: z.string().nullable(),
  stats: z.array(z.object({ value: slotBindingSchema, label: z.string().min(1).max(100) })).max(6),
});

function fieldNamesIn(binding: z.infer<typeof slotBindingSchema> | null): string[] {
  return binding?.mode === "field" ? [binding.fieldName] : [];
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", detail: parsed.error.flatten() }, { status: 400 });
  }

  const fieldNames = [
    ...fieldNamesIn(parsed.data.title),
    ...fieldNamesIn(parsed.data.subtitle),
    parsed.data.imageField,
    ...parsed.data.stats.flatMap((s) => fieldNamesIn(s.value)),
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
