"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const formatColor: Record<string, string> = {
  MIXED:  "bg-purple-900/50 text-purple-300",
  MENS:   "bg-sky-900/50 text-sky-300",
  WOMENS: "bg-pink-900/50 text-pink-300",
  ANY:    "bg-emerald-900/50 text-emerald-300",
};

export const formatLabel: Record<string, string> = {
  MIXED:  "Mixed",
  MENS:   "Men's",
  WOMENS: "Women's",
  ANY:    "Open",
};

const podColors = [
  "bg-violet-900/50 text-violet-300",
  "bg-amber-900/50 text-amber-300",
  "bg-teal-900/50 text-teal-300",
  "bg-rose-900/50 text-rose-300",
  "bg-indigo-900/50 text-indigo-300",
  "bg-orange-900/50 text-orange-300",
];

interface ScoreEntry {
  t1: string;
  t2: string;
  onT1Change: (v: string) => void;
  onT2Change: (v: string) => void;
  /** Provide to show a per-card Save button (new scores or individual edit). Omit when Save is in the round header (round edit mode). */
  onSave?: () => void;
  onCancel?: () => void;
  saving?: boolean;
}

interface Props {
  courtFormat: "MIXED" | "MENS" | "WOMENS" | "ANY";
  courtNumber?: number;
  /** Optional — shown as a small label beside the court badge */
  roundNumber?: number;
  team1Names: string[];
  team2Names: string[];
  team1Score: number | null;
  team2Score: number | null;
  completed: boolean;
  /** Name to underline (leaderboard perspective) */
  highlightName?: string;
  /** Pod this game belongs to */
  podName?: string;
  /** Index of the pod in the session's pod list — determines badge color */
  podIndex?: number;
  /** Tints the card background for the leaderboard view */
  highlightResult?: "won" | "lost";
  /** Colours the winning team name lime (schedule tab) */
  highlightWinner?: boolean;
  /** Pass when admin score entry is active */
  scoreEntry?: ScoreEntry;
  /** Pass to show a per-card edit button (individual score correction) */
  onEdit?: () => void;
}

function TeamRow({
  names,
  score,
  completed,
  won,
  highlightName,
  colorWinner,
  entryValue,
  onEntryChange,
}: {
  names: string[];
  score: number | null;
  completed: boolean;
  won: boolean;
  highlightName?: string;
  colorWinner?: boolean;
  entryValue?: string;
  onEntryChange?: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-sm font-medium flex-1 leading-snug ${colorWinner && won ? "text-lime-400" : ""}`}>
        {names.map((name, i) => (
          <span key={i}>
            {i > 0 && <span className={colorWinner && won ? "text-lime-600" : "text-zinc-500"}> & </span>}
            <span className={highlightName === name ? "underline underline-offset-2" : ""}>{name}</span>
          </span>
        ))}
      </span>
      {entryValue !== undefined && onEntryChange ? (
        <Input
          className="w-14 h-8 text-center text-sm p-1 shrink-0"
          placeholder="0"
          value={entryValue}
          onChange={(e) => onEntryChange(e.target.value)}
        />
      ) : completed && score !== null ? (
        <span className={`text-lg font-bold tabular-nums w-14 text-right shrink-0 ${won ? "text-lime-400" : "text-zinc-500"}`}>
          {score}
        </span>
      ) : null}
    </div>
  );
}

export function GameCard({
  courtFormat,
  courtNumber,
  roundNumber,
  team1Names,
  team2Names,
  team1Score,
  team2Score,
  completed,
  highlightName,
  podName,
  podIndex,
  highlightResult,
  highlightWinner,
  scoreEntry,
  onEdit,
}: Props) {
  const hasScores = scoreEntry !== undefined;
  const t1Won = completed && team1Score !== null && team2Score !== null && team1Score > team2Score;
  const t2Won = completed && team1Score !== null && team2Score !== null && team2Score > team1Score;

  const cardStyle = highlightResult === "won"
    ? "bg-lime-950/50 border-lime-900/60"
    : highlightResult === "lost"
    ? "bg-red-950/50 border-red-900/60"
    : "bg-zinc-900 border-zinc-700";

  return (
    <div className={`rounded-lg border px-3 py-2.5 min-w-0 ${cardStyle}`}>
      {/* Badge row — flush left to align with team names */}
      {(roundNumber !== undefined || courtNumber !== undefined || podName || onEdit) && (
        <div className="flex items-center gap-2 mb-1.5">
          {roundNumber !== undefined && (
            <span className="text-xs text-zinc-500">Rd {roundNumber}</span>
          )}
          {courtNumber !== undefined && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${formatColor[courtFormat]}`}>
              C{courtNumber} {formatLabel[courtFormat]}
            </span>
          )}
          {podName && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              podIndex !== undefined
                ? podColors[podIndex % podColors.length]
                : "bg-zinc-700 text-zinc-300"
            }`}>
              {podName}
            </span>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="ml-auto text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              edit
            </button>
          )}
        </div>
      )}

      {/* Matchup */}
      <div className="flex flex-col gap-1.5">
        <TeamRow
          names={team1Names}
          score={team1Score}
          completed={completed}
          won={t1Won}
          highlightName={highlightName}
          colorWinner={highlightWinner}
          entryValue={scoreEntry?.t1}
          onEntryChange={scoreEntry?.onT1Change}
        />
        <div className="flex items-center gap-2">
          <div className="flex-1 border-t border-zinc-800" />
          <span className="text-xs text-zinc-600">vs</span>
          <div className="flex-1 border-t border-zinc-800" />
        </div>
        <TeamRow
          names={team2Names}
          score={team2Score}
          completed={completed}
          won={t2Won}
          highlightName={highlightName}
          colorWinner={highlightWinner}
          entryValue={scoreEntry?.t2}
          onEntryChange={scoreEntry?.onT2Change}
        />
      </div>

      {/* Per-card Save button (new scores only, not edit mode) */}
      {hasScores && (scoreEntry?.onSave || scoreEntry?.onCancel) && (
        <div className="mt-2.5 flex gap-2">
          {scoreEntry?.onSave && (
            <Button
              size="sm"
              className="flex-1 h-8 text-xs bg-lime-500 hover:bg-lime-400 text-black font-bold"
              onClick={scoreEntry.onSave}
              disabled={!scoreEntry.t1 || !scoreEntry.t2 || scoreEntry.saving}
            >
              {scoreEntry.saving ? "Saving…" : "Save"}
            </Button>
          )}
          {scoreEntry?.onCancel && (
            <button
              onClick={scoreEntry.onCancel}
              className="text-xs text-zinc-500 hover:text-zinc-300 px-2 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
