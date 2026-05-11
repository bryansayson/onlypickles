-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "CourtFormat" AS ENUM ('MIXED', 'MENS', 'WOMENS');

-- CreateEnum
CREATE TYPE "SessionFormat" AS ENUM ('ROTATING', 'FIXED');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "sessionFormat" "SessionFormat" NOT NULL DEFAULT 'ROTATING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Court" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "format" "CourtFormat" NOT NULL,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPlayer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "courtId" TEXT,

    CONSTRAINT "SessionPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "team1Player1Id" TEXT NOT NULL,
    "team1Player2Id" TEXT NOT NULL,
    "team2Player1Id" TEXT NOT NULL,
    "team2Player2Id" TEXT NOT NULL,
    "team1Id" TEXT,
    "team2Id" TEXT,
    "team1Score" INTEGER,
    "team2Score" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_sessionId_player1Id_key" ON "Team"("sessionId", "player1Id");

-- CreateIndex
CREATE UNIQUE INDEX "Team_sessionId_player2Id_key" ON "Team"("sessionId", "player2Id");

-- CreateIndex
CREATE UNIQUE INDEX "SessionPlayer_sessionId_playerId_key" ON "SessionPlayer"("sessionId", "playerId");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayer" ADD CONSTRAINT "SessionPlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayer" ADD CONSTRAINT "SessionPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_team1Player1Id_fkey" FOREIGN KEY ("team1Player1Id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_team1Player2Id_fkey" FOREIGN KEY ("team1Player2Id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_team2Player1Id_fkey" FOREIGN KEY ("team2Player1Id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_team2Player2Id_fkey" FOREIGN KEY ("team2Player2Id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_team1Id_fkey" FOREIGN KEY ("team1Id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_team2Id_fkey" FOREIGN KEY ("team2Id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
