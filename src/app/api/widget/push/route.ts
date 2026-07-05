import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashApiKey } from "@/lib/apiKey";
import { syncUserWidget } from "@/lib/widgetService";

const bodySchema = z.object({
  fields: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.object({ url: z.string().url() })]),
  ),
});

type FieldValue = z.infer<typeof bodySchema>["fields"][string];

function fieldValueMatchesType(value: FieldValue, fieldType: number): boolean {
  if (fieldType === 1) return typeof value === "string";
  if (fieldType === 2) return typeof value === "number";
  if (fieldType === 3) return typeof value === "object" && value !== null && "url" in value;
  return false;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const rawKey = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!rawKey) {
    return NextResponse.json(
      { error: "Missing Authorization: Bearer <API key> header" },
      { status: 401 },
    );
  }

  const keyHash = hashApiKey(rawKey);
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!apiKey || apiKey.revokedAt) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const fieldNames = Object.keys(parsed.data.fields);
  const fieldMaps = await prisma.adminFieldMap.findMany({
    where: { fieldName: { in: fieldNames } },
  });
  const fieldMapByName = new Map(fieldMaps.map((f) => [f.fieldName, f]));

  const unknownFields = fieldNames.filter((name) => !fieldMapByName.has(name));
  if (unknownFields.length > 0) {
    return NextResponse.json(
      { error: `Unknown field name(s): ${unknownFields.join(", ")}` },
      { status: 400 },
    );
  }

  for (const [name, value] of Object.entries(parsed.data.fields)) {
    const fieldMap = fieldMapByName.get(name)!;
    if (!fieldValueMatchesType(value, fieldMap.fieldType)) {
      return NextResponse.json(
        { error: `Field "${name}" value does not match its configured type` },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction(
    Object.entries(parsed.data.fields).map(([name, value]) => {
      const fieldMap = fieldMapByName.get(name)!;
      return prisma.widgetFieldValue.upsert({
        where: { userId_fieldName: { userId: apiKey.userId, fieldName: name } },
        create: {
          userId: apiKey.userId,
          fieldName: name,
          fieldType: fieldMap.fieldType,
          value: JSON.stringify(value),
          dataSource: "manual",
        },
        update: {
          fieldType: fieldMap.fieldType,
          value: JSON.stringify(value),
          dataSource: "manual",
          urlSourceId: null,
          jsonPath: null,
        },
      });
    }),
  );

  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });

  try {
    const result = await syncUserWidget(apiKey.userId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Fields saved but push to Discord failed", detail: message },
      { status: 502 },
    );
  }
}
