"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AdminContextValue {
  isAdmin: boolean;
  openLogin: () => void;
  logout: () => void;
}

const AdminContext = createContext<AdminContextValue>({
  isAdmin: false,
  openLogin: () => {},
  logout: () => {},
});

export function useAdmin() {
  return useContext(AdminContext);
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsAdmin(localStorage.getItem("op_admin") === "true");
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    setLoading(false);
    if (res.ok) {
      localStorage.setItem("op_admin", "true");
      setIsAdmin(true);
      setDialogOpen(false);
      setPin("");
    } else {
      setError("Incorrect PIN");
    }
  }

  function logout() {
    localStorage.removeItem("op_admin");
    setIsAdmin(false);
  }

  function openLogin() {
    setPin("");
    setError("");
    setDialogOpen(true);
  }

  return (
    <AdminContext.Provider value={{ isAdmin, openLogin, logout }}>
      {children}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Admin Login</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLogin} className="flex flex-col gap-3 mt-1">
            <Input
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button
              type="submit"
              disabled={loading || !pin}
              className="bg-lime-500 hover:bg-lime-400 text-black font-bold"
            >
              {loading ? "Checking..." : "Unlock"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AdminContext.Provider>
  );
}
