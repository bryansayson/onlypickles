"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/components/AdminProvider";
import { MatchupDisplay } from "@/components/MatchupDisplay";

interface BracketTeam {
  id: string;
  label: string;
  playerNames: string[];
}

interface BracketGame {
  team1Id: string | null;
  team2Id: string | null;
  team1Score: number | null;
  team2Score: number | null;
}

interface SubBracket {
  teams: BracketTeam[];
  semi1: BracketGame;
  semi2: BracketGame;
  gold: BracketGame;
  bronze: BracketGame;
}

interface ArchivedBracket {
  type: string;
  savedAt: string;
  teams?: BracketTeam[];
  semi1?: BracketGame;
  semi2?: BracketGame;
  gold?: BracketGame;
  bronze?: BracketGame;
  mens?: SubBracket;
  womens?: SubBracket;
}

interface MedalRoundData {
  // Single bracket (mixed sessions)
  teams?: BracketTeam[];
  semi1?: BracketGame;
  semi2?: BracketGame;
  gold?: BracketGame;
  bronze?: BracketGame;
  // Dual bracket (gender-split sessions)
  mens?: SubBracket;
  womens?: SubBracket;
  // History of past brackets
  history?: ArchivedBracket[];
}

interface MedalRound {
  id: string;
  type: "FIXED" | "RANDOM";
  data: MedalRoundData;
}

interface Player {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE";
}

interface SessionTeam {
  id: string;
  player1: Player;
  player2: Player;
}

interface Court {
  format: "MIXED" | "MENS" | "WOMENS" | "ANY";
}

interface RankedPlayer {
  name: string;
  gender: "MALE" | "FEMALE";
  wins: number;
  pointDiff: number;
  played: number;
}

