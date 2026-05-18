import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if ("podId" in body) data.podId = body.podId ?? null;
  if ("division" in body) data.division = body.division ?? null;
  const updated = await prisma.sessionPlayer.update({ where: { id }, data });
  return NextResponse.json(updated);
}
