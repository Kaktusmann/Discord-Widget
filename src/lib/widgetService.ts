import { prisma } from "@/lib/prisma";
import {
  computePayloadHash,
  pushProfileData,
  type DynamicField,
  type DynamicFieldType,
  type ProfilePushPayload,
} from "@/lib/discord/profilePush";

export async function buildPayloadForUser(userId: string): Promise<ProfilePushPayload> {
  const [user, fieldValues] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.widgetFieldValue.findMany({ where: { userId } }),
  ]);

  const dynamic: DynamicField[] = fieldValues
    .filter((f) => f.value !== null)
    .map((f) => ({
      type: f.fieldType as DynamicFieldType,
      name: f.fieldName,
      // value is stored JSON-encoded so it round-trips to exactly the shape
      // Discord expects: a bare string, a bare number, or { url } for images.
      value: JSON.parse(f.value as string) as string | number | { url: string },
    }));

  return { username: user.username, data: { dynamic } };
}

export type SyncResult =
  | { pushed: true; reason: "sent" }
  | { pushed: false; reason: "deduped" | "not_linked" };

/** Recomputes a user's full widget payload from stored field values and pushes it to Discord if it changed since the last successful push. Shared by the manual push API and the URL-source poller. */
export async function syncUserWidget(userId: string): Promise<SyncResult> {
  const [user, link] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.widgetLink.findUnique({ where: { userId } }),
  ]);

  if (!link?.published) {
    return { pushed: false, reason: "not_linked" };
  }

  const payload = await buildPayloadForUser(userId);
  const hash = computePayloadHash(payload);

  if (link.lastPushedHash === hash) {
    return { pushed: false, reason: "deduped" };
  }

  try {
    await pushProfileData(user.discordId, payload);
    await prisma.widgetLink.update({
      where: { userId },
      data: { lastPushedHash: hash, lastPushedAt: new Date(), lastError: null },
    });
    return { pushed: true, reason: "sent" };
  } catch (err) {
    await prisma.widgetLink.update({
      where: { userId },
      data: { lastError: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}
