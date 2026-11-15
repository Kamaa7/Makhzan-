import { SHOP_LANGUAGES } from "../lib/i18n";
import { useLanguage } from "../context/LanguageContext";

export function LanguageSelect({ className = "" }: { className?: string }) {
  const { languageId, setLanguage } = useLanguage();
  return (
    <select
      aria-label="Language"
      className={`rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 ${className}`}
      value={languageId}
      onChange={(event) => setLanguage(event.target.value)}
    >
      {SHOP_LANGUAGES.map((item) => (
        <option key={item.id} value={item.id}>
          {item.id === "en" ? "English" : `${item.country} — ${item.native}`}
        </option>
      ))}
    </select>
  );
}
