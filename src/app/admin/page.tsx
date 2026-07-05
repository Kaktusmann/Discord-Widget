import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { discordConfig } from "@/lib/discord/config";
import { FieldMapEditor } from "@/app/admin/FieldMapEditor";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin");
  if (!session.user.isAdmin) redirect("/dashboard");

  const fields = await prisma.adminFieldMap.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <div>
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="text-sm text-zinc-500">
          Non-secret Discord config and the field-name mapping used across all dashboards.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <h2 className="font-medium">Discord application config</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-zinc-600 dark:text-zinc-400">
          <dt>Application ID</dt>
          <dd>{discordConfig.applicationId}</dd>
          <dt>Widget config ID</dt>
          <dd>{discordConfig.widgetConfigId}</dd>
        </dl>
        <p className="mt-2 text-xs text-zinc-400">
          Bot token and client secret are never shown here. See SETUP.md to change them.
        </p>
      </section>

      <FieldMapEditor
        fields={fields.map((f) => ({
          id: f.id,
          fieldName: f.fieldName,
          fieldType: f.fieldType,
          label: f.label,
          sortOrder: f.sortOrder,
        }))}
      />
    </div>
  );
}
