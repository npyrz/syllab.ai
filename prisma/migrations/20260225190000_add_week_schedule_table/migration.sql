-- CreateTable
CREATE TABLE "WeekSchedule" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "weekStartISO" TEXT NOT NULL,
    "weekEndISO" TEXT NOT NULL,
    "days" JSONB NOT NULL,
    "upcoming" JSONB NOT NULL,
    "generatedAtISO" TEXT NOT NULL,
    "scheduleFingerprint" TEXT NOT NULL,
    "syllabusFingerprint" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeekSchedule_classId_week_idx" ON "WeekSchedule"("classId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "WeekSchedule_classId_week_scheduleFingerprint_syllabusFingerp_key" ON "WeekSchedule"("classId", "week", "scheduleFingerprint", "syllabusFingerprint");

-- AddForeignKey
ALTER TABLE "WeekSchedule" ADD CONSTRAINT "WeekSchedule_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
