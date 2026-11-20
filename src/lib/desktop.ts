/** True only inside the installed Windows app. The browser build never takes this path. */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type ShopFile = { bytes: number[]; generation: number };

export type ReadyUpdate = { version: string; url: string };

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: call } = await import("@tauri-apps/api/core");
  return call<T>(cmd, args);
}

function shopChanged(): Error {
  const error = new Error("Another window saved the shop. Reload this window before you continue.");
  error.name = "ShopChangedError";
  return error;
}

function asMessage(err: unknown, fallback: string): Error {
  if (String(err).includes("stale")) return shopChanged();
  if (typeof err === "string" && err.trim()) return new Error(err);
  if (err instanceof Error && err.message) return err;
  return new Error(fallback);
}

export async function desktopReadShop(): Promise<{ bytes: Uint8Array | null; generation: number }> {
  const file = await invoke<ShopFile>("shop_read");
  return {
    bytes: file.bytes.length ? Uint8Array.from(file.bytes) : null,
    generation: file.generation,
  };
}

export async function desktopComparePut(bytes: Uint8Array, expected: number): Promise<number> {
  try {
    return await invoke<number>("shop_write", { bytes: Array.from(bytes), expected });
  } catch (err) {
    throw asMessage(err, "Could not save the shop file");
  }
}

export async function desktopForcePut(bytes: Uint8Array): Promise<number> {
  try {
    return await invoke<number>("shop_force_write", { bytes: Array.from(bytes) });
  } catch (err) {
    throw asMessage(err, "Could not replace the shop file");
  }
}

/** Copies shop.db to shop.db.bak only when this window still owns the generation. */
export async function desktopBackupIfCurrent(expected: number): Promise<boolean> {
  try {
    return await invoke<boolean>("shop_backup", { expected });
  } catch (err) {
    if (String(err).includes("stale")) return false;
    throw asMessage(err, "Could not copy the shop backup");
  }
}

export async function desktopSaveCopy(bytes: Uint8Array, filename: string): Promise<boolean> {
  try {
    return await invoke<boolean>("save_shop_copy", { bytes: Array.from(bytes), filename });
  } catch (err) {
    throw asMessage(err, "Could not save the backup file");
  }
}

export async function desktopShopFolder(): Promise<string> {
  return invoke<string>("shop_folder");
}

/** Null when this copy is current, offline, or GitHub has no release yet. */
export async function desktopReadyUpdate(): Promise<ReadyUpdate | null> {
  try {
    return await invoke<ReadyUpdate | null>("ready_update");
  } catch {
    return null;
  }
}

export async function openDesktopRelease(url: string): Promise<void> {
  await invoke("open_release", { url });
}
