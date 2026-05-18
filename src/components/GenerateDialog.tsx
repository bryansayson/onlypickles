"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Court {
  format: "MIXED" | "MENS" | "WOMENS" | "ANY";
}

interface PodInfo {
  id: string;
  name: string;
  teamCount: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  sessionFormat: "ROTATING" | "FIXED";
  courts: Court[];
  players: { gender: string; division?: string | null }[];
  pods?: PodInfo[];
  unassignedTeamCount?: number;
  onGenerated: () => void;
}

interface RoundOption {
  rounds: number;
  maleGames: string | null;
  femaleGames: string | null;
}

function gamesLabel(rounds: number, total: number, perRound: number): string | null {
  if (total === 0 || perRound === 0) return null;
  const exact = (perRound * rounds) / total;
  if (Number.isInteger(exact)) return String(exact);
  return `${Math.floor(exact)}–${Math.ceil(exact)}`;
}

// Returns rounds needed so the larger division pool reaches `target` games.
// `courtsOfType` is how many courts of the relevant format exist — each court
// gives each division 2 slots per round, so the divisor scales with court count.
// Only applied when pools are within 2:1 ratio.
function divisionRounds(target: number, upper: number, lower: number, courtsOfType: number): number {
  if (upper === 0 || lower === 0 || courtsOfType === 0) return 0;
  if (Math.max(upper, lower) / Math.min(upper, lower) > 2) return 0;
  const slotsPerDivPerRound = courtsOfType * 2;
  return Math.ceil((target * Math.max(upper, lower)) / slotsPerDivPerRound);
}

function buildOptions(
  numMales: number,
  numFemales: number,
  malesPerRound: number,
  femalesPerRound: number,
  upperMales = 0,
  lowerMales = 0,
  upperFemales = 0,
  lowerFemales = 0,
  mensCourts = 0,
  womensCourts = 0,
): RoundOption[] {
  const targets = [5, 6, 7, 8];
  const hasMaleDivisions = upperMales > 0 && lowerMales > 0;
  const hasFemaleDivisions = upperFemales > 0 && lowerFemales > 0;
  const seen = new Set<number>();
  const options: RoundOption[] = [];

  for (const target of targets) {
    let mRounds = numMales > 0 && malesPerRound > 0
      ? Math.ceil((target * numMales) / malesPerRound) : 0;
    let fRounds = numFemales > 0 && femalesPerRound > 0
      ? Math.ceil((target * numFemales) / femalesPerRound) : 0;

    if (hasMaleDivisions) mRounds = Math.max(mRounds, divisionRounds(target, upperMales, lowerMales, mensCourts));
    if (hasFemaleDivisions) fRounds = Math.max(fRounds, divisionRounds(target, upperFemales, lowerFemales, womensCourts));

    const rounds = Math.max(mRounds, fRounds, 1);
    if (seen.has(rounds)) continue;
    seen.add(rounds);

    options.push({
      rounds,
      maleGames: gamesLabel(rounds, numMales, malesPerRound),
      femaleGames: gamesLabel(rounds, numFemales, femalesPerRound),
    });
  }
  return options;
}

