/**
 * Round robin scheduler.
 *
 * Players are one shared pool — courts are format slots filled each round.
 * MENS: 4 males. WOMENS: 4 females. MIXED: 2M + 2F (teams are 1M+1F).
 *
 * Per round, for each court we exhaustively evaluate every valid 4-player
 * combination and team split, then pick the one that minimises repeat pairings
 * while favouring players who have sat out the most.
 */

export interface RRPlayer {
  id: string;
  gender: "MALE" | "FEMALE";
}

export interface RRCourt {
  courtId: string;
  format: "MIXED" | "MENS" | "WOMENS" | "ANY";
}

export interface RROverride {
  player1Id: string;
  player2Id: string;
  type: "MUST_PARTNER" | "MUST_NOT_PARTNER";
}

interface Game {
  courtId: string;
  team1: [string, string];
  team2: [string, string];
}

type Round = Game[];

// Cap the candidate pool for exhaustive search so runtime stays fast even
// with large groups. We always keep the most-underplayed players first.
const MAX_CANDIDATES = 20;

export function generateSchedule(
  players: RRPlayer[],
  courts: RRCourt[],
  numRounds: number,
  overrides: RROverride[] = []
): Round[] {
  const genders = Object.fromEntries(players.map((p) => [p.id, p.gender]));

  const partnerCount = new Map<string, number>();
  const opponentCount = new Map<string, number>();
  const sitOutCount = new Map<string, number>();
  for (const p of players) sitOutCount.set(p.id, 0);

  function pairKey(a: string, b: string) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }
  function get(map: Map<string, number>, a: string, b: string) {
    return map.get(pairKey(a, b)) ?? 0;
  }
  function inc(map: Map<string, number>, a: string, b: string) {
    const k = pairKey(a, b);
    map.set(k, (map.get(k) ?? 0) + 1);
  }

  // Lower score = better. Partner repeats penalised more heavily than opponent
  // repeats because partners directly determine the "unique people" experience.
  // Sit-out count subtracts from the score to favour underplayed players.
  // Overrides add a large penalty when violated so the search naturally avoids them.
  function gameScore(
    t1p1: string, t1p2: string,
    t2p1: string, t2p2: string
  ): number {
    let score =
      get(partnerCount, t1p1, t1p2) * 6 +
      get(partnerCount, t2p1, t2p2) * 6 +
      get(opponentCount, t1p1, t2p1) * 2 +
      get(opponentCount, t1p1, t2p2) * 2 +
      get(opponentCount, t1p2, t2p1) * 2 +
      get(opponentCount, t1p2, t2p2) * 2;

    for (const ov of overrides) {
      const { player1Id: a, player2Id: b, type } = ov;
      const t1Together = (t1p1 === a && t1p2 === b) || (t1p1 === b && t1p2 === a);
      const t2Together = (t2p1 === a && t2p2 === b) || (t2p1 === b && t2p2 === a);
      const bothInGame = [t1p1, t1p2, t2p1, t2p2].includes(a) && [t1p1, t1p2, t2p1, t2p2].includes(b);

      if (type === "MUST_NOT_PARTNER" && (t1Together || t2Together)) score += 10000;
      // MUST_PARTNER = partner at least once: penalise being split only until they've partnered
      if (type === "MUST_PARTNER" && bothInGame && !t1Together && !t2Together) {
        const alreadyPartnered = get(partnerCount, a, b) > 0;
        if (!alreadyPartnered) score += 10000;
      }
    }

    return score;
  }

  function sitBonus(ids: string[]): number {
    // Subtract from group score: more sit-outs → more preferred
    return -ids.reduce((s, id) => s + (sitOutCount.get(id) ?? 0), 0) * 3;
  }

  // Sort a pool by sit-out count descending, then cap size for perf.
  function candidates(pool: string[]): string[] {
    return [...pool]
      .sort((a, b) => (sitOutCount.get(b) ?? 0) - (sitOutCount.get(a) ?? 0))
      .slice(0, MAX_CANDIDATES);
  }

  // Exhaustive search over all C(n,4) combinations for a non-mixed court.
  function bestGameAny(
    pool: string[]
  ): { team1: [string, string]; team2: [string, string] } | null {
    const c = candidates(pool);
    if (c.length < 4) return null;

    let best: { team1: [string, string]; team2: [string, string] } | null = null;
    let bestScore = Infinity;

    for (let i = 0; i < c.length - 3; i++)
    for (let j = i + 1; j < c.length - 2; j++)
    for (let k = j + 1; k < c.length - 1; k++)
    for (let l = k + 1; l < c.length; l++) {
      const [a, b, cc, d] = [c[i], c[j], c[k], c[l]];
      const sb = sitBonus([a, b, cc, d]);
      const splits: [[string, string], [string, string]][] = [
        [[a, b], [cc, d]],
        [[a, cc], [b, d]],
        [[a, d], [b, cc]],
      ];
      for (const [t1, t2] of splits) {
        const s = gameScore(t1[0], t1[1], t2[0], t2[1]) + sb;
        if (s < bestScore) { bestScore = s; best = { team1: t1, team2: t2 }; }
      }
    }
    return best;
  }

  // Exhaustive search over all C(m,2)×C(f,2) combinations for a mixed court.
  // Only valid splits: 1M+1F per team.
  function bestGameMixed(
    pool: string[]
  ): { team1: [string, string]; team2: [string, string] } | null {
    const allMales = candidates(pool.filter((id) => genders[id] === "MALE"));
    const allFemales = candidates(pool.filter((id) => genders[id] === "FEMALE"));
    if (allMales.length < 2 || allFemales.length < 2) return null;

    let best: { team1: [string, string]; team2: [string, string] } | null = null;
    let bestScore = Infinity;

    for (let mi = 0; mi < allMales.length - 1; mi++)
    for (let mj = mi + 1; mj < allMales.length; mj++)
    for (let fi = 0; fi < allFemales.length - 1; fi++)
    for (let fj = fi + 1; fj < allFemales.length; fj++) {
      const m1 = allMales[mi], m2 = allMales[mj];
      const f1 = allFemales[fi], f2 = allFemales[fj];
      const sb = sitBonus([m1, m2, f1, f2]);
      const splits: [[string, string], [string, string]][] = [
        [[m1, f1], [m2, f2]],
        [[m1, f2], [m2, f1]],
      ];
      for (const [t1, t2] of splits) {
        const s = gameScore(t1[0], t1[1], t2[0], t2[1]) + sb;
        if (s < bestScore) { bestScore = s; best = { team1: t1, team2: t2 }; }
      }
    }
    return best;
  }

  const allIds = players.map((p) => p.id);

  // Process MIXED courts first (need both genders), then gender-specific, then ANY last
  // (ANY takes whoever remains and can host any gender combination).
  const courtOrder = [...courts].sort((a, b) => {
    const p = { MIXED: 0, MENS: 1, WOMENS: 2, ANY: 3 };
    return p[a.format] - p[b.format];
  });

  const rounds: Round[] = [];

  for (let r = 0; r < numRounds; r++) {
    const round: Round = [];
    const used = new Set<string>();

    for (const court of courtOrder) {
      const available = allIds.filter((id) => !used.has(id));

      let result: { team1: [string, string]; team2: [string, string] } | null = null;

      if (court.format === "MIXED") {
        result = bestGameMixed(available);
      } else if (court.format === "MENS") {
        result = bestGameAny(available.filter((id) => genders[id] === "MALE"));
      } else if (court.format === "WOMENS") {
        result = bestGameAny(available.filter((id) => genders[id] === "FEMALE"));
      } else {
        // ANY court: pick best 4 from all remaining players, any gender mix
        result = bestGameAny(available);
      }

      if (!result) continue;

      const { team1, team2 } = result;
      const four = [...team1, ...team2];
      for (const id of four) used.add(id);

      inc(partnerCount, team1[0], team1[1]);
      inc(partnerCount, team2[0], team2[1]);
      for (const p1 of team1) for (const p2 of team2) inc(opponentCount, p1, p2);

      round.push({ courtId: court.courtId, team1, team2 });
    }

    for (const id of allIds) {
      if (!used.has(id)) sitOutCount.set(id, (sitOutCount.get(id) ?? 0) + 1);
    }

    rounds.push(round);
  }

  return rounds;
}

