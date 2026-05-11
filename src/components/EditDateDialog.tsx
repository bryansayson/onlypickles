"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onClose: () => void;
  currentDate: Date;
  currentEndTime: Date | null;
  onSaved: (start: Date, end: Date | null) => void;
}

export function EditDateDialog({ open, onClose, currentDate, currentEndTime, onSaved }: Props) {
  const [selected, setSelected] = useState<Date>(currentDate);
  const [startTime, setStartTime] = useState(format(currentDate, "HH:mm"));
  const [endTime, setEndTime] = useState(currentEndTime ? format(currentEndTime, "HH:mm") : "");

  function handleSave() {
    const [sh, sm] = startTime.split(":").map(Number);
    const start = new Date(selected);
    start.setHours(sh, sm, 0, 0);

    let end: Date | null = null;
    if (endTime) {
      const [eh, em] = endTime.split(":").map(Number);
      end = new Date(selected);
      end.setHours(eh, em, 0, 0);
    }
    onSaved(start, end);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Date & Time</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-1">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => d && setSelected(d)}
            className="rounded-lg border mx-auto"
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="startTime">Start</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1"
                style={{ colorScheme: "dark" }}
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
                style={{ colorScheme: "dark" }}
              />
            </div>
          </div>
          <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
