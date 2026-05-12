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

type OverrideType = "MUST_PARTNER" | "MUST_NOT_PARTNER";

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  players: Player[];
  onCreated: () => void;
}

export function AddOverrideDialog({ open, onClose, sessionId, players, onCreated }: Props) {
  const [player1Id, setPlayer1Id] = useState<string | null>(null);
  const [player2Id, setPlayer2Id] = useState<string | null>(null);
  const [type, setType] = useState<OverrideType>("MUST_PARTNER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function selectPlayer(id: string) {
    if (player1Id === id) { setPlayer1Id(null); return; }
    if (player2Id === id) { setPlayer2Id(null); return; }
    if (!player1Id) { setPlayer1Id(id); return; }
    if (!player2Id) { setPlayer2Id(id); return; }
    setPlayer2Id(id);
  }

  function isSelected(id: string) { return player1Id === id || player2Id === id; }

  async function handleSave() {
    if (!player1Id || !player2Id) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/sessions/${sessionId}/overrides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player1Id, player2Id, type }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to save");
      return;
    }
    setPlayer1Id(null);
    setPlayer2Id(null);
    setType("MUST_PARTNER");
    setError("");
    onCreated();
  }

  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog open={open} onOpenChange={() => { setPlayer1Id(null); setPlayer2Id(null); setError(""); onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Player Override</DialogTitle>
        </DialogHeader>

        {/* Type toggle */}
        <div className="flex gap-2">
          {(["MUST_PARTNER", "MUST_NOT_PARTNER"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                type === t
                  ? t === "MUST_PARTNER"
                    ? "bg-lime-500 text-black border-lime-500"
                    : "bg-red-500 text-white border-red-500"
                  : "bg-zinc-900 text-zinc-400 border-zinc-700"
              }`}
            >
              {t === "MUST_PARTNER" ? "Partner At Least Once" : "Never Partner"}
            </button>
          ))}
        </div>

        <p className="text-xs text-zinc-500 -mt-1">
          {type === "MUST_PARTNER"
            ? "The algorithm will pair these two players together at least once."
            : "These two players will never be on the same team."}
        </p>

        {/* Player selection */}
        <p className="text-xs text-zinc-500">Select 2 players</p>
        <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
          {sorted.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPlayer(p.id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                isSelected(p.id) ? "border-lime-500 bg-lime-950" : "border-zinc-700 bg-zinc-900"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${p.gender === "MALE" ? "bg-sky-400" : "bg-pink-400"}`} />
              <span className="text-sm font-medium text-white flex-1">{p.name}</span>
              {isSelected(p.id) && (
                <span className="text-lime-400 text-xs font-bold">
                  {player1Id === p.id ? "1" : "2"}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <Button
          onClick={handleSave}
          disabled={!player1Id || !player2Id || loading}
          className={`w-full font-bold ${
            type === "MUST_PARTNER"
              ? "bg-lime-500 hover:bg-lime-400 text-black"
              : "bg-red-600 hover:bg-red-500 text-white"
          }`}
        >
          {loading ? "Saving..." : "Add Override"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
