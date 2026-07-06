-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_widget_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "widgetConfigId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "linkedAt" DATETIME,
    "unlinkedAt" DATETIME,
    "lastPushedHash" TEXT,
    "lastPushedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "widget_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_widget_links" ("createdAt", "id", "lastError", "lastPushedAt", "lastPushedHash", "linkedAt", "published", "unlinkedAt", "updatedAt", "userId", "widgetConfigId") SELECT "createdAt", "id", "lastError", "lastPushedAt", "lastPushedHash", "linkedAt", "published", "unlinkedAt", "updatedAt", "userId", "widgetConfigId" FROM "widget_links";
DROP TABLE "widget_links";
ALTER TABLE "new_widget_links" RENAME TO "widget_links";
CREATE UNIQUE INDEX "widget_links_userId_key" ON "widget_links"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
