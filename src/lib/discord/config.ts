import { env } from "@/lib/env";

// Only the site's own OAuth login client — NOT a widget-owning application.
// Each user brings their own Discord Application for the widget itself (see
// User.discordAppId/discordBotTokenEnc), since attaching/pushing a widget
// only works for that application's owner.
export interface DiscordConfig {
  clientId: string;
  clientSecret: string;
}

export const discordConfig: DiscordConfig = {
  clientId: env.DISCORD_CLIENT_ID,
  clientSecret: env.DISCORD_CLIENT_SECRET,
};
