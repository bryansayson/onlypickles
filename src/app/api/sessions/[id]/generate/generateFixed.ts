import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateFixedSchedule,
  generateFixedPodSchedules,
  RRTeam,
} from "@/lib/roundRobin";

const _q = () =>
  prisma.session.findUnique({
    where: { id: "" },
    include: {
      courts: { orderBy: { number: "asc" as const } },
      sessionPlayers: { include: { player: true } },
      teams: { include: { player1: true, player2: true } },
      playerOverrides: true,
      pods: { include: { sessionPlayers: true, teams: true } },
    },
  });

type Session = NonNullable<Awaited<ReturnType<typeof _q>>>;

type Court = { courtId: string; format: "MIXED" | "MENS" | "WOMENS" | "ANY" };

type GameInsert = {
  courtId: string;
  roundNumber: number;
  team1Player1Id: string;
  team1Player2Id: string;
  team2Player1Id: string;
  team2Player2Id: string;
  team1Id: string;
  team2Id: string;
};

type Result =
  | { ok: true; data: GameInsert[] }
  | { ok: false; response: NextResponse };

function roundsForGroup(teamCount: number, courtCount: number): number {
  if (teamCount < 2 || courtCount === 0) return 0;
  const gamesPerRound = Math.min(courtCount, Math.floor(teamCount / 2));
  const pairs = (teamCount * (teamCount - 1)) / 2;
  return Math.ceil(pairs / gamesPerRound);
}

export function generateFixed(
  session: Session,
  courts: Court[],
  body: { mode?: string; podMatchups?: { podId: string; matchups: number }[]; unassignedMatchups?: number }
): Result {
  if (session.teams.length < 2) {
    return { ok: false, response: NextResponse.json({ error: "Create at least 2 teams first." }, { status: 400 }) };
  }

  const rrTeams: RRTeam[] = session.teams.map((t) => ({
    teamId: t.id,
    player1Id: t.player1Id,
    player2Id: t.player2Id,
    player1Gender: t.player1.gender as "MALE" | "FEMALE",
    player2Gender: t.player2.gender as "MALE" | "FEMALE",
  }));

  const mensCourts   = courts.filter((c) => c.format === "MENS").length;
  const womensCourts = courts.filter((c) => c.format === "WOMENS").length;
  const mixedCourts  = courts.filter((c) => c.format === "MIXED").length;
  const anyCourts    = courts.filter((c) => c.format === "ANY").length;

  const mensTeamCount   = rrTeams.filter((t) => t.player1Gender === "MALE"   && t.player2Gender === "MALE").length;
  const womensTeamCount = rrTeams.filter((t) => t.player1Gender === "FEMALE" && t.player2Gender === "FEMALE").length;
  const mixedTeamCount  = rrTeams.filter((t) => t.player1Gender !== t.player2Gender).length;
  const anyTeamCount    = anyCourts > 0 ? rrTeams.length : 0;

  const roundsForSingle = Math.max(
    roundsForGroup(mensTeamCount, mensCourts),
    roundsForGroup(womensTeamCount, womensCourts),
    roundsForGroup(mixedTeamCount, mixedCourts),
    roundsForGroup(anyTeamCount, anyCourts),
    1
  );

  if (roundsForSingle === 1 && mensTeamCount + womensTeamCount + mixedTeamCount < 2) {
    return { ok: false, response: NextResponse.json({ error: "Need at least 2 teams and 1 court." }, { status: 400 }) };
  }

  const podMatchupsMap = new Map<string, number>(
    (body.podMatchups ?? []).map((pm) => [pm.podId, pm.matchups])
  );

  const teamPodMap = new Map<string, string>();
  for (const t of session.teams) {
    if ((t as typeof t & { podId?: string | null }).podId) {
      teamPodMap.set(t.id, (t as typeof t & { podId: string }).podId);
    }
  }

  const podTeamGroups = session.pods
    .map((p) => ({
      podId: p.id,
      teamIds: session.teams.filter((t) => teamPodMap.get(t.id) === p.id).map((t) => t.id),
    }))
    .filter((g) => g.teamIds.length > 0);

  const hasPods = podTeamGroups.length > 0;
  const { mode } = body;

  const globalMaxMatchups = hasPods ? 1 : mode === "triple" ? 3 : mode === "double" ? 2 : 1;
  const numRounds = hasPods
    ? roundsForSingle * 3 + 10
    : mode === "triple" ? roundsForSingle * 3 : mode === "double" ? roundsForSingle * 2 : roundsForSingle;

  const schedule = hasPods
    ? generateFixedPodSchedules(
        rrTeams,
        podTeamGroups.map((g) => ({ teamIds: g.teamIds, maxMatchups: podMatchupsMap.get(g.podId) ?? 1 })),
        courts,
        numRounds,
        1,
        body.unassignedMatchups ?? 1
      )
    : generateFixedSchedule(rrTeams, courts, numRounds, globalMaxMatchups);

  const data = schedule.flatMap((round, roundIdx) =>
    round.map((game) => ({
      courtId: game.courtId,
      roundNumber: roundIdx + 1,
      team1Player1Id: game.team1.player1Id,
      team1Player2Id: game.team1.player2Id,
      team2Player1Id: game.team2.player1Id,
      team2Player2Id: game.team2.player2Id,
      team1Id: game.team1.teamId,
      team2Id: game.team2.teamId,
    }))
  );

  return { ok: true, data };
}
