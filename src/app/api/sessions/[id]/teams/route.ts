import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const teams = await prisma.team.findMany({
    where: { sessionId },
    include: { player1: true, player2: true },
  });
  return NextResponse.json(teams);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const { player1Id, player2Id } = await request.json();
  if (!player1Id || !player2Id) {
    return NextResponse.json({ error: "player1Id and player2Id required" }, { status: 400 });
  }

  // Check neither player is already on a team in this session
  const existing = await prisma.team.findFirst({
    where: {
      sessionId,
      OR: [
        { player1Id }, { player2Id },
        { player1Id: player2Id }, { player2Id: player1Id },
      ],
    },
  });
  if (existing) {
    return NextResponse.json({ error: "One or both players are already on a team" }, { status: 400 });
  }

  const created = await prisma.team.create({
    data: { sessionId, player1Id, player2Id },
  });
  const team = await prisma.team.findUnique({
    where: { id: created.id },
    include: { player1: true, player2: true },
  });
  return NextResponse.json(team, { status: 201 });
}
