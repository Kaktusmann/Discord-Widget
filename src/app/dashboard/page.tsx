import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { buildLinkConsoleSnippet, buildCreateWidgetConfigSnippet } from "@/lib/discord/consoleSnippet";
import { buildWidgetConfigSurfaces, normalizeLayoutMapping } from "@/lib/discord/widgetConfigBuilder";
import { DiscordAppPanel } from "@/app/dashboard/DiscordAppPanel";
import { WidgetLayoutEditor } from "@/app/dashboard/WidgetLayoutEditor";
import { WidgetConfigPanel } from "@/app/dashboard/WidgetConfigPanel";
import { LinkPanel } from "@/app/dashboard/LinkPanel";
import { FieldsTable } from "@/app/dashboard/FieldsTable";
import { SourcesPanel } from "@/app/dashboard/SourcesPanel";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ identity?: string; reason?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin");

  const { identity, reason } = await searchParams;
  const userId = session.user.id;

  const [user, link, fieldValues, fieldMap, sources, settings] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        discordId: true,
        discordAppId: true,
        discordBotTokenEnc: true,
        discordClientSecretEnc: true,
        discordIdentityAuthorizedAt: true,
        widgetLayoutJson: true,
        discordWidgetConfigId: true,
      },
    }),
    prisma.widgetLink.findUnique({ where: { userId } }),
    prisma.widgetFieldValue.findMany({ where: { userId } }),
    prisma.adminFieldMap.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.urlSource.findMany({
      where: { userId },
      include: { fieldValues: { select: { fieldName: true, jsonPath: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);

  const consoleSnippet = user.discordAppId
    ? buildLinkConsoleSnippet(user.discordAppId, user.discordId)
    : null;

  const layoutMapping = normalizeLayoutMapping(
    user.widgetLayoutJson ? JSON.parse(user.widgetLayoutJson) : null,
    fieldMap,
  );

  const createConfigSnippet = user.discordAppId
    ? buildCreateWidgetConfigSnippet(
        user.discordAppId,
        "My Widget",
        buildWidgetConfigSurfaces(layoutMapping, fieldMap),
        user.discordWidgetConfigId,
      )
    : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <div className="flex items-center gap-3">
        {session.user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" width={48} height={48} className="rounded-full" />
        )}
        <div>
          <p className="font-medium">{session.user.name}</p>
          <p className="text-sm text-zinc-500">{session.user.id}</p>
        </div>
        {session.user.isAdmin && (
          <a href="/admin" className="ml-auto text-sm underline text-zinc-500">
            Admin
          </a>
        )}
      </div>

      {identity === "ok" && (
        <p className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
          Identity authorized — pushed data can now show on your profile.
        </p>
      )}
      {identity === "error" && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          Authorization failed ({reason ?? "unknown error"}) — check your app ID/bot token/client
          secret and the redirect URI, then try again.
        </p>
      )}

      <DiscordAppPanel
        discordAppId={user.discordAppId}
        hasBotToken={Boolean(user.discordBotTokenEnc)}
        hasClientSecret={Boolean(user.discordClientSecretEnc)}
        identityAuthorizedAt={user.discordIdentityAuthorizedAt?.toISOString() ?? null}
        oauthCallbackUrl={`${env.NEXTAUTH_URL}/api/widget/oauth-callback`}
      />

      <WidgetLayoutEditor
        fieldMap={fieldMap.map((f) => ({ fieldName: f.fieldName, label: f.label, fieldType: f.fieldType }))}
        initialMapping={layoutMapping}
      />

      {createConfigSnippet && (
        <WidgetConfigPanel script={createConfigSnippet} discordWidgetConfigId={user.discordWidgetConfigId} />
      )}

      <LinkPanel
        published={link?.published ?? false}
        lastError={link?.lastError ?? null}
        lastPushedAt={link?.lastPushedAt?.toISOString() ?? null}
        consoleSnippet={consoleSnippet}
      />

      <FieldsTable
        fieldMap={fieldMap}
        fieldValues={fieldValues.map((f) => ({
          fieldName: f.fieldName,
          value: f.value,
          dataSource: f.dataSource,
          updatedAt: f.updatedAt.toISOString(),
        }))}
      />

      <SourcesPanel
        fieldMap={fieldMap.map((f) => ({
          fieldName: f.fieldName,
          label: f.label,
          defaultJsonPath: f.defaultJsonPath,
        }))}
        sources={sources.map((s) => ({
          id: s.id,
          url: s.url,
          enabled: s.enabled,
          lastFetchedAt: s.lastFetchedAt?.toISOString() ?? null,
          lastError: s.lastError,
          fields: s.fieldValues,
        }))}
        defaultSourceUrlTemplate={settings?.defaultSourceUrlTemplate ?? null}
      />
    </div>
  );
}