// ─── Fixed-partner scheduling ────────────────────────────────────────────────

export interface RRTeam {
  teamId: string;
  player1Gender: "MALE" | "FEMALE";
  player2Gender: "MALE" | "FEMALE";
  player1Id: string;
  player2Id: string;
}

interface FixedGame {
  courtId: string;
  team1: RRTeam;
  team2: RRTeam;
}

function teamMatchesCourtFormat(team: RRTeam, format: "MIXED" | "MENS" | "WOMENS" | "ANY"): boolean {
  if (format === "ANY") return true; // any team can play on an ANY court
  const bothMale = team.player1Gender === "MALE" && team.player2Gender === "MALE";
  const bothFemale = team.player1Gender === "FEMALE" && team.player2Gender === "FEMALE";
  const isMixed = !bothMale && !bothFemale;
  if (format === "MENS") return bothMale;
  if (format === "WOMENS") return bothFemale;
  return isMixed; // MIXED court requires 1M+1F team
}

export function generateFixedSchedule(
  teams: RRTeam[],
  courts: RRCourt[],
  numRounds: number,
  maxMatchups = Infinity
): FixedGame[][] {
  const matchupCount = new Map<string, number>();
  const sitOutCount = new Map<string, number>();
  for (const t of teams) sitOutCount.set(t.teamId, 0);

  function matchKey(a: string, b: string) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }
  function getMatchups(a: string, b: string) {
    return matchupCount.get(matchKey(a, b)) ?? 0;
  }
  function incMatchup(a: string, b: string) {
    const k = matchKey(a, b);
    matchupCount.set(k, (matchupCount.get(k) ?? 0) + 1);
  }

  // Score a team pairing: lower = better (fewer repeats, more sit-outs preferred)
  function pairScore(a: RRTeam, b: RRTeam): number {
    return (
      getMatchups(a.teamId, b.teamId) * 6 -
      (sitOutCount.get(a.teamId) ?? 0) * 3 -
      (sitOutCount.get(b.teamId) ?? 0) * 3
    );
  }

  // Find the best 2-team pairing from eligible teams for a court.
  // When maxMatchups is finite, skip pairs that have already met that many times.
  function bestPair(eligible: RRTeam[]): { team1: RRTeam; team2: RRTeam } | null {
    if (eligible.length < 2) return null;
    const sorted = [...eligible].sort(
      (a, b) => (sitOutCount.get(b.teamId) ?? 0) - (sitOutCount.get(a.teamId) ?? 0)
    );
    let best: { team1: RRTeam; team2: RRTeam } | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (getMatchups(sorted[i].teamId, sorted[j].teamId) >= maxMatchups) continue;
        const s = pairScore(sorted[i], sorted[j]);
        if (s < bestScore) {
          bestScore = s;
          best = { team1: sorted[i], team2: sorted[j] };
        }
      }
    }
    return best;
  }

  const courtOrder = [...courts].sort((a, b) => {
    const p: Record<string, number> = { MIXED: 0, MENS: 1, WOMENS: 2, ANY: 3 };
    return (p[a.format] ?? 3) - (p[b.format] ?? 3);
  });

  const rounds: FixedGame[][] = [];

  for (let r = 0; r < numRounds; r++) {
    const round: FixedGame[] = [];
    const used = new Set<string>();

    for (const court of courtOrder) {
      const eligible = teams.filter(
        (t) => !used.has(t.teamId) && teamMatchesCourtFormat(t, court.format)
      );
      const pair = bestPair(eligible);
      if (!pair) continue;

      used.add(pair.team1.teamId);
      used.add(pair.team2.teamId);
      incMatchup(pair.team1.teamId, pair.team2.teamId);
      round.push({ courtId: court.courtId, team1: pair.team1, team2: pair.team2 });
    }

    for (const t of teams) {
      if (!used.has(t.teamId)) sitOutCount.set(t.teamId, (sitOutCount.get(t.teamId) ?? 0) + 1);
    }

    rounds.push(round);
  }

  return rounds;
}

