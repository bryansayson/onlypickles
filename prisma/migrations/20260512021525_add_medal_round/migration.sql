-- CreateEnum
CREATE TYPE "MedalRoundType" AS ENUM ('FIXED', 'RANDOM');

-- CreateTable
CREATE TABLE "MedalRound" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "MedalRoundType" NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedalRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MedalRound_sessionId_key" ON "MedalRound"("sessionId");

-- AddForeignKey
ALTER TABLE "MedalRound" ADD CONSTRAINT "MedalRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
