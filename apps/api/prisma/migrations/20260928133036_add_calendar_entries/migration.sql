-- CreateTable
CREATE TABLE "calendar_entries" (
    "pageId" TEXT NOT NULL,
    "date" CHAR(10) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_entries_pkey" PRIMARY KEY ("pageId")
);

-- CreateTable
CREATE TABLE "calendar_create_requests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" CHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_create_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_entries_date_idx" ON "calendar_entries"("date");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_create_requests_pageId_key" ON "calendar_create_requests"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_create_requests_projectId_clientRequestId_key" ON "calendar_create_requests"("projectId", "clientRequestId");

-- AddForeignKey
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_create_requests" ADD CONSTRAINT "calendar_create_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_create_requests" ADD CONSTRAINT "calendar_create_requests_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