export function roundsFromMinGamesFixed(
  teams: RRTeam[],
  courts: RRCourt[],
  minGames: number
): number {
  const teamsPerRound = Math.min(teams.length, courts.length * 2);
  const rate = teams.length > 0 ? teamsPerRound / teams.length : 0;
  if (rate <= 0) return minGames;
  return Math.ceil(minGames / rate);
}

// Run men's and women's schedules independently and merge by round index.
export function generateSplitSchedule(
  players: RRPlayer[],
  courts: RRCourt[],
  mensRounds: number,
  womensRounds: number,
  overrides: RROverride[] = []
): ReturnType<typeof generateSchedule> {
  const males   = players.filter((p) => p.gender === "MALE");
  const females = players.filter((p) => p.gender === "FEMALE");
  const mensCourts   = courts.filter((c) => c.format === "MENS");
  const womensCourts = courts.filter((c) => c.format === "WOMENS");

  const mensSchedule = mensRounds > 0 && males.length > 0 && mensCourts.length > 0
    ? generateSchedule(males, mensCourts, mensRounds, overrides)
    : [];
  const womensSchedule = womensRounds > 0 && females.length > 0 && womensCourts.length > 0
    ? generateSchedule(females, womensCourts, womensRounds, overrides)
    : [];

  const total = Math.max(mensRounds, womensRounds);
  return Array.from({ length: total }, (_, i) => [
    ...(mensSchedule[i] ?? []),
    ...(womensSchedule[i] ?? []),
  ]);
}

