import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      courts: { orderBy: { number: "asc" } },
      sessionPlayers: { include: { player: true } },
      teams: { include: { player1: true, player2: true } },
      playerOverrides: { include: { player1: true, player2: true } },
      pods: { include: { sessionPlayers: true, teams: true }, orderBy: { name: "asc" } },
    },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(session);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name?.trim() || null;
  if (body.date) data.date = body.date;
  if (body.endTime !== undefined) data.endTime = body.endTime ?? null;
  if (body.sessionFormat) data.sessionFormat = body.sessionFormat;
  if (body.hasMedalRound !== undefined) data.hasMedalRound = body.hasMedalRound;
  if (body.hasDivisions !== undefined) data.hasDivisions = body.hasDivisions;
  const session = await prisma.session.update({ where: { id }, data });
  return NextResponse.json(session);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.session.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
