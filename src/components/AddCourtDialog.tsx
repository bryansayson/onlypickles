"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type CourtFormat = "MIXED" | "MENS" | "WOMENS";

const options: { value: CourtFormat; label: string; description: string; color: string }[] = [
  { value: "MIXED", label: "Mixed", description: "Open to all genders", color: "border-purple-300 bg-purple-50 text-purple-700" },
  { value: "MENS", label: "Men's", description: "Male players only", color: "border-blue-300 bg-blue-50 text-blue-700" },
  { value: "WOMENS", label: "Women's", description: "Female players only", color: "border-pink-300 bg-pink-50 text-pink-700" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: (format: CourtFormat) => void;
}

export function AddCourtDialog({ open, onClose, onAdded }: Props) {
  const [selected, setSelected] = useState<CourtFormat>("MIXED");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Court</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                selected === opt.value
                  ? opt.color
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              <div>
                <p className="font-semibold text-sm">{opt.label}</p>
                <p className="text-xs opacity-70">{opt.description}</p>
              </div>
              {selected === opt.value && (
                <span className="ml-auto text-sm">✓</span>
              )}
            </button>
          ))}
        </div>
        <Button
          onClick={() => onAdded(selected)}
          className="w-full mt-2 bg-green-600 hover:bg-green-700"
        >
          Add Court
        </Button>
      </DialogContent>
    </Dialog>
  );
}
