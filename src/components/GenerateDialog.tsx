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
  format: "MIXED" | "MENS" | "WOMENS";
}

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  sessionFormat: "ROTATING" | "FIXED";
  courts: Court[];
  players: { gender: string }[];
  onGenerated: () => void;
}

interface RoundOption {
  rounds: number;
  maleGames: string | null;  // e.g. "5" or "5–6"
  femaleGames: string | null;
}

function gamesLabel(rounds: number, total: number, perRound: number): string | null {
  if (total === 0 || perRound === 0) return null;
  const exact = (perRound * rounds) / total;
  if (Number.isInteger(exact)) return String(exact);
  return `${Math.floor(exact)}–${Math.ceil(exact)}`;
}

function buildOptions(
  numMales: number,
  numFemales: number,
  malesPerRound: number,
  femalesPerRound: number,
): RoundOption[] {
  const targets = [5, 6, 7, 8];
  const seen = new Set<number>();
  const options: RoundOption[] = [];

  for (const target of targets) {
    const mRounds = numMales > 0 && malesPerRound > 0
      ? Math.ceil((target * numMales) / malesPerRound) : 0;
    const fRounds = numFemales > 0 && femalesPerRound > 0
      ? Math.ceil((target * numFemales) / femalesPerRound) : 0;
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

export function GenerateDialog({ open, onClose, sessionId, sessionFormat, courts, players, onGenerated }: Props) {
  const [rrType, setRrType] = useState<"single" | "double">("single");
  const [selectedRounds, setSelectedRounds] = useState<number | null>(null);
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

  const malesPerRound   = Math.min(numMales,   numMens * 4 + numMixed * 2);
  const femalesPerRound = Math.min(numFemales, numWomens * 4 + numMixed * 2);

  const roundOptions = useMemo(
    () => buildOptions(numMales, numFemales, malesPerRound, femalesPerRound),
    [numMales, numFemales, malesPerRound, femalesPerRound],
  );

  const effectiveSelection = selectedRounds ?? roundOptions[0]?.rounds ?? null;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (sessionFormat === "ROTATING" && !effectiveSelection) return;
    setLoading(true);
    setError("");

    const body = sessionFormat === "FIXED"
      ? { mode: rrType }
      : { mode: "exactRounds", value: effectiveSelection };

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

  const noOptions = sessionFormat === "ROTATING" && roundOptions.length === 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleGenerate} className="flex flex-col gap-4 mt-2">
          {sessionFormat === "FIXED" ? (
            <div className="flex flex-col gap-2">
              {(["single", "double"] as const).map((type) => (
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
                    {type === "single" ? "Every team faces every other team once" : "Every team faces every other team twice"}
                  </p>
                </button>
              ))}
            </div>
          ) : noOptions ? (
            <p className="text-sm text-zinc-500 text-center py-4">Add players and courts first.</p>
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
            disabled={loading || noOptions || (sessionFormat === "ROTATING" && !effectiveSelection)}
            className="bg-lime-500 hover:bg-lime-400 text-black font-bold"
          >
            {loading ? "Generating..." : "Generate"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
