import { useEffect, useRef } from "react";

const GUN_GAP_MS = 50;
const MIN_CODE_LEN = 3;

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Keyboard-wedge barcode gun.
 * Rapid keys (< 50ms apart) are a scan. Slower typing in qty/rate boxes is left alone.
 * Codes shorter than 3 characters are ignored.
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    let buffer = "";
    let lastAt = 0;
    let isGun = false;

    const reset = () => {
      buffer = "";
      isGun = false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const now = Date.now();
      const gap = now - lastAt;
      lastAt = now;

      if (event.key === "Enter") {
        if (isGun && buffer.length >= MIN_CODE_LEN) {
          event.preventDefault();
          const code = buffer;
          reset();
          onScanRef.current(code);
        } else {
          reset();
        }
        return;
      }

      if (event.key.length !== 1) {
        if (gap >= GUN_GAP_MS) reset();
        return;
      }

      if (buffer.length > 0 && gap < GUN_GAP_MS) {
        isGun = true;
        buffer += event.key;
        event.preventDefault();
        return;
      }

      if (isEditable(event.target)) {
        reset();
        buffer = event.key;
        isGun = false;
        return;
      }

      buffer = event.key;
      isGun = false;
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);
}
