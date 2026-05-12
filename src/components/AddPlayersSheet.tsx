"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // New player inline form
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState<"MALE" | "FEMALE">("MALE");
  const [addingNew, setAddingNew] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  async function loadPlayers() {
    const res = await fetch("/api/players");
    return res.json() as Promise<Player[]>;
  }

  useEffect(() => {
    if (open) {
      loadPlayers().then(setPlayers);
      setSelected(new Set());
      setQuery("");
      setNewOpen(false);
      setNewName("");
      setNewGender("MALE");
    }
  }, [open]);

  const available = players.filter((p) => !existingPlayerIds.includes(p.id));
  const filtered = query.trim()
    ? available.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : available;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreatePlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddingNew(true);
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), gender: newGender }),
    });
    const created: Player = await res.json();
    const fresh = await loadPlayers();
    setPlayers(fresh);
    setSelected((prev) => new Set([...prev, created.id]));
    setNewName("");
    setNewOpen(false);
    setAddingNew(false);
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
      <SheetContent side="bottom" className="max-h-[85vh] px-6 pb-8 flex flex-col">
        <SheetHeader className="mb-3 shrink-0">
          <SheetTitle>Add Players to Session</SheetTitle>
        </SheetHeader>

        {/* Search */}
        <div className="shrink-0 mb-3">
          <Input
            placeholder="Search players…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 flex flex-col gap-3">
          {/* Player grid */}
          {filtered.length === 0 && !newOpen ? (
            <p className="text-zinc-500 text-sm text-center py-4">
              {query ? "No players match your search." : "All roster players are already in this session."}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filtered.map((player) => {
                const isSelected = selected.has(player.id);
                const isMale = player.gender === "MALE";
                return (
                  <button
                    key={player.id}
                    onClick={() => toggle(player.id)}
                    className={`relative flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-center select-none touch-manipulation transition-colors ${
                      isSelected
                        ? "border-lime-500 bg-lime-950"
                        : isMale
                          ? "border-sky-900 bg-sky-950 active:bg-sky-900"
                          : "border-pink-900 bg-pink-950 active:bg-pink-900"
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 text-lime-400 text-xs leading-none">✓</span>
                    )}
                    <span className={`w-1.5 h-1.5 rounded-full ${isMale ? "bg-sky-400" : "bg-pink-400"}`} />
                    <span className="text-xs font-medium leading-tight break-words w-full">{player.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* New player form */}
          {newOpen ? (
            <form onSubmit={handleCreatePlayer} className="flex flex-col gap-3 pt-3 border-t border-zinc-800">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">New player</p>
              <Input
                ref={nameInputRef}
                autoFocus
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
              <div className="flex gap-2">
                {(["MALE", "FEMALE"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setNewGender(g)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border touch-manipulation transition-colors ${
                      newGender === g
                        ? g === "MALE" ? "bg-sky-900 border-sky-600 text-sky-200" : "bg-pink-900 border-pink-600 text-pink-200"
                        : "bg-zinc-900 border-zinc-700 text-zinc-400"
                    }`}
                  >
                    {g === "MALE" ? "Man" : "Woman"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={addingNew || !newName.trim()} className="flex-1 bg-lime-500 hover:bg-lime-400 text-black font-bold">
                  {addingNew ? "Adding…" : "Add to Roster"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setNewOpen(false); setNewName(""); }} className="flex-1">
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => { setNewOpen(true); setTimeout(() => nameInputRef.current?.focus(), 50); }}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 text-sm touch-manipulation transition-colors"
            >
              <span className="text-lg leading-none">+</span> New player
            </button>
          )}
        </div>

        <div className="shrink-0 pt-3 border-t border-zinc-800 mt-3">
          <Button
            onClick={handleAdd}
            disabled={selected.size === 0 || loading}
            className="w-full bg-lime-500 hover:bg-lime-400 text-black font-bold"
          >
            {loading ? "Adding..." : selected.size > 0 ? `Add ${selected.size} Player${selected.size !== 1 ? "s" : ""}` : "Add Players"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
