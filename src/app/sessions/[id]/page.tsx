"use client";

import { useEffect, useRef, useState, use } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useAdmin } from "@/components/AdminProvider";
import { AddPlayersSheet } from "@/components/AddPlayersSheet";
import { GenerateDialog } from "@/components/GenerateDialog";
import { AddCourtDialog } from "@/components/AddCourtDialog";
import { EditDateDialog } from "@/components/EditDateDialog";
import { CreateTeamDialog } from "@/components/CreateTeamDialog";
import { AddOverrideDialog } from "@/components/AddOverrideDialog";
import { MedalRoundTab } from "@/components/MedalRoundTab";
import { MatchupDisplay } from "@/components/MatchupDisplay";
import { GameCard, formatColor, formatLabel, podColors } from "@/components/GameCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Player {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE";
}

interface Court {
  id: string;
  number: number;
  format: "MIXED" | "MENS" | "WOMENS" | "ANY";
}

interface SessionPlayer {
  id: string;
  playerId: string;
  player: Player;
  division: "UPPER" | "LOWER" | null;
}

interface Team {
  id: string;
  player1: Player;
  player2: Player;
}

interface PlayerOverride {
  id: string;
  player1: Player;
  player2: Player;
  type: "MUST_PARTNER" | "MUST_NOT_PARTNER";
}

interface Pod {
  id: string;
  name: string;
  sessionPlayers: { id: string; playerId: string }[];
  teams: { id: string }[];
}

interface Session {
  id: string;
  name: string | null;
  date: string;
  endTime: string | null;
  sessionFormat: "ROTATING" | "FIXED";
  hasMedalRound: boolean;
  hasDivisions: boolean;
  courts: Court[];
  sessionPlayers: SessionPlayer[];
  teams: Team[];
  playerOverrides: PlayerOverride[];
  pods: Pod[];
}

interface Game {
  id: string;
  courtId: string;
  roundNumber: number;
  team1Player1: Player;
  team1Player2: Player;
  team2Player1: Player;
  team2Player2: Player;
  team1Id: string | null;
  team2Id: string | null;
  team1Score: number | null;
  team2Score: number | null;
  completed: boolean;
  court: Court;
}



