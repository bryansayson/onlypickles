import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateSchedule,
  generateSplitSchedule,
  roundsFromMinGames,
  roundsFromMinGamesSplit,
  generateFixedSchedule,
  roundsFromMinGamesFixed,
  generatePodSchedules,
  generateFixedPodSchedules,
  RRTeam,
  RROverride,
} from "@/lib/roundRobin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const { mode, value, womensValue, podMatchups, unassignedMatchups } = await request.json();

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      courts: { orderBy: { number: "asc" } },
      sessionPlayers: { include: { player: true } },
      teams: { include: { player1: true, player2: true } },
      playerOverrides: true,
      pods: { include: { sessionPlayers: true, teams: true } },
    },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const courts = session.courts.map((c) => ({
    courtId: c.id,
    format: c.format as "MIXED" | "MENS" | "WOMENS" | "ANY",
  }));

  if (courts.length === 0) {
    return NextResponse.json({ error: "Add at least one court first." }, { status: 400 });
  }

  // Relation filters on deleteMany may require transactions — use direct courtId IN instead
  const courtIds = session.courts.map((c) => c.id);
  if (courtIds.length > 0) {
    await prisma.game.deleteMany({ where: { courtId: { in: courtIds } } });
  }

  // ── Fixed partners ──────────────────────────────────────────────────────────
  if (session.sessionFormat === "FIXED") {
    if (session.teams.length < 2) {
      return NextResponse.json({ error: "Create at least 2 teams first." }, { status: 400 });
    }

    const rrTeams: RRTeam[] = session.teams.map((t) => ({
      teamId: t.id,
      player1Id: t.player1Id,
      player2Id: t.player2Id,
      player1Gender: t.player1.gender as "MALE" | "FEMALE",
      player2Gender: t.player2.gender as "MALE" | "FEMALE",
    }));

    if (courts.length === 0) {
      return NextResponse.json({ error: "Need at least 1 court." }, { status: 400 });
    }

    // Calculate rounds per gender group independently — men's teams only face
    // men's teams (on MENS courts), women's only face women's, mixed face mixed.
    function roundsForGroup(teamCount: number, courtCount: number): number {
      if (teamCount < 2 || courtCount === 0) return 0;
      const gamesPerRound = Math.min(courtCount, Math.floor(teamCount / 2));
      const pairs = (teamCount * (teamCount - 1)) / 2;
      return Math.ceil(pairs / gamesPerRound);
    }

    const mensCourts   = courts.filter((c) => c.format === "MENS").length;
    const womensCourts = courts.filter((c) => c.format === "WOMENS").length;
    const mixedCourts  = courts.filter((c) => c.format === "MIXED").length;
    const anyCourts    = courts.filter((c) => c.format === "ANY").length;

    const mensTeamCount   = rrTeams.filter((t) => t.player1Gender === "MALE"   && t.player2Gender === "MALE").length;
    const womensTeamCount = rrTeams.filter((t) => t.player1Gender === "FEMALE" && t.player2Gender === "FEMALE").length;
    const mixedTeamCount  = rrTeams.filter((t) => t.player1Gender !== t.player2Gender).length;
    // ANY courts can host any team type — use total team count for round calculation.
    const anyTeamCount    = anyCourts > 0 ? rrTeams.length : 0;

    const roundsForSingle = Math.max(
      roundsForGroup(mensTeamCount, mensCourts),
      roundsForGroup(womensTeamCount, womensCourts),
      roundsForGroup(mixedTeamCount, mixedCourts),
      roundsForGroup(anyTeamCount, anyCourts),
      1
    );

    if (roundsForSingle === 1 && mensTeamCount + womensTeamCount + mixedTeamCount < 2) {
      return NextResponse.json({ error: "Need at least 2 teams and 1 court." }, { status: 400 });
    }

    // Per-pod matchups come from the dialog; fall back to global mode for no-pod sessions.
    const podMatchupsMap = new Map<string, number>(
      (podMatchups ?? []).map((pm: { podId: string; matchups: number }) => [pm.podId, pm.matchups])
    );

    // Compute pod membership from team.podId (scalar field, always present)
    const teamPodMap = new Map<string, string>(); // teamId → podId
    for (const t of session.teams) {
      if ((t as typeof t & { podId?: string | null }).podId) {
        teamPodMap.set(t.id, (t as typeof t & { podId: string }).podId);
      }
    }
    const podTeamGroups = session.pods
      .map((p) => ({ podId: p.id, teamIds: session.teams.filter((t) => teamPodMap.get(t.id) === p.id).map((t) => t.id) }))
      .filter((g) => g.teamIds.length > 0);

    const hasPodConfig = podTeamGroups.length > 0;

    // For sessions without pods, fall back to the global mode setting.
    const globalMaxMatchups = hasPodConfig ? 1 : mode === "triple" ? 3 : mode === "double" ? 2 : 1;
    const numRounds = hasPodConfig
      ? roundsForSingle * 3 + 10  // generous cap; scheduler self-terminates
      : mode === "triple" ? roundsForSingle * 3 : mode === "double" ? roundsForSingle * 2 : roundsForSingle;

    const schedule = hasPodConfig
      ? generateFixedPodSchedules(
          rrTeams,
          podTeamGroups.map((g) => ({
            teamIds: g.teamIds,
            maxMatchups: podMatchupsMap.get(g.podId) ?? 1,
          })),
          courts,
          numRounds,
          1, // defaultMaxMatchups
          unassignedMatchups ?? 1
        )
      : generateFixedSchedule(rrTeams, courts, numRounds, globalMaxMatchups);

    const gameData = schedule.flatMap((round, roundIdx) =>
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

    for (const game of gameData) await prisma.game.create({ data: game });
  } else {
    // ── Rotating partners ─────────────────────────────────────────────────────
    const players = session.sessionPlayers.map((sp) => ({
      id: sp.playerId,
      gender: sp.player.gender as "MALE" | "FEMALE",
    }));

    if (players.length === 0) {
      return NextResponse.json({ error: "Add players to the session first." }, { status: 400 });
    }

    const males = players.filter((p) => p.gender === "MALE").length;
    const females = players.filter((p) => p.gender === "FEMALE").length;
    const mensCourts   = courts.filter((c) => c.format === "MENS").length;
    const womensCourts = courts.filter((c) => c.format === "WOMENS").length;
    const mixedCourts  = courts.filter((c) => c.format === "MIXED").length;
    // ANY courts don't have gender requirements — skip strict validation for them

    // Males needed per round from gender-specific courts only
    const malesNeeded   = mensCourts * 4 + mixedCourts * 2;
    const femalesNeeded = womensCourts * 4 + mixedCourts * 2;

    const errors: string[] = [];
    if (malesNeeded > 0 && males < 4 && mensCourts > 0)
      errors.push(`Men's courts need at least 4 male players (have ${males})`);
    if (femalesNeeded > 0 && females < 4 && womensCourts > 0)
      errors.push(`Women's courts need at least 4 female players (have ${females})`);
    if (mixedCourts > 0 && (males < 2 || females < 2))
      errors.push(`Mixed courts need at least 2 men and 2 women (have ${males}M, ${females}F)`);
    if (malesNeeded > males)
      errors.push(`${mensCourts} men's + ${mixedCourts} mixed court(s) need ${malesNeeded} men per round but only ${males} are in the session — add ${malesNeeded - males} more men or remove a court`);
    if (femalesNeeded > females)
      errors.push(`${womensCourts} women's + ${mixedCourts} mixed court(s) need ${femalesNeeded} women per round but only ${females} are in the session — add ${femalesNeeded - females} more women or remove a court`);

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(". ") }, { status: 400 });
    }

    const rrOverrides: RROverride[] = session.playerOverrides.map((o) => ({
      player1Id: o.player1Id,
      player2Id: o.player2Id,
      type: o.type as "MUST_PARTNER" | "MUST_NOT_PARTNER",
    }));

    let schedule: ReturnType<typeof generateSchedule>;

    // Compute pod membership from sessionPlayer.podId (scalar field, always present)
    const spPodMap = new Map<string, string>(); // playerId → podId
    for (const sp of session.sessionPlayers) {
      if ((sp as typeof sp & { podId?: string | null }).podId) {
        spPodMap.set(sp.playerId, (sp as typeof sp & { podId: string }).podId);
      }
    }
    const podPlayerGroups = session.pods
      .map((p) => ({ podId: p.id, playerIds: session.sessionPlayers.filter((sp) => spPodMap.get(sp.playerId) === p.id).map((sp) => sp.playerId) }))
      .filter((g) => g.playerIds.length > 0);
    const usePods = podPlayerGroups.length > 0;

    if (mode === "splitExactRounds") {
      schedule = generateSplitSchedule(players, courts, value, womensValue ?? value, rrOverrides);
    } else {
      let numRounds: number;
      if (mode === "splitMinGames") {
        const malePlayers = players.filter((p) => p.gender === "MALE");
        const femalePlayers = players.filter((p) => p.gender === "FEMALE");
        const rrMensCourts = courts.filter((c) => c.format === "MENS");
        const rrWomensCourts = courts.filter((c) => c.format === "WOMENS");
        numRounds = roundsFromMinGamesSplit(
          malePlayers, femalePlayers,
          rrMensCourts, rrWomensCourts,
          value, womensValue ?? value
        );
      } else if (mode === "minGames") {
        numRounds = roundsFromMinGames(players, courts, value);
      } else {
        numRounds = value;
      }

      if (usePods) {
        schedule = generatePodSchedules(
          players,
          podPlayerGroups.map((g) => ({ playerIds: g.playerIds })),
          courts,
          numRounds,
          rrOverrides
        );
      } else {
        schedule = generateSchedule(players, courts, numRounds, rrOverrides);
      }
    }

    const gameData = schedule.flatMap((round, roundIdx) =>
      round.map((game) => ({
        courtId: game.courtId,
        roundNumber: roundIdx + 1,
        team1Player1Id: game.team1[0],
        team1Player2Id: game.team1[1],
        team2Player1Id: game.team2[0],
        team2Player2Id: game.team2[1],
      }))
    );

    for (const game of gameData) await prisma.game.create({ data: game });
  }

  const games = await prisma.game.findMany({
    where: { court: { sessionId } },
    include: {
      team1Player1: true,
      team1Player2: true,
      team2Player1: true,
      team2Player2: true,
      court: true,
    },
    orderBy: [{ roundNumber: "asc" }, { court: { number: "asc" } }],
  });

  return NextResponse.json({ games });
}
