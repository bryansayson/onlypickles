import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { podId } = await request.json();
  const updated = await prisma.sessionPlayer.update({
    where: { id },
    data: { podId: podId ?? null },
  });
  return NextResponse.json(updated);
}
