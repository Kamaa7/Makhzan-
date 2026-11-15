import type { ReactNode } from "react";
import { useLanguage } from "../context/LanguageContext";
import { EN, labelIn, type ArKey } from "../lib/i18n";

export function Bi({
  k,
  en,
  className = "",
  mutedClass = "text-gray-500",
  inline = false,
}: {
  k: ArKey;
  en?: string;
  className?: string;
  mutedClass?: string;
  /** Put the country language on the same line (muted). Default stacks under English so the sidebar stays usable. */
  inline?: boolean;
}): ReactNode {
  const { language } = useLanguage();
  const english = en ?? EN[k];
  const local = labelIn(language.lang, k);
  if (!local) return english;
  if (inline) {
    return (
      <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
        <span>{english}</span>
        <span className={`text-[11px] font-normal ${mutedClass}`} dir={language.dir}>
          {local}
        </span>
      </span>
    );
  }
  return (
    <span className={`inline-flex flex-col items-start leading-tight ${className}`}>
      <span>{english}</span>
      <span className={`text-[10px] font-normal ${mutedClass}`} dir={language.dir}>
        {local}
      </span>
    </span>
  );
}
