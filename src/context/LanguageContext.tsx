import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readArabicOn, writeArabicOn } from "../lib/i18n";
import { useAuth } from "./AuthContext";

type LanguageContextValue = {
  arabic: boolean;
  toggleArabic: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [arabic, setArabic] = useState(false);

  useEffect(() => {
    setArabic(readArabicOn(userId));
  }, [userId]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      arabic,
      toggleArabic: () => {
        setArabic((prev) => {
          const next = !prev;
          writeArabicOn(userId, next);
          return next;
        });
      },
    }),
    [arabic, userId],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
