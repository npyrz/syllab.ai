-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "ApiUsageDaily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiUsageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsageGlobalDaily" (
    "id" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiUsageGlobalDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiUsageDaily_userId_idx" ON "ApiUsageDaily"("userId");

-- CreateIndex
CREATE INDEX "ApiUsageDaily_windowStart_idx" ON "ApiUsageDaily"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "ApiUsageDaily_userId_windowStart_key" ON "ApiUsageDaily"("userId", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "ApiUsageGlobalDaily_windowStart_key" ON "ApiUsageGlobalDaily"("windowStart");

-- CreateIndex
CREATE INDEX "ApiUsageGlobalDaily_windowStart_idx" ON "ApiUsageGlobalDaily"("windowStart");

-- AddForeignKey
ALTER TABLE "ApiUsageDaily" ADD CONSTRAINT "ApiUsageDaily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
