"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User, LoginPayload, RegisterPayload } from "@/types";
import { authApi } from "@/lib/api";
import toast from "react-hot-toast";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  /** Refresh user object in context + localStorage (e.g. after plan upgrade) */
  refreshUser: (updated: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "vk_user"; // stores only the user object — NOT the token

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate user object from localStorage on mount, then validate session via API
  useEffect(() => {
    const rehydrate = async () => {
      try {
        const stored = localStorage.getItem(USER_KEY);
        if (stored) {
          setUser(JSON.parse(stored));
        }
        // Validate the session cookie is still active by calling /users/me
        const { backendApi } = await import("@/lib/api");
        const { data } = await backendApi.get<User>("/users/me");
        setUser(data);
        localStorage.setItem(USER_KEY, JSON.stringify(data));
      } catch {
        // Cookie expired or invalid — clear stale user state
        localStorage.removeItem(USER_KEY);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    rehydrate();
  }, []);

  const persist = useCallback((u: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const res = await authApi.login(payload);
    // The backend sets an httpOnly cookie; we only store the user object
    persist(res.user);
  }, [persist]);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await authApi.register(payload);
    persist(res.user);
  }, [persist]);

  const refreshUser = useCallback((updated: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
    setUser(updated);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore network errors during logout
    } finally {
      localStorage.removeItem(USER_KEY);
      setUser(null);
      toast.success("Logged out successfully");
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
