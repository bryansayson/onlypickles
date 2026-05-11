-- CreateEnum
CREATE TYPE "OverrideType" AS ENUM ('MUST_PARTNER', 'MUST_NOT_PARTNER');

-- CreateTable
CREATE TABLE "PlayerOverride" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT NOT NULL,
    "type" "OverrideType" NOT NULL,

    CONSTRAINT "PlayerOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerOverride_sessionId_player1Id_player2Id_key" ON "PlayerOverride"("sessionId", "player1Id", "player2Id");

-- AddForeignKey
ALTER TABLE "PlayerOverride" ADD CONSTRAINT "PlayerOverride_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerOverride" ADD CONSTRAINT "PlayerOverride_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerOverride" ADD CONSTRAINT "PlayerOverride_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
