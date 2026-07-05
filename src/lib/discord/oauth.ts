import { discordRequest } from "@/lib/discord/client";
import { discordConfig } from "@/lib/discord/config";
import { discordQueue } from "@/lib/discord/rateLimiter";

/**
 * NOTE: the request bodies below are best-effort reconstructions from third-party
 * writeups of Discord's undocumented, experimental "Profile Widgets v2" API — not
 * primary documentation. Before relying on this in production, do the manual
 * verification spike described in SETUP.md / the project plan (capture the real
 * request/response via devtools while performing this flow by hand), then adjust
 * these two functions to match reality. They are intentionally isolated here so
 * that correction is a small, contained patch.
 */

/**
 * NOT currently called by the link flow (see src/app/api/widget/link/route.ts).
 *
 * This mirrors a POST to /oauth2/authorize seen in third-party writeups of the
 * *manual, browser-based* version of this trick — visiting a specially-crafted
 * Discord URL directly in a logged-in browser tab (implicit grant). There, it's
 * effectively Discord's own consent-screen form submission, which likely relies
 * on browser session cookies rather than being a portable bearer-token API call.
 *
 * Our app instead does a standard server-side Authorization Code grant during
 * login, where the user already approves the sdk.social_layer scope on
 * Discord's real consent screen — that grant should already be sufficient, and
 * calling this afterward returned 401 in testing. Kept here, unused, in case
 * investigation turns up a legitimate reason to call it after all.
 */
export async function authorizeWidgetForUser(userAccessToken: string): Promise<void> {
  await discordQueue.enqueue(() =>
    discordRequest({
      method: "POST",
      path: "/oauth2/authorize",
      token: `Bearer ${userAccessToken}`,
      body: {
        client_id: discordConfig.clientId,
        scope: "sdk.social_layer",
        permissions: "0",
        authorize: true,
      },
    }),
  );
}

export async function attachWidgetToProfile(
  userAccessToken: string,
  widgetConfigId: string,
): Promise<void> {
  // UNVERIFIED: this PUT may REPLACE the user's entire widget list rather than
  // appending to it. If the spike confirms that, this must become a
  // GET-current-widgets -> merge -> PUT instead of this naive single-element PUT.
  await discordQueue.enqueue(() =>
    discordRequest({
      method: "PUT",
      path: "/users/@me/widgets",
      token: `Bearer ${userAccessToken}`,
      body: {
        widgets: [
          { application_id: discordConfig.applicationId, widget_config_id: widgetConfigId },
        ],
      },
    }),
  );
}

export async function detachWidgetFromProfile(userAccessToken: string): Promise<void> {
  // Same caveat as attachWidgetToProfile: assumes PUT with an empty list removes
  // only this application's widget rather than clobbering others.
  await discordQueue.enqueue(() =>
    discordRequest({
      method: "PUT",
      path: "/users/@me/widgets",
      token: `Bearer ${userAccessToken}`,
      body: { widgets: [] },
    }),
  );
}
