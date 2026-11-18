-- CreateEnum
CREATE TYPE "user_avatar_status" AS ENUM ('pending', 'processing', 'ready', 'deletePending');

-- CreateTable
CREATE TABLE "user_avatars" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sourceStorageKey" TEXT,
    "resultAvatarId" TEXT,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "user_avatar_status" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3),
    "deleteAfter" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatarId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_avatars_storageKey_key" ON "user_avatars"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "user_avatars_sourceStorageKey_key" ON "user_avatars"("sourceStorageKey");

-- CreateIndex
CREATE UNIQUE INDEX "user_avatars_resultAvatarId_key" ON "user_avatars"("resultAvatarId");

-- CreateIndex
CREATE INDEX "user_avatars_ownerId_status_idx" ON "user_avatars"("ownerId", "status");

-- CreateIndex
CREATE INDEX "user_avatars_status_expiresAt_idx" ON "user_avatars"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "user_avatars_status_deleteAfter_idx" ON "user_avatars"("status", "deleteAfter");

-- CreateIndex
CREATE UNIQUE INDEX "users_avatarId_key" ON "users"("avatarId");

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatarId_fkey"
FOREIGN KEY ("avatarId") REFERENCES "user_avatars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_resultAvatarId_fkey"
FOREIGN KEY ("resultAvatarId") REFERENCES "user_avatars"("id") ON DELETE SET NULL ON UPDATE CASCADE;
