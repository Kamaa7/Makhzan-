export const GUN_GAP_MS = 50;
export const MIN_CODE_LEN = 3;

export type ScanState =
  | { kind: "idle"; at: number }
  | { kind: "human"; text: string; at: number }
  | { kind: "gun"; text: string; at: number };

export type ScanResult = { state: ScanState; emit?: string; prevent: boolean };

export function stepScan(
  state: ScanState,
  event:
    | { type: "modified"; now: number }
    | { type: "enter"; now: number }
    | { type: "key"; key: string; now: number },
): ScanResult {
  const now = event.now;
  if (event.type === "modified") return { state: { ...state, at: now }, prevent: false };

  if (event.type === "enter") {
    if (state.kind === "gun" && state.text.length >= MIN_CODE_LEN) {
      return { state: { kind: "idle", at: now }, emit: state.text, prevent: true };
    }
    return { state: { kind: "idle", at: now }, prevent: false };
  }

  const gap = now - state.at;
  if (event.key.length !== 1) {
    if (gap >= GUN_GAP_MS) return { state: { kind: "idle", at: now }, prevent: false };
    return { state: { ...state, at: now }, prevent: false };
  }

  const armed = state.kind !== "idle" && state.text.length > 0 && gap < GUN_GAP_MS;
  if (armed) {
    return { state: { kind: "gun", text: state.text + event.key, at: now }, prevent: true };
  }

  return { state: { kind: "human", text: event.key, at: now }, prevent: false };
}
