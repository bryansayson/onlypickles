import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name } = await request.json();
  const pod = await prisma.pod.update({ where: { id }, data: { name: name.trim() } });
  return NextResponse.json(pod);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.pod.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
