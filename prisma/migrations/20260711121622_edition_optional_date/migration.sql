-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Edition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "eventDate" DATETIME,
    "location" TEXT,
    "inviteMarkdown" TEXT,
    "inviteHtml" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "coverPhotoId" TEXT,
    "lastInviteSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Edition" ("coverPhotoId", "createdAt", "eventDate", "id", "inviteHtml", "inviteMarkdown", "lastInviteSentAt", "location", "slug", "status", "title", "updatedAt") SELECT "coverPhotoId", "createdAt", "eventDate", "id", "inviteHtml", "inviteMarkdown", "lastInviteSentAt", "location", "slug", "status", "title", "updatedAt" FROM "Edition";
DROP TABLE "Edition";
ALTER TABLE "new_Edition" RENAME TO "Edition";
CREATE UNIQUE INDEX "Edition_slug_key" ON "Edition"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
