import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Unassign any players on this court before deleting
  await prisma.sessionPlayer.updateMany({
    where: { courtId: id },
    data: { courtId: null },
  });

  await prisma.court.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { format } = await request.json();
  const court = await prisma.court.update({
    where: { id },
    data: { format },
  });
  return NextResponse.json(court);
}
