"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/components/AdminProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Player {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE";
}

export default function RosterPage() {
  const { isAdmin } = useAdmin();
  const [players, setPlayers] = useState<Player[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE">("MALE");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/players");
    setPlayers(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), gender }),
    });
    setLoading(false);
    setName("");
    setGender("MALE");
    setOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/players/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Roster</h1>
        {isAdmin && (
          <Button onClick={() => setOpen(true)} className="bg-lime-500 hover:bg-lime-400 text-black font-bold">
            + Add Player
          </Button>
        )}
      </div>

      {players.length === 0 && (
        <p className="text-zinc-500 text-center py-12">No players yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800"
          >
            <div className="flex items-center gap-3">
              <span className="font-semibold text-white">{player.name}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  player.gender === "MALE"
                    ? "bg-sky-900/60 text-sky-300"
                    : "bg-pink-900/60 text-pink-300"
                }`}
              >
                {player.gender === "MALE" ? "M" : "F"}
              </span>
            </div>
            {isAdmin && (
              <button
                onClick={() => handleDelete(player.id)}
                className="text-zinc-600 hover:text-red-400 text-sm transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <Dialog open={isAdmin && open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Player</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="flex flex-col gap-4 mt-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Player name"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as "MALE" | "FEMALE")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-lime-500 hover:bg-lime-400 text-black font-bold"
            >
              {loading ? "Adding..." : "Add Player"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
