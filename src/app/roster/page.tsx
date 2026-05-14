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

      <div className="flex flex-col gap-6">
        {(["MALE", "FEMALE"] as const).map((gender) => {
          const group = players
            .filter((p) => p.gender === gender)
            .sort((a, b) => a.name.localeCompare(b.name));
          if (group.length === 0) return null;
          const isMale = gender === "MALE";
          return (
            <div key={gender}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${isMale ? "bg-sky-400" : "bg-pink-400"}`} />
                <span className="text-sm font-semibold text-zinc-300">{isMale ? "Men" : "Women"}</span>
                <span className="text-xs text-zinc-500">{group.length}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {group.map((player) => (
                  <div
                    key={player.id}
                    className={`relative rounded-lg border px-2 py-2.5 flex flex-col items-center gap-1 text-center ${
                      isMale ? "border-sky-900 bg-sky-950" : "border-pink-900 bg-pink-950"
                    }`}
                  >
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(player.id)}
                        className="absolute top-1 right-1.5 text-zinc-600 hover:text-red-400 text-xs leading-none"
                      >×</button>
                    )}
                    <span className="text-xs font-medium leading-tight break-words w-full pt-1">{player.name}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
                  <SelectItem value="MALE">Men&apos;s</SelectItem>
                  <SelectItem value="FEMALE">Women&apos;s</SelectItem>
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
