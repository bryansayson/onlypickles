import { NextResponse } from "next/server";
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
  const session = await prisma.session.create({
    data: {
      date: new Date(date),
      endTime: endTime ? new Date(endTime) : null,
      sessionFormat: sessionFormat ?? "ROTATING",
      courts: {
        create: courts.map((c: { number: number; format: string }) => ({
          number: c.number,
          format: c.format,
        })),
      },
    },
    include: { courts: true },
  });
  return NextResponse.json(session, { status: 201 });
}
