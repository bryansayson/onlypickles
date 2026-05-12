"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TeamSide {
  names: string[];
  score?: number | null;
  won?: boolean;
  /** Name to underline (leaderboard perspective highlighting) */
  highlight?: string;
}

interface EditingState {
  t1: string;
  t2: string;
  onT1Change: (v: string) => void;
  onT2Change: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}

interface Props {
  team1: TeamSide;
  team2: TeamSide;
  /** Pass when the game is in admin edit mode */
  editing?: EditingState;
  completed?: boolean;
}

export function MatchupDisplay({ team1, team2, editing, completed }: Props) {
  const showScores = completed && !editing;

  function TeamRow({ side, team }: { side: "t1" | "t2"; team: TeamSide }) {
    const scoreColor = team.won ? "text-lime-400" : "text-zinc-500";
    return (
      <div className="flex items-center justify-between gap-2">
        {team.names.length > 0 ? (
          <span className="text-sm font-medium flex-1 leading-snug">
            {team.names.map((name, i) => (
              <span key={i}>
                {i > 0 && <span className="text-zinc-500"> & </span>}
                <span className={team.highlight === name ? "underline underline-offset-2" : ""}>
                  {name}
                </span>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-sm text-zinc-600 italic flex-1">TBD</span>
        )}
        {editing ? (
          <Input
            className="w-14 h-8 text-center text-sm p-1 shrink-0"
            placeholder="0"
            value={side === "t1" ? editing.t1 : editing.t2}
            onChange={(e) =>
              side === "t1" ? editing.onT1Change(e.target.value) : editing.onT2Change(e.target.value)
            }
          />
        ) : showScores && team.score !== null && team.score !== undefined ? (
          <span className={`text-lg font-bold tabular-nums w-8 text-right shrink-0 ${scoreColor}`}>
            {team.score}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <TeamRow side="t1" team={team1} />
      <div className="flex items-center gap-2">
        <div className="flex-1 border-t border-zinc-800" />
        <span className="text-xs text-zinc-600">vs</span>
        <div className="flex-1 border-t border-zinc-800" />
      </div>
      <TeamRow side="t2" team={team2} />
      {editing && (
        <div className="flex gap-2 mt-1">
          <Button
            size="sm"
            className="flex-1 h-8 text-xs bg-lime-500 hover:bg-lime-400 text-black font-bold"
            disabled={!editing.t1 || !editing.t2 || editing.saving}
            onClick={editing.onSave}
          >
            {editing.saving ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={editing.onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
