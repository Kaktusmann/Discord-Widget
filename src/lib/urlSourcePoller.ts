import { prisma } from "@/lib/prisma";
import { fetchJsonSafely } from "@/lib/urlFetch";
import { resolveJsonPath } from "@/lib/jsonPath";
import { syncUserWidget } from "@/lib/widgetService";
import { env } from "@/lib/env";

let started = false;

export function startUrlSourcePoller(): void {
  if (started) return;
  started = true;

  const intervalMs = env.URL_SOURCE_POLL_INTERVAL_SECONDS * 1000;
  setInterval(() => {
    void pollOnce().catch((err) => console.error("[urlSourcePoller] poll failed", err));
  }, intervalMs);

  console.log(`[urlSourcePoller] started, interval=${env.URL_SOURCE_POLL_INTERVAL_SECONDS}s`);
}

async function pollOnce(): Promise<void> {
  const sources = await prisma.urlSource.findMany({
    where: { enabled: true },
    include: { fieldValues: true },
  });

  const affectedUserIds = new Set<string>();

  for (const source of sources) {
    if (source.fieldValues.length === 0) continue; // nothing depends on this source, skip the fetch

    try {
      const json = await fetchJsonSafely(source.url);
      await prisma.urlSource.update({
        where: { id: source.id },
        data: { lastFetchedJson: JSON.stringify(json), lastFetchedAt: new Date(), lastError: null },
      });

      for (const field of source.fieldValues) {
        if (!field.jsonPath) continue;
        const resolved = resolveJsonPath(json, field.jsonPath);
        if (resolved === undefined) continue;

        const encoded = JSON.stringify(resolved);
        if (encoded !== field.value) {
          await prisma.widgetFieldValue.update({ where: { id: field.id }, data: { value: encoded } });
        }
        affectedUserIds.add(field.userId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.urlSource.update({ where: { id: source.id }, data: { lastError: message } });
    }
  }

  for (const userId of affectedUserIds) {
    try {
      await syncUserWidget(userId);
    } catch {
      // syncUserWidget already persists the failure on WidgetLink.lastError.
    }
  }
}
