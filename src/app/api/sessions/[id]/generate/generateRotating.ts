import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateSchedule,
  generateSplitSchedule,
  generatePodSchedules,
  roundsFromMinGames,
  roundsFromMinGamesSplit,
  RROverride,
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
};

type Result =
  | { ok: true; data: GameInsert[] }
  | { ok: false; response: NextResponse };

export function generateRotating(
  session: Session,
  courts: Court[],
  body: { mode?: string; value?: number; womensValue?: number }
): Result {
  const players = session.sessionPlayers.map((sp) => ({
    id: sp.playerId,
    gender: sp.player.gender as "MALE" | "FEMALE",
    division: (sp as typeof sp & { division?: "UPPER" | "LOWER" | null }).division ?? null,
  }));

  if (players.length === 0) {
    return { ok: false, response: NextResponse.json({ error: "Add players to the session first." }, { status: 400 }) };
  }

  const males   = players.filter((p) => p.gender === "MALE").length;
  const females = players.filter((p) => p.gender === "FEMALE").length;
  const mensCourts  = courts.filter((c) => c.format === "MENS").length;
  const womensCourts = courts.filter((c) => c.format === "WOMENS").length;
  const mixedCourts = courts.filter((c) => c.format === "MIXED").length;

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
    return { ok: false, response: NextResponse.json({ error: errors.join(". ") }, { status: 400 }) };
  }

  const rrOverrides: RROverride[] = session.playerOverrides.map((o) => ({
    player1Id: o.player1Id,
    player2Id: o.player2Id,
    type: o.type as "MUST_PARTNER" | "MUST_NOT_PARTNER",
  }));

  const spPodMap = new Map<string, string>();
  for (const sp of session.sessionPlayers) {
    if ((sp as typeof sp & { podId?: string | null }).podId) {
      spPodMap.set(sp.playerId, (sp as typeof sp & { podId: string }).podId);
    }
  }
  const podPlayerGroups = session.pods
    .map((p) => ({
      podId: p.id,
      playerIds: session.sessionPlayers
        .filter((sp) => spPodMap.get(sp.playerId) === p.id)
        .map((sp) => sp.playerId),
    }))
    .filter((g) => g.playerIds.length > 0);
  const usePods = podPlayerGroups.length > 0;

  const { mode, value, womensValue } = body;

  let schedule: ReturnType<typeof generateSchedule>;

  if (mode === "splitExactRounds") {
    schedule = generateSplitSchedule(players, courts, value!, womensValue ?? value!, rrOverrides);
  } else {
    let numRounds: number;
    if (mode === "splitMinGames") {
      const malePlayers  = players.filter((p) => p.gender === "MALE");
      const femalePlayers = players.filter((p) => p.gender === "FEMALE");
      const rrMensCourts   = courts.filter((c) => c.format === "MENS");
      const rrWomensCourts = courts.filter((c) => c.format === "WOMENS");
      numRounds = roundsFromMinGamesSplit(malePlayers, femalePlayers, rrMensCourts, rrWomensCourts, value!, womensValue ?? value!);
    } else if (mode === "minGames") {
      numRounds = roundsFromMinGames(players, courts, value!);
    } else {
      numRounds = value!;
    }

    schedule = usePods
      ? generatePodSchedules(players, podPlayerGroups.map((g) => ({ playerIds: g.playerIds })), courts, numRounds, rrOverrides)
      : generateSchedule(players, courts, numRounds, rrOverrides);
  }

  const data = schedule.flatMap((round, roundIdx) =>
    round.map((game) => ({
      courtId: game.courtId,
      roundNumber: roundIdx + 1,
      team1Player1Id: game.team1[0],
      team1Player2Id: game.team1[1],
      team2Player1Id: game.team2[0],
      team2Player2Id: game.team2[1],
    }))
  );

  return { ok: true, data };
}
