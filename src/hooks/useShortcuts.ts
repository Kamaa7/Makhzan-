import { useEffect, useRef } from "react";

export type ShortcutBinding = {
  match: (event: KeyboardEvent) => boolean;
  run: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
};

/**
 * Window-level keydown in capture phase so F-keys still fire while a field is focused.
 * Does not bind bare letters, digits, or Enter — those belong to the barcode gun.
 */
export function useShortcuts(bindings: ShortcutBinding[], enabled = true) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      for (const binding of bindingsRef.current) {
        if (!binding.match(event)) continue;
        if (binding.preventDefault) event.preventDefault();
        binding.run(event);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);
}
