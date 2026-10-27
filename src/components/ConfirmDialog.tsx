import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Continue",
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/25" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-lg font-semibold text-gray-900">{title}</DialogTitle>
            <button type="button" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" aria-label="Close" onClick={onClose}>
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-3 text-sm text-gray-600">{message}</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={danger ? "btn-primary bg-red-600 hover:bg-red-700" : "btn-primary"}
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
