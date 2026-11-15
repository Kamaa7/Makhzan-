import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readLanguageId, shopLanguage, writeLanguageId, type ShopLanguage } from "../lib/i18n";
import { useAuth } from "./AuthContext";

type LanguageContextValue = {
  languageId: string;
  language: ShopLanguage;
  setLanguage: (id: string) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [languageId, setLanguageId] = useState("en");

  useEffect(() => {
    setLanguageId(readLanguageId(userId));
  }, [userId]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      languageId,
      language: shopLanguage(languageId),
      setLanguage: (id: string) => {
        const next = shopLanguage(id).id;
        setLanguageId(next);
        writeLanguageId(userId, next);
      },
    }),
    [languageId, userId],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
