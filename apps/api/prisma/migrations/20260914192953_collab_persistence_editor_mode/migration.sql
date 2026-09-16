-- CreateEnum
CREATE TYPE "editor_mode" AS ENUM ('rest', 'collab');

-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "editorMode" "editor_mode" NOT NULL DEFAULT 'rest';

-- CreateTable
CREATE TABLE "page_collab_states" (
    "pageId" TEXT NOT NULL,
    "state" BYTEA NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_collab_states_pkey" PRIMARY KEY ("pageId")
);

-- AddForeignKey
ALTER TABLE "page_collab_states" ADD CONSTRAINT "page_collab_states_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
