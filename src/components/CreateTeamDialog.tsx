"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Player {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE";
}

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  availablePlayers: Player[];
  hasMixedCourt: boolean;
  onCreated: () => void;
}

export function CreateTeamDialog({
  open,
  onClose,
  sessionId,
  availablePlayers,
  hasMixedCourt,
  onCreated,
}: Props) {
  const [p1, setP1] = useState<string | null>(null);
  const [p2, setP2] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggle(id: string) {
    if (p1 === id) { setP1(null); return; }
    if (p2 === id) { setP2(null); return; }
    if (!p1) { setP1(id); return; }
    if (!p2) { setP2(id); return; }
    // both slots full — ignore
  }

  function isSelected(id: string) { return p1 === id || p2 === id; }
  const bothSelected = !!p1 && !!p2;

  async function handleCreate() {
    if (!p1 || !p2) return;

    if (hasMixedCourt) {
      const player1 = availablePlayers.find((p) => p.id === p1);
      const player2 = availablePlayers.find((p) => p.id === p2);
      if (player1?.gender === player2?.gender) {
        setError("Mixed courts require teams of 1 male and 1 female.");
        return;
      }
    }

    setError("");
    setLoading(true);
    const res = await fetch(`/api/sessions/${sessionId}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player1Id: p1, player2Id: p2 }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create team");
      return;
    }
    setP1(null);
    setP2(null);
    onCreated();
  }

  const canCreate = !!p1 && !!p2;

  return (
    <Dialog open={open} onOpenChange={() => { setP1(null); setP2(null); setError(""); onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
        </DialogHeader>
        {hasMixedCourt && (
          <p className="text-xs text-purple-300 bg-purple-900/30 border border-purple-800/50 rounded px-2 py-1 -mt-1">
            Mixed courts require 1 men&apos;s + 1 women&apos;s player per team.
          </p>
        )}

        {/* Selected slots */}
        <div className="grid grid-cols-2 gap-2">
          {[{ slot: p1, label: "Player 1" }, { slot: p2, label: "Player 2" }].map(({ slot, label }, idx) => {
            const player = slot ? availablePlayers.find((p) => p.id === slot) : null;
            return (
              <div
                key={idx}
                className={`flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border min-h-[64px] text-center ${
                  player ? "border-lime-600 bg-lime-950" : "border-zinc-700 border-dashed bg-zinc-900"
                }`}
              >
                {player ? (
                  <>
                    <span className={`w-2 h-2 rounded-full ${player.gender === "MALE" ? "bg-sky-400" : "bg-pink-400"}`} />
                    <span className="text-sm font-semibold text-white leading-tight">{player.name}</span>
                    <button
                      onClick={() => idx === 0 ? setP1(null) : setP2(null)}
                      className="text-xs text-zinc-500 hover:text-red-400"
                    >remove</button>
                  </>
                ) : (
                  <span className="text-xs text-zinc-600">{label}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Player grid */}
        <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto">
          {availablePlayers.map((p) => {
            const selected = isSelected(p.id);
            const disabled = bothSelected && !selected;
            const isMale = p.gender === "MALE";
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                disabled={disabled}
                className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border text-center transition-colors ${
                  selected
                    ? "border-lime-500 bg-lime-950"
                    : disabled
                    ? "border-zinc-800 bg-zinc-900 opacity-30 cursor-not-allowed"
                    : isMale
                    ? "border-sky-900 bg-sky-950 hover:bg-sky-900"
                    : "border-pink-900 bg-pink-950 hover:bg-pink-900"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isMale ? "bg-sky-400" : "bg-pink-400"}`} />
                <span className="text-xs font-medium text-white leading-tight break-words w-full">{p.name}</span>
              </button>
            );
          })}
          {availablePlayers.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-4 col-span-3">No available players.</p>
          )}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button
          onClick={handleCreate}
          disabled={!canCreate || loading}
          className="bg-lime-500 hover:bg-lime-400 text-black font-bold"
        >
          {loading ? "Creating..." : "Create Team"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