// Independent per-gender calculation for MENS+WOMENS-only sessions.
// Returns the max of the two genders so both reach minGames.
export function roundsFromMinGamesSplit(
  malePlayers: RRPlayer[],
  femalePlayers: RRPlayer[],
  mensCourts: RRCourt[],
  womensCourts: RRCourt[],
  menMinGames: number,
  womenMinGames: number
): number {
  const malesPlaying = Math.min(malePlayers.length, mensCourts.length * 4);
  const femalesPlaying = Math.min(femalePlayers.length, womensCourts.length * 4);

  const maleRate = malePlayers.length > 0 ? malesPlaying / malePlayers.length : 0;
  const femaleRate = femalePlayers.length > 0 ? femalesPlaying / femalePlayers.length : 0;

  const menRounds = maleRate > 0 ? Math.ceil(menMinGames / maleRate) : 0;
  const womenRounds = femaleRate > 0 ? Math.ceil(womenMinGames / femaleRate) : 0;

  return Math.max(menRounds, womenRounds, 1);
}

// ─── Pod-aware scheduling ─────────────────────────────────────────────────────
//
// Both generatePodSchedules (rotating) and generateFixedPodSchedules (fixed)
// use a unified multi-group scheduler: all groups compete for court slots each
// round. In every round, each court is filled by whichever group has the best
// available game for that court format. This guarantees all courts are always
// in use as long as any group has players/teams remaining to schedule.

