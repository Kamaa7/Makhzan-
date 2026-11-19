import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BootScreen } from "../components/BootScreen";
import { initDb } from "../db";

type DbState = { ready: boolean; error: string | null };

const DbContext = createContext<DbState>({ ready: false, error: null });

export function DbProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const onStale = () => setStale(true);
    window.addEventListener("makhzan-shop-changed", onStale);
    initDb()
      .then(() => setReady(true))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not open the local database"));
    return () => window.removeEventListener("makhzan-shop-changed", onStale);
  }, []);

  if (stale) {
    return (
      <BootScreen
        message="This window is out of date."
        error="Another window saved the shop. Reload this window before you continue."
      />
    );
  }

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
