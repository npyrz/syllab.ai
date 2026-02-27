-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'lecture_notes';

-- CreateEnum
CREATE TYPE "ReadableNoteStatus" AS ENUM ('processing', 'done', 'failed');

-- CreateTable
CREATE TABLE "ReadableNote" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "status" "ReadableNoteStatus" NOT NULL DEFAULT 'processing',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ReadableNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReadableNote_userId_idx" ON "ReadableNote"("userId");

-- CreateIndex
CREATE INDEX "ReadableNote_classId_idx" ON "ReadableNote"("classId");

-- CreateIndex
CREATE INDEX "ReadableNote_sourceDocumentId_idx" ON "ReadableNote"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "ReadableNote_status_idx" ON "ReadableNote"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReadableNote_sourceDocumentId_key" ON "ReadableNote"("sourceDocumentId");

-- AddForeignKey
ALTER TABLE "ReadableNote" ADD CONSTRAINT "ReadableNote_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadableNote" ADD CONSTRAINT "ReadableNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadableNote" ADD CONSTRAINT "ReadableNote_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