export function generatePodSchedules(
  players: RRPlayer[],
  podGroups: { playerIds: string[] }[],
  courts: RRCourt[],
  numRounds: number,
  overrides: RROverride[] = []
): ReturnType<typeof generateSchedule> {
  const allPodPlayerIds = new Set(podGroups.flatMap((g) => g.playerIds));
  const ungrouped = players.filter((p) => !allPodPlayerIds.has(p.id));

  const playerMap = new Map(players.map((p) => [p.id, p]));

  const rawGroups: RRPlayer[][] = [
    ...podGroups
      .filter((g) => g.playerIds.length > 0)
      .map((g) => g.playerIds.map((id) => playerMap.get(id)).filter((p): p is RRPlayer => !!p)),
    ...(ungrouped.length > 0 ? [ungrouped] : []),
  ].filter((g) => g.length >= 4);

  if (rawGroups.length === 0) return generateSchedule(players, courts, numRounds, overrides);
  if (rawGroups.length === 1) return generateSchedule(rawGroups[0], courts, numRounds, overrides);

  // Per-group scheduling state (mirrors generateSchedule internals).
  type GState = {
    players: RRPlayer[];
    genders: Record<string, "MALE" | "FEMALE">;
    partnerCount: Map<string, number>;
    opponentCount: Map<string, number>;
    sitOutCount: Map<string, number>;
  };

  const gKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const getC = (m: Map<string, number>, a: string, b: string) => m.get(gKey(a, b)) ?? 0;
  const incC = (m: Map<string, number>, a: string, b: string) => {
    const k = gKey(a, b);
    m.set(k, (m.get(k) ?? 0) + 1);
  };

  const states: GState[] = rawGroups.map((gp) => ({
    players: gp,
    genders: Object.fromEntries(gp.map((p) => [p.id, p.gender])) as Record<string, "MALE" | "FEMALE">,
    partnerCount: new Map(),
    opponentCount: new Map(),
    sitOutCount: new Map(gp.map((p) => [p.id, 0])),
  }));

  function scoreGame(
    st: GState,
    t1: [string, string],
    t2: [string, string]
  ): number {
    let s =
      getC(st.partnerCount, t1[0], t1[1]) * 6 +
      getC(st.partnerCount, t2[0], t2[1]) * 6 +
      getC(st.opponentCount, t1[0], t2[0]) * 2 +
      getC(st.opponentCount, t1[0], t2[1]) * 2 +
      getC(st.opponentCount, t1[1], t2[0]) * 2 +
      getC(st.opponentCount, t1[1], t2[1]) * 2 -
      [...t1, ...t2].reduce((sum, id) => sum + (st.sitOutCount.get(id) ?? 0), 0) * 3;
    for (const ov of overrides) {
      const { player1Id: a, player2Id: b, type } = ov;
      if (!st.players.some((p) => p.id === a) || !st.players.some((p) => p.id === b)) continue;
      const t1Tog = (t1[0] === a && t1[1] === b) || (t1[0] === b && t1[1] === a);
      const t2Tog = (t2[0] === a && t2[1] === b) || (t2[0] === b && t2[1] === a);
      const both = [...t1, ...t2].includes(a) && [...t1, ...t2].includes(b);
      if (type === "MUST_NOT_PARTNER" && (t1Tog || t2Tog)) s += 10000;
      if (type === "MUST_PARTNER" && both && !t1Tog && !t2Tog && getC(st.partnerCount, a, b) === 0)
        s += 10000;
    }
    return s;
  }

  function findBestForCourt(
    st: GState,
    available: string[],
    format: "MIXED" | "MENS" | "WOMENS" | "ANY"
  ): { team1: [string, string]; team2: [string, string]; score: number } | null {
    const sorted = [...available]
      .sort((a, b) => (st.sitOutCount.get(b) ?? 0) - (st.sitOutCount.get(a) ?? 0))
      .slice(0, MAX_CANDIDATES);

    let best: { team1: [string, string]; team2: [string, string]; score: number } | null = null;

    if (format === "MIXED") {
      const males = sorted.filter((id) => st.genders[id] === "MALE");
      const females = sorted.filter((id) => st.genders[id] === "FEMALE");
      if (males.length < 2 || females.length < 2) return null;
      for (let mi = 0; mi < males.length - 1; mi++)
        for (let mj = mi + 1; mj < males.length; mj++)
          for (let fi = 0; fi < females.length - 1; fi++)
            for (let fj = fi + 1; fj < females.length; fj++) {
              const [m1, m2, f1, f2] = [males[mi], males[mj], females[fi], females[fj]];
              for (const [t1, t2] of [
                [[m1, f1], [m2, f2]],
                [[m1, f2], [m2, f1]],
              ] as [[string, string], [string, string]][]) {
                const s = scoreGame(st, t1, t2);
                if (!best || s < best.score) best = { team1: t1, team2: t2, score: s };
              }
            }
    } else {
      const pool =
        format === "MENS"
          ? sorted.filter((id) => st.genders[id] === "MALE")
          : format === "WOMENS"
          ? sorted.filter((id) => st.genders[id] === "FEMALE")
          : sorted;
      if (pool.length < 4) return null;
      for (let i = 0; i < pool.length - 3; i++)
        for (let j = i + 1; j < pool.length - 2; j++)
          for (let k = j + 1; k < pool.length - 1; k++)
            for (let l = k + 1; l < pool.length; l++) {
              const [a, b, c, d] = [pool[i], pool[j], pool[k], pool[l]];
              for (const [t1, t2] of [
                [[a, b], [c, d]],
                [[a, c], [b, d]],
                [[a, d], [b, c]],
              ] as [[string, string], [string, string]][]) {
                const s = scoreGame(st, t1, t2);
                if (!best || s < best.score) best = { team1: t1, team2: t2, score: s };
              }
            }
    }
    return best;
  }

  const courtOrder = [...courts].sort((a, b) => {
    const p: Record<string, number> = { MIXED: 0, MENS: 1, WOMENS: 2, ANY: 3 };
    return (p[a.format] ?? 3) - (p[b.format] ?? 3);
  });

  const rounds: ReturnType<typeof generateSchedule> = [];

  for (let r = 0; r < numRounds; r++) {
    const round: { courtId: string; team1: [string, string]; team2: [string, string] }[] = [];
    const usedPlayers = new Set<string>();

    for (const court of courtOrder) {
      let winner: { team1: [string, string]; team2: [string, string]; score: number } | null = null;
      let winnerStateIdx = -1;

      for (let gi = 0; gi < states.length; gi++) {
        const available = states[gi].players.map((p) => p.id).filter((id) => !usedPlayers.has(id));
        const candidate = findBestForCourt(states[gi], available, court.format);
        if (candidate && (!winner || candidate.score < winner.score)) {
          winner = candidate;
          winnerStateIdx = gi;
        }
      }

      if (!winner) continue;

      const st = states[winnerStateIdx];
      const { team1, team2 } = winner;
      incC(st.partnerCount, team1[0], team1[1]);
      incC(st.partnerCount, team2[0], team2[1]);
      for (const a of team1) for (const b of team2) incC(st.opponentCount, a, b);
      for (const id of [...team1, ...team2]) usedPlayers.add(id);
      round.push({ courtId: court.courtId, team1, team2 });
    }

    for (const st of states) {
      for (const p of st.players) {
        if (!usedPlayers.has(p.id))
          st.sitOutCount.set(p.id, (st.sitOutCount.get(p.id) ?? 0) + 1);
      }
    }

    rounds.push(round);
  }

  return rounds;
}

