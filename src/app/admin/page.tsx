import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FieldMapEditor } from "@/app/admin/FieldMapEditor";
import { SettingsEditor } from "@/app/admin/SettingsEditor";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin");
  if (!session.user.isAdmin) redirect("/dashboard");

  const [fields, users, settings] = await Promise.all([
    prisma.adminFieldMap.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.user.findMany({ include: { widgetLink: true }, orderBy: { createdAt: "asc" } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <div>
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="text-sm text-zinc-500">
          Non-secret Discord config and the field-name mapping used across all dashboards.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">
        There&apos;s no single shared Discord application anymore — attaching a widget only works
        for the account that owns the Discord Application it belongs to, so each user configures
        their own on their dashboard (&quot;Your Discord application&quot;). This admin page's
        Discord-facing config is now just the site&apos;s login OAuth client (env vars
        `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET`), unrelated to any individual widget.
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">Users</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="pb-2 font-normal">User</th>
              <th className="pb-2 font-normal">Own app set up</th>
              <th className="pb-2 font-normal">Linked</th>
              <th className="pb-2 font-normal">Last updated</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-zinc-100 dark:border-zinc-900">
                <td className="py-2">
                  {u.username}
                  {u.isAdmin && <span className="ml-1 text-xs text-zinc-400">(admin)</span>}
                </td>
                <td className="py-2 text-zinc-500">
                  {u.discordAppId && u.discordBotTokenEnc ? "Yes" : "No"}
                </td>
                <td className="py-2 text-zinc-500">
                  {u.widgetLink?.published ? "Yes" : "No"}
                </td>
                <td className="py-2 text-zinc-500">
                  {u.widgetLink?.lastPushedAt
                    ? new Date(u.widgetLink.lastPushedAt).toLocaleString()
                    : "Never"}
                  {u.widgetLink?.lastError && (
                    <span className="ml-2 text-xs text-red-500">{u.widgetLink.lastError}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <SettingsEditor defaultSourceUrlTemplate={settings?.defaultSourceUrlTemplate ?? null} />

      <FieldMapEditor
        fields={fields.map((f) => ({
          id: f.id,
          fieldName: f.fieldName,
          fieldType: f.fieldType,
          label: f.label,
          defaultJsonPath: f.defaultJsonPath,
          sortOrder: f.sortOrder,
        }))}
      />
    </div>
  );
}
