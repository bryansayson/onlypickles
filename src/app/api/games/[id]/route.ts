import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { team1Score, team2Score } = await request.json();

  // update + include uses an implicit transaction — split into two queries
  await prisma.game.update({
    where: { id },
    data: {
      team1Score: team1Score ?? null,
      team2Score: team2Score ?? null,
      completed: team1Score !== null && team2Score !== null,
    },
  });

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      team1Player1: true,
      team1Player2: true,
      team2Player1: true,
      team2Player2: true,
      court: true,
    },
  });

  return NextResponse.json(game);
}
