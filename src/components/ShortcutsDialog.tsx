import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import { GUIDE_SECTIONS } from "../lib/guide";
import { SHORTCUT_SECTIONS } from "../lib/shortcuts";

export function ShortcutHint({ keys }: { keys: string }) {
  return <span className="font-normal opacity-50"> · {keys}</span>;
}

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/25" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-lg font-semibold text-gray-900">Help</DialogTitle>
            <button type="button" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" aria-label="Close" onClick={onClose}>
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Shortcuts stay on the keyboard. The guide is the six steps for a new shop. Read one block, then go back to the counter.
          </p>
          <div className="mt-5 grid min-h-0 flex-1 gap-6 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
            <section className="lg:overflow-y-auto lg:pr-2" aria-labelledby="help-shortcuts">
              <h2 id="help-shortcuts" className="text-sm font-semibold text-gray-900">
                Shortcuts
              </h2>
              <p className="mt-1 text-sm text-slate-500">Function keys work while a field is focused. Digit keys and Enter stay with the barcode gun.</p>
              <div className="mt-4 space-y-5">
                {SHORTCUT_SECTIONS.map((section) => (
                  <section key={section.title}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{section.title}</h3>
                    <ul className="mt-2 divide-y divide-gray-100">
                      {section.rows.map((row) => (
                        <li key={`${section.title}-${row.keys}-${row.action}`} className="flex items-center justify-between gap-4 py-1.5 text-sm">
                          <span className="text-gray-800">{row.action}</span>
                          <kbd className="shrink-0 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-xs text-gray-700">
                            {row.keys}
                          </kbd>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </section>
            <section className="border-t border-gray-200 pt-5 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" aria-labelledby="help-guide">
              <h2 id="help-guide" className="text-sm font-semibold text-gray-900">
                Guide
              </h2>
              <ol className="mt-4 space-y-5">
                {GUIDE_SECTIONS.map((section, index) => (
                  <li key={section.title}>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {index + 1}. {section.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-gray-700">{section.body}</p>
                    <Link to={section.to} onClick={onClose} className="mt-2 inline-block text-sm font-medium text-gray-900 underline">
                      {section.link}
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
