# Discord Widget Manager

A small, self-hosted manager for Discord's experimental "Profile Widgets v2"
feature — link your Discord account, then keep the widget on your profile
up to date either by pushing values from your own scripts/cron jobs, or by
pointing a field at your own JSON API and letting the server poll it.

Before doing anything else, read **[SETUP.md](./SETUP.md)** — it walks through
the one-time manual Discord Developer Portal setup this app depends on.

## Local development

```bash
npm ci
cp .env.example .env   # then fill in real values per SETUP.md
npx prisma migrate deploy
npm run dev
```

Sign in with Discord, then (as an admin, per `ADMIN_DISCORD_IDS`) visit
`/admin` to map field names from your widget_config to labels.

## Architecture

- **Next.js (App Router) + TypeScript**, single Node process — the same app
  runs under Plesk/Passenger or in Docker via `server.js`.
- **Prisma + SQLite**, using the `@prisma/adapter-better-sqlite3` driver
  adapter (required by Prisma 7's client architecture).
- **Auth.js (next-auth v4)** for Discord OAuth2 login, JWT session strategy.
- All Discord-facing HTTP calls live under `src/lib/discord/` — nothing else
  in the app calls `discord.com` directly. This is deliberate: the "Profile
  Widgets v2" API is undocumented and experimental, so isolating it keeps a
  future correction to a small, contained patch. See the risks section of
  the project plan / `SETUP.md` for what's unverified.
- `src/lib/urlSourcePoller.ts` runs an in-process interval (started once via
  `src/instrumentation.ts`) that polls user-configured JSON URLs and pushes
  changed field values through the shared dedupe/rate-limit pipeline
  (`src/lib/widgetService.ts`'s `syncUserWidget`) also used by the dashboard's
  "Push now" button.

## Deployment

### Docker

Images are built and pushed to Docker Hub automatically by
[`.github/workflows/docker-publish.yml`](./.github/workflows/docker-publish.yml)
on every push to `main` (tagged `latest`) and on version tags like `v1.0.0`
(tagged with that semver). Requires the `DOCKERHUB_USERNAME` and
`DOCKERHUB_TOKEN` secrets to be set on the GitHub repo (Settings → Secrets and
variables → Actions — the token should be a Docker Hub access token, not your
account password).

On the VPS, `docker-compose.yml` pulls the published image
(`kaktusmann/discord-widget-manager:latest`) rather than building locally:

```bash
cp .env.example .env   # fill in real values
docker compose pull
docker compose up -d
```

To redeploy after a new push: `docker compose pull && docker compose up -d`.

The SQLite file lives in the `widget-data` named volume, so it survives
redeploys.

`docker-compose.yml` intentionally has **no `build:` key** — production hosts
(including Portainer stacks) should always pull the published image, never
build on the server. `docker-compose.override.yml` adds `build: .` back in,
and Compose auto-merges it when both files sit in the same directory, so
local `docker compose up --build` still builds from source. Don't copy
`docker-compose.override.yml` to production.

#### Portainer

1. **Stacks → Add stack**, then either:
   - **Repository**: point it at `https://github.com/Kaktusmann/Discord-Widget`, branch `main`, compose path `docker-compose.yml` (leave the override file out of it — it isn't referenced, so this is automatic), or
   - **Web editor**: paste the contents of `docker-compose.yml` directly.
2. In the **Environment variables** section, add every variable from
   `.env.example` (`NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DISCORD_CLIENT_ID`,
   `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`,
   `DISCORD_WIDGET_CONFIG_ID`, `ADMIN_DISCORD_IDS`, `ENCRYPTION_KEY`) with
   real values — Portainer also accepts pasting them in `.env` format via the
   "advanced" editor instead of adding one by one.
3. **Deploy the stack.** Since the image is public on Docker Hub, no registry
   credentials are needed — Portainer pulls
   `kaktusmann/discord-widget-manager:latest` directly.
4. Point your existing reverse proxy at `127.0.0.1:3000` on the VPS, same as
   any other deployment method.
5. **To pick up a new image after a push**: open the stack and use
   "Pull and redeploy" (or "Update the stack" with the re-pull option
   checked) — redeploying without that option reuses whatever image is
   already cached locally, even if `latest` has moved on in Docker Hub.

### Plesk (Node.js / Passenger)

See the "Deployment" section at the bottom of [SETUP.md](./SETUP.md).
