# Setup

This app manages Discord's experimental "Profile Widgets v2" feature. Before the
app can do anything useful, you need to do a one-time manual setup in the Discord
Developer Portal. None of this can be automated from the app itself.

**This uses an undocumented, experimental Discord feature.** Discord can change or
remove it without notice. Experiment flag names below are known-correct as of this
writing but may drift — if the widget config editor doesn't unlock, search for the
current flag name before assuming something in this app is broken.

## 1. Create the Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new Application.
2. Under **Games → Social SDK**, enable the Social SDK for this application.
3. Under **OAuth2**, add a redirect URI: `<NEXTAUTH_URL>/api/auth/callback/discord`
   (e.g. `http://localhost:3000/api/auth/callback/discord` for local dev). Note the
   **Client ID** and **Client Secret**.
4. Under **Bot**, generate a bot token.
   **This token is extremely sensitive** — it can push profile data to *any* user
   who links this application. Never commit it, never log it, store it only as a
   server-side environment variable.

## 2. Design the widget layout

The widget's visual layout (which fields exist, their type, static vs. dynamic) is
defined by a `widget_config` created through a hidden editor in the Developer
Portal UI. Unlock it by pasting the following into your browser's devtools console
while on the Developer Portal:

```js
let _mods = webpackChunkdiscord_developers.push([[Symbol()], {}, (r) => r.c]);
webpackChunkdiscord_developers.pop();
let findByProps = (...props) => {
  for (let m of Object.values(_mods)) {
    try {
      if (!m.exports || m.exports === window) continue;
      if (props.every((x) => m.exports?.[x])) return m.exports;
      for (let ex in m.exports) {
        if (
          props.every((x) => m.exports?.[ex]?.[x]) &&
          m.exports[ex][Symbol.toStringTag] !== "IntlMessagesProxy"
        )
          return m.exports[ex];
      }
    } catch {}
  }
};
findByProps("getAll")
  .getAll()
  .find((e) => e.getName() === "ApexExperimentStore")
  .createOverride("2026-03-widget-config-editor", 1);
```

Reload the page. A widget config editor should now be available for your
application. Design a layout with:
- A **Widget Top** section (e.g. a hero image + title)
- A **Widget Bottom** section (e.g. stat_1 through stat_6)

Mark fields as **static** (same for everyone) or **dynamic/data** (per-user,
updatable via the API). Use dynamic fields for anything you want this app to be
able to update. Note the exact **field names** you chose — they must match the
`fieldName` values you enter in this app's admin page later.

Publishing this layout gives you a **widget_config ID** — save it.

## 3. Fill in environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Where it comes from |
|---|---|
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | OAuth2 tab |
| `DISCORD_BOT_TOKEN` | Bot tab |
| `DISCORD_APPLICATION_ID` | Application's General Information page |
| `DISCORD_WIDGET_CONFIG_ID` | From the widget config editor in step 2 |
| `ADMIN_DISCORD_IDS` | Your own Discord user ID (comma-separated if more than one) |
| `NEXTAUTH_SECRET` / `ENCRYPTION_KEY` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` — run it twice, once per variable. **Back `ENCRYPTION_KEY` up somewhere safe outside `.env`** — losing it makes stored OAuth tokens unrecoverable. |

## 4. Run it

```
npm ci
npx prisma migrate deploy
npm run build
npm start
```

Sign in with Discord, then use the admin page (only visible to `ADMIN_DISCORD_IDS`)
to map field names from step 2 to labels shown on the dashboard.

## 5. Known limitation: viewer-side rendering

Because Profile Widgets v2 is experimental, **people viewing your Discord profile
may need their own client-side experiment override enabled** to actually see the
widget render (as of this writing, `2026-03-application-widget-v2-renderer`). This
is a Discord client-side limitation, not something this app can fix.

## Deployment

See the project README for the Docker path. For Plesk (Node.js / Passenger):

1. Deploy the repo, set the **Application Startup File** to `server.js`.
2. Set all variables from `.env.example` via Plesk's Node.js "Environment Variables" UI.
3. Set `DATABASE_URL` to a path **outside** the git-deployed application directory
   (e.g. a sibling `../data/prod.db` folder you create once with correct
   permissions) so redeploys never wipe the database.
4. Deploy/build action: `npm ci && npx prisma generate && npm run build && npx prisma migrate deploy`, then restart the app.
5. **Enable Plesk's "keep app instance always running" setting.** This app runs an
   in-process poller (`urlSourcePoller.ts`) that fetches user-configured JSON URLs
   on a timer. Passenger can idle-reap a Node process with no inbound HTTP
   traffic, which would silently pause that poller.
