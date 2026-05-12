"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  existingPlayerIds: string[];
  onAdded: () => void;
}

export function AddPlayersSheet({ open, onClose, sessionId, existingPlayerIds, onAdded }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/players").then((r) => r.json()).then(setPlayers);
      setSelected(new Set());
    }
  }, [open]);

  const available = players.filter((p) => !existingPlayerIds.includes(p.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIds: [...selected] }),
    });
    setLoading(false);
    onAdded();
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[80vh] px-6 pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle>Add Players to Session</SheetTitle>
        </SheetHeader>
        {available.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-8">
            All roster players are already in this session.
          </p>
        ) : (
          <>
            <p className="text-xs text-zinc-500 mb-3">Tap to select players</p>
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[50vh] pb-4 overscroll-contain">
              {available.map((player) => {
                const isSelected = selected.has(player.id);
                return (
                  <button
                    key={player.id}
                    onPointerDown={() => toggle(player.id)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-lg border text-left select-none touch-manipulation ${
                      isSelected
                        ? "border-lime-500 bg-lime-950 active:bg-lime-900"
                        : "border-zinc-700 bg-zinc-900 active:bg-zinc-800"
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        player.gender === "MALE" ? "bg-sky-400" : "bg-pink-400"
                      }`}
                    />
                    <span className="font-medium text-white flex-1">{player.name}</span>
                    <span className="text-xs text-zinc-500">
                      {player.gender === "MALE" ? "M" : "F"}
                    </span>
                    {isSelected && (
                      <span className="text-lime-400 text-sm">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
            <Button
              onClick={handleAdd}
              disabled={selected.size === 0 || loading}
              className="w-full mt-2 bg-lime-500 hover:bg-lime-400 text-black font-bold"
            >
              {loading ? "Adding..." : `Add ${selected.size > 0 ? selected.size : ""} Player${selected.size !== 1 ? "s" : ""}`}
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
