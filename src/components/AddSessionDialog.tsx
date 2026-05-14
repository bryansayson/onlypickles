"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type CourtFormat = "MIXED" | "MENS" | "WOMENS";

interface CourtEntry {
  number: number;
  format: CourtFormat;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AddSessionDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [courts, setCourts] = useState<CourtEntry[]>([{ number: 1, format: "MIXED" }]);
  const [sessionFormat, setSessionFormat] = useState<"ROTATING" | "FIXED">("ROTATING");
  const [hasMedalRound, setHasMedalRound] = useState(false);
  const [loading, setLoading] = useState(false);

  function addCourt() {
    if (courts.length >= 4) return;
    setCourts([...courts, { number: courts.length + 1, format: "MIXED" }]);
  }

  function removeCourt(i: number) {
    const updated = courts
      .filter((_, idx) => idx !== i)
      .map((c, idx) => ({ ...c, number: idx + 1 }));
    setCourts(updated);
  }

  function setFormat(i: number, format: CourtFormat) {
    setCourts(courts.map((c, idx) => (idx === i ? { ...c, format } : c)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setLoading(true);
    const datetime = new Date(`${date}T${startTime}`).toISOString().replace("Z", "+00:00");
    const endDatetime = endTime ? new Date(`${date}T${endTime}`).toISOString().replace("Z", "+00:00") : null;
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, date: datetime, endTime: endDatetime, courts, sessionFormat, hasMedalRound }),
    });
    setLoading(false);
    setName("");
    setDate("");
    setStartTime("09:00");
    setEndTime("11:00");
    setCourts([{ number: 1, format: "MIXED" }]);
    setSessionFormat("ROTATING");
    setHasMedalRound(false);
    onCreated();
  }

  // Reset form when dialog closes
  function handleClose() {
    setName("");
    setDate("");
    setStartTime("09:00");
    setEndTime("11:00");
    setCourts([{ number: 1, format: "MIXED" }]);
    setSessionFormat("ROTATING");
    setHasMedalRound(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div>
            <Label htmlFor="name">Session Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tuesday Open Play"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="startTime">Start</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1"
                />
            </div>
            <div className="flex-1">
              <Label htmlFor="endTime">End</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1"
                />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Format</Label>
            <div className="flex gap-2">
              {(["ROTATING", "FIXED"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSessionFormat(f)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    sessionFormat === f
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {f === "ROTATING" ? "Rotating Partners" : "Fixed Partners"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Courts</Label>
              {courts.length < 4 && (
                <button
                  type="button"
                  onClick={addCourt}
                  className="text-xs text-green-600 font-medium hover:underline"
                >
                  + Add court
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {courts.map((court, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 w-14 shrink-0">Court {court.number}</span>
                  <Select
                    value={court.format}
                    onValueChange={(v) => setFormat(i, v as CourtFormat)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MIXED">Mixed</SelectItem>
                      <SelectItem value="MENS">Men&apos;s</SelectItem>
                      <SelectItem value="WOMENS">Women&apos;s</SelectItem>
                      <SelectItem value="ANY">Any</SelectItem>
                    </SelectContent>
                  </Select>
                  {courts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCourt(i)}
                      className="text-gray-400 hover:text-red-500 text-lg leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasMedalRound}
              onChange={(e) => setHasMedalRound(e.target.checked)}
              className="w-4 h-4 rounded accent-green-600"
            />
            <span className="text-sm text-gray-700">With medal rounds</span>
          </label>

          <Button
            type="submit"
            disabled={loading || !date}
            className="bg-green-600 hover:bg-green-700 mt-1"
          >
            {loading ? "Creating..." : "Create Session"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
