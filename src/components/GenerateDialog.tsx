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

interface Court {
  format: "MIXED" | "MENS" | "WOMENS";
}

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  sessionFormat: "ROTATING" | "FIXED";
  courts: Court[];
  onGenerated: () => void;
}

export function GenerateDialog({ open, onClose, sessionId, sessionFormat, courts, onGenerated }: Props) {
  const isSplit = sessionFormat === "ROTATING"
    && courts.some((c) => c.format === "MENS")
    && courts.some((c) => c.format === "WOMENS")
    && !courts.some((c) => c.format === "MIXED");

  const [rrType, setRrType] = useState<"single" | "double">("single");
  const [mensMinGames, setMensMinGames] = useState("5");
  const [womensMinGames, setWomensMinGames] = useState("5");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const body =
      sessionFormat === "FIXED"
        ? { mode: rrType }
        : isSplit
        ? { mode: "splitMinGames", value: parseInt(mensMinGames), womensValue: parseInt(womensMinGames) }
        : { mode: "minGames", value: parseInt(mensMinGames) };

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
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  <span className="font-semibold capitalize">{type} Round Robin</span>
                  <p className={`text-xs mt-0.5 ${rrType === type ? "text-green-100" : "text-gray-400"}`}>
                    {type === "single"
                      ? "Every team faces every other team once"
                      : "Every team faces every other team twice"}
                  </p>
                </button>
              ))}
            </div>
          ) : isSplit ? (
            <div className="flex flex-col gap-3">
              <div>
                <Label htmlFor="mensGames" className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                  Men&apos;s games per player
                </Label>
                <Input
                  id="mensGames"
                  type="number"
                  min="1"
                  value={mensMinGames}
                  onChange={(e) => setMensMinGames(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="womensGames" className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-pink-400 inline-block" />
                  Women&apos;s games per player
                </Label>
                <Input
                  id="womensGames"
                  type="number"
                  min="1"
                  value={womensMinGames}
                  onChange={(e) => setWomensMinGames(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="value">Games per player</Label>
              <Input
                id="value"
                type="number"
                min="1"
                value={mensMinGames}
                onChange={(e) => setMensMinGames(e.target.value)}
                className="mt-1"
                required
              />
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            type="submit"
            disabled={loading || (sessionFormat === "ROTATING" && !mensMinGames)}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? "Generating..." : "Generate"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
