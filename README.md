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
  changed field values through the same dedupe/rate-limit pipeline used by
  the manual push API (`src/lib/widgetService.ts`'s `syncUserWidget`).

## Deployment

### Docker

```bash
cp .env.example .env   # fill in real values
docker compose up -d --build
```

The SQLite file lives in the `widget-data` named volume, so it survives
rebuilds.

### Plesk (Node.js / Passenger)

See the "Deployment" section at the bottom of [SETUP.md](./SETUP.md).
