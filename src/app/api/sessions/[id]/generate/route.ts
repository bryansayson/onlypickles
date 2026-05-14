import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateFixed } from "./generateFixed";
import { generateRotating } from "./generateRotating";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const body = await request.json();

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      courts: { orderBy: { number: "asc" } },
      sessionPlayers: { include: { player: true } },
      teams: { include: { player1: true, player2: true } },
      playerOverrides: true,
      pods: { include: { sessionPlayers: true, teams: true } },
    },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const courts = session.courts.map((c) => ({
    courtId: c.id,
    format: c.format as "MIXED" | "MENS" | "WOMENS" | "ANY",
  }));

  if (courts.length === 0) {
    return NextResponse.json({ error: "Add at least one court first." }, { status: 400 });
  }

  // Clear existing games before regenerating
  const courtIds = session.courts.map((c) => c.id);
  if (courtIds.length > 0) {
    await prisma.game.deleteMany({ where: { courtId: { in: courtIds } } });
  }

  const result = session.sessionFormat === "FIXED"
    ? generateFixed(session, courts, body)
    : generateRotating(session, courts, body);

  if (!result.ok) return result.response;

  for (const game of result.data) await prisma.game.create({ data: game });

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

  return NextResponse.json({ games });
}
