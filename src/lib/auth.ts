import type { NextAuthOptions } from "next-auth";
import DiscordProvider, { type DiscordProfile } from "next-auth/providers/discord";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

function avatarUrl(profile: DiscordProfile): string {
  if (!profile.avatar) {
    const defaultAvatarNumber = Number(profile.discriminator) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
  }
  const format = profile.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: [
    DiscordProvider({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: { scope: env.DISCORD_OAUTH_SCOPE },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const discordProfile = profile as DiscordProfile;
        const isAdmin = env.ADMIN_DISCORD_IDS.includes(discordProfile.id);

        const tokenExpiresAt = account.expires_at ? new Date(account.expires_at * 1000) : null;
        const accessTokenEnc = account.access_token ? encrypt(account.access_token) : undefined;
        const refreshTokenEnc = account.refresh_token ? encrypt(account.refresh_token) : undefined;

        const user = await prisma.user.upsert({
          where: { discordId: discordProfile.id },
          create: {
            discordId: discordProfile.id,
            username: discordProfile.username,
            discriminator: discordProfile.discriminator,
            avatar: avatarUrl(discordProfile),
            isAdmin,
            accessTokenEnc,
            refreshTokenEnc,
            tokenExpiresAt,
          },
          update: {
            username: discordProfile.username,
            discriminator: discordProfile.discriminator,
            avatar: avatarUrl(discordProfile),
            isAdmin,
            ...(accessTokenEnc ? { accessTokenEnc } : {}),
            ...(refreshTokenEnc ? { refreshTokenEnc } : {}),
            ...(tokenExpiresAt ? { tokenExpiresAt } : {}),
          },
        });

        token.userId = user.id;
        token.isAdmin = user.isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.isAdmin = Boolean(token.isAdmin);
      }
      return session;
    },
  },
};
