"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { AddSessionDialog } from "@/components/AddSessionDialog";
import { useAdmin } from "@/components/AdminProvider";

interface Court {
  id: string;
  number: number;
  format: "MIXED" | "MENS" | "WOMENS";
}

interface Session {
  id: string;
  date: string;
  endTime: string | null;
  courts: Court[];
  sessionPlayers: { id: string }[];
}

const formatLabel: Record<string, string> = {
  MIXED: "Mixed",
  MENS: "Men's",
  WOMENS: "Women's",
};

const formatColor: Record<string, string> = {
  MIXED: "bg-purple-900/50 text-purple-300",
  MENS:  "bg-sky-900/50 text-sky-300",
  WOMENS:"bg-pink-900/50 text-pink-300",
};

export default function HomePage() {
  const { isAdmin } = useAdmin();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const res = await fetch("/api/sessions");
    setSessions(await res.json());
  }

  async function deleteSession(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    load();
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Sessions</h1>
        {isAdmin && (
          <Button onClick={() => setOpen(true)} className="bg-lime-500 hover:bg-lime-400 text-black font-bold">
            + Add Session
          </Button>
        )}
      </div>

      {sessions.length === 0 && (
        <p className="text-zinc-500 text-center py-12">No sessions yet. Add your first one!</p>
      )}

      <div className="flex flex-col gap-3">
        {sessions.map((session) => (
          <Link key={session.id} href={`/sessions/${session.id}`}>
            <Card className="hover:border-zinc-600 transition-colors cursor-pointer bg-zinc-900 border-zinc-800">
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-white">
                      {format(new Date(session.date), "EEEE, MMMM d")}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {format(new Date(session.date), "h:mm a")}
                      {session.endTime && ` – ${format(new Date(session.endTime), "h:mm a")}`}
                      {" "}&middot; {session.sessionPlayers.length} players
                    </p>
                    <div className="flex gap-1 flex-wrap mt-1.5">
                      {session.courts.map((court) => (
                        <span
                          key={court.id}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${formatColor[court.format]}`}
                        >
                          C{court.number} {formatLabel[court.format]}
                        </span>
                      ))}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={(e) => deleteSession(e, session.id)}
                      className="shrink-0 text-zinc-600 hover:text-red-400 text-xl leading-none p-1"
                      title="Delete session"
                    >
                      ×
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <AddSessionDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => { setOpen(false); load(); }}
      />
    </div>
  );
}