export function generateFixedPodSchedules(
  teams: RRTeam[],
  /** Each pod group carries its own maxMatchups (1 = single, 2 = double, etc.) */
  podGroups: { teamIds: string[]; maxMatchups?: number }[],
  courts: RRCourt[],
  numRounds: number,
  defaultMaxMatchups = 1,
  unassignedMaxMatchups?: number
): ReturnType<typeof generateFixedSchedule> {
  const allPodTeamIds = new Set(podGroups.flatMap((g) => g.teamIds));
  const ungrouped = teams.filter((t) => !allPodTeamIds.has(t.teamId));
  const teamMap = new Map(teams.map((t) => [t.teamId, t]));

  type GroupDef = { teams: RRTeam[]; maxMatchups: number };

  const rawGroups: GroupDef[] = [
    ...podGroups
      .filter((g) => g.teamIds.length > 0)
      .map((g) => ({
        teams: g.teamIds.map((id) => teamMap.get(id)).filter((t): t is RRTeam => !!t),
        maxMatchups: g.maxMatchups ?? defaultMaxMatchups,
      })),
    ...(ungrouped.length > 0
      ? [{ teams: ungrouped, maxMatchups: unassignedMaxMatchups ?? defaultMaxMatchups }]
      : []),
  ].filter((g) => g.teams.length >= 2);

  if (rawGroups.length === 0) return generateFixedSchedule(teams, courts, numRounds, defaultMaxMatchups);
  if (rawGroups.length === 1)
    return generateFixedSchedule(rawGroups[0].teams, courts, numRounds, rawGroups[0].maxMatchups);

  type FState = {
    teams: RRTeam[];
    maxMatchups: number;
    matchupCount: Map<string, number>;
    sitOutCount: Map<string, number>;
  };

  const fKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const getM = (m: Map<string, number>, a: string, b: string) => m.get(fKey(a, b)) ?? 0;
  const incM = (m: Map<string, number>, a: string, b: string) => {
    const k = fKey(a, b);
    m.set(k, (m.get(k) ?? 0) + 1);
  };

  const fStates: FState[] = rawGroups.map((g) => ({
    teams: g.teams,
    maxMatchups: g.maxMatchups,
    matchupCount: new Map(),
    sitOutCount: new Map(g.teams.map((t) => [t.teamId, 0])),
  }));

  function findBestPairForCourt(
    st: FState,
    availableTeams: RRTeam[],
    format: "MIXED" | "MENS" | "WOMENS" | "ANY"
  ): { team1: RRTeam; team2: RRTeam; score: number } | null {
    const eligible = availableTeams.filter((t) => teamMatchesCourtFormat(t, format));
    if (eligible.length < 2) return null;
    const sorted = [...eligible].sort(
      (a, b) => (st.sitOutCount.get(b.teamId) ?? 0) - (st.sitOutCount.get(a.teamId) ?? 0)
    );
    let best: { team1: RRTeam; team2: RRTeam; score: number } | null = null;
    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (getM(st.matchupCount, sorted[i].teamId, sorted[j].teamId) >= st.maxMatchups) continue;
        const s =
          getM(st.matchupCount, sorted[i].teamId, sorted[j].teamId) * 6 -
          (st.sitOutCount.get(sorted[i].teamId) ?? 0) * 3 -
          (st.sitOutCount.get(sorted[j].teamId) ?? 0) * 3;
        if (!best || s < best.score) best = { team1: sorted[i], team2: sorted[j], score: s };
      }
    }
    return best;
  }

  const fCourtOrder = [...courts].sort((a, b) => {
    const p: Record<string, number> = { MIXED: 0, MENS: 1, WOMENS: 2, ANY: 3 };
    return (p[a.format] ?? 3) - (p[b.format] ?? 3);
  });

  const rounds: ReturnType<typeof generateFixedSchedule> = [];

  // Run until no games can be scheduled (all pairs within each pod exhausted).
  // Safety cap: sum of (pairs × maxMatchups) across all groups, at least numRounds.
  const totalWeightedPairs = rawGroups.reduce(
    (sum, g) => sum + ((g.teams.length * (g.teams.length - 1)) / 2) * g.maxMatchups,
    0
  );
  const cap = Math.max(numRounds, totalWeightedPairs + 10);

  for (let r = 0; r < cap; r++) {
    const round: { courtId: string; team1: RRTeam; team2: RRTeam }[] = [];
    const usedTeams = new Set<string>();

    for (const court of fCourtOrder) {
      let winner: { team1: RRTeam; team2: RRTeam; score: number } | null = null;
      let winnerStateIdx = -1;

      for (let gi = 0; gi < fStates.length; gi++) {
        const available = fStates[gi].teams.filter((t) => !usedTeams.has(t.teamId));
        const candidate = findBestPairForCourt(fStates[gi], available, court.format);
        if (candidate && (!winner || candidate.score < winner.score)) {
          winner = candidate;
          winnerStateIdx = gi;
        }
      }

      if (!winner) continue;

      const st = fStates[winnerStateIdx];
      incM(st.matchupCount, winner.team1.teamId, winner.team2.teamId);
      usedTeams.add(winner.team1.teamId);
      usedTeams.add(winner.team2.teamId);
      round.push({ courtId: court.courtId, team1: winner.team1, team2: winner.team2 });
    }

    for (const st of fStates) {
      for (const t of st.teams) {
        if (!usedTeams.has(t.teamId))
          st.sitOutCount.set(t.teamId, (st.sitOutCount.get(t.teamId) ?? 0) + 1);
      }
    }

    if (round.length === 0) break; // all pods exhausted
    rounds.push(round);
  }

  return rounds;
}