interface Props {
  sessionId: string;
  sessionFormat: "ROTATING" | "FIXED";
  courts: Court[];
  sessionTeams: SessionTeam[];
  sessionPlayers: { player: Player }[];
  rankedPlayers?: RankedPlayer[];
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function emptyGame(t1: string | null = null, t2: string | null = null): BracketGame {
  return { team1Id: t1, team2Id: t2, team1Score: null, team2Score: null };
}

function makeBracket(teams: BracketTeam[]): SubBracket {
  return {
    teams,
    semi1: emptyGame(teams[0].id, teams[3].id),
    semi2: emptyGame(teams[1].id, teams[2].id),
    gold: emptyGame(),
    bronze: emptyGame(),
  };
}

const MEDAL_COLORS = {
  gold:   { bg: "bg-yellow-900/30", border: "border-yellow-500/40", label: "text-yellow-400" },
  bronze: { bg: "bg-orange-900/30", border: "border-orange-600/40", label: "text-orange-400" },
  semi:   { bg: "bg-zinc-900",      border: "border-zinc-700",      label: "text-zinc-300" },
};

export function MedalRoundTab({ sessionId, courts, sessionPlayers, rankedPlayers = [] }: Props) {
  const { isAdmin } = useAdmin();

  const isSplitGender =
    courts.some((c) => c.format === "MENS") &&
    courts.some((c) => c.format === "WOMENS") &&
    !courts.some((c) => c.format === "MIXED");

  const [round, setRound] = useState<MedalRound | null | undefined>(undefined);
  const [mode, setMode] = useState<"RANDOM" | "SNAKE" | "FIXED">("RANDOM");
  // Single-bracket manual teams (mixed sessions)
  const [manualTeams, setManualTeams] = useState<BracketTeam[]>([]);
  // Dual-bracket manual teams (split sessions)
  const [manualMensTeams, setManualMensTeams] = useState<BracketTeam[]>([]);
  const [manualWomensTeams, setManualWomensTeams] = useState<BracketTeam[]>([]);
  const [pendingPlayer, setPendingPlayer] = useState<{ name: string; gender: string } | null>(null);
  const [scores, setScores] = useState<Record<string, { t1: string; t2: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedBrackets, setExpandedBrackets] = useState<Set<string>>(new Set());
  const [confirmReset, setConfirmReset] = useState(false);

  // Poll for bracket updates every 30 seconds (another admin may regenerate)
  useEffect(() => {
    const fetchRound = () =>
      fetch(`/api/sessions/${sessionId}/medal-round`)
        .then((r) => r.json())
        .then(setRound);
    fetchRound();
    const interval = setInterval(fetchRound, 30_000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Rankings come directly from the scores-tab leaderboard (rankedPlayers).
  // For players with no games yet, fall back to roster order at the bottom.
  function rankPool(gender: "MALE" | "FEMALE") {
    const scored = rankedPlayers.filter((p) => p.gender === gender);
    const scoredNames = new Set(scored.map((p) => p.name));
    const unscored = sessionPlayers
      .filter((sp) => sp.player.gender === gender && !scoredNames.has(sp.player.name))
      .map((sp) => ({ name: sp.player.name, gender, wins: 0, pointDiff: 0, played: 0 }));
    return [...scored, ...unscored].slice(0, 8);
  }

  const topMen   = rankPool("MALE");
  const topWomen = rankPool("FEMALE");

  // ── Team generation helpers ────────────────────────────────────────────────
  function randomSingleTeams(): BracketTeam[] {
    const men = shuffle(topMen); const women = shuffle(topWomen);
    return [0, 1, 2, 3].flatMap((i) => {
      const m1 = men[i * 2]; const m2 = men[i * 2 + 1];
      const f1 = women[i * 2]; const f2 = women[i * 2 + 1];
      if (!m1 || !m2 || !f1 || !f2) return [];
      return [{ id: `random-${i + 1}`, label: `Team ${i + 1}`, playerNames: [m1.name, m2.name, f1.name, f2.name] }];
    });
  }

  function randomGenderTeams(pool: typeof topMen, prefix: string): BracketTeam[] {
    const shuffled = shuffle(pool);
    return [0, 1, 2, 3].map((i) => ({
      id: `${prefix}-${i + 1}`,
      label: `${shuffled[i * 2].name} & ${shuffled[i * 2 + 1].name}`,
      playerNames: [shuffled[i * 2].name, shuffled[i * 2 + 1].name],
    }));
  }

  function snakeGenderTeams(pool: typeof topMen, prefix: string): BracketTeam[] {
    return [0, 1, 2, 3].map((i) => ({
      id: `${prefix}-${i + 1}`,
      label: `${pool[i].name} & ${pool[7 - i].name}`,
      playerNames: [pool[i].name, pool[7 - i].name],
    }));
  }

  function snakeCrossTeams(): BracketTeam[] {
    return [0, 1, 2, 3].map((i) => ({
      id: `snake-${i + 1}`,
      label: `Team ${i + 1}`,
      playerNames: [topMen[i].name, topWomen[7 - i].name],
    }));
  }

  // ── Pool click handler for Fixed mode ─────────────────────────────────────
  const usedInManual = new Set(manualTeams.flatMap((t) => t.playerNames));
  const usedInMens = new Set(manualMensTeams.flatMap((t) => t.playerNames));
  const usedInWomens = new Set(manualWomensTeams.flatMap((t) => t.playerNames));

  function handlePoolClick(player: { name: string; gender: string }) {
    if (isSplitGender) {
      const isMale = player.gender === "MALE";
      const usedSet = isMale ? usedInMens : usedInWomens;
      if (usedSet.has(player.name)) return;
      if (!pendingPlayer) { setPendingPlayer(player); return; }
      if (pendingPlayer.name === player.name) { setPendingPlayer(null); return; }
      if (pendingPlayer.gender !== player.gender) { setPendingPlayer(player); return; }
      const setter = isMale ? setManualMensTeams : setManualWomensTeams;
      const existing = isMale ? manualMensTeams : manualWomensTeams;
      const prefix = isMale ? "manual-m" : "manual-w";
      setter((prev) => [...prev, {
        id: `${prefix}${prev.length + 1}`,
        label: `${pendingPlayer.name} & ${player.name}`,
        playerNames: [pendingPlayer.name, player.name],
      }]);
      setPendingPlayer(null);
      return;
    }
    // Single bracket
    if (usedInManual.has(player.name)) return;
    if (!pendingPlayer) { setPendingPlayer(player); return; }
    if (pendingPlayer.name === player.name) { setPendingPlayer(null); return; }
    const n = manualTeams.length + 1;
    setManualTeams((prev) => [...prev, {
      id: `manual-${n}`,
      label: `${pendingPlayer.name} & ${player.name}`,
      playerNames: [pendingPlayer.name, player.name],
    }]);
    setPendingPlayer(null);
  }

  // ── Generate bracket ───────────────────────────────────────────────────────
  async function handleGenerate() {
    let data: MedalRoundData;

    if (isSplitGender) {
      let mensTeams: BracketTeam[];
      let womensTeams: BracketTeam[];
      if (mode === "RANDOM") {
        mensTeams = randomGenderTeams(topMen, "random-m");
        womensTeams = randomGenderTeams(topWomen, "random-w");
      } else if (mode === "SNAKE") {
        mensTeams = snakeGenderTeams(topMen, "snake-m");
        womensTeams = snakeGenderTeams(topWomen, "snake-w");
      } else {
        mensTeams = manualMensTeams;
        womensTeams = manualWomensTeams;
      }
      data = { mens: makeBracket(mensTeams), womens: makeBracket(womensTeams) };
    } else {
      let teams: BracketTeam[];
      if (mode === "RANDOM") teams = randomSingleTeams();
      else if (mode === "SNAKE") teams = snakeCrossTeams();
      else teams = manualTeams;
      if (teams.length !== 4) return;
      const b = makeBracket(teams);
      data = { teams, semi1: b.semi1, semi2: b.semi2, gold: b.gold, bronze: b.bronze };
    }

    const res = await fetch(`/api/sessions/${sessionId}/medal-round`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: mode, data }),
    });
    setRound(await res.json());
  }

  async function handleReset() {
    const res = await fetch(`/api/sessions/${sessionId}/medal-round`, { method: "DELETE" });
    const updated = await res.json();
    setRound(updated.ok ? null : updated);
    setScores({}); setConfirmReset(false);
    setManualTeams([]); setManualMensTeams([]); setManualWomensTeams([]); setPendingPlayer(null);
  }

  async function saveScore(gameKey: string, bracket?: "mens" | "womens") {
    const scoreKey = bracket ? `${bracket}.${gameKey}` : gameKey;
    const s = scores[scoreKey];
    if (!s) return;
    const t1 = parseInt(s.t1); const t2 = parseInt(s.t2);
    if (isNaN(t1) || isNaN(t2)) return;
    setSaving(scoreKey);
    const body: Record<string, unknown> = { game: gameKey, team1Score: t1, team2Score: t2 };
    if (bracket) body.bracket = bracket;
    const res = await fetch(`/api/sessions/${sessionId}/medal-round`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setRound(await res.json());
    setSaving(null);
    setScores((prev) => { const n = { ...prev }; delete n[scoreKey]; return n; });
  }

  const hasActiveBracket = !!(round && (round.data.teams || round.data.mens || round.data.womens));
  const history: ArchivedBracket[] = round?.data.history ?? [];

  async function deleteHistory(originalIndex: number) {
    const res = await fetch(`/api/sessions/${sessionId}/medal-round`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteHistoryIndex: originalIndex }),
    });
    setRound(await res.json());
  }

  function PodiumResult({ arch, originalIndex }: { arch: ArchivedBracket; originalIndex: number }) {
    function podium(teams: BracketTeam[], gold: BracketGame | undefined, bronze: BracketGame | undefined) {
      if (!gold || gold.team1Score === null) return null;
      const byId = Object.fromEntries(teams.map((t) => [t.id, t]));
      const goldWinner   = gold.team1Score >= gold.team2Score! ? byId[gold.team1Id!]   : byId[gold.team2Id!];
      const silver       = gold.team1Score >= gold.team2Score! ? byId[gold.team2Id!]   : byId[gold.team1Id!];
      const bronzeWinner = bronze && bronze.team1Score !== null
        ? (bronze.team1Score >= bronze.team2Score! ? byId[bronze.team1Id!] : byId[bronze.team2Id!])
        : null;
      return (
        <div className="flex flex-col gap-0.5">
          {([["🥇", goldWinner], ["🥈", silver], ["🥉", bronzeWinner]] as [string, BracketTeam | null | undefined][]).map(([medal, team]) => (
            <div key={medal} className="flex items-center gap-1.5 text-xs">
              <span>{medal}</span>
              <span className="text-zinc-300 font-medium truncate">{team?.label ?? "—"}</span>
            </div>
          ))}
        </div>
      );
    }

    const modeLabel: Record<string, string> = { RANDOM: "Random", SNAKE: "Snake Draw", FIXED: "Fixed" };
    const label = modeLabel[arch.type] ?? arch.type;
    const date = new Date(arch.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-zinc-400">{label}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600">{date}</span>
            {isAdmin && (
              <button
                onClick={() => deleteHistory(originalIndex)}
                className="text-zinc-600 hover:text-red-400 text-base leading-none"
              >×</button>
            )}
          </div>
        </div>
        {arch.mens && arch.womens ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-sky-400 font-semibold mb-1.5">Men</p>
              {podium(arch.mens.teams, arch.mens.gold, arch.mens.bronze)}
            </div>
            <div>
              <p className="text-xs text-pink-400 font-semibold mb-1.5">Women</p>
              {podium(arch.womens.teams, arch.womens.gold, arch.womens.bronze)}
            </div>
          </div>
        ) : arch.teams ? podium(arch.teams, arch.gold, arch.bronze) : null}
      </div>
    );
  }

  function HistorySection() {
    if (history.length === 0) return null;
    return (
      <div className="mt-6 flex flex-col gap-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Past Brackets ({history.length})</p>
        {[...history].map((arch, i) => (
          <PodiumResult key={i} arch={arch} originalIndex={i} />
        )).reverse()}
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (round === undefined) return <p className="text-zinc-500 text-center py-12">Loading...</p>;

  // ── Setup screen ───────────────────────────────────────────────────────────
  if (!hasActiveBracket) {
    const canGenerate = isSplitGender
      ? (mode === "FIXED"
          ? manualMensTeams.length === 4 && manualWomensTeams.length === 4
          : topMen.length >= 8 && topWomen.length >= 8)
      : (mode === "FIXED"
          ? manualTeams.length === 4
          : mode === "SNAKE"
            ? topMen.length >= 4 && topWomen.length >= 8
            : topMen.length >= 8 && topWomen.length >= 8);

    // Pool chip component
    function PoolChip({ player, index, used, isMale }: { player: { name: string; gender: string }; index: number; used: boolean; isMale: boolean }) {
      const isPending = pendingPlayer?.name === player.name;
      const base = isMale
        ? { active: "bg-sky-900/60 text-sky-200 border-sky-600", muted: "bg-sky-950/30 text-sky-700 border-sky-900" }
        : { active: "bg-pink-900/60 text-pink-200 border-pink-600", muted: "bg-pink-950/30 text-pink-800 border-pink-900" };
      return (
        <button
          disabled={used}
          onClick={() => handlePoolClick(player)}
          className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${
            used ? "opacity-30 cursor-default " + base.muted
            : isPending ? "bg-lime-500 text-black border-lime-400"
            : base.active + " hover:opacity-80"
          }`}
        >
          {index + 1}. {player.name}
        </button>
      );
    }

    function PoolSection({ pool, gender, usedSet, teams, onRemove, prefix }: {
      pool: typeof topMen; gender: "MALE" | "FEMALE";
      usedSet: Set<string>; teams: BracketTeam[];
      onRemove: (i: number) => void; prefix: string;
    }) {
      const isMale = gender === "MALE";
      return (
        <div className="flex flex-col gap-2">
          <p className={`text-xs font-semibold uppercase tracking-wider ${isMale ? "text-sky-400" : "text-pink-400"}`}>
            {isMale ? "Men" : "Women"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pool.map((p, i) => (
              <PoolChip key={p.name} player={p} index={i} used={usedSet.has(p.name)} isMale={isMale} />
            ))}
          </div>
          {teams.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              {teams.map((team, i) => (
                <div key={team.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700">
                  <span className="text-xs text-zinc-500 w-14 shrink-0 self-start pt-0.5">Team {i + 1}</span>
                  <div className="flex flex-col flex-1 gap-0.5">
                    {team.playerNames.map((name) => (
                      <span key={name} className="text-sm text-white font-medium">{name}</span>
                    ))}
                  </div>
                  <button onClick={() => onRemove(i)} className="text-zinc-600 hover:text-red-400 text-base leading-none self-start">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-5">
        {/* Mode toggle */}
        <div className="flex gap-2">
          {(["RANDOM", "SNAKE", "FIXED"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setPendingPlayer(null); }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                mode === m ? "bg-lime-500 text-black border-lime-500" : "bg-zinc-900 text-zinc-400 border-zinc-700"
              }`}>
              {m === "RANDOM" ? "Random" : m === "SNAKE" ? "Snake Draw" : "Fixed"}
            </button>
          ))}
        </div>

        {/* ── Random ── */}
        {mode === "RANDOM" && (
          <div className="flex flex-col gap-3">
            {[{ pool: topMen, label: "Top 8 Men", color: "text-sky-400", chipColor: "bg-sky-900/50 text-sky-300" },
              { pool: topWomen, label: "Top 8 Women", color: "text-pink-400", chipColor: "bg-pink-900/50 text-pink-300" }]
              .map(({ pool, label, color, chipColor }) => (
              <div key={label}>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${color}`}>{label}</p>
                {pool.length === 0
                  ? <p className="text-zinc-500 text-xs italic">No players in session yet.</p>
                  : <div className="flex flex-wrap gap-1.5">{pool.map((p, i) => (
                      <span key={p.name} className={`text-xs px-2 py-0.5 rounded-full font-medium ${chipColor}`}>{i + 1}. {p.name}</span>
                    ))}</div>}
              </div>
            ))}
            <p className="text-xs text-zinc-500">
              {isSplitGender
                ? "4 men's teams and 4 women's teams will be drawn randomly from the top 8."
                : "4 teams per gender will be drawn randomly from the top 8."}
            </p>
          </div>
        )}

        {/* ── Snake Draw ── */}
        {mode === "SNAKE" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-400">Seeds paired 1+8, 2+7, 3+6, 4+5 to balance teams by rank.</p>
            {isSplitGender ? (
              <div className="flex flex-col gap-4">
                {[{ pool: topMen, label: "Men's Teams", color: "text-sky-400", nameColor: "text-sky-300" },
                  { pool: topWomen, label: "Women's Teams", color: "text-pink-400", nameColor: "text-pink-300" }]
                  .map(({ pool, label, color, nameColor }) => (
                  <div key={label}>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${color}`}>{label}</p>
                    {pool.length < 8
                      ? <p className="text-zinc-500 text-xs italic">Need at least 8 players.</p>
                      : <div className="grid grid-cols-2 gap-2">
                          {[0,1,2,3].map((i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700">
                              <span className="text-xs text-zinc-500 w-8 shrink-0 self-start pt-0.5">T{i + 1}</span>
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className={`text-sm font-medium truncate ${nameColor}`}>#{i + 1} {pool[i].name}</span>
                                <span className={`text-sm font-medium truncate ${nameColor}`}>#{8 - i} {pool[7 - i].name}</span>
                              </div>
                            </div>
                          ))}
                        </div>}
                  </div>
                ))}
              </div>
            ) : (
              topMen.length < 4 || topWomen.length < 8
                ? <p className="text-zinc-500 text-xs italic">Need at least 4 men and 8 women in the session.</p>
                : <div className="grid grid-cols-2 gap-2">
                    {[0,1,2,3].map((i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700">
                        <span className="text-xs text-zinc-500 w-8 shrink-0 self-start pt-0.5">T{i + 1}</span>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-sm text-sky-300 font-medium truncate">#{i + 1} {topMen[i].name}</span>
                          <span className="text-sm text-pink-300 font-medium truncate">#{8 - i} {topWomen[7 - i].name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
            )}
          </div>
        )}

        {/* ── Fixed ── */}
        {mode === "FIXED" && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-zinc-400">
              {pendingPlayer
                ? <span className="text-lime-400 font-semibold">Now tap a partner for {pendingPlayer.name}</span>
                : isSplitGender ? "Tap two players of the same gender to form a team." : "Tap two players to form a team."}
            </p>
            {isSplitGender ? (
              <div className="flex flex-col gap-5">
                <PoolSection
                  pool={topMen} gender="MALE" usedSet={usedInMens}
                  teams={manualMensTeams}
                  onRemove={(i) => setManualMensTeams((prev) => prev.filter((_, j) => j !== i))}
                  prefix="m"
                />
                <PoolSection
                  pool={topWomen} gender="FEMALE" usedSet={usedInWomens}
                  teams={manualWomensTeams}
                  onRemove={(i) => setManualWomensTeams((prev) => prev.filter((_, j) => j !== i))}
                  prefix="w"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {(["MALE", "FEMALE"] as const).map((gender) => {
                  const pool = gender === "MALE" ? topMen : topWomen;
                  const isMale = gender === "MALE";
                  if (pool.length === 0) return null;
                  return (
                    <div key={gender}>
                      <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${isMale ? "text-sky-400" : "text-pink-400"}`}>
                        {isMale ? "Men" : "Women"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {pool.map((p, i) => <PoolChip key={p.name} player={p} index={i} used={usedInManual.has(p.name)} isMale={isMale} />)}
                      </div>
                    </div>
                  );
                })}
                {manualTeams.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Teams ({manualTeams.length}/4)</p>
                    <div className="flex flex-col gap-1.5">
                      {manualTeams.map((team, i) => (
                        <div key={team.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700">
                          <span className="text-xs text-zinc-500 w-14 shrink-0 self-start pt-0.5">Team {i + 1}</span>
                          <div className="flex flex-col flex-1 gap-0.5">
                            {team.playerNames.map((name) => (
                              <span key={name} className="text-sm text-white font-medium">{name}</span>
                            ))}
                          </div>
                          <button onClick={() => setManualTeams((prev) => prev.filter((_, j) => j !== i))} className="text-zinc-600 hover:text-red-400 text-base leading-none self-start">×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <Button onClick={handleGenerate} disabled={!canGenerate} className="bg-lime-500 hover:bg-lime-400 text-black font-bold">
            Generate Medal Bracket
          </Button>
        )}
        {!canGenerate && mode !== "FIXED" && (
          <p className="text-xs text-zinc-500 -mt-3">Need at least 8 men and 8 women in the session.</p>
        )}
        <HistorySection />
      </div>
    );
  }

  // ── Bracket view ───────────────────────────────────────────────────────────
  const isDual = !!(round.data.mens && round.data.womens);

  function GameCard({ gameKey, game, title, style, bracket, teamById }: {
    gameKey: string; game: BracketGame; title: string;
    style: typeof MEDAL_COLORS.semi; bracket?: "mens" | "womens";
    teamById: Record<string, BracketTeam>;
  }) {
    const scoreKey = bracket ? `${bracket}.${gameKey}` : gameKey;
    const t1 = game.team1Id ? teamById[game.team1Id] : null;
    const t2 = game.team2Id ? teamById[game.team2Id] : null;
    const sc = scores[scoreKey];
    const hasResult = game.team1Score !== null && game.team2Score !== null;
    const isEditing = !!sc;
    const showInputs = isAdmin && (isEditing || (!hasResult && t1 && t2));
    const t1Won = hasResult && game.team1Score! > game.team2Score!;
    const t2Won = hasResult && game.team2Score! > game.team1Score!;

    return (
      <div className={`rounded-xl border p-3 ${style.bg} ${style.border}`}>
        <div className="flex items-center justify-between mb-2.5">
          <span className={`text-xs font-bold ${style.label}`}>{title}</span>
          {hasResult && !isEditing && isAdmin && (
            <button
              onClick={() => setScores((p) => ({ ...p, [scoreKey]: { t1: String(game.team1Score), t2: String(game.team2Score) } }))}
              className="text-xs text-zinc-500 hover:text-zinc-300 underline"
            >Edit</button>
          )}
        </div>
        <MatchupDisplay
          team1={{ names: t1?.playerNames ?? [], score: game.team1Score, won: t1Won }}
          team2={{ names: t2?.playerNames ?? [], score: game.team2Score, won: t2Won }}
          completed={hasResult}
          editing={showInputs ? {
            t1: sc?.t1 ?? "",
            t2: sc?.t2 ?? "",
            onT1Change: (v) => setScores((p) => ({ ...p, [scoreKey]: { t1: v, t2: sc?.t2 ?? "" } })),
            onT2Change: (v) => setScores((p) => ({ ...p, [scoreKey]: { t1: sc?.t1 ?? "", t2: v } })),
            onSave: () => saveScore(gameKey, bracket),
            onCancel: () => setScores((p) => { const n = { ...p }; delete n[scoreKey]; return n; }),
            saving: saving === scoreKey,
          } : undefined}
        />
      </div>
    );
  }

  function BracketSection({ sub, bracket }: { sub: SubBracket; bracket?: "mens" | "womens" }) {
    const teamById = Object.fromEntries(sub.teams.map((t) => [t.id, t]));
    const expandKey = bracket ?? "single";
    const isExpanded = expandedBrackets.has(expandKey);

    const concluded =
      sub.gold.team1Score !== null && sub.gold.team2Score !== null &&
      sub.bronze.team1Score !== null && sub.bronze.team2Score !== null;

    if (concluded && !isExpanded) {
      const goldWinner = sub.gold.team1Score! >= sub.gold.team2Score! ? teamById[sub.gold.team1Id!] : teamById[sub.gold.team2Id!];
      const silver    = sub.gold.team1Score! >= sub.gold.team2Score! ? teamById[sub.gold.team2Id!] : teamById[sub.gold.team1Id!];
      const bronze    = sub.bronze.team1Score! >= sub.bronze.team2Score! ? teamById[sub.bronze.team1Id!] : teamById[sub.bronze.team2Id!];

      return (
        <div className="flex flex-col gap-2">
          {[
            { medal: "🥇", team: goldWinner, bg: "bg-yellow-500/10 border-yellow-500/40", text: "text-yellow-300" },
            { medal: "🥈", team: silver,     bg: "bg-zinc-400/10 border-zinc-400/30",     text: "text-zinc-300" },
            { medal: "🥉", team: bronze,     bg: "bg-orange-600/10 border-orange-600/40", text: "text-orange-400" },
          ].map(({ medal, team, bg, text }) => (
            <div key={medal} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${bg}`}>
              <span className="text-xl w-7 shrink-0">{medal}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${text}`}>{team?.label ?? "TBD"}</p>
                <p className="text-xs text-zinc-500 truncate">{team?.playerNames.join(", ")}</p>
              </div>
            </div>
          ))}
          <button
            onClick={() => setExpandedBrackets((prev) => new Set([...prev, expandKey]))}
            className="text-xs text-zinc-600 hover:text-zinc-300 underline text-center mt-1"
          >
            Show bracket
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {concluded && (
          <button
            onClick={() => setExpandedBrackets((prev) => { const s = new Set(prev); s.delete(expandKey); return s; })}
            className="text-xs text-zinc-600 hover:text-zinc-300 underline text-right"
          >
            Collapse
          </button>
        )}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Semi-Finals</p>
          <div className="grid grid-cols-2 gap-2">
            <GameCard gameKey="semi1" game={sub.semi1} title="Semi-Final 1" style={MEDAL_COLORS.semi} bracket={bracket} teamById={teamById} />
            <GameCard gameKey="semi2" game={sub.semi2} title="Semi-Final 2" style={MEDAL_COLORS.semi} bracket={bracket} teamById={teamById} />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Finals</p>
          <GameCard gameKey="gold" game={sub.gold} title="🥇 Gold Medal" style={MEDAL_COLORS.gold} bracket={bracket} teamById={teamById} />
          <GameCard gameKey="bronze" game={sub.bronze} title="🥉 Bronze Medal" style={MEDAL_COLORS.bronze} bracket={bracket} teamById={teamById} />
        </div>
      </div>
    );
  }

  function ResetControl() {
    if (!isAdmin) return null;
    if (confirmReset) return (
      <div className="flex flex-col gap-2 pt-2">
        <p className="text-xs text-zinc-400 text-center">Save this bracket and start a new one?</p>
        <div className="flex gap-2">
          <Button onClick={handleReset} size="sm" variant="outline" className="flex-1 border-red-900 text-red-400 hover:bg-red-950">
            Save &amp; Reset
          </Button>
          <Button onClick={() => setConfirmReset(false)} size="sm" variant="outline" className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    );
    return (
      <button onClick={() => setConfirmReset(true)} className="text-xs text-zinc-600 hover:text-red-400 underline text-center mt-2">
        Reset bracket
      </button>
    );
  }

  if (isDual) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <p className="text-sm font-bold text-sky-300 uppercase tracking-wide">Men&apos;s Bracket</p>
          </div>
          <BracketSection sub={round.data.mens!} bracket="mens" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-pink-400" />
            <p className="text-sm font-bold text-pink-300 uppercase tracking-wide">Women&apos;s Bracket</p>
          </div>
          <BracketSection sub={round.data.womens!} bracket="womens" />
        </div>
        <ResetControl />
        <HistorySection />
      </div>
    );
  }

  const single: SubBracket = {
    teams: round.data.teams!,
    semi1: round.data.semi1!,
    semi2: round.data.semi2!,
    gold: round.data.gold!,
    bronze: round.data.bronze!,
  };

  return (
    <div className="flex flex-col gap-4">
      <BracketSection sub={single} />
      <ResetControl />
      <HistorySection />
    </div>
  );
}
