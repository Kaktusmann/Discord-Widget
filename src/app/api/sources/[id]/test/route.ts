import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchJsonSafely } from "@/lib/urlFetch";
import { resolveJsonPath } from "@/lib/jsonPath";

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
        .map((f) => [f.fieldName, resolveJsonPath(json, f.jsonPath as string)]),
    );

    return NextResponse.json({ ok: true, json, resolved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.urlSource.update({ where: { id }, data: { lastError: message } });
    return NextResponse.json({ error: "Fetch failed", detail: message }, { status: 502 });
  }
}
