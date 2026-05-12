import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MedalRoundType } from "@/generated/prisma/enums";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const round = await prisma.medalRound.findUnique({ where: { sessionId } });
  return NextResponse.json(round ?? null);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const { type, data } = await request.json();

  const existing = await prisma.medalRound.findUnique({ where: { sessionId } });
  if (existing) {
    const existingData = existing.data as Record<string, unknown>;
    const history = existingData.history ?? [];
    const round = await prisma.medalRound.update({
      where: { sessionId },
      data: { type: type as MedalRoundType, data: { ...data, history } },
    });
    return NextResponse.json(round, { status: 201 });
  }

  const round = await prisma.medalRound.create({
    data: { sessionId, type: type as MedalRoundType, data },
  });
  return NextResponse.json(round, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const body = await request.json();

  const existing = await prisma.medalRound.findUnique({ where: { sessionId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const currentData = existing.data as Record<string, unknown>;

  // History deletion
  if (body.deleteHistoryIndex !== undefined) {
    const history = (currentData.history ?? []) as unknown[];
    const newData = { ...currentData, history: history.filter((_, i) => i !== body.deleteHistoryIndex) };
    const round = await prisma.medalRound.update({
      where: { sessionId },
      data: { data: newData as Parameters<typeof prisma.medalRound.update>[0]["data"]["data"] },
    });
    return NextResponse.json(round);
  }

  const { game, team1Score, team2Score, bracket } = body;

  function winner(g: Record<string, unknown>) {
    if (g.team1Score === null || g.team2Score === null) return null;
    return (g.team1Score as number) >= (g.team2Score as number) ? g.team1Id : g.team2Id;
  }
  function loser(g: Record<string, unknown>) {
    if (g.team1Score === null || g.team2Score === null) return null;
    return (g.team1Score as number) < (g.team2Score as number) ? g.team1Id : g.team2Id;
  }

  function applyToSubBracket(sub: Record<string, unknown>): Record<string, unknown> {
    const gameData = (sub[game] ?? {}) as Record<string, unknown>;
    const updatedGame = { ...gameData, team1Score: team1Score ?? null, team2Score: team2Score ?? null };
    let updated = { ...sub, [game]: updatedGame };
    if (game === "semi1" || game === "semi2") {
      const s1 = game === "semi1" ? updatedGame : (sub.semi1 ?? {}) as Record<string, unknown>;
      const s2 = game === "semi2" ? updatedGame : (sub.semi2 ?? {}) as Record<string, unknown>;
      updated = {
        ...updated,
        gold: { ...(sub.gold ?? {}) as Record<string, unknown>, team1Id: winner(s1), team2Id: winner(s2), team1Score: null, team2Score: null },
        bronze: { ...(sub.bronze ?? {}) as Record<string, unknown>, team1Id: loser(s1), team2Id: loser(s2), team1Score: null, team2Score: null },
      };
    }
    return updated;
  }

  let newData: Record<string, unknown>;
  if (bracket === "mens" || bracket === "womens") {
    const sub = (currentData[bracket] ?? {}) as Record<string, unknown>;
    newData = { ...currentData, [bracket]: applyToSubBracket(sub) } as Record<string, unknown>;
  } else {
    newData = applyToSubBracket(currentData);
  }

  const round = await prisma.medalRound.update({
    where: { sessionId },
    data: { data: newData as Parameters<typeof prisma.medalRound.update>[0]["data"]["data"] },
  });
  return NextResponse.json(round);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const existing = await prisma.medalRound.findUnique({ where: { sessionId } });
  if (!existing) return NextResponse.json({ ok: true });

  const currentData = existing.data as Record<string, unknown>;
  const history = (currentData.history ?? []) as unknown[];

  // Archive everything except the history array itself
  const archived = {
    type: existing.type,
    savedAt: new Date().toISOString(),
    ...Object.fromEntries(Object.entries(currentData).filter(([k]) => k !== "history")),
  };

  const round = await prisma.medalRound.update({
    where: { sessionId },
    data: { data: { history: [...history, archived] } as Parameters<typeof prisma.medalRound.update>[0]["data"]["data"] },
  });
  return NextResponse.json(round);
}
