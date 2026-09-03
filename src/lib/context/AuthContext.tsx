"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface Officer {
  badge: string;
  label: string;
}

interface AuthState {
  officer: Officer | null;
  loginAsOfficer: (badge: string) => void;
  logout: () => void;
}

const STORAGE_KEY = "labellens.officer";

const AuthContext = createContext<AuthState | null>(null);

function officerLabel(badge: string): string {
  const match = badge.match(/^([A-Za-z]{2})-([A-Za-z]{3})/);
  return match ? `${match[1].toUpperCase()} ${match[2]} Inspector` : "Inspector";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [officer, setOfficer] = useState<Officer | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setOfficer(JSON.parse(raw) as Officer);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const loginAsOfficer = (badge: string) => {
    const next = { badge, label: officerLabel(badge) };
    setOfficer(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const logout = () => {
    setOfficer(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <AuthContext.Provider value={{ officer, loginAsOfficer, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
