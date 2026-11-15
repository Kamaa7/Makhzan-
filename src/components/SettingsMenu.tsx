import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Cog6ToothIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { saveKeeperBackup } from "../db";
import { Bi } from "./Bi";
import { LanguageSelect } from "./LanguageSelect";
import { ShortcutsDialog } from "./ShortcutsDialog";

type SettingsVariant = "nav" | "header" | "toolbar";

export function SettingsButton({
  variant = "header",
  onOpen,
}: {
  variant?: SettingsVariant;
  /** When set, the parent owns the dialog so it stays open after a mobile menu closes. */
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const className =
    variant === "nav"
      ? "flex w-full items-start gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-black hover:bg-gray-100"
      : variant === "toolbar"
        ? "btn-secondary no-print"
        : "btn-ghost text-sm";

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          if (onOpen) onOpen();
          else setOpen(true);
        }}
      >
        {variant === "nav" ? <Cog6ToothIcon className="mt-0.5 h-5 w-5 shrink-0 text-black" /> : <Cog6ToothIcon className="h-4 w-4 shrink-0" />}
        <Bi k="settings" />
      </button>
      {onOpen ? null : <SettingsDialog open={open} onClose={() => setOpen(false)} />}
    </>
  );
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { push } = useToast();
  const [helpOpen, setHelpOpen] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  const backup = async () => {
    setBackupBusy(true);
    try {
      await saveKeeperBackup();
      push("Backup file downloaded", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not save backup", "error");
    } finally {
      setBackupBusy(false);
    }
  };

  const leave = async () => {
    onClose();
    await signOut();
    navigate("/signin");
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/25" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                <Bi k="settings" />
              </DialogTitle>
              <button type="button" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" aria-label="Close" onClick={onClose}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-500">Shop setup, backup, country language, and help. This stays available on every screen.</p>
            <div className="mt-5 space-y-2">
              <button type="button" className="btn-secondary w-full" onClick={() => go("/store")}>
                <Bi k="storeProfile" />
              </button>
              <button type="button" className="btn-secondary w-full" disabled={backupBusy} onClick={() => void backup()}>
                <Bi k="saveBackup" />
              </button>
              <label className="block space-y-1 text-sm text-gray-700">
                Language
                <LanguageSelect className="w-full" />
              </label>
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => {
                  onClose();
                  setHelpOpen(true);
                }}
              >
                Help
              </button>
              <button type="button" className="btn-outline w-full" onClick={() => void leave()}>
                <Bi k="signOut" />
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
