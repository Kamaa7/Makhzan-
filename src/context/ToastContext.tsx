import { createContext, useContext, type ReactNode } from "react";
import toast, { Toaster } from "react-hot-toast";

export type ToastKind = "info" | "success" | "error";

type ToastContextValue = {
  toasts: [];
  push: (message: string, kind?: ToastKind, action?: { label: string; onAction: () => void }) => void;
  dismiss: (id: number | string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const push: ToastContextValue["push"] = (message, kind = "info", action) => {
    if (action) {
      toast(
        (t) => (
          <div className="text-sm">
            <p>{message}</p>
            <button
              type="button"
              className="mt-2 text-xs font-semibold underline"
              onClick={() => {
                action.onAction();
                toast.dismiss(t.id);
              }}
            >
              {action.label}
            </button>
          </div>
        ),
        { duration: 5000 },
      );
      return;
    }
    if (kind === "error") toast.error(message);
    else if (kind === "success") toast.success(message);
    else toast(message);
  };

  return (
    <ToastContext.Provider value={{ toasts: [], push, dismiss: (id) => toast.dismiss(String(id)) }}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          className: "text-sm",
          success: { style: { background: "#fff", color: "#111827" } },
          error: { style: { background: "#fef2f2", color: "#991b1b" } },
        }}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
