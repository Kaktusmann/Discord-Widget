import { discordRequest } from "@/lib/discord/client";
import { discordQueue } from "@/lib/discord/rateLimiter";

export interface WidgetConfigResult {
  configId: string;
}

/**
 * Creates (or, if `existingConfigId` is given, updates) and publishes a
 * widget_config using the bot token — the same server-side mechanism
 * profilePush.ts already uses successfully to push profile data. This is an
 * untested hypothesis, not a confirmed-working call like profilePush.ts:
 * discordwidgets.com apparently lets users republish a layout with a single
 * "Publish" button and no browser-console step, which only makes sense if
 * these application-level widget-config endpoints accept a bot token —
 * unlike the user-level `/users/@me/widgets` attach endpoint, which is
 * confirmed to require a live discord.com browser session (see
 * consoleSnippet.ts). If this throws an auth error, that hypothesis is
 * wrong for these endpoints too, and buildCreateWidgetConfigSnippet's
 * console-script path is the proven fallback.
 */
export async function publishWidgetConfig(
  applicationId: string,
  botToken: string,
  existingConfigId: string | null,
  displayName: string,
  surfaces: unknown,
): Promise<WidgetConfigResult> {
  const token = `Bot ${botToken}`;
  let configId = existingConfigId;

  if (configId) {
    await discordQueue.enqueue(() =>
      discordRequest({
        method: "PATCH",
        version: "v9",
        path: `/applications/${applicationId}/widget-configs/${configId}`,
        token,
        body: { display_name: displayName, surfaces },
      }),
    );
  } else {
    const created = await discordQueue.enqueue(() =>
      discordRequest<{ config_id: string }>({
        method: "POST",
        version: "v9",
        path: `/applications/${applicationId}/widget-configs`,
        token,
        body: { display_name: displayName, surfaces },
      }),
    );
    configId = created.config_id;
  }

  await discordQueue.enqueue(() =>
    discordRequest({
      method: "POST",
      version: "v9",
      path: `/applications/${applicationId}/widget-configs/${configId}/publish`,
      token,
    }),
  );

  return { configId };
}
