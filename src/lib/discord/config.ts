import { env } from "@/lib/env";

export interface DiscordConfig {
  clientId: string;
  clientSecret: string;
  botToken: string;
  applicationId: string;
  widgetConfigId: string;
}

export const discordConfig: DiscordConfig = {
  clientId: env.DISCORD_CLIENT_ID,
  clientSecret: env.DISCORD_CLIENT_SECRET,
  botToken: env.DISCORD_BOT_TOKEN,
  applicationId: env.DISCORD_APPLICATION_ID,
  widgetConfigId: env.DISCORD_WIDGET_CONFIG_ID,
};
