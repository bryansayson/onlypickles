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
  body: { mode?: string; value?: number; womensValue?: number; maxGamesPerPlayer?: number }
): Result {
  const hasDivisions = (session as typeof session & { hasDivisions?: boolean }).hasDivisions ?? false;

  const players = session.sessionPlayers
    .filter((sp) => {
      if (!hasDivisions) return true;
      // When divisions are active, exclude players not assigned to a division
      const div = (sp as typeof sp & { division?: "UPPER" | "LOWER" | null }).division;
      return div === "UPPER" || div === "LOWER";
    })
    .map((sp) => ({
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

  // Compute the per-player game cap server-side from actual player/court/round data.
  // For each gender×division group, the ceiling of (slots_per_round × rounds / group_size)
  // is the most games any player in that group can get. We cap at the highest of these.
  function computeCap(numRounds: number): number {
    const groups: number[] = [];
    const addGroup = (slots: number, size: number) => {
      if (size > 0 && slots > 0) groups.push(Math.ceil((slots * numRounds) / size));
    };

    for (const gender of ["MALE", "FEMALE"] as const) {
      const gPlayers = players.filter((p) => p.gender === gender);
      if (gPlayers.length === 0) continue;

      const upper = gPlayers.filter((p) => p.division === "UPPER");
      const lower = gPlayers.filter((p) => p.division === "LOWER");
      const hasDivs = upper.length > 0 && lower.length > 0;

      // How many of this gender play per round across all relevant courts
      const genderCourts = courts.filter((c) =>
        c.format === (gender === "MALE" ? "MENS" : "WOMENS")
      );
      const mixedCourts = courts.filter((c) => c.format === "MIXED");
      const anyCourts = courts.filter((c) => c.format === "ANY");
      const slotsPerRound =
        genderCourts.length * 4 +
        mixedCourts.length * 2 +
        anyCourts.length * 4;

      // Overall cap: no player exceeds the average ceiling regardless of court type
      addGroup(slotsPerRound, gPlayers.length);

      if (hasDivs) {
        // Per-division cap for gender-specific/mixed courts (stricter when pools are unequal)
        const divSlots = genderCourts.length * 2 + mixedCourts.length * 1;
        if (divSlots > 0) {
          addGroup(divSlots, upper.length);
          addGroup(divSlots, lower.length);
        }
      }
    }

    return groups.length > 0 ? Math.max(...groups) : Infinity;
  }

  let schedule: ReturnType<typeof generateSchedule>;

  if (mode === "splitExactRounds") {
    const mRounds = value!;
    const wRounds = womensValue ?? value!;

    const males   = players.filter((p) => p.gender === "MALE");
    const females = players.filter((p) => p.gender === "FEMALE");
    const mensCts   = courts.filter((c) => c.format === "MENS");
    const womensCts = courts.filter((c) => c.format === "WOMENS");

    function capForGroup(
      gPlayers: { id: string; gender: "MALE" | "FEMALE"; division: "UPPER" | "LOWER" | null }[],
      gCts: { courtId: string; format: "MIXED" | "MENS" | "WOMENS" | "ANY" }[],
      numRounds: number,
    ): number {
      const gs: number[] = [];
      const add = (slots: number, size: number) => {
        if (slots > 0 && size > 0) gs.push(Math.ceil((slots * numRounds) / size));
      };
      add(gCts.length * 4, gPlayers.length);
      const upper = gPlayers.filter((p) => p.division === "UPPER");
      const lower = gPlayers.filter((p) => p.division === "LOWER");
      if (upper.length > 0 && lower.length > 0 && gCts.length > 0) {
        add(gCts.length * 2, upper.length);
        add(gCts.length * 2, lower.length);
      }
      return gs.length > 0 ? Math.max(...gs) : Infinity;
    }

    const mCap = capForGroup(males, mensCts, mRounds);
    const wCap = capForGroup(females, womensCts, wRounds);

    const mSched = mRounds > 0 && males.length > 0 && mensCts.length > 0
      ? generateSchedule(males, mensCts, mRounds, rrOverrides, mCap)
      : [];
    const wSched = wRounds > 0 && females.length > 0 && womensCts.length > 0
      ? generateSchedule(females, womensCts, wRounds, rrOverrides, wCap)
      : [];

    const total = Math.max(mRounds, wRounds);
    schedule = Array.from({ length: total }, (_, i) => [
      ...(mSched[i] ?? []),
      ...(wSched[i] ?? []),
    ]);
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

    const cap = computeCap(numRounds);

    schedule = usePods
      ? generatePodSchedules(players, podPlayerGroups.map((g) => ({ playerIds: g.playerIds })), courts, numRounds, rrOverrides, cap)
      : generateSchedule(players, courts, numRounds, rrOverrides, cap);
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
