import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { QrPrint } from "./QrPrint";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    select: { id: true, name: true, date: true },
  });
  if (!session) notFound();

  return (
    <QrPrint
      sessionId={session.id}
      sessionName={session.name}
      sessionDate={session.date.toISOString()}
    />
  );
}
