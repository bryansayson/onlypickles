import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const pods = await prisma.pod.findMany({
    where: { sessionId },
    include: { sessionPlayers: true, teams: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(pods);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const { name } = await request.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const created = await prisma.pod.create({
    data: { sessionId, name: name.trim() },
  });
  const pod = await prisma.pod.findUnique({
    where: { id: created.id },
    include: { sessionPlayers: true, teams: true },
  });
  return NextResponse.json(pod);
}
