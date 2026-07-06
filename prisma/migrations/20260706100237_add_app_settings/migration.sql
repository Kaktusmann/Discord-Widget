-- CreateTable
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "defaultSourceUrlTemplate" TEXT,
    "updatedAt" DATETIME NOT NULL
);
