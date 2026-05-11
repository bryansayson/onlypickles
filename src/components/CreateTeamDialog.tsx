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
    // swap second pick
    setP2(id);
  }

  function isSelected(id: string) { return p1 === id || p2 === id; }

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
        <p className="text-xs text-gray-400 -mt-1">Select 2 players to pair as a team.</p>
        {hasMixedCourt && (
          <p className="text-xs text-purple-600 bg-purple-50 rounded px-2 py-1">
            Mixed courts require 1 male + 1 female per team.
          </p>
        )}
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {availablePlayers.map((p) => (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                isSelected(p.id)
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.gender === "MALE" ? "bg-blue-400" : "bg-pink-400"}`} />
              <span className="font-medium text-sm flex-1">{p.name}</span>
              <span className="text-xs text-gray-400">{p.gender === "MALE" ? "M" : "F"}</span>
              {isSelected(p.id) && (
                <span className="text-green-500 text-xs font-bold">
                  {p1 === p.id ? "1" : "2"}
                </span>
              )}
            </button>
          ))}
          {availablePlayers.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No available players.</p>
          )}
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button
          onClick={handleCreate}
          disabled={!canCreate || loading}
          className="bg-green-600 hover:bg-green-700"
        >
          {loading ? "Creating..." : "Create Team"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
