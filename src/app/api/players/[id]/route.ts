import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Check for game history before deleting
  const gameCount = await prisma.game.count({
    where: {
      OR: [
        { team1Player1Id: id },
        { team1Player2Id: id },
        { team2Player1Id: id },
        { team2Player2Id: id },
      ],
    },
  });

  if (gameCount > 0) {
    return NextResponse.json(
      { error: "This player has game history and cannot be removed from the roster. Remove them from individual sessions instead." },
      { status: 409 }
    );
  }

  // Remove from any teams and session rosters first (no game history so safe to clean up)
  await prisma.team.deleteMany({ where: { OR: [{ player1Id: id }, { player2Id: id }] } });
  await prisma.playerOverride.deleteMany({ where: { OR: [{ player1Id: id }, { player2Id: id }] } });
  await prisma.sessionPlayer.deleteMany({ where: { playerId: id } });
  await prisma.player.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
