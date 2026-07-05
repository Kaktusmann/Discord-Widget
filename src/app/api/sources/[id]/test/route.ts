import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchJsonSafely } from "@/lib/urlFetch";
import {
  isTemplate,
  resolveJsonPath,
  resolveTemplate,
  resolveFieldValue,
  templateResolvesFully,
} from "@/lib/jsonPath";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const source = await prisma.urlSource.findUnique({
    where: { id },
    include: { fieldValues: { select: { fieldName: true, jsonPath: true } } },
  });
  if (!source || source.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const json = await fetchJsonSafely(source.url);
    await prisma.urlSource.update({
      where: { id },
      data: { lastFetchedJson: JSON.stringify(json), lastFetchedAt: new Date(), lastError: null },
    });

    const resolved = Object.fromEntries(
      source.fieldValues
        .filter((f) => f.jsonPath)
        .map((f) => {
          const path = f.jsonPath as string;
          return [f.fieldName, isTemplate(path) ? resolveTemplate(json, path) : resolveJsonPath(json, path)];
        }),
    );

    // Auto-detect mappings for fields not already mapped to this source: try
    // the admin-set default path first, otherwise fall back to a bare path
    // equal to the field's own name (the common case — a JSON key that
    // already matches the field name one-for-one). Only suggest it if the
    // value actually resolves and matches the field's type, so a suggestion
    // is always safe to apply as-is.
    const alreadyMapped = new Set(source.fieldValues.map((f) => f.fieldName));
    const allFields = await prisma.adminFieldMap.findMany();
    const suggestions = allFields
      .filter((f) => !alreadyMapped.has(f.fieldName))
      .map((f) => {
        const candidatePath = f.defaultJsonPath || f.fieldName;
        if (isTemplate(candidatePath) && !templateResolvesFully(json, candidatePath)) return null;
        const value = resolveFieldValue(json, candidatePath, f.fieldType);
        return value !== undefined ? { fieldName: f.fieldName, jsonPath: candidatePath, value } : null;
      })
      .filter(
        (s): s is { fieldName: string; jsonPath: string; value: string | number | { url: string } } =>
          s !== null,
      );

    return NextResponse.json({ ok: true, json, resolved, suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.urlSource.update({ where: { id }, data: { lastError: message } });
    return NextResponse.json({ error: "Fetch failed", detail: message }, { status: 502 });
  }
}
