"use client";

import { useAdmin } from "@/components/AdminProvider";

export function AdminToggle() {
  const { isAdmin, openLogin, logout } = useAdmin();

  if (isAdmin) {
    return (
      <button
        onClick={logout}
        title="Lock admin"
        className="text-lime-400 hover:text-lime-300 transition-colors text-lg"
      >
        🔓
      </button>
    );
  }

  return (
    <button
      onClick={openLogin}
      title="Admin login"
      className="text-zinc-600 hover:text-zinc-400 transition-colors text-lg"
    >
      🔒
    </button>
  );
}
