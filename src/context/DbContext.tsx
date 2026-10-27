import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BootScreen } from "../components/BootScreen";
import { initDb } from "../db";

type DbState = { ready: boolean; error: string | null };

const DbContext = createContext<DbState>({ ready: false, error: null });

export function DbProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDb()
      .then(() => setReady(true))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not open the local database"));
  }, []);

  if (error) {
    return <BootScreen message="Local database failed to open." error={error} />;
  }

  return <DbContext.Provider value={{ ready, error }}>{children}</DbContext.Provider>;
}

export function useDb() {
  return useContext(DbContext);
}

export function useDbReady() {
  return useContext(DbContext).ready;
}
