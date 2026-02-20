-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('syllabus', 'schedule', 'other');

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "scheduleId" TEXT,
ADD COLUMN     "semester" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "docType" "DocumentType" NOT NULL DEFAULT 'other',
ADD COLUMN     "weeklyInfo" TEXT;
