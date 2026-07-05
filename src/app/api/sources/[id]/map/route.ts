import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveJsonPath } from "@/lib/jsonPath";
import { syncUserWidget } from "@/lib/widgetService";

const bodySchema = z.object({
  fieldName: z.string().min(1),
  jsonPath: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const source = await prisma.urlSource.findUnique({ where: { id } });
  if (!source || source.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", detail: parsed.error.flatten() }, { status: 400 });
  }
  const { fieldName, jsonPath } = parsed.data;

  const fieldMap = await prisma.adminFieldMap.findUnique({ where: { fieldName } });
  if (!fieldMap) {
    return NextResponse.json({ error: `Unknown field name: ${fieldName}` }, { status: 400 });
  }

  let value: string | null = null;
  if (source.lastFetchedJson) {
    const resolved = resolveJsonPath(JSON.parse(source.lastFetchedJson), jsonPath);
    if (resolved !== undefined) value = JSON.stringify(resolved);
  }

  await prisma.widgetFieldValue.upsert({
    where: { userId_fieldName: { userId: session.user.id, fieldName } },
    create: {
      userId: session.user.id,
      fieldName,
      fieldType: fieldMap.fieldType,
      value,
      dataSource: "json_url",
      urlSourceId: id,
      jsonPath,
    },
    update: {
      fieldType: fieldMap.fieldType,
      value: value ?? undefined,
      dataSource: "json_url",
      urlSourceId: id,
      jsonPath,
    },
  });

  try {
    const result = await syncUserWidget(session.user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Field mapped but push to Discord failed", detail: message },
      { status: 502 },
    );
  }
}