export function roundsFromMinGames(
  players: RRPlayer[],
  courts: RRCourt[],
  minGames: number
): number {
  // A "game" is a round where the player actually plays — bye rounds don't count.
  // Find the play rate for the gender that plays least often (the bottleneck),
  // then calculate rounds needed so even that player reaches minGames.
  const males = players.filter((p) => p.gender === "MALE").length;
  const females = players.filter((p) => p.gender === "FEMALE").length;
  const mensCourts = courts.filter((c) => c.format === "MENS").length;
  const womensCourts = courts.filter((c) => c.format === "WOMENS").length;
  const mixedCourts = courts.filter((c) => c.format === "MIXED").length;
  const anyCourts = courts.filter((c) => c.format === "ANY").length;

  // ANY courts take 4 players of any gender — add their capacity to each gender's pool.
  const malesPlaying = Math.min(males, mensCourts * 4 + mixedCourts * 2 + anyCourts * 4);
  const femalesPlaying = Math.min(females, womensCourts * 4 + mixedCourts * 2 + anyCourts * 4);

  const maleRate = males > 0 ? malesPlaying / males : 0;
  const femaleRate = females > 0 ? femalesPlaying / females : 0;

  const rates = [maleRate, femaleRate].filter((r) => r > 0);
  const minRate = rates.length > 0 ? Math.min(...rates) : 0;
  if (minRate <= 0) return minGames;

  return Math.ceil(minGames / minRate);
}
