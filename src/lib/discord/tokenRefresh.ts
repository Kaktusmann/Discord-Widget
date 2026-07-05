import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { discordConfig } from "@/lib/discord/config";

const REFRESH_SAFETY_WINDOW_MS = 60_000;

interface DiscordTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

/** Returns a usable Discord access token for the user, refreshing it first if it's stale or near expiry. */
export async function getFreshAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.accessTokenEnc) {
    throw new Error("User has no stored Discord access token — they need to sign in again");
  }

  const expiresSoon =
    !user.tokenExpiresAt || user.tokenExpiresAt.getTime() - Date.now() < REFRESH_SAFETY_WINDOW_MS;

  if (!expiresSoon) {
    return decrypt(user.accessTokenEnc);
  }

  if (!user.refreshTokenEnc) {
    return decrypt(user.accessTokenEnc);
  }

  const refreshToken = decrypt(user.refreshTokenEnc);
  const res = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: discordConfig.clientId,
      client_secret: discordConfig.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh Discord token: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as DiscordTokenResponse;

  await prisma.user.update({
    where: { id: userId },
    data: {
      accessTokenEnc: encrypt(data.access_token),
      refreshTokenEnc: data.refresh_token ? encrypt(data.refresh_token) : undefined,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}
