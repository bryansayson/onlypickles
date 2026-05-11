import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const players = await prisma.player.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(players);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, gender } = body;
  if (!name || !gender) {
    return NextResponse.json({ error: "name and gender required" }, { status: 400 });
  }
  const player = await prisma.player.create({ data: { name, gender } });
  return NextResponse.json(player, { status: 201 });
}
