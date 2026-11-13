import { useEffect, useRef } from "react";
import { stepScan, type ScanState } from "../lib/scanMachine";

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

    let state: ScanState = { kind: "idle", at: 0 };

    const onKeyDown = (event: KeyboardEvent) => {
      const now = Date.now();
      if (event.ctrlKey || event.metaKey || event.altKey) {
        state = stepScan(state, { type: "modified", now }).state;
        return;
      }
      if (event.key === "Enter") {
        const next = stepScan(state, { type: "enter", now });
        state = next.state;
        if (next.prevent) event.preventDefault();
        if (next.emit) onScanRef.current(next.emit);
        return;
      }
      const next = stepScan(state, { type: "key", key: event.key, now });
      state = next.state;
      if (next.prevent) event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);
}
