import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),

  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),

  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_OAUTH_SCOPE: z.string().default("identify sdk.social_layer"),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_APPLICATION_ID: z.string().min(1),
  DISCORD_WIDGET_CONFIG_ID: z.string().min(1),

  ADMIN_DISCORD_IDS: z
    .string()
    .default("")
    .transform((v) => v.split(",").map((id) => id.trim()).filter(Boolean)),

  ENCRYPTION_KEY: z.string().min(1),

  URL_SOURCE_POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),

  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables — check .env against .env.example");
  }
  return parsed.data;
}

export const env = loadEnv();
