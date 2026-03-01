-- CreateTable
CREATE TABLE "WeekRecommendation" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "topicSource" TEXT NOT NULL,
    "topicSummary" TEXT NOT NULL,
    "topics" JSONB NOT NULL,
    "resources" JSONB NOT NULL,
    "generatedAtISO" TEXT NOT NULL,
    "scheduleFingerprint" TEXT NOT NULL,
    "syllabusFingerprint" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeekRecommendation_classId_week_idx" ON "WeekRecommendation"("classId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "WeekRecommendation_classId_week_scheduleFingerprint_syllabusFin_key" ON "WeekRecommendation"("classId", "week", "scheduleFingerprint", "syllabusFingerprint");

-- AddForeignKey
ALTER TABLE "WeekRecommendation" ADD CONSTRAINT "WeekRecommendation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
