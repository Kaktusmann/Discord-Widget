/*
  Warnings:

  - You are about to drop the `api_keys` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "admin_field_map" ADD COLUMN "defaultJsonPath" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "api_keys";
PRAGMA foreign_keys=on;
