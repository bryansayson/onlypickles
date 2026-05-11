import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Gender, CourtFormat } from "@/generated/prisma";

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Distribute players as evenly as possible across courts (round-robin fill).
function distributeEvenly(players: { id: string }[], courts: { id: string }[]): Map<string, string> {
  const assignments = new Map<string, string>(); // playerId -> courtId
  players.forEach((p, i) => {
    assignments.set(p.id, courts[i % courts.length].id);
  });
  return assignments;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const body = await request.json();

  // Manual assignment: { playerId, courtId | null }
  if (body.type === "manual") {
    const { playerId, courtId } = body;
    await prisma.sessionPlayer.updateMany({
      where: { sessionId, playerId },
      data: { courtId: courtId ?? null },
    });
    return NextResponse.json({ ok: true });
  }

  // Auto-assign: distribute evenly by gender eligibility across courts.
  if (body.type === "auto") {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        courts: { orderBy: { number: "asc" } },
        sessionPlayers: { include: { player: true } },
      },
    });
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.sessionPlayer.updateMany({
      where: { sessionId },
      data: { courtId: null },
    });

    const players = session.sessionPlayers.map((sp) => sp.player);
    const courts = session.courts;

    const males = shuffle(players.filter((p) => p.gender === Gender.MALE));
    const females = shuffle(players.filter((p) => p.gender === Gender.FEMALE));

    const mensCourts = courts.filter((c) => c.format === CourtFormat.MENS);
    const womensCourts = courts.filter((c) => c.format === CourtFormat.WOMENS);
    const mixedCourts = courts.filter((c) => c.format === CourtFormat.MIXED);

    const assignments = new Map<string, string>();

    // Gender-specific courts first so mixed courts absorb whatever's left.
    if (mensCourts.length > 0) {
      for (const [id, courtId] of distributeEvenly(males, mensCourts)) {
        assignments.set(id, courtId);
      }
    }
    if (womensCourts.length > 0) {
      for (const [id, courtId] of distributeEvenly(females, womensCourts)) {
        assignments.set(id, courtId);
      }
    }

    if (mixedCourts.length > 0) {
      const unassignedMales = males.filter((p) => !assignments.has(p.id));
      const unassignedFemales = females.filter((p) => !assignments.has(p.id));

      // Each team on a mixed court is 1M+1F, so courts need equal M and F.
      // Only use as many of each gender as the smaller pool allows — extras stay unassigned.
      const pairs = Math.min(unassignedMales.length, unassignedFemales.length);
      const pairedMales = unassignedMales.slice(0, pairs);
      const pairedFemales = unassignedFemales.slice(0, pairs);

      // Distribute each gender separately so each court gets ~equal M and ~equal F.
      for (const [id, courtId] of distributeEvenly(pairedMales, mixedCourts)) {
        assignments.set(id, courtId);
      }
      for (const [id, courtId] of distributeEvenly(pairedFemales, mixedCourts)) {
        assignments.set(id, courtId);
      }
    }

    for (const [playerId, courtId] of assignments.entries()) {
      await prisma.sessionPlayer.updateMany({
        where: { sessionId, playerId },
        data: { courtId },
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
