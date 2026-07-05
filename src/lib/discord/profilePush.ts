import { createHash } from "node:crypto";
import { discordRequest } from "@/lib/discord/client";
import { discordConfig } from "@/lib/discord/config";
import { discordQueue } from "@/lib/discord/rateLimiter";

export type DynamicFieldType = 1 | 2 | 3; // 1=string, 2=number, 3=image ({url})

export interface DynamicField {
  type: DynamicFieldType;
  name: string;
  value: string | number | { url: string };
}

export interface ProfilePushPayload {
  username: string;
  data: { dynamic: DynamicField[] };
}

export function computePayloadHash(payload: ProfilePushPayload): string {
  const stable = {
    username: payload.username,
    dynamic: [...payload.data.dynamic].sort((a, b) => a.name.localeCompare(b.name)),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

/**
 * Pushes the full dynamic-field payload to a user's Discord profile. Replaces
 * the entire array — always send the complete current field set, not a delta.
 *
 * The `identities/{id}` path segment is a `provider_issued_user_id` — this
 * application's own internal ID for the person, as in a real game/account
 * integration (confirmed by Discord's 50035
 * APPLICATION_IDENTITY_PROVIDER_USER_ID_MISMATCH error when we hardcoded the
 * literal "0" for every user). Since this app has no separate internal
 * user-ID system, the Discord user's own ID doubles as that provider-issued
 * ID — same value as {discordUserId} above it.
 */
export async function pushProfileData(
  discordUserId: string,
  payload: ProfilePushPayload,
): Promise<void> {
  await discordQueue.enqueue(() =>
    discordRequest({
      method: "PATCH",
      version: "v9",
      path: `/applications/${discordConfig.applicationId}/users/${discordUserId}/identities/${discordUserId}/profile`,
      token: `Bot ${discordConfig.botToken}`,
      body: payload,
    }),
  );
}
