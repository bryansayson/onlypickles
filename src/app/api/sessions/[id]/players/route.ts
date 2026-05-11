import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const { playerIds } = await request.json();
  if (!Array.isArray(playerIds)) {
    return NextResponse.json({ error: "playerIds array required" }, { status: 400 });
  }

  // Upsert — add players not already in session
  for (const playerId of playerIds as string[]) {
    await prisma.sessionPlayer.upsert({
      where: { sessionId_playerId: { sessionId, playerId } },
      create: { sessionId, playerId },
      update: {},
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const { playerId } = await request.json();
  await prisma.sessionPlayer.deleteMany({ where: { sessionId, playerId } });
  return NextResponse.json({ ok: true });
}
