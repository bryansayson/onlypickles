import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const { format } = await request.json();
  if (!format) {
    return NextResponse.json({ error: "format required" }, { status: 400 });
  }

  // Next court number = max existing + 1
  const existing = await prisma.court.findMany({
    where: { sessionId },
    orderBy: { number: "desc" },
    take: 1,
  });
  const number = existing.length > 0 ? existing[0].number + 1 : 1;

  const court = await prisma.court.create({
    data: { sessionId, number, format },
  });
  return NextResponse.json(court, { status: 201 });
}
