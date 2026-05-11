import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const games = await prisma.game.findMany({
    where: { court: { sessionId } },
    include: {
      team1Player1: true,
      team1Player2: true,
      team2Player1: true,
      team2Player2: true,
      court: true,
    },
    orderBy: [{ roundNumber: "asc" }, { court: { number: "asc" } }],
  });
  return NextResponse.json(games);
}
