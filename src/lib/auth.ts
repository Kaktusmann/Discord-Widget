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
      // The sdk.social_layer scope makes Discord's token response include an
      // id_token even without the openid scope. next-auth's default OAuth
      // client either refuses to process that response at all (plain OAuth2
      // path) or, if told it's an id_token (idToken: true), tries to validate
      // it as a full OIDC token against issuer/JWKS metadata Discord doesn't
      // publish for this undocumented scope — both fail. Bypassing all of
      // that by doing the code-for-token exchange ourselves; the id_token in
      // the response is simply ignored, and state/PKCE/nonce checks against
      // the callback request still happen upstream of this, unaffected.
      token: {
        async request({ params }) {
          const res = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: env.DISCORD_CLIENT_ID,
              client_secret: env.DISCORD_CLIENT_SECRET,
              grant_type: "authorization_code",
              code: params.code as string,
              redirect_uri: `${env.NEXTAUTH_URL}/api/auth/callback/discord`,
            }),
          });
          if (!res.ok) {
            throw new Error(`Discord token exchange failed: ${res.status} ${await res.text()}`);
          }
          return { tokens: await res.json() };
        },
      },
      // Profile info still comes from the well-documented REST endpoint
      // (id/username/discriminator/avatar), not from the id_token's claims.
      userinfo: {
        url: "https://discord.com/api/users/@me",
        async request({ tokens }) {
          const res = await fetch("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          return res.json();
        },
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
