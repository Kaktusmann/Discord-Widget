import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({ url: z.string().url() });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sources = await prisma.urlSource.findMany({
    where: { userId: session.user.id },
    include: { fieldValues: { select: { fieldName: true, jsonPath: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ sources });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", detail: parsed.error.flatten() }, { status: 400 });
  }

  const source = await prisma.urlSource.create({
    data: { userId: session.user.id, url: parsed.data.url },
  });
  return NextResponse.json({ source }, { status: 201 });
}
