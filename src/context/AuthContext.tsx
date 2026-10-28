import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ensureStoreProfile, emptyProfile, restoreSession, signIn as dbSignIn, signOut as dbSignOut, signUp as dbSignUp } from "../db";
import { clearSaleDraft } from "../lib/saleDraft";
import type { AuthSession, AuthUser, StoreProfile } from "../lib/types";
import { useDb } from "./DbContext";

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  profile: StoreProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { ready, error: dbError } = useDb();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = async (next: AuthSession | null) => {
    setSession(next);
    if (!next) {
      setProfile(null);
      return;
    }
    try {
      setProfile(await ensureStoreProfile(next.user.id));
    } catch {
      setProfile(emptyProfile(next.user.id));
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (dbError) {
      setLoading(false);
      return;
    }
    if (!ready) return;
    restoreSession()
      .then(async (next) => {
        if (cancelled) return;
        await applySession(next);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, dbError]);

  const refreshProfile = async () => {
    const uid = session?.user.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    setProfile(await ensureStoreProfile(uid));
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      refreshProfile,
      signIn: async (email, password) => {
        await applySession(await dbSignIn(email, password));
      },
      signUp: async (email, password) => {
        await applySession(await dbSignUp(email, password));
      },
      signOut: async () => {
        const uid = session?.user.id;
        if (uid) clearSaleDraft(uid);
        await dbSignOut();
        await applySession(null);
      },
    }),
    [session, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