export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isAdmin } = useAdmin();
  const [session, setSession] = useState<Session | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [addPlayersOpen, setAddPlayersOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [addCourtOpen, setAddCourtOpen] = useState(false);
  const [editDateOpen, setEditDateOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [scores, setScores] = useState<Record<string, { t1: string; t2: string }>>({});
  const [savingRound, setSavingRound] = useState<number | null>(null);
  const [roundEditMode, setRoundEditMode] = useState<number | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [addOverrideOpen, setAddOverrideOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [podPickerOpen, setPodPickerOpen] = useState<string | null>(null);
  const [editingPodId, setEditingPodId] = useState<string | null>(null);
  const [podNameInput, setPodNameInput] = useState("");
  const [selectedPodTeamId, setSelectedPodTeamId] = useState<string | null>(null);
  const [divPickerOpen, setDivPickerOpen] = useState<string | null>(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(600);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadSession() {
    const res = await fetch(`/api/sessions/${id}`);
    setSession(await res.json());
  }

  async function loadGames() {
    const res = await fetch(`/api/sessions/${id}/games`);
    setGames(await res.json());
  }

  useEffect(() => {
    loadSession();
    loadGames();
  }, [id]);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSecondsLeft((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  async function removePlayer(playerId: string) {
    await fetch(`/api/sessions/${id}/players`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
    loadSession();
  }

  async function assignDivision(sessionPlayerId: string, division: "UPPER" | "LOWER" | null) {
    const res = await fetch(`/api/session-players/${sessionPlayerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ division }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Failed to save division: ${err.message ?? err.error ?? res.status}`);
      return;
    }
    loadSession();
  }

  async function openDivisions() {
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasDivisions: true }),
    });
    if (!res.ok) {
      alert(`Failed to enable divisions: ${res.status}`);
      return;
    }
    loadSession();
  }

  async function clearAllDivisions() {
    await Promise.all([
      fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasDivisions: false }),
      }),
      ...session!.sessionPlayers
        .filter((sp) => sp.division)
        .map((sp) =>
          fetch(`/api/session-players/${sp.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ division: null }),
          })
        ),
    ]);
    loadSession();
  }

  async function addCourt(courtFormat: string) {
    await fetch(`/api/sessions/${id}/courts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: courtFormat }),
    });
    loadSession();
  }

  async function removeCourt(courtId: string) {
    await fetch(`/api/courts/${courtId}`, { method: "DELETE" });
    loadSession();
  }

  async function updateDate(start: Date, end: Date | null) {
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: start.toISOString().replace("Z", "+00:00"),
        endTime: end ? end.toISOString().replace("Z", "+00:00") : null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Failed to save: ${err.error ?? res.status}`);
      return;
    }
    // Immediately patch the local state so UI updates without waiting for full reload
    const updated = await res.json();
    setSession((prev) => prev ? { ...prev, date: updated.date, endTime: updated.endTime } : prev);
    setEditDateOpen(false);
    // Full reload in background to sync includes
    loadSession();
  }

  async function toggleFormat() {
    const next = session!.sessionFormat === "ROTATING" ? "FIXED" : "ROTATING";
    setSession((prev) => prev ? { ...prev, sessionFormat: next } : prev);
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionFormat: next }),
    });
  }

  async function toggleMedalRound() {
    const next = !session!.hasMedalRound;
    setSession((prev) => prev ? { ...prev, hasMedalRound: next } : prev);
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasMedalRound: next }),
    });
  }

  async function saveName() {
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput }),
    });
    setEditingName(false);
    loadSession();
  }

  async function deleteOverride(overrideId: string) {
    await fetch(`/api/overrides/${overrideId}`, { method: "DELETE" });
    loadSession();
  }

  async function deleteTeam(teamId: string) {
    await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    loadSession();
  }

  async function createPod() {
    const existingCount = session?.pods?.length ?? 0;
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const name = `Pod ${letters[existingCount] ?? (existingCount + 1)}`;
    const res = await fetch(`/api/sessions/${id}/pods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to create pod");
      return;
    }
    await loadSession();
  }

  async function savePodName(podId: string) {
    if (!podNameInput.trim()) return;
    await fetch(`/api/pods/${podId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: podNameInput }),
    });
    setEditingPodId(null);
    await loadSession();
  }

  async function deletePod(podId: string) {
    await fetch(`/api/pods/${podId}`, { method: "DELETE" });
    loadSession();
  }

  async function assignPlayerToPod(sessionPlayerId: string, podId: string | null) {
    await fetch(`/api/session-players/${sessionPlayerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podId }),
    });
    loadSession();
  }

  async function assignTeamToPod(teamId: string, podId: string | null) {
    await fetch(`/api/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podId }),
    });
    loadSession();
  }

  async function updateCourtFormat(courtId: string, format: string) {
    await fetch(`/api/courts/${courtId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format }),
    });
    loadSession();
  }

  async function submitScore(gameId: string) {
    const s = scores[gameId];
    if (!s) return;
    const t1 = parseInt(s.t1);
    const t2 = parseInt(s.t2);
    if (isNaN(t1) || isNaN(t2)) return;
    await fetch(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team1Score: t1, team2Score: t2 }),
    });
    loadGames();
    setScores((prev) => { const next = { ...prev }; delete next[gameId]; return next; });
  }

  async function saveRound(roundGames: Game[]) {
    const toSave = roundGames.filter((g) => {
      const s = scores[g.id];
      return s && !isNaN(parseInt(s.t1)) && !isNaN(parseInt(s.t2));
    });
    if (toSave.length === 0) return;
    setSavingRound(toSave[0].roundNumber);
    await Promise.all(toSave.map((g) =>
      fetch(`/api/games/${g.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team1Score: parseInt(scores[g.id].t1), team2Score: parseInt(scores[g.id].t2) }),
      })
    ));
    loadGames();
    setScores((prev) => {
      const next = { ...prev };
      toSave.forEach((g) => delete next[g.id]);
      return next;
    });
    setSavingRound(null);
    setRoundEditMode(null);
  }

  function cancelRound(roundGames: Game[]) {
    setRoundEditMode(null);
    setScores((prev) => {
      const next = { ...prev };
      roundGames.forEach((g) => delete next[g.id]);
      return next;
    });
  }

  function clearGameScore(gameId: string) {
    setScores((prev) => {
      const next = { ...prev };
      delete next[gameId];
      return next;
    });
  }

  const leaderboard = (() => {
    const stats: Record<string, { name: string; wins: number; losses: number; pointDiff: number; scored: number; allowed: number; played: number; scheduled: number }> = {};

    if (session?.sessionFormat === "FIXED") {
      const teamName = (t: Team) => `${t.player1.name} & ${t.player2.name}`;
      for (const g of games) {
        if (!g.team1Id || !g.team2Id) continue;
        if (!stats[g.team1Id]) {
          const team = session.teams.find((t) => t.id === g.team1Id);
          stats[g.team1Id] = { name: team ? teamName(team) : "Team", wins: 0, losses: 0, pointDiff: 0, scored: 0, allowed: 0, played: 0, scheduled: 0 };
        }
        if (!stats[g.team2Id]) {
          const team = session.teams.find((t) => t.id === g.team2Id);
          stats[g.team2Id] = { name: team ? teamName(team) : "Team", wins: 0, losses: 0, pointDiff: 0, scored: 0, allowed: 0, played: 0, scheduled: 0 };
        }
        stats[g.team1Id].scheduled++;
        stats[g.team2Id].scheduled++;
        if (!g.completed || g.team1Score === null || g.team2Score === null) continue;
        const t1Won = g.team1Score > g.team2Score;
        if (t1Won) stats[g.team1Id].wins++; else stats[g.team1Id].losses++;
        if (!t1Won) stats[g.team2Id].wins++; else stats[g.team2Id].losses++;
        stats[g.team1Id].pointDiff += g.team1Score - g.team2Score;
        stats[g.team2Id].pointDiff += g.team2Score - g.team1Score;
        stats[g.team1Id].scored += g.team1Score;
        stats[g.team1Id].allowed += g.team2Score;
        stats[g.team2Id].scored += g.team2Score;
        stats[g.team2Id].allowed += g.team1Score;
        stats[g.team1Id].played++;
        stats[g.team2Id].played++;
      }
    } else {
      for (const g of games) {
        for (const p of [g.team1Player1, g.team1Player2, g.team2Player1, g.team2Player2]) {
          if (!stats[p.id]) stats[p.id] = { name: p.name, wins: 0, losses: 0, pointDiff: 0, scored: 0, allowed: 0, played: 0, scheduled: 0 };
        }
        stats[g.team1Player1.id].scheduled++;
        stats[g.team1Player2.id].scheduled++;
        stats[g.team2Player1.id].scheduled++;
        stats[g.team2Player2.id].scheduled++;
        if (!g.completed || g.team1Score === null || g.team2Score === null) continue;
        const t1Won = g.team1Score > g.team2Score;
        for (const p of [g.team1Player1, g.team1Player2]) {
          if (t1Won) stats[p.id].wins++; else stats[p.id].losses++;
          stats[p.id].pointDiff += g.team1Score - g.team2Score;
          stats[p.id].scored += g.team1Score;
          stats[p.id].allowed += g.team2Score;
          stats[p.id].played++;
        }
        for (const p of [g.team2Player1, g.team2Player2]) {
          if (!t1Won) stats[p.id].wins++; else stats[p.id].losses++;
          stats[p.id].pointDiff += g.team2Score - g.team1Score;
          stats[p.id].scored += g.team2Score;
          stats[p.id].allowed += g.team1Score;
          stats[p.id].played++;
        }
      }
    }

    const entries = Object.values(stats);

    return entries.sort((a, b) => {
      const aAvg = a.played > 0 ? a.pointDiff / a.played : 0;
      const bAvg = b.played > 0 ? b.pointDiff / b.played : 0;
      return bAvg - aAvg;
    });
  })();

  // Ranked player list for medal rounds — same sort order as the scores tab.
  // Keyed by player name; gender joined from sessionPlayers.
  const rankedPlayers: { name: string; gender: "MALE" | "FEMALE"; wins: number; pointDiff: number; played: number }[] = (() => {
    if (!session || session.sessionFormat !== "ROTATING") return [];
    const nameToGender = new Map(
      session.sessionPlayers.map((sp) => [sp.player.name, sp.player.gender])
    );
    return leaderboard.flatMap((entry) => {
      const gender = nameToGender.get(entry.name);
      if (!gender) return [];
      return [{ name: entry.name, gender, wins: entry.wins, pointDiff: entry.pointDiff, played: entry.played }];
    });
  })();

  const roundsMap = games.reduce<Record<number, Game[]>>((acc, g) => {
    if (!acc[g.roundNumber]) acc[g.roundNumber] = [];
    acc[g.roundNumber].push(g);
    return acc;
  }, {});

  // Sort: incomplete rounds first (ascending), completed rounds at bottom (ascending)
  const rounds = Object.entries(roundsMap).sort(([aNum, aGames], [bNum, bGames]) => {
    const aComplete = aGames.every((g) => g.completed);
    const bComplete = bGames.every((g) => g.completed);
    if (aComplete !== bComplete) return aComplete ? 1 : -1;
    return Number(aNum) - Number(bNum);
  });

  function editRound(roundGames: Game[]) {
    setRoundEditMode(roundGames[0]?.roundNumber ?? null);
    setScores((prev) => {
      const next = { ...prev };
      for (const g of roundGames) {
        if (g.completed) {
          next[g.id] = {
            t1: String(g.team1Score ?? ""),
            t2: String(g.team2Score ?? ""),
          };
        }
      }
      return next;
    });
  }

  function byesForRound(roundGames: Game[]): Player[] {
    const playing = new Set(
      roundGames.flatMap((g) => [
        g.team1Player1.id, g.team1Player2.id,
        g.team2Player1.id, g.team2Player2.id,
      ])
    );
    return session?.sessionPlayers
      .map((sp) => sp.player)
      .filter((p) => !playing.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name)) ?? [];
  }

  function byeTeamsForRound(roundGames: Game[]): Team[] {
    const playingTeamIds = new Set(
      roundGames.flatMap((g) => [g.team1Id, g.team2Id].filter(Boolean) as string[])
    );
    return session?.teams.filter((t) => !playingTeamIds.has(t.id)) ?? [];
  }

  if (!session) return <div className="text-zinc-400 py-12 text-center">Loading...</div>;

  const divisionMap = Object.fromEntries(
    session.sessionPlayers.map((sp) => [sp.playerId, sp.division ?? null])
  );

  return (
    <div>
      <div className="mb-6">
        {/* Name */}
        {editingName ? (
          <div className="flex items-center gap-2 mb-1">
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
              placeholder="Session name"
              className="flex-1 text-2xl font-bold bg-transparent border-b border-zinc-600 outline-none text-white placeholder-zinc-600"
            />
            <button onClick={saveName} className="text-lime-400 text-sm font-semibold">Save</button>
            <button onClick={() => setEditingName(false)} className="text-zinc-500 text-sm">Cancel</button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div>
              {session.name && (
                <h1
                  className="text-2xl font-bold text-white cursor-pointer hover:text-zinc-300"
                  onClick={isAdmin ? () => { setNameInput(session.name ?? ""); setEditingName(true); } : undefined}
                >
                  {session.name}
                </h1>
              )}
              <p className={session.name ? "text-zinc-400" : "text-2xl font-bold text-white"}>
                {format(new Date(session.date), "EEEE, MMMM d")}
              </p>
              <p className="text-zinc-400 text-sm">
                {format(new Date(session.date), "h:mm a")}
                {session.endTime && ` – ${format(new Date(session.endTime), "h:mm a")}`}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <button
                  onClick={isAdmin ? toggleFormat : undefined}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                    session.sessionFormat === "ROTATING"
                      ? "bg-violet-400/20 text-violet-400"
                      : "bg-amber-400/20 text-amber-400"
                  } ${isAdmin ? "hover:opacity-75 cursor-pointer" : "cursor-default"}`}
                >
                  {session.sessionFormat === "ROTATING" ? "Rotating Partners" : "Fixed Partners"}
                </button>
                {session.sessionFormat === "ROTATING" && (
                  <button
                    onClick={isAdmin ? toggleMedalRound : undefined}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                      session.hasMedalRound
                        ? "bg-yellow-900/50 text-yellow-400"
                        : "bg-zinc-800 text-zinc-500"
                    } ${isAdmin ? "hover:opacity-75 cursor-pointer" : "cursor-default"}`}
                  >
                    {session.hasMedalRound ? "With Medal Rounds" : "No Medal Rounds"}
                  </button>
                )}
              </div>
            </div>
            {isAdmin && (
              <div className="flex flex-col items-end gap-1 shrink-0">
                {!session.name && (
                  <button
                    onClick={() => { setNameInput(""); setEditingName(true); }}
                    className="text-xs text-zinc-500 hover:text-zinc-200 underline"
                  >
                    + Name
                  </button>
                )}
                <button
                  onClick={() => setEditDateOpen(true)}
                  className="text-xs text-zinc-500 hover:text-zinc-200 underline"
                >
                  Edit date
                </button>
                <button
                  onClick={() => window.open(`/sessions/${id}/print`, "_blank")}
                  className="text-xs text-zinc-500 hover:text-zinc-200 underline"
                >
                  QR code
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="players">
        <TabsList className={`w-full mb-4 grid ${session.hasMedalRound ? "grid-cols-5" : "grid-cols-4"}`}>
          <TabsTrigger value="players" className="text-xs">Players</TabsTrigger>
          <TabsTrigger value="courts" className="text-xs">Courts</TabsTrigger>
          <TabsTrigger value="schedule" className="text-xs">Schedule</TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-xs">Scores</TabsTrigger>
          {session.hasMedalRound && <TabsTrigger value="medals" className="text-xs">Medals</TabsTrigger>}
        </TabsList>

        {/* PLAYERS TAB */}
        <TabsContent value="players">
          {/* ── Shared header ── */}
          <div className="mb-4">
            <span className="text-sm text-zinc-400">{session.sessionPlayers.length} players</span>
          </div>

          {/* ── Rotating: gender groups grid ── */}
          {session.sessionFormat === "ROTATING" && (() => {
            const mensCourts  = session.courts.filter((c) => c.format === "MENS").length;
            const womensCourts = session.courts.filter((c) => c.format === "WOMENS").length;
            const mixedCourts = session.courts.filter((c) => c.format === "MIXED").length;
            const malesPerRound   = mensCourts * 4 + mixedCourts * 2;
            const femalesPerRound = womensCourts * 4 + mixedCourts * 2;

            function idealHint(count: number, perRound: number): { text: string; perfect: boolean } | null {
              if (perRound === 0 || count === 0) return null;
              if (count % perRound === 0) return { text: "equal games guaranteed", perfect: true };
              const prev = Math.floor(count / perRound) * perRound;
              const next = prev + perRound;
              const parts = [];
              if (prev > 0) parts.push(prev);
              parts.push(next);
              return { text: `for equal games: ${parts.join(" or ")} players`, perfect: false };
            }

            return (
            <>
              {session.sessionPlayers.length === 0 ? (
                <p className="text-zinc-500 text-center py-10 text-sm">No players yet.</p>
              ) : (session.hasDivisions && isAdmin) ? null : (
                <div className="flex flex-col gap-5">
                  {(["MALE", "FEMALE"] as const).map((gender) => {
                    const group = [...session.sessionPlayers]
                      .filter((sp) => sp.player.gender === gender)
                      .sort((a, b) => a.player.name.localeCompare(b.player.name));
                    if (group.length === 0) return null;
                    const isMale = gender === "MALE";
                    const hint = idealHint(group.length, isMale ? malesPerRound : femalesPerRound);
                    const upper = group.filter((sp) => sp.division === "UPPER");
                    const lower = group.filter((sp) => sp.division === "LOWER");
                    return (
                      <div key={gender}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-2 h-2 rounded-full ${isMale ? "bg-sky-400" : "bg-pink-400"}`} />
                          <span className="text-sm font-semibold text-zinc-200">{isMale ? "Men" : "Women"}</span>
                          <span className="text-xs text-zinc-500">{group.length}</span>
                          {hint && (
                            <span className={`text-xs ml-1 ${hint.perfect ? "text-lime-500" : "text-zinc-600"}`}>
                              · {hint.text}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {group.map((sp) => (
                            <div
                              key={sp.id}
                              className={`relative rounded-lg border px-2 py-2.5 flex flex-col items-center gap-1 text-center ${
                                isMale ? "border-sky-900 bg-sky-950" : "border-pink-900 bg-pink-950"
                              }`}
                            >
                              {isAdmin && (
                                <button
                                  onClick={() => removePlayer(sp.playerId)}
                                  className="absolute top-1 right-1.5 text-zinc-600 hover:text-red-400 text-xs leading-none"
                                >×</button>
                              )}
                              {isAdmin && sp.division && (
                                <span className={`absolute top-1 left-1.5 w-1.5 h-1.5 rounded-full ${sp.division === "UPPER" ? "bg-amber-400" : "bg-sky-400"}`} />
                              )}
                              <span className="text-xs font-medium leading-tight break-words w-full pt-1">{sp.player.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* ── Pods section (rotating mode) ── */}
              {isAdmin && session.sessionPlayers.length > 0 && !session.hasDivisions && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-sm font-semibold text-zinc-200">Pods</span>
                      <span className="text-xs text-zinc-500 ml-2">optional sub-groups</span>
                    </div>
                    <button
                      onClick={createPod}
                      className="text-xs text-lime-400 hover:text-lime-300 font-medium"
                    >
                      + Add Pod
                    </button>
                  </div>
                  {session.pods.length === 0 ? (
                    <p className="text-xs text-zinc-600 italic">No pods — everyone plays everyone.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {session.pods.map((pod) => {
                        const assignedSps = session.sessionPlayers.filter((sp) =>
                          pod.sessionPlayers.some((psp) => psp.id === sp.id)
                        );
                        const unassignedSps = session.sessionPlayers.filter(
                          (sp) => !session.pods.some((p) => p.sessionPlayers.some((psp) => psp.id === sp.id))
                        );
                        return (
                          <div key={pod.id} className="rounded-xl border border-zinc-700 bg-zinc-900 p-3">
                            <div className="flex items-center justify-between mb-2">
                              {editingPodId === pod.id ? (
                                <input
                                  autoFocus
                                  value={podNameInput}
                                  onChange={(e) => setPodNameInput(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") savePodName(pod.id); if (e.key === "Escape") setEditingPodId(null); }}
                                  onBlur={() => savePodName(pod.id)}
                                  className="text-sm font-semibold bg-transparent border-b border-zinc-600 outline-none text-white flex-1 mr-2"
                                />
                              ) : (
                                <span
                                  className={`text-sm font-semibold text-zinc-200 ${isAdmin ? "cursor-pointer hover:text-white" : ""}`}
                                  onClick={isAdmin ? () => { setPodNameInput(pod.name); setEditingPodId(pod.id); } : undefined}
                                >{pod.name}</span>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500">{assignedSps.length} players</span>
                                <button
                                  onClick={() => deletePod(pod.id)}
                                  className="text-zinc-600 hover:text-red-400 text-base leading-none"
                                >×</button>
                              </div>
                            </div>
                            {assignedSps.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {assignedSps.map((sp) => {
                                  const isMale = sp.player.gender === "MALE";
                                  return (
                                    <span
                                      key={sp.id}
                                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                                        isMale ? "bg-sky-900/60 text-sky-300 border border-sky-800" : "bg-pink-900/60 text-pink-300 border border-pink-800"
                                      }`}
                                    >
                                      {sp.player.name}
                                      <button
                                        onClick={() => assignPlayerToPod(sp.id, null)}
                                        className="text-zinc-500 hover:text-red-400 leading-none ml-0.5"
                                      >×</button>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-600 italic mb-2">No players assigned.</p>
                            )}
                            {unassignedSps.length > 0 && (
                              <div>
                                {podPickerOpen === pod.id ? (
                                  <div className="mt-1">
                                    <div className="flex flex-wrap gap-1.5">
                                      {unassignedSps.map((sp) => {
                                        const isMale = sp.player.gender === "MALE";
                                        return (
                                          <button
                                            key={sp.id}
                                            onClick={async () => {
                                              await assignPlayerToPod(sp.id, pod.id);
                                              // keep picker open if more unassigned
                                            }}
                                            className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                                              isMale
                                                ? "bg-sky-950 text-sky-400 border border-sky-800 hover:bg-sky-900"
                                                : "bg-pink-950 text-pink-400 border border-pink-800 hover:bg-pink-900"
                                            }`}
                                          >
                                            + {sp.player.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <button
                                      onClick={() => setPodPickerOpen(null)}
                                      className="text-xs text-zinc-500 hover:text-zinc-300 mt-1.5"
                                    >
                                      Done
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setPodPickerOpen(pod.id)}
                                    className="text-xs text-lime-500 hover:text-lime-400 font-medium"
                                  >
                                    + Add players
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {isAdmin && (
                <div className="mt-5 flex justify-end">
                  <Button
                    onClick={() => setGenerateOpen(true)}
                    size="sm"
                    className="bg-lime-500 hover:bg-lime-400 text-black font-bold"
                  >
                    Generate Schedule
                  </Button>
                </div>
              )}
            </>
            );
          })()}

          {/* ── Divisions section (all formats) ── */}
          {isAdmin && session.sessionPlayers.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-semibold text-zinc-200">Divisions</span>
                  <span className="text-xs text-zinc-500 ml-2">upper &amp; lower skill pools</span>
                </div>
                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <Button onClick={() => setAddPlayersOpen(true)} size="sm" className="bg-lime-500 hover:bg-lime-400 text-black font-bold">
                      + Add Players
                    </Button>
                  )}
                  {isAdmin && (session.hasDivisions ? (
                    <button onClick={clearAllDivisions} className="text-xs text-zinc-500 hover:text-red-400 font-medium transition-colors">
                      Remove
                    </button>
                  ) : (
                    <button onClick={openDivisions} className="text-xs text-lime-400 hover:text-lime-300 font-medium">
                      + Add Division
                    </button>
                  ))}
                </div>
              </div>

              {!session.hasDivisions ? (
                <p className="text-xs text-zinc-600 italic">No divisions — everyone mixes freely.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {(["MALE", "FEMALE"] as const).map((gender) => {
                    const isMale = gender === "MALE";
                    const genderPlayers = session.sessionPlayers
                      .filter((sp) => sp.player.gender === gender)
                      .sort((a, b) => a.player.name.localeCompare(b.player.name));
                    if (genderPlayers.length === 0) return null;
                    const unassigned = genderPlayers.filter((sp) => !sp.division);

                    return (
                      <div key={gender} className="rounded-xl border border-zinc-700 bg-zinc-900 p-3">
                        {/* Gender header */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`w-2 h-2 rounded-full ${isMale ? "bg-sky-400" : "bg-pink-400"}`} />
                          <span className="text-sm font-semibold text-zinc-200">{isMale ? "Men" : "Women"}</span>
                          <span className="text-xs text-zinc-500">{genderPlayers.length}</span>
                        </div>

                        {/* Upper and Lower stacked */}
                        <div className="flex flex-col gap-3 mb-2">
                          {(["UPPER", "LOWER"] as const).map((div) => {
                            const isUpper = div === "UPPER";
                            const bucket = genderPlayers.filter((sp) => sp.division === div);
                            return (
                              <div key={div}>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${isUpper ? "bg-amber-400" : "bg-sky-400"}`} />
                                  <span className={`text-xs font-semibold ${isUpper ? "text-amber-400" : "text-sky-400"}`}>
                                    {isUpper ? "Upper" : "Lower"}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {bucket.map((sp) => (
                                    <span
                                      key={sp.id}
                                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                                        isMale ? "bg-sky-900/60 text-sky-300 border border-sky-800" : "bg-pink-900/60 text-pink-300 border border-pink-800"
                                      }`}
                                    >
                                      {sp.player.name}
                                      {isAdmin && <button onClick={() => assignDivision(sp.id, null)} className="text-zinc-500 hover:text-red-400 leading-none ml-0.5">×</button>}
                                    </span>
                                  ))}
                                  {bucket.length === 0 && <p className="text-xs text-zinc-700 italic">None</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Unassigned picker */}
                        {isAdmin && unassigned.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-zinc-800">
                            {divPickerOpen === gender ? (
                              <div>
                                <div className="flex flex-wrap gap-1.5 mb-1">
                                  {unassigned.map((sp) => (
                                    <div key={sp.id} className="flex items-stretch rounded-lg overflow-hidden border border-zinc-700">
                                      <button
                                        onClick={() => assignDivision(sp.id, "UPPER")}
                                        className="text-[10px] font-bold px-2 bg-zinc-800 text-amber-600 hover:bg-amber-900/60 hover:text-amber-300 transition-colors"
                                      >U</button>
                                      <span className="text-xs px-2 py-1 bg-zinc-800 border-x border-zinc-700 text-zinc-300">
                                        {sp.player.name.split(" ")[0]}
                                      </span>
                                      <button
                                        onClick={() => assignDivision(sp.id, "LOWER")}
                                        className="text-[10px] font-bold px-2 bg-zinc-800 text-sky-600 hover:bg-sky-900/60 hover:text-sky-300 transition-colors border-r border-zinc-700"
                                      >L</button>
                                      <button
                                        onClick={() => removePlayer(sp.playerId)}
                                        className="text-[10px] px-2 bg-zinc-800 text-zinc-600 hover:bg-red-950 hover:text-red-400 transition-colors"
                                      >×</button>
                                    </div>
                                  ))}
                                </div>
                                <button onClick={() => setDivPickerOpen(null)} className="text-xs text-zinc-500 hover:text-zinc-300">Done</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDivPickerOpen(gender)}
                                className="text-xs text-lime-500 hover:text-lime-400 font-medium"
                              >
                                + Assign players
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Fixed: player roster + team builder ── */}
          {session.sessionFormat === "FIXED" && (() => {
            const teamedPlayerIds = new Set(
              session.teams.flatMap((t) => [t.player1.id, t.player2.id])
            );
            const unteamed = session.sessionPlayers
              .filter((sp) => !teamedPlayerIds.has(sp.playerId))
              .map((sp) => sp.player)
              .sort((a, b) => a.name.localeCompare(b.name));
            const hasMixed = session.courts.some((c) => c.format === "MIXED");

            return (
              <>
                {/* Teams header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-zinc-200">Teams ({session.teams.length})</span>
                  <div className="flex items-center gap-2">
                    {isAdmin && session.teams.length > 0 && (
                      <button onClick={createPod} className="text-xs text-zinc-500 hover:text-lime-400 font-medium">+ Add Pod</button>
                    )}
                    {isAdmin && (
                      <Button onClick={() => setCreateTeamOpen(true)} size="sm" variant="outline" disabled={unteamed.length < 2}>
                        + Create Team
                      </Button>
                    )}
                  </div>
                </div>

                {session.teams.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-4">No teams yet. Pair players up.</p>
                ) : (() => {
                  // Shared team card renderer
                  function TeamCard({ team, n, inPod }: { team: Team; n: number; inPod?: boolean }) {
                    const isMens = team.player1.gender === "MALE" && team.player2.gender === "MALE";
                    const isWomens = team.player1.gender === "FEMALE" && team.player2.gender === "FEMALE";
                    const border = isMens ? "border-sky-900" : isWomens ? "border-pink-900" : "border-purple-900";
                    const bg = isMens ? "bg-sky-950" : isWomens ? "bg-pink-950" : "bg-purple-950";
                    return (
                      <div className={`rounded-xl border ${border} ${bg} px-3 py-2.5`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-zinc-500">Team {n}</span>
                          {isAdmin && !inPod && (
                            <button onClick={() => deleteTeam(team.id)} className="text-zinc-600 hover:text-red-400 text-base leading-none">×</button>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          {[team.player1, team.player2].map((player) => (
                            <div key={player.id} className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${player.gender === "MALE" ? "bg-sky-400" : "bg-pink-400"}`} />
                              <span className="text-sm font-medium text-white truncate">{player.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  const hasPods = session.pods.length > 0;
                  const podTeamIds = new Set(session.pods.flatMap(p => p.teams.map(t => t.id)));
                  const unassignedTeams = session.teams.filter(t => !podTeamIds.has(t.id));
                  let globalIdx = 0;

                  if (!hasPods) {
                    // No pods: gender-grouped layout
                    type TeamPool = { label: string; dot: string; teams: typeof session.teams };
                    const pools: TeamPool[] = [
                      { label: "Men's",   dot: "bg-sky-400",    teams: session.teams.filter(t => t.player1.gender === "MALE"   && t.player2.gender === "MALE") },
                      { label: "Women's", dot: "bg-pink-400",   teams: session.teams.filter(t => t.player1.gender === "FEMALE" && t.player2.gender === "FEMALE") },
                      { label: "Mixed",   dot: "bg-purple-400", teams: session.teams.filter(t => t.player1.gender !== t.player2.gender) },
                    ].filter(pool => pool.teams.length > 0);
                    return (
                      <div className="flex flex-col gap-5 mb-4">
                        {pools.map(pool => (
                          <div key={pool.label}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className={`w-2 h-2 rounded-full ${pool.dot}`} />
                              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{pool.label} ({pool.teams.length})</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {pool.teams.map(team => <TeamCard key={team.id} team={team} n={++globalIdx} />)}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }

                  // Pods exist: pod-grouped layout
                  return (
                    <div className="flex flex-col gap-4 mb-4">
                      {session.pods.map(pod => {
                        const podTeams = session.teams.filter(t => pod.teams.some(pt => pt.id === t.id));
                        const available = unassignedTeams; // teams not yet in any pod
                        return (
                          <div key={pod.id} className="rounded-xl border border-zinc-700 bg-zinc-900 p-3">
                            <div className="flex items-center justify-between mb-3">
                              {editingPodId === pod.id ? (
                                <input autoFocus value={podNameInput}
                                  onChange={(e) => setPodNameInput(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") savePodName(pod.id); if (e.key === "Escape") setEditingPodId(null); }}
                                  onBlur={() => savePodName(pod.id)}
                                  className="text-sm font-semibold bg-transparent border-b border-zinc-600 outline-none text-white flex-1 mr-2"
                                />
                              ) : (
                                <span className={`text-sm font-semibold text-zinc-200 ${isAdmin ? "cursor-pointer hover:text-white" : ""}`}
                                  onClick={isAdmin ? () => { setPodNameInput(pod.name); setEditingPodId(pod.id); } : undefined}>
                                  {pod.name}
                                </span>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500">{podTeams.length} teams</span>
                                {isAdmin && <button onClick={() => deletePod(pod.id)} className="text-zinc-600 hover:text-red-400 text-base leading-none">×</button>}
                              </div>
                            </div>
                            {podTeams.length > 0 ? (
                              <div className="grid grid-cols-2 gap-2">
                                {podTeams.map(team => {
                                  const isSelected = selectedPodTeamId === team.id;
                                  return (
                                    <div
                                      key={team.id}
                                      className="relative"
                                      onClick={isAdmin ? () => setSelectedPodTeamId(isSelected ? null : team.id) : undefined}
                                    >
                                      <TeamCard team={team} n={++globalIdx} inPod />
                                      {isAdmin && isSelected && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); assignTeamToPod(team.id, null); setSelectedPodTeamId(null); }}
                                          className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-zinc-700 hover:bg-red-500 text-zinc-300 hover:text-white text-xs leading-none"
                                          title="Remove from pod"
                                        >×</button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-600 italic mb-1">No teams assigned.</p>
                            )}
                            {isAdmin && available.length > 0 && (
                              <div className="mt-2">
                                {podPickerOpen === pod.id ? (
                                  <div>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      {available.map(team => {
                                        const isMens = team.player1.gender === "MALE" && team.player2.gender === "MALE";
                                        const isWomens = team.player1.gender === "FEMALE" && team.player2.gender === "FEMALE";
                                        return (
                                          <button key={team.id} onClick={() => assignTeamToPod(team.id, pod.id)}
                                            className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${
                                              isMens ? "bg-sky-950 text-sky-400 border-sky-800 hover:bg-sky-900"
                                              : isWomens ? "bg-pink-950 text-pink-400 border-pink-800 hover:bg-pink-900"
                                              : "bg-purple-950 text-purple-400 border-purple-800 hover:bg-purple-900"
                                            }`}>
                                            + {team.player1.name} &amp; {team.player2.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <button onClick={() => setPodPickerOpen(null)} className="text-xs text-zinc-500 hover:text-zinc-300 mt-1.5">Done</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setPodPickerOpen(pod.id)} className="text-xs text-lime-500 hover:text-lime-400 font-medium">+ Add teams</button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Unassigned teams */}
                      {unassignedTeams.length > 0 && (
                        <div>
                          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2">Unassigned ({unassignedTeams.length})</p>
                          <div className="grid grid-cols-2 gap-2">
                            {unassignedTeams.map(team => <TeamCard key={team.id} team={team} n={++globalIdx} />)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Unteamed players */}
                {unteamed.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 font-medium mb-2">Not on a team ({unteamed.length})</p>
                    <div className="grid grid-cols-4 gap-2">
                      {unteamed.map((p) => {
                        const isMale = p.gender === "MALE";
                        return (
                          <div key={p.id} className={`relative rounded-lg border px-2 py-2.5 flex flex-col items-center gap-1 text-center ${isMale ? "border-sky-900 bg-sky-950" : "border-pink-900 bg-pink-950"}`}>
                            {isAdmin && (
                              <button onClick={() => removePlayer(p.id)} className="absolute top-1 right-1.5 text-zinc-600 hover:text-red-400 text-xs leading-none">×</button>
                            )}
                            <span className="text-xs font-medium leading-tight break-words w-full pt-1">{p.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}


                <CreateTeamDialog
                  open={createTeamOpen}
                  onClose={() => setCreateTeamOpen(false)}
                  sessionId={id}
                  availablePlayers={unteamed}
                  hasMixedCourt={hasMixed}
                  onCreated={() => { setCreateTeamOpen(false); loadSession(); }}
                />
              </>
            );
          })()}
        </TabsContent>

        {/* COURTS TAB */}
        <TabsContent value="courts">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-zinc-400">{session.courts.length} court{session.courts.length !== 1 ? "s" : ""}</span>
            {isAdmin && session.courts.length < 4 && (
              <Button
                onClick={() => setAddCourtOpen(true)}
                size="sm"
                className="bg-lime-500 hover:bg-lime-400 text-black font-bold"
              >
                + Add Court
              </Button>
            )}
          </div>

          {session.courts.length === 0 ? (
            <p className="text-zinc-500 text-center py-10 text-sm">No courts yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {session.courts.map((court) => (
                <Card key={court.id} className="bg-zinc-900 border-zinc-800">
                  <CardContent className="py-3 px-4 flex items-center justify-between gap-2">
                    <span className="font-semibold text-white shrink-0">
                      Court {court.number}
                    </span>
                    <div className="flex items-center gap-1">
                      <Select
                        value={court.format}
                        onValueChange={(v) => v && updateCourtFormat(court.id, v)}
                      >
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 focus:ring-0 shadow-none w-auto gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${formatColor[court.format]}`}>
                            {formatLabel[court.format]}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MIXED">Mixed</SelectItem>
                          <SelectItem value="MENS">Men&apos;s</SelectItem>
                          <SelectItem value="WOMENS">Women&apos;s</SelectItem>
                          <SelectItem value="ANY">Open</SelectItem>
                        </SelectContent>
                      </Select>
                      {isAdmin && (
                        <button
                          onClick={() => removeCourt(court.id)}
                          className="text-zinc-600 hover:text-red-400 text-base leading-none"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Overrides */}
          {session.sessionPlayers.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-zinc-300">Player Overrides</span>
                {isAdmin && (
                  <button
                    onClick={() => setAddOverrideOpen(true)}
                    className="text-xs text-lime-400 hover:text-lime-300 font-medium"
                  >
                    + Add
                  </button>
                )}
              </div>
              {session.playerOverrides.length === 0 ? (
                <p className="text-xs text-zinc-600 italic">No overrides set.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {session.playerOverrides.map((ov) => (
                    <div
                      key={ov.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                        ov.type === "MUST_PARTNER"
                          ? "border-lime-800 bg-lime-950/50"
                          : "border-red-900 bg-red-950/50"
                      }`}
                    >
                      <span className={`text-xs font-bold shrink-0 ${ov.type === "MUST_PARTNER" ? "text-lime-400" : "text-red-400"}`}>
                        {ov.type === "MUST_PARTNER" ? "ONCE" : "NEVER"}
                      </span>
                      <span className="text-white flex-1">
                        {ov.player1.name} <span className="text-zinc-500">&</span> {ov.player2.name}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => deleteOverride(ov.id)}
                          className="text-zinc-600 hover:text-red-400 text-base leading-none shrink-0"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </TabsContent>

        {/* SCHEDULE TAB */}
        <TabsContent value="schedule">
          {/* Round timer */}
          {games.length > 0 && (() => {
            const mins = Math.floor(timerSecondsLeft / 60);
            const secs = timerSecondsLeft % 60;
            const display = `${mins}:${secs.toString().padStart(2, "0")}`;
            const expired = timerSecondsLeft === 0;
            const low = timerSecondsLeft <= 60 && !expired;
            return (
              <div className={`flex items-center justify-between rounded-xl px-4 py-3 mb-4 border ${
                expired ? "bg-red-950/50 border-red-800" : low ? "bg-amber-950/30 border-amber-800" : "bg-zinc-800 border-zinc-700"
              }`}>
                <span className={`text-2xl font-black tabular-nums tracking-tight ${
                  expired ? "text-red-400" : low ? "text-amber-400" : "text-white"
                }`}>
                  {expired ? "TIME" : display}
                </span>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    {expired ? (
                      <button
                        onClick={() => { setTimerSecondsLeft(600); setTimerRunning(false); }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-200 font-semibold hover:bg-zinc-600 transition-colors"
                      >
                        Reset
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setTimerRunning((r) => !r)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                            timerRunning
                              ? "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
                              : "bg-lime-500 text-black hover:bg-lime-400"
                          }`}
                        >
                          {timerRunning ? "Pause" : timerSecondsLeft === 600 ? "Start" : "Resume"}
                        </button>
                        <button
                          onClick={() => { setTimerSecondsLeft(600); setTimerRunning(false); }}
                          className="text-xs px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-200 font-semibold hover:bg-zinc-600 transition-colors"
                        >
                          Reset
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          {games.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-400">No schedule yet. Use the Players tab to generate one.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {rounds.map(([roundNum, roundGames], idx) => {
                const byes = session.sessionFormat === "FIXED" ? [] : byesForRound(roundGames);
                const byeTeams = session.sessionFormat === "FIXED" ? byeTeamsForRound(roundGames) : [];
                const isRoundComplete = roundGames.every((g) => g.completed);
                const isRoundEditing = roundGames.some((g) => !!scores[g.id]);
                const isRoundEditMode = roundEditMode === Number(roundNum);
                const isCurrent = !isRoundComplete && idx === rounds.findIndex(([, gs]) => !gs.every((g) => g.completed));
                return (
                  <div
                    key={roundNum}
                    className={`relative rounded-xl p-3 transition-opacity ${isRoundComplete && !isRoundEditing ? "opacity-50" : "opacity-100"} bg-zinc-800`}
                  >
                    {isCurrent && (
                      <div className="absolute inset-0 rounded-xl ring-2 ring-lime-500/70 animate-pulse pointer-events-none" />
                    )}
                    {/* Round header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-2 py-0.5 bg-zinc-700 rounded-full">
                          Round {roundNum}
                        </span>
                        {isCurrent && (
                          <span className="text-xs font-semibold text-lime-400 px-2 py-0.5 bg-lime-500/15 rounded-full">
                            Now
                          </span>
                        )}
                      </div>
                      {isAdmin && isRoundComplete && !isRoundEditing && (
                        <button onClick={() => editRound(roundGames)} className="text-xs text-zinc-500 hover:text-zinc-200 underline">
                          Edit
                        </button>
                      )}
                      {isAdmin && isRoundEditMode && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveRound(roundGames)}
                            disabled={savingRound === roundGames[0]?.roundNumber}
                            className="text-xs font-semibold text-lime-400 hover:text-lime-300 disabled:opacity-50"
                          >
                            {savingRound === roundGames[0]?.roundNumber ? "Saving…" : "Save"}
                          </button>
                          <button onClick={() => cancelRound(roundGames)} className="text-xs text-zinc-500 hover:text-zinc-300">
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Games — sorted by court number */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[...roundGames].sort((a, b) => a.court.number - b.court.number).map((game) => {
                        const sc = scores[game.id];
                        const isEditing = !!sc;
                        const isIndividualEdit = isEditing && !isRoundEditMode;
                        const showInputs = isAdmin && (isEditing || !game.completed);

                        // Determine pod from players (rotating) or team (fixed)
                        const gamePodIndex = (() => {
                          if (session.sessionFormat === "FIXED" && game.team1Id) {
                            return session.pods.findIndex((p) => p.teams.some((t) => t.id === game.team1Id));
                          }
                          const pid = game.team1Player1.id;
                          return session.pods.findIndex((p) =>
                            p.sessionPlayers.some((sp) => sp.playerId === pid)
                          );
                        })();
                        const gamePodName = gamePodIndex >= 0 ? session.pods[gamePodIndex].name : undefined;

                        return (
                          <GameCard
                            key={game.id}
                            courtFormat={game.court.format}
                            courtNumber={game.court.number}
                            podName={gamePodName}
                            podIndex={gamePodIndex >= 0 ? gamePodIndex : undefined}
                            team1Names={[game.team1Player1.name, game.team1Player2.name]}
                            team2Names={[game.team2Player1.name, game.team2Player2.name]}
                            team1Divisions={isAdmin ? [divisionMap[game.team1Player1.id], divisionMap[game.team1Player2.id]] : undefined}
                            team2Divisions={isAdmin ? [divisionMap[game.team2Player1.id], divisionMap[game.team2Player2.id]] : undefined}
                            team1Score={game.team1Score}
                            team2Score={game.team2Score}
                            completed={game.completed}
                            highlightWinner={game.completed && !isEditing}
                            onEdit={isAdmin && game.completed && !isEditing && !isRoundEditing
                              ? () => setScores((prev) => ({ ...prev, [game.id]: { t1: String(game.team1Score ?? ""), t2: String(game.team2Score ?? "") } }))
                              : undefined}
                            scoreEntry={showInputs ? {
                              t1: sc?.t1 ?? "",
                              t2: sc?.t2 ?? "",
                              onT1Change: (v) => setScores((prev) => ({ ...prev, [game.id]: { t1: v, t2: sc?.t2 ?? "" } })),
                              onT2Change: (v) => setScores((prev) => ({ ...prev, [game.id]: { t1: sc?.t1 ?? "", t2: v } })),
                              onSave: (!game.completed || isIndividualEdit) ? () => submitScore(game.id) : undefined,
                              onCancel: isIndividualEdit ? () => clearGameScore(game.id) : undefined,
                            } : undefined}
                          />
                        );
                      })}
                    </div>

                    {/* Bye players */}
                    {byes.length > 0 && (
                      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-zinc-500 font-medium">Bye:</span>
                        {byes.map((p) => {
                          const podIndex = session.pods.findIndex((pod) =>
                            pod.sessionPlayers.some((sp) => sp.playerId === p.id)
                          );
                          const colorClass = podIndex >= 0
                            ? podColors[podIndex % podColors.length]
                            : "bg-zinc-800 text-zinc-400";
                          return (
                            <span key={p.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
                              {p.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {byeTeams.length > 0 && (
                      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-zinc-500 font-medium">Bye:</span>
                        {byeTeams.map((t) => {
                          const podIndex = session.pods.findIndex((pod) =>
                            pod.teams.some((pt) => pt.id === t.id)
                          );
                          const isMensTeam = t.player1.gender === "MALE" && t.player2.gender === "MALE";
                          const isWomensTeam = t.player1.gender === "FEMALE" && t.player2.gender === "FEMALE";
                          const colorClass = podIndex >= 0
                            ? podColors[podIndex % podColors.length]
                            : isMensTeam ? "bg-sky-900/50 text-sky-300"
                            : isWomensTeam ? "bg-pink-900/50 text-pink-300"
                            : "bg-zinc-800 text-zinc-400";
                          return (
                            <span key={t.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
                              {t.player1.name} & {t.player2.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* LEADERBOARD TAB */}
        <TabsContent value="leaderboard">
          {leaderboard.length === 0 ? (
            <p className="text-zinc-400 text-center py-12">No scores recorded yet.</p>
          ) : (() => {
            const note = (
              <div className="mb-4 px-1">
                <p className="text-xs text-zinc-500 font-semibold mb-1">Ranked by</p>
                <p className="text-xs text-zinc-600">
                  Ranked by average point differential per game played.
                </p>
              </div>
            );
            const hasMens = session.courts.some((c) => c.format === "MENS");
            const hasWomens = session.courts.some((c) => c.format === "WOMENS");
            const hasMixed = session.courts.some((c) => c.format === "MIXED");
            const showSplit = hasMens && hasWomens && !hasMixed;

            function getEntryGender(name: string): "MALE" | "FEMALE" {
              if (session!.sessionFormat === "FIXED") {
                const team = session!.teams.find((t) => `${t.player1.name} & ${t.player2.name}` === name);
                return (team?.player1.gender === "MALE" && team?.player2.gender === "MALE") ? "MALE" : "FEMALE";
              }
              const sp = session!.sessionPlayers.find((sp) => sp.player.name === name);
              return sp?.player.gender === "MALE" ? "MALE" : "FEMALE";
            }

            const renderEntry = (entry: typeof leaderboard[0], i: number) => {
              const isExpanded = expandedEntry === entry.name;
              // Find all games this player/team was in
              const entryGames = session.sessionFormat === "FIXED"
                  ? games.filter((g) => {
                      const t = session.teams.find((t) =>
                        `${t.player1.name} & ${t.player2.name}` === entry.name
                      );
                      return t && (g.team1Id === t.id || g.team2Id === t.id);
                    })
                  : games.filter((g) =>
                      [g.team1Player1, g.team1Player2, g.team2Player1, g.team2Player2]
                        .some((p) => p.name === entry.name)
                    );

                return (
                  <div key={entry.name} className={`rounded-xl overflow-hidden border ${
                    i === 0 ? "border-yellow-500/40" :
                    i === 1 ? "border-zinc-400/40" :
                    i === 2 ? "border-orange-600/40" :
                    "border-zinc-800"
                  }`}>
                    {/* Summary row */}
                    <button
                      onClick={() => setExpandedEntry(isExpanded ? null : entry.name)}
                      className={`w-full flex items-center gap-2 px-3 py-0 h-14 hover:bg-zinc-800 transition-colors text-left ${
                        i === 0 ? "bg-yellow-500/10" :
                        i === 1 ? "bg-zinc-400/10" :
                        i === 2 ? "bg-orange-600/10" :
                        "bg-zinc-900"
                      }`}
                    >
                      <span className={`text-lg font-black w-6 ${
                        i === 0 ? "text-yellow-400" :
                        i === 1 ? "text-zinc-300" :
                        i === 2 ? "text-orange-500" :
                        "text-zinc-600"
                      }`}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                      <span className="font-semibold flex-1 text-white truncate min-w-0">{entry.name}</span>
                      <div className="flex gap-2 text-sm items-center shrink-0 whitespace-nowrap">
                        <span className="font-semibold text-lime-400">{entry.wins}W</span>
                        <span className="font-semibold text-red-400">{entry.losses}L</span>
                        <span>
                          {(() => {
                            const avg = entry.played > 0 ? entry.pointDiff / entry.played : 0;
                            const display = (avg > 0 ? "+" : "") + avg.toFixed(1);
                            return (
                              <span className={`font-semibold ${avg >= 0 ? "text-lime-400" : "text-red-400"}`}>
                                {display}
                              </span>
                            );
                          })()}
                          <span className="text-zinc-500 text-xs"> avg diff</span>
                        </span>
                        <span className="font-semibold text-sky-400">
                          {entry.played}/{entry.scheduled}
                          <span className="text-zinc-500 font-normal text-xs"> games</span>
                        </span>
                        <span className="text-zinc-600 text-xs ml-1">{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {/* Expanded games */}
                    {isExpanded && (
                      <div className="bg-zinc-950 border-t border-zinc-800 p-3">
                        {entryGames.length === 0 ? (
                          <p className="text-zinc-500 text-sm text-center py-4">No games found.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[...entryGames]
                              .sort((a, b) => a.roundNumber - b.roundNumber)
                              .map((g) => {
                                const isTeam1 = session.sessionFormat === "FIXED"
                                  ? g.team1Id === session.teams.find((t) => `${t.player1.name} & ${t.player2.name}` === entry.name)?.id
                                  : [g.team1Player1, g.team1Player2].some((p) => p.name === entry.name);

                                const myPlayers   = isTeam1 ? [g.team1Player1, g.team1Player2] : [g.team2Player1, g.team2Player2];
                                const theirPlayers = isTeam1 ? [g.team2Player1, g.team2Player2] : [g.team1Player1, g.team1Player2];
                                const myScore    = isTeam1 ? g.team1Score : g.team2Score;
                                const theirScore = isTeam1 ? g.team2Score : g.team1Score;
                                const won = myScore !== null && theirScore !== null && myScore > theirScore;

                                return (
                                  <GameCard
                                    key={g.id}
                                    courtFormat={g.court.format}
                                    roundNumber={g.roundNumber}
                                    team1Names={myPlayers.map((p) => p.name)}
                                    team2Names={theirPlayers.map((p) => p.name)}
                                    team1Divisions={isAdmin ? myPlayers.map((p) => divisionMap[p.id]) : undefined}
                                    team2Divisions={isAdmin ? theirPlayers.map((p) => divisionMap[p.id]) : undefined}
                                    team1Score={myScore}
                                    team2Score={theirScore}
                                    completed={g.completed}
                                    highlightName={entry.name}
                                    highlightResult={g.completed ? (won ? "won" : "lost") : undefined}
                                  />
                                );
                              })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
            };

            const podDotColors = [
              { dot: "bg-violet-400", text: "text-violet-400" },
              { dot: "bg-amber-400",  text: "text-amber-400"  },
              { dot: "bg-teal-400",   text: "text-teal-400"   },
              { dot: "bg-rose-400",   text: "text-rose-400"   },
              { dot: "bg-indigo-400", text: "text-indigo-400" },
              { dot: "bg-orange-400", text: "text-orange-400" },
            ];

            function getEntryPodIndex(entry: typeof leaderboard[0]): number {
              if (session!.sessionFormat === "FIXED") {
                const team = session!.teams.find(
                  (t) => `${t.player1.name} & ${t.player2.name}` === entry.name
                );
                if (!team) return -1;
                return session!.pods.findIndex((p) => p.teams.some((t) => t.id === team.id));
              }
              const sp = session!.sessionPlayers.find((sp) => sp.player.name === entry.name);
              if (!sp) return -1;
              return session!.pods.findIndex((p) =>
                p.sessionPlayers.some((psp) => psp.playerId === sp.playerId)
              );
            }

            const hasPods = session!.pods.length > 0 && leaderboard.some((e) => getEntryPodIndex(e) >= 0);

            if (hasPods) {
              return (
                <div className="flex flex-col gap-6">
                  {note}
                  {session!.pods.map((pod, podIdx) => {
                    const podEntries = leaderboard.filter((e) => getEntryPodIndex(e) === podIdx);
                    if (podEntries.length === 0) return null;
                    const c = podDotColors[podIdx % podDotColors.length];
                    return (
                      <div key={pod.id}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                          <span className={`text-xs font-semibold uppercase tracking-wider ${c.text}`}>{pod.name}</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {podEntries.map((entry, i) => renderEntry(entry, i))}
                        </div>
                      </div>
                    );
                  })}
                  {(() => {
                    const unassigned = leaderboard.filter((e) => getEntryPodIndex(e) === -1);
                    if (unassigned.length === 0) return null;
                    return (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full bg-zinc-500" />
                          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Unassigned</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {unassigned.map((entry, i) => renderEntry(entry, i))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            }

            if (showSplit) {
              const maleEntries = leaderboard.filter((e) => getEntryGender(e.name) === "MALE");
              const femaleEntries = leaderboard.filter((e) => getEntryGender(e.name) === "FEMALE");
              return (
                <div className="flex flex-col gap-6">
                  {note}
                  {maleEntries.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-2 h-2 rounded-full bg-sky-400" />
                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Men</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {maleEntries.map((entry, i) => renderEntry(entry, i))}
                      </div>
                    </div>
                  )}
                  {femaleEntries.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-2 h-2 rounded-full bg-pink-400" />
                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Women</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {femaleEntries.map((entry, i) => renderEntry(entry, i))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-2">
                {note}
                {leaderboard.map((entry, i) => renderEntry(entry, i))}
              </div>
            );
          })()}
        </TabsContent>
        {/* MEDAL ROUNDS TAB */}
        {session.hasMedalRound && (
          <TabsContent value="medals">
            <MedalRoundTab
              sessionId={id}
              sessionFormat={session.sessionFormat}
              courts={session.courts}
              sessionTeams={session.teams}
              sessionPlayers={session.sessionPlayers}
              rankedPlayers={rankedPlayers}
            />
          </TabsContent>
        )}
      </Tabs>

      <AddPlayersSheet
        open={addPlayersOpen}
        onClose={() => setAddPlayersOpen(false)}
        sessionId={id}
        existingPlayerIds={session.sessionPlayers.map((sp) => sp.playerId)}
        onAdded={() => { setAddPlayersOpen(false); loadSession(); }}
      />

      <GenerateDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        sessionId={id}
        sessionFormat={session.sessionFormat}
        courts={session.courts}
        players={session.sessionPlayers.map((sp) => ({ gender: sp.player.gender, division: sp.division }))}
        pods={session.pods.map((p) => ({ id: p.id, name: p.name, teamCount: p.teams.length }))}
        unassignedTeamCount={(() => {
          const podTeamIds = new Set(session.pods.flatMap((p) => p.teams.map((t) => t.id)));
          return session.teams.filter((t) => !podTeamIds.has(t.id)).length;
        })()}
        onGenerated={() => { setGenerateOpen(false); loadGames(); }}
      />

      <AddCourtDialog
        open={addCourtOpen}
        onClose={() => setAddCourtOpen(false)}
        onAdded={(courtFormat) => { setAddCourtOpen(false); addCourt(courtFormat); }}
      />

      {session && (
        <EditDateDialog
          open={editDateOpen}
          onClose={() => setEditDateOpen(false)}
          currentDate={new Date(session.date)}
          currentEndTime={session.endTime ? new Date(session.endTime) : null}
          onSaved={updateDate}
        />
      )}

      <AddOverrideDialog
        open={addOverrideOpen}
        onClose={() => setAddOverrideOpen(false)}
        sessionId={id}
        players={session?.sessionPlayers.map((sp) => sp.player) ?? []}
        onCreated={() => { setAddOverrideOpen(false); loadSession(); }}
      />
    </div>
  );
}
