import { NextResponse } from "next/server";
import { CourtFormat } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const sessions = await prisma.session.findMany({
    orderBy: { date: "desc" },
    include: {
      courts: true,
      sessionPlayers: { include: { player: true } },
    },
  });
  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { date, endTime, courts, sessionFormat } = body;
  if (!date || !courts?.length) {
    return NextResponse.json({ error: "date and courts required" }, { status: 400 });
  }
  // Create session first, then courts separately — HTTP adapter doesn't support transactions
  const session = await prisma.session.create({
    data: {
      date: new Date(date),
      endTime: endTime ? new Date(endTime) : null,
      sessionFormat: sessionFormat ?? "ROTATING",
    },
  });
  await Promise.all(
    courts.map((c: { number: number; format: string }) =>
      prisma.court.create({ data: { sessionId: session.id, number: c.number, format: c.format as CourtFormat } })
    )
  );
  const full = await prisma.session.findUnique({ where: { id: session.id }, include: { courts: true } });
  return NextResponse.json(full, { status: 201 });
}
