import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OverrideType } from "@/generated/prisma/enums";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const overrides = await prisma.playerOverride.findMany({
    where: { sessionId },
    include: { player1: true, player2: true },
  });
  return NextResponse.json(overrides);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const { player1Id, player2Id, type } = await request.json();

  if (!player1Id || !player2Id || !type) {
    return NextResponse.json({ error: "player1Id, player2Id, and type required" }, { status: 400 });
  }

  // Store with consistent ordering so (A,B) and (B,A) don't create duplicates
  const [p1, p2] = [player1Id, player2Id].sort();

  try {
    const created = await prisma.playerOverride.create({
      data: { sessionId, player1Id: p1, player2Id: p2, type: type as OverrideType },
    });
    const override = await prisma.playerOverride.findUnique({
      where: { id: created.id },
      include: { player1: true, player2: true },
    });
    return NextResponse.json(override, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Override already exists for this pair" }, { status: 400 });
    }
    throw e;
  }
}
