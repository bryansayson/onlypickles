import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const { playerIds } = await request.json();
  if (!Array.isArray(playerIds)) {
    return NextResponse.json({ error: "playerIds array required" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { id: sessionId }, select: { hasDivisions: true } });
  const division = session?.hasDivisions ? "LOWER" : undefined;

  // HTTP adapter doesn't support transactions, so upsert is unavailable.
  // Try to create each; silently skip if already exists (P2002 = unique violation).
  for (const playerId of playerIds as string[]) {
    try {
      await prisma.sessionPlayer.create({ data: { sessionId, playerId, ...(division ? { division } : {}) } });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code !== "P2002") throw e;
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const { playerId } = await request.json();
  await prisma.sessionPlayer.deleteMany({ where: { sessionId, playerId } });
  return NextResponse.json({ ok: true });
}
