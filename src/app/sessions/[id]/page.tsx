"use client";

import { useEffect, useState, use } from "react";
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
  format: "MIXED" | "MENS" | "WOMENS";
}

interface SessionPlayer {
  id: string;
  playerId: string;
  player: Player;
}

interface Team {
  id: string;
  player1: Player;
  player2: Player;
}

interface Session {
  id: string;
  date: string;
  endTime: string | null;
  sessionFormat: "ROTATING" | "FIXED";
  courts: Court[];
  sessionPlayers: SessionPlayer[];
  teams: Team[];
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

const formatLabel: Record<string, string> = {
  MIXED: "Mixed",
  MENS: "Men's",
  WOMENS: "Women's",
};

const formatColor: Record<string, string> = {
  MIXED: "bg-purple-900/50 text-purple-300",
  MENS: "bg-sky-900/50 text-sky-300",
  WOMENS: "bg-pink-900/50 text-pink-300",
};

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
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

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

  async function removePlayer(playerId: string) {
    await fetch(`/api/sessions/${id}/players`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
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
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: start.toISOString(), endTime: end?.toISOString() ?? null }),
    });
    setEditDateOpen(false);
    loadSession();
  }

  async function deleteTeam(teamId: string) {
    await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
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
    setScores((prev) => {
      const next = { ...prev };
      delete next[gameId];
      return next;
    });
  }

  const leaderboard = (() => {
    const stats: Record<string, { name: string; wins: number; losses: number; pointDiff: number; played: number; scheduled: number }> = {};

    if (session?.sessionFormat === "FIXED") {
      const teamName = (t: Team) => `${t.player1.name} & ${t.player2.name}`;
      for (const g of games) {
        if (!g.team1Id || !g.team2Id) continue;
        // Initialise from any game (scheduled or played)
        if (!stats[g.team1Id]) {
          const team = session.teams.find((t) => t.id === g.team1Id);
          stats[g.team1Id] = { name: team ? teamName(team) : "Team", wins: 0, losses: 0, pointDiff: 0, played: 0, scheduled: 0 };
        }
        if (!stats[g.team2Id]) {
          const team = session.teams.find((t) => t.id === g.team2Id);
          stats[g.team2Id] = { name: team ? teamName(team) : "Team", wins: 0, losses: 0, pointDiff: 0, played: 0, scheduled: 0 };
        }
        stats[g.team1Id].scheduled++;
        stats[g.team2Id].scheduled++;
        if (!g.completed || g.team1Score === null || g.team2Score === null) continue;
        const t1Won = g.team1Score > g.team2Score;
        if (t1Won) stats[g.team1Id].wins++; else stats[g.team1Id].losses++;
        if (!t1Won) stats[g.team2Id].wins++; else stats[g.team2Id].losses++;
        stats[g.team1Id].pointDiff += g.team1Score - g.team2Score;
        stats[g.team2Id].pointDiff += g.team2Score - g.team1Score;
        stats[g.team1Id].played++;
        stats[g.team2Id].played++;
      }
    } else {
      for (const g of games) {
        for (const p of [g.team1Player1, g.team1Player2, g.team2Player1, g.team2Player2]) {
          if (!stats[p.id]) stats[p.id] = { name: p.name, wins: 0, losses: 0, pointDiff: 0, played: 0, scheduled: 0 };
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
          stats[p.id].played++;
        }
        for (const p of [g.team2Player1, g.team2Player2]) {
          if (!t1Won) stats[p.id].wins++; else stats[p.id].losses++;
          stats[p.id].pointDiff += g.team2Score - g.team1Score;
          stats[p.id].played++;
        }
      }
    }
    return Object.values(stats).sort((a, b) => b.wins - a.wins || b.pointDiff - a.pointDiff);
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

  if (!session) return <div className="text-zinc-400 py-12 text-center">Loading...</div>;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{format(new Date(session.date), "EEEE, MMMM d")}</h1>
          <p className="text-zinc-400">
            {format(new Date(session.date), "h:mm a")}
            {session.endTime && ` – ${format(new Date(session.endTime), "h:mm a")}`}
          </p>
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-medium">
            {session.sessionFormat === "ROTATING" ? "Rotating Partners" : "Fixed Partners"}
          </span>
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditDateOpen(true)}
            className="text-xs text-zinc-500 hover:text-zinc-200 underline mt-1"
          >
            Edit
          </button>
        )}
      </div>

      <Tabs defaultValue="players">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="players" className="flex-1">Players</TabsTrigger>
          <TabsTrigger value="courts" className="flex-1">Courts</TabsTrigger>
          <TabsTrigger value="schedule" className="flex-1">Schedule</TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex-1">Leaderboard</TabsTrigger>
        </TabsList>

        {/* PLAYERS TAB */}
        <TabsContent value="players">
          {/* ── Rotating: gender groups grid ── */}
          {session.sessionFormat === "ROTATING" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-zinc-400">{session.sessionPlayers.length} players</span>
                {isAdmin && (
                  <Button onClick={() => setAddPlayersOpen(true)} size="sm" className="bg-lime-500 hover:bg-lime-400 text-black font-bold">
                    + Add Players
                  </Button>
                )}
              </div>
              {session.sessionPlayers.length === 0 ? (
                <p className="text-zinc-500 text-center py-10 text-sm">No players yet.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {(["MALE", "FEMALE"] as const).map((gender) => {
                    const group = [...session.sessionPlayers]
                      .filter((sp) => sp.player.gender === gender)
                      .sort((a, b) => a.player.name.localeCompare(b.player.name));
                    if (group.length === 0) return null;
                    const isMale = gender === "MALE";
                    return (
                      <div key={gender}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-2 h-2 rounded-full ${isMale ? "bg-sky-400" : "bg-pink-400"}`} />
                          <span className="text-sm font-semibold text-zinc-200">{isMale ? "Males" : "Females"}</span>
                          <span className="text-xs text-zinc-500">{group.length}</span>
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
                              <span className="text-xs font-medium leading-tight break-words w-full pt-1">{sp.player.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {isAdmin && (
                <Button
                  onClick={() => setGenerateOpen(true)}
                  className="w-full mt-5 bg-lime-500 hover:bg-lime-400 text-black font-bold"
                >
                  Generate Schedule
                </Button>
              )}
            </>
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
                {/* Add players */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-zinc-400">{session.sessionPlayers.length} players</span>
                  {isAdmin && (
                    <Button onClick={() => setAddPlayersOpen(true)} size="sm" className="bg-lime-500 hover:bg-lime-400 text-black font-bold">
                      + Add Players
                    </Button>
                  )}
                </div>

                {/* Teams */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-zinc-200">Teams ({session.teams.length})</span>
                  {isAdmin && (
                    <Button onClick={() => setCreateTeamOpen(true)} size="sm" variant="outline" disabled={unteamed.length < 2}>
                      + Create Team
                    </Button>
                  )}
                </div>

                {session.teams.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-4">No teams yet. Pair players up.</p>
                ) : (
                  <div className="flex flex-col gap-2 mb-4">
                    {session.teams.map((team, i) => (
                      <Card key={team.id} className="bg-zinc-900 border-zinc-800">
                        <CardContent className="py-3 px-4 flex items-center justify-between gap-2">
                          <span className="text-xs text-zinc-500 w-10 shrink-0">Team {i + 1}</span>
                          <div className="flex items-center gap-2 flex-1">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${team.player1.gender === "MALE" ? "bg-sky-400" : "bg-pink-400"}`} />
                            <span className="text-sm font-medium">{team.player1.name}</span>
                            <span className="text-zinc-600">&</span>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${team.player2.gender === "MALE" ? "bg-sky-400" : "bg-pink-400"}`} />
                            <span className="text-sm font-medium">{team.player2.name}</span>
                          </div>
                          {isAdmin && (
                            <button onClick={() => deleteTeam(team.id)} className="text-zinc-600 hover:text-red-400 text-base">×</button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

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

                {isAdmin && (
                  <Button
                    onClick={() => setGenerateOpen(true)}
                    className="w-full mt-5 bg-lime-500 hover:bg-lime-400 text-black font-bold"
                  >
                    Generate Schedule
                  </Button>
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

          {isAdmin && session.sessionPlayers.length > 0 && session.courts.length > 0 && (
            <Button
              onClick={() => setGenerateOpen(true)}
              className="w-full mt-5 bg-lime-500 hover:bg-lime-400 text-black font-bold"
            >
              Generate Schedule
            </Button>
          )}
        </TabsContent>

        {/* SCHEDULE TAB */}
        <TabsContent value="schedule">
          {games.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-400 mb-3">No schedule yet.</p>
              {isAdmin && session.sessionPlayers.length > 0 && session.courts.length > 0 && (
                <Button onClick={() => setGenerateOpen(true)} className="bg-lime-500 hover:bg-lime-400 text-black font-bold">
                  Generate Schedule
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {rounds.map(([roundNum, roundGames]) => {
                const byes = byesForRound(roundGames);
                const isRoundComplete = roundGames.every((g) => g.completed);
                const isRoundEditing = roundGames.some((g) => !!scores[g.id]);
                return (
                  <div
                    key={roundNum}
                    className={`rounded-xl p-3 transition-opacity ${isRoundComplete ? "opacity-50" : "opacity-100"} bg-zinc-800`}
                  >
                    {/* Round header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-2 py-0.5 bg-zinc-800 rounded-full">
                        Round {roundNum}
                      </span>
                      {isAdmin && isRoundComplete && !isRoundEditing && (
                        <button
                          onClick={() => editRound(roundGames)}
                          className="text-xs text-zinc-500 hover:text-zinc-200 underline transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    {/* Games — sorted by court number, 2 per row */}
                    <div className="grid grid-cols-2 gap-2">
                      {[...roundGames].sort((a, b) => a.court.number - b.court.number).map((game) => {
                        const sc = scores[game.id];
                        const isEditing = !!sc;
                        const showInputs = isAdmin && (isEditing || !game.completed);
                        return (
                          <div
                            key={game.id}
                            className="bg-zinc-900 rounded-lg border border-zinc-700 px-3 py-2.5 min-w-0"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${formatColor[game.court.format]}`}>
                                Court {game.court.number}
                              </span>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium flex-1">
                                  {game.team1Player1.name} & {game.team1Player2.name}
                                </span>
                                {showInputs ? (
                                  <Input
                                    className="w-14 h-8 text-center text-sm p-1 shrink-0"
                                    placeholder="0"
                                    value={sc?.t1 ?? ""}
                                    onChange={(e) =>
                                      setScores((prev) => ({
                                        ...prev,
                                        [game.id]: { t1: e.target.value, t2: sc?.t2 ?? "" },
                                      }))
                                    }
                                  />
                                ) : game.completed ? (
                                  <span className={`text-lg font-bold tabular-nums w-14 text-right shrink-0 ${game.team1Score! > game.team2Score! ? "text-lime-400" : "text-zinc-500"}`}>
                                    {game.team1Score}
                                  </span>
                                ) : null}
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex-1 border-t border-zinc-800" />
                                <span className="text-xs text-zinc-600">vs</span>
                                <div className="flex-1 border-t border-zinc-800" />
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium flex-1">
                                  {game.team2Player1.name} & {game.team2Player2.name}
                                </span>
                                {showInputs ? (
                                  <Input
                                    className="w-14 h-8 text-center text-sm p-1 shrink-0"
                                    placeholder="0"
                                    value={sc?.t2 ?? ""}
                                    onChange={(e) =>
                                      setScores((prev) => ({
                                        ...prev,
                                        [game.id]: { t1: sc?.t1 ?? "", t2: e.target.value },
                                      }))
                                    }
                                  />
                                ) : game.completed ? (
                                  <span className={`text-lg font-bold tabular-nums w-14 text-right shrink-0 ${game.team2Score! > game.team1Score! ? "text-lime-400" : "text-zinc-500"}`}>
                                    {game.team2Score}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {showInputs && (
                              <div className="flex gap-2 mt-2.5">
                                <Button
                                  size="sm"
                                  className="flex-1 h-8 text-xs bg-lime-500 hover:bg-lime-400 text-black font-bold"
                                  onClick={() => submitScore(game.id)}
                                  disabled={!sc?.t1 || !sc?.t2}
                                >
                                  Save
                                </Button>
                                {isEditing && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs"
                                    onClick={() =>
                                      setScores((prev) => {
                                        const next = { ...prev };
                                        delete next[game.id];
                                        return next;
                                      })
                                    }
                                  >
                                    Cancel
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Bye players */}
                    {byes.length > 0 && (
                      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-zinc-500 font-medium">Bye:</span>
                        {byes.map((p) => (
                          <span
                            key={p.id}
                            className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400"
                          >
                            {p.name}
                          </span>
                        ))}
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
          ) : (
            <div className="flex flex-col gap-2">
              {leaderboard.map((entry, i) => {
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
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left ${
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
                      <span className="font-semibold flex-1 text-white">{entry.name}</span>
                      <div className="flex gap-3 text-sm items-center">
                        <span className="font-semibold text-lime-400">{entry.wins}W</span>
                        <span className="font-semibold text-red-400">{entry.losses}L</span>
                        <span>
                          <span className={`font-semibold ${entry.pointDiff >= 0 ? "text-lime-400" : "text-red-400"}`}>
                            {entry.pointDiff > 0 ? "+" : ""}{entry.pointDiff}
                          </span>
                          <span className="text-zinc-500 text-xs"> diff</span>
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
                      <div className="bg-zinc-950 border-t border-zinc-800 divide-y divide-zinc-800">
                        {entryGames.length === 0 ? (
                          <p className="text-zinc-500 text-sm text-center py-4">No games found.</p>
                        ) : (
                          [...entryGames]
                            .sort((a, b) => a.roundNumber - b.roundNumber)
                            .map((g) => {
                              const isTeam1 = session.sessionFormat === "FIXED"
                                ? g.team1Id === session.teams.find((t) => `${t.player1.name} & ${t.player2.name}` === entry.name)?.id
                                : [g.team1Player1, g.team1Player2].some((p) => p.name === entry.name);

                              const myTeamNames = `${g.team1Player1.name} & ${g.team1Player2.name}`;
                              const theirTeamNames = `${g.team2Player1.name} & ${g.team2Player2.name}`;
                              const myScore = isTeam1 ? g.team1Score : g.team2Score;
                              const theirScore = isTeam1 ? g.team2Score : g.team1Score;
                              const myTeam = isTeam1 ? myTeamNames : theirTeamNames;
                              const theirTeam = isTeam1 ? theirTeamNames : myTeamNames;
                              const won = myScore !== null && theirScore !== null && myScore > theirScore;

                              return (
                                <div key={g.id} className="px-4 py-2.5">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-xs text-zinc-500">Rd {g.roundNumber}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${formatColor[g.court.format]}`}>
                                      Court {g.court.number}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className={`text-sm font-semibold text-lime-400`}>
                                        {myTeam.split(" & ").map((name, ni) => (
                                          <span key={ni}>
                                            {ni > 0 && <span className="text-zinc-500"> & </span>}
                                            <span className={name === entry.name ? "text-lime-300 underline underline-offset-2" : "text-lime-400"}>
                                              {name}
                                            </span>
                                          </span>
                                        ))}
                                      </span>
                                      {g.completed && myScore !== null && (
                                        <span className={`text-sm font-bold tabular-nums ${won ? "text-lime-400" : "text-zinc-400"}`}>
                                          {myScore}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm text-zinc-400">{theirTeam}</span>
                                      {g.completed && theirScore !== null && (
                                        <span className={`text-sm font-bold tabular-nums ${!won ? "text-lime-400" : "text-zinc-500"}`}>
                                          {theirScore}
                                        </span>
                                      )}
                                    </div>
                                    {!g.completed && (
                                      <span className="text-xs text-zinc-600 italic">Not played yet</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
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
    </div>
  );
}
