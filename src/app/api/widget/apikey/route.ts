import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/apiKey";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = await prisma.apiKey.findUnique({ where: { userId: session.user.id } });
  if (!key || key.revokedAt) {
    return NextResponse.json({ exists: false });
  }
  return NextResponse.json({ exists: true, keyPrefix: key.keyPrefix, lastUsedAt: key.lastUsedAt });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { raw, keyHash, keyPrefix } = generateApiKey();

  await prisma.apiKey.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, keyHash, keyPrefix },
    update: { keyHash, keyPrefix, revokedAt: null, lastUsedAt: null },
  });

  return NextResponse.json({ apiKey: raw, keyPrefix });
}
