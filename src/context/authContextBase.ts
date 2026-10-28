import { createContext, useContext } from "react";
import type { AuthSession, AuthUser, StoreProfile } from "../lib/types";

export type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  profile: StoreProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
