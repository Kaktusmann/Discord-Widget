# Setup

This app manages Discord's experimental "Profile Widgets v2" feature.

**This uses an undocumented, experimental Discord feature.** Discord can change or
remove it without notice. Experiment flag names below are known-correct as of this
writing but may drift — if something described here doesn't unlock/work anymore,
search for the current equivalent before assuming this app is broken.

**Important architectural fact, confirmed the hard way:** attaching/pushing a
widget only works for the account that *owns* the Discord Application it belongs
to. A single shared application cannot serve multiple people. That means there
are two separate setup tracks:

- **Part A** (once, by whoever deploys this): a small Discord Application used
  only to let people sign into the site.
- **Part B** (once per person who wants a widget, including the deployer): their
  own, separate Discord Application that actually owns their widget.

## Part A — one-time site setup

### A1. Create the login application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new Application (e.g. "MyWidgetSite Login").
2. Under **OAuth2**, add a redirect URI: `<NEXTAUTH_URL>/api/auth/callback/discord`
   (e.g. `http://localhost:3000/api/auth/callback/discord` for local dev). Note the
   **Client ID** and **Client Secret**.

That's it for this application — it does not need Social SDK, a bot, or anything
else. It exists purely so people can click "Sign in with Discord" on your site.

### A2. Fill in environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Where it comes from |
|---|---|
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | The login application's OAuth2 tab (step A1) |
| `ADMIN_DISCORD_IDS` | Your own Discord user ID (comma-separated if more than one) |
| `NEXTAUTH_SECRET` / `ENCRYPTION_KEY` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` — run it twice, once per variable. **Back `ENCRYPTION_KEY` up somewhere safe outside `.env`** — losing it makes stored tokens unrecoverable. |

### A3. Run it

```
npm ci
npx prisma migrate deploy
npm run build
npm start
```

Sign in with Discord. As an admin (per `ADMIN_DISCORD_IDS`), visit `/admin` and
add the field names your widget layout will use (name, type, optionally a
default JSON path) — see Part B2 below for where the names come from. This field
map is shared across everyone using the site; each person's widget uses the same
field *names*, populated with their own values.

## Part B — per-person setup (everyone who wants a widget, including you)

Each person does this once on their own Discord account.

### B1. Create your own Discord Application

1. Create a new Application in the [Developer Portal](https://discord.com/developers/applications) (separate from the site's login app).
2. Under **Games → Social SDK**, enable the Social SDK for this application.
3. Under **Bot**, generate a bot token.
   **This token is extremely sensitive** — it can push profile data to your
   Discord account on your behalf. Never share it or commit it anywhere.
4. Under **OAuth2**, note the **Client Secret** (also sensitive — required for
   step B3b below, which is what actually makes pushed data show up on your
   profile). Add a redirect URI here too — the dashboard shows you the exact
   URL to paste in once you've entered your app's details (step B3).
5. Note the **Application ID** from the General Information page.

### B2. Create your widget layout

The widget's visual layout (which fields exist, their type, static vs. dynamic)
is defined by a `widget_config`. On your dashboard, under **"Set up your widget
layout"**, there's a generated script that creates and publishes one
automatically from the site's shared field map (`/admin`) — paste it into
devtools on discord.com, run it once, done. It covers the main widget content
(top section, bottom stats, mini profile, activity accessory); the "add
widget" preview icon isn't included, since that specifically requires an
uploaded image asset we haven't automated (a different, unconfirmed API).

If you want to add that preview icon, or customize the layout beyond what the
site's field map produces, use the hidden manual editor instead. Unlock it by
pasting the following into your browser's devtools console while on the
Developer Portal:

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

Reload the page. A widget config editor should now be available for **your**
application (not the site's login app). Design a layout with:
- A **Widget Top** section (e.g. a hero image + title)
- A **Widget Bottom** section (e.g. stat_1 through stat_6, or any names you want)

Mark fields as **static** (same for everyone) or **dynamic/data** (updatable via
the API). Use dynamic fields for anything you want this app to be able to
update. **Note the exact field names you chose** — if they're not already in the
site's shared field map (`/admin`, Part A3), ask the site admin to add them.

Publish the layout when you're done. If you used the manual editor instead of
the generated script above, make sure your field names match the site's shared
field map (`/admin`) — the automated script's field names always match by
construction, since it's generated *from* that map.

### B3. Enter your app into the dashboard

Sign into the site, and on `/dashboard` under **"Your Discord application"**,
enter your Application ID, bot token, and client secret from step B1. All
three are stored encrypted and used server-side — the bot token to push your
field values to Discord (via `PATCH .../identities/{id}/profile`, which —
unlike attaching — does work with a bot token, no browser session needed),
the client secret only for step B3b below.

### B3b. Authorize your app for your account

This step is easy to skip and easy to miss the consequences of: without it,
pushed data is accepted by Discord with no error, but never actually shows on
your profile. It's a real OAuth2 consent screen, not a script — copy the
redirect URL shown under "Authorize your app for this account" into your
app's OAuth2 redirect settings (Developer Portal), then click **Authorize**
on the dashboard and approve. The dashboard shows whether this has succeeded.

An earlier version of this app tried faking this via a browser-console
request instead of a real OAuth flow — that approach 400s and turned out to
be the wrong mechanism; this is the confirmed-correct one (matching how
discordwidgets.com does it, which is also why it asks for the same redirect
URL and client secret).

### B4. Attach the widget to your profile

Click **Link** on the dashboard, then open the **"Widget not showing up on your
profile?"** section underneath it. It has a script generated specifically for
your account and application — open [discord.com](https://discord.com), open
devtools (F12) → Console, paste the script, press Enter.

This step fundamentally cannot be done server-side: attaching a widget
(`PUT /users/@me/widgets`) only accepts discord.com's own live browser session
token, not a portable OAuth token — confirmed by testing, not just suspected.
Re-run the script any time the widget disappears from your profile (Discord can
drop it, e.g. after certain session/security events).

### B5. Known limitation: viewer-side rendering

Because Profile Widgets v2 is experimental, **people viewing your Discord
profile may need their own client-side experiment override enabled** to
actually see the widget render (as of this writing,
`2026-03-application-widget-v2-renderer`). This is a Discord client-side
limitation, not something this app can fix.

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
