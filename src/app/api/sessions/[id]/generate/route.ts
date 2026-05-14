import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateSchedule,
  generateSplitSchedule,
  roundsFromMinGames,
  roundsFromMinGamesSplit,
  generateFixedSchedule,
  roundsFromMinGamesFixed,
  RRTeam,
  RROverride,
} from "@/lib/roundRobin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const { mode, value, womensValue } = await request.json();

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      courts: { orderBy: { number: "asc" } },
      sessionPlayers: { include: { player: true } },
      teams: { include: { player1: true, player2: true } },
      playerOverrides: true,
    },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const courts = session.courts.map((c) => ({
    courtId: c.id,
    format: c.format as "MIXED" | "MENS" | "WOMENS",
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

    const mensTeamCount   = rrTeams.filter((t) => t.player1Gender === "MALE"   && t.player2Gender === "MALE").length;
    const womensTeamCount = rrTeams.filter((t) => t.player1Gender === "FEMALE" && t.player2Gender === "FEMALE").length;
    const mixedTeamCount  = rrTeams.filter((t) => t.player1Gender !== t.player2Gender).length;

    const roundsForSingle = Math.max(
      roundsForGroup(mensTeamCount, mensCourts),
      roundsForGroup(womensTeamCount, womensCourts),
      roundsForGroup(mixedTeamCount, mixedCourts),
      1
    );

    if (roundsForSingle === 1 && mensTeamCount + womensTeamCount + mixedTeamCount < 2) {
      return NextResponse.json({ error: "Need at least 2 teams and 1 court." }, { status: 400 });
    }

    const numRounds = mode === "double" ? roundsForSingle * 2 : roundsForSingle;
    const maxMatchups = mode === "double" ? 2 : 1;

    const schedule = generateFixedSchedule(rrTeams, courts, numRounds, maxMatchups);

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
    const mensCourts = courts.filter((c) => c.format === "MENS").length;
    const womensCourts = courts.filter((c) => c.format === "WOMENS").length;
    const mixedCourts = courts.filter((c) => c.format === "MIXED").length;

    // Males needed per round: 4 per MENS court + 2 per MIXED court
    const malesNeeded = mensCourts * 4 + mixedCourts * 2;
    // Females needed per round: 4 per WOMENS court + 2 per MIXED court
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
      schedule = generateSchedule(players, courts, numRounds, rrOverrides);
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
