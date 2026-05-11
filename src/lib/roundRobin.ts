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
  format: "MIXED" | "MENS" | "WOMENS";
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
  numRounds: number
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
  function gameScore(
    t1p1: string, t1p2: string,
    t2p1: string, t2p2: string
  ): number {
    return (
      get(partnerCount, t1p1, t1p2) * 6 +
      get(partnerCount, t2p1, t2p2) * 6 +
      get(opponentCount, t1p1, t2p1) * 2 +
      get(opponentCount, t1p1, t2p2) * 2 +
      get(opponentCount, t1p2, t2p1) * 2 +
      get(opponentCount, t1p2, t2p2) * 2
    );
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

  // Process MIXED courts first — they need both genders so must claim players
  // before gender-specific courts drain one pool entirely.
  const courtOrder = [...courts].sort((a, b) => {
    const p = { MIXED: 0, MENS: 1, WOMENS: 2 };
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
      } else {
        result = bestGameAny(available.filter((id) => genders[id] === "FEMALE"));
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

function teamMatchesCourtFormat(team: RRTeam, format: "MIXED" | "MENS" | "WOMENS"): boolean {
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
  numRounds: number
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

  // Find the best 2-team pairing from eligible teams for a court
  function bestPair(eligible: RRTeam[]): { team1: RRTeam; team2: RRTeam } | null {
    if (eligible.length < 2) return null;
    // Sort by sit-out count descending so most-rested teams appear first
    const sorted = [...eligible].sort(
      (a, b) => (sitOutCount.get(b.teamId) ?? 0) - (sitOutCount.get(a.teamId) ?? 0)
    );
    let best: { team1: RRTeam; team2: RRTeam } | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
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
    const p = { MIXED: 0, MENS: 1, WOMENS: 2 };
    return p[a.format] - p[b.format];
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

  const malesPlaying = Math.min(males, mensCourts * 4 + mixedCourts * 2);
  const femalesPlaying = Math.min(females, womensCourts * 4 + mixedCourts * 2);

  const maleRate = males > 0 ? malesPlaying / males : 0;
  const femaleRate = females > 0 ? femalesPlaying / females : 0;

  const rates = [maleRate, femaleRate].filter((r) => r > 0);
  const minRate = rates.length > 0 ? Math.min(...rates) : 0;
  if (minRate <= 0) return minGames;

  return Math.ceil(minGames / minRate);
}