export function GenerateDialog({
  open,
  onClose,
  sessionId,
  sessionFormat,
  courts,
  players,
  pods,
  unassignedTeamCount = 0,
  onGenerated,
}: Props) {
  const [rrType, setRrType] = useState<"single" | "double" | "triple">("single");
  const [selectedRounds, setSelectedRounds] = useState<number | null>(null);
  const [selectedMensRounds, setSelectedMensRounds] = useState<number | null>(null);
  const [selectedWomensRounds, setSelectedWomensRounds] = useState<number | null>(null);
  // Per-group matchups for FIXED+pods: key is podId or "unassigned"
  const [groupMatchups, setGroupMatchups] = useState<Record<string, 1 | 2 | 3>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSplit = sessionFormat === "ROTATING"
    && courts.some((c) => c.format === "MENS")
    && courts.some((c) => c.format === "WOMENS")
    && !courts.some((c) => c.format === "MIXED");

  const numMales   = players.filter((p) => p.gender === "MALE").length;
  const numFemales = players.filter((p) => p.gender === "FEMALE").length;
  const numMixed   = courts.filter((c) => c.format === "MIXED").length;
  const numMens    = courts.filter((c) => c.format === "MENS").length;
  const numWomens  = courts.filter((c) => c.format === "WOMENS").length;
  const numAny     = courts.filter((c) => c.format === "ANY").length;

  const malesPerRound   = Math.min(numMales,   numMens * 4 + numMixed * 2 + numAny * 4);
  const femalesPerRound = Math.min(numFemales, numWomens * 4 + numMixed * 2 + numAny * 4);

  const upperMales   = players.filter((p) => p.gender === "MALE"   && p.division === "UPPER").length;
  const lowerMales   = players.filter((p) => p.gender === "MALE"   && p.division === "LOWER").length;
  const upperFemales = players.filter((p) => p.gender === "FEMALE" && p.division === "UPPER").length;
  const lowerFemales = players.filter((p) => p.gender === "FEMALE" && p.division === "LOWER").length;

  const roundOptions = useMemo(
    () => buildOptions(numMales, numFemales, malesPerRound, femalesPerRound, upperMales, lowerMales, upperFemales, lowerFemales, numMens, numWomens),
    [numMales, numFemales, malesPerRound, femalesPerRound, upperMales, lowerMales, upperFemales, lowerFemales, numMens, numWomens],
  );

  const mensOptions = useMemo(
    () => buildOptions(numMales, 0, malesPerRound, 0, upperMales, lowerMales, 0, 0, numMens, 0),
    [numMales, malesPerRound, upperMales, lowerMales, numMens],
  );
  const womensOptions = useMemo(
    () => buildOptions(0, numFemales, 0, femalesPerRound, 0, 0, upperFemales, lowerFemales, 0, numWomens),
    [numFemales, femalesPerRound, upperFemales, lowerFemales, numWomens],
  );

  const effectiveSelection = selectedRounds ?? roundOptions[0]?.rounds ?? null;
  const effectiveMens   = selectedMensRounds   ?? mensOptions[0]?.rounds   ?? null;
  const effectiveWomens = selectedWomensRounds ?? womensOptions[0]?.rounds ?? null;

  // Pod groups to show per-group toggles (FIXED mode only)
  const hasPods = sessionFormat === "FIXED" && (pods?.length ?? 0) > 0;
  const podGroups: { key: string; label: string; count: number; podId: string | null }[] = hasPods
    ? [
        ...(pods ?? []).map((p) => ({ key: p.id, label: p.name, count: p.teamCount, podId: p.id })),
        ...(unassignedTeamCount > 0
          ? [{ key: "unassigned", label: "Unassigned", count: unassignedTeamCount, podId: null }]
          : []),
      ]
    : [];

  function getMatchup(key: string): 1 | 2 | 3 {
    return groupMatchups[key] ?? 1;
  }
  function setMatchup(key: string, v: 1 | 2 | 3) {
    setGroupMatchups((prev) => ({ ...prev, [key]: v }));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (sessionFormat === "ROTATING" && !effectiveSelection) return;
    setLoading(true);
    setError("");

    let body: Record<string, unknown>;
    if (sessionFormat === "FIXED") {
      if (hasPods) {
        body = {
          podMatchups: (pods ?? []).map((p) => ({ podId: p.id, matchups: getMatchup(p.id) })),
          unassignedMatchups: getMatchup("unassigned"),
        };
      } else {
        body = { mode: rrType };
      }
    } else if (isSplit) {
      body = { mode: "splitExactRounds", value: effectiveMens, womensValue: effectiveWomens };
    } else {
      body = { mode: "exactRounds", value: effectiveSelection };
    }

    const res = await fetch(`/api/sessions/${sessionId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to generate");
      setLoading(false);
      return;
    }
    setLoading(false);
    onGenerated();
  }

  function gameLabel(opt: RoundOption): string {
    if (isSplit) {
      const m = opt.maleGames ?? "?";
      const f = opt.femaleGames ?? "?";
      return m === f ? `${m} games each` : `Men ${m} · Women ${f} games`;
    }
    const g = opt.maleGames ?? opt.femaleGames;
    return g ? `${g} games per player` : "";
  }

  const noOptions = sessionFormat === "ROTATING" && (
    isSplit ? mensOptions.length === 0 && womensOptions.length === 0 : roundOptions.length === 0
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleGenerate} className="flex flex-col gap-4 mt-2">
          {sessionFormat === "FIXED" ? (
            hasPods ? (
              /* Per-pod single/double toggles */
              <div className="flex flex-col gap-2.5">
                {podGroups.map((group) => (
                  <div key={group.key} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-200 truncate">{group.label}</div>
                      <div className="text-xs text-zinc-500">
                        {group.count} {group.count === 1 ? "team" : "teams"}
                      </div>
                    </div>
                    <div className="flex shrink-0 rounded-md overflow-hidden border border-zinc-700">
                      {([1, 2, 3] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMatchup(group.key, m)}
                          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                            getMatchup(group.key) === m
                              ? "bg-lime-500 text-black"
                              : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {m === 1 ? "Single" : m === 2 ? "Double" : "Triple"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Global single/double/triple for no-pod sessions */
              <div className="flex flex-col gap-2">
                {(["single", "double", "triple"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRrType(type)}
                    className={`w-full py-3 rounded-lg text-sm font-medium border transition-colors text-left px-4 ${
                      rrType === type
                        ? "bg-lime-500 text-black border-lime-500"
                        : "bg-zinc-900 text-zinc-400 border-zinc-700"
                    }`}
                  >
                    <span className="font-semibold capitalize">{type} Round Robin</span>
                    <p className={`text-xs mt-0.5 ${rrType === type ? "text-black/60" : "text-zinc-600"}`}>
                      {type === "single"
                        ? "Every team faces every other team once"
                        : type === "double"
                        ? "Every team faces every other team twice"
                        : "Every team faces every other team three times"}
                    </p>
                  </button>
                ))}
              </div>
            )
          ) : noOptions ? (
            <p className="text-sm text-zinc-500 text-center py-4">Add players and courts first.</p>
          ) : isSplit ? (
            <div className="flex flex-col gap-4">
              {[
                { label: "Men", color: "text-sky-400", dot: "bg-sky-400", options: mensOptions, selected: effectiveMens, onSelect: setSelectedMensRounds },
                { label: "Women", color: "text-pink-400", dot: "bg-pink-400", options: womensOptions, selected: effectiveWomens, onSelect: setSelectedWomensRounds },
              ].map(({ label, color, dot, options, selected, onSelect }) => (
                <div key={label}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {options.map((opt) => {
                      const isSelected = selected === opt.rounds;
                      return (
                        <button
                          key={opt.rounds}
                          type="button"
                          onClick={() => onSelect(opt.rounds)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-left transition-colors ${
                            isSelected
                              ? "bg-lime-500 text-black border-lime-500"
                              : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500"
                          }`}
                        >
                          <span className="font-semibold text-sm">{opt.rounds} rounds</span>
                          <span className={`text-xs ${isSelected ? "text-black/60" : "text-zinc-500"}`}>
                            {(label === "Men" ? opt.maleGames : opt.femaleGames) ?? "?"} games per player
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {roundOptions.map((opt) => {
                const selected = effectiveSelection === opt.rounds;
                return (
                  <button
                    key={opt.rounds}
                    type="button"
                    onClick={() => setSelectedRounds(opt.rounds)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors ${
                      selected
                        ? "bg-lime-500 text-black border-lime-500"
                        : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500"
                    }`}
                  >
                    <span className="font-semibold text-sm">{opt.rounds} rounds</span>
                    <span className={`text-xs ${selected ? "text-black/60" : "text-zinc-500"}`}>
                      {gameLabel(opt)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            type="submit"
            disabled={loading || noOptions || (sessionFormat === "ROTATING" && (
              isSplit ? !effectiveMens || !effectiveWomens : !effectiveSelection
            ))}
            className="bg-lime-500 hover:bg-lime-400 text-black font-bold"
          >
            {loading ? "Generating..." : "Generate"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
