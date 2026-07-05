import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveFieldValue } from "@/lib/jsonPath";
import { syncUserWidget } from "@/lib/widgetService";

const bodySchema = z.object({
  mappings: z.array(z.object({ fieldName: z.string().min(1), jsonPath: z.string().min(1) })).min(1),
});

/** Applies several field-to-source mappings in one request (see the auto-detected suggestions from /test), then pushes once instead of once per field. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const source = await prisma.urlSource.findUnique({ where: { id } });
  if (!source || source.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!source.lastFetchedJson) {
    return NextResponse.json({ error: "Run Test fetch on this source first" }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", detail: parsed.error.flatten() }, { status: 400 });
  }

  const fieldNames = parsed.data.mappings.map((m) => m.fieldName);
  const fieldMaps = await prisma.adminFieldMap.findMany({ where: { fieldName: { in: fieldNames } } });
  const fieldMapByName = new Map(fieldMaps.map((f) => [f.fieldName, f]));

  const sourceJson = JSON.parse(source.lastFetchedJson);
  const upserts = [];
  for (const { fieldName, jsonPath } of parsed.data.mappings) {
    const fieldMap = fieldMapByName.get(fieldName);
    if (!fieldMap) continue; // unknown/stale field name — skip rather than fail the whole batch

    const coerced = resolveFieldValue(sourceJson, jsonPath, fieldMap.fieldType);
    const value = coerced !== undefined ? JSON.stringify(coerced) : null;

    upserts.push(
      prisma.widgetFieldValue.upsert({
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
      }),
    );
  }

  await prisma.$transaction(upserts);

  try {
    const result = await syncUserWidget(session.user.id);
    return NextResponse.json({ ok: true, mapped: upserts.length, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Fields mapped but push to Discord failed", detail: message },
      { status: 502 },
    );
  }
}
