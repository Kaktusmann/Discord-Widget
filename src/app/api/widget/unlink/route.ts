import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // No Discord-side call here — see src/lib/discord/oauth.ts. Unlinking just
    // stops us from pushing further profile data for this user; revoking the
    // OAuth authorization itself is done through Discord's own "Authorized
    // Apps" settings, outside this app's control.
    const link = await prisma.widgetLink.update({
      where: { userId },
      data: { published: false, unlinkedAt: new Date(), lastError: null },
    });

    return NextResponse.json({ ok: true, link });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.widgetLink.updateMany({
      where: { userId },
      data: { lastError: message },
    });
    return NextResponse.json({ error: "Failed to unlink widget", detail: message }, { status: 502 });
  }
}
