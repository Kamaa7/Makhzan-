/** Match shop-counter shortcuts without stealing barcode-gun digits or Enter. */

export function isFKey(event: KeyboardEvent, n: number): boolean {
  return event.key === `F${n}` && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

export function isAltDigit(event: KeyboardEvent, digit: string): boolean {
  return (
    event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    (event.code === `Digit${digit}` || event.key === digit)
  );
}

export function isAltLetter(event: KeyboardEvent, letter: string): boolean {
  const code = `Key${letter.toUpperCase()}`;
  return (
    event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    (event.code === code || event.key.toLowerCase() === letter.toLowerCase())
  );
}

export function isCtrlKey(event: KeyboardEvent, key: string): boolean {
  return (
    event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === key.toLowerCase()
  );
}

export function isCtrlEnter(event: KeyboardEvent): boolean {
  return event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.key === "Enter";
}

export function isEscape(event: KeyboardEvent): boolean {
  return event.key === "Escape" && !event.altKey && !event.ctrlKey && !event.metaKey;
}

export function isDialogOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"]'));
}

export const SHORTCUT_SECTIONS: { title: string; rows: { keys: string; action: string }[] }[] = [
  {
    title: "Everywhere",
    rows: [
      { keys: "F1", action: "Open this list" },
      { keys: "Alt+1", action: "Home" },
      { keys: "Alt+2", action: "New Sale" },
      { keys: "Alt+3", action: "Sales Register" },
      { keys: "Alt+4", action: "Products & Stock" },
      { keys: "Alt+5", action: "Customers" },
      { keys: "Alt+6", action: "Store Profile" },
    ],
  },
  {
    title: "New Sale",
    rows: [
      { keys: "F2", action: "Focus product search" },
      { keys: "F4", action: "Toggle Cash memo / Bill" },
      { keys: "F6", action: "Focus discount" },
      { keys: "F7", action: "Focus amount paid (Bill)" },
      { keys: "F8", action: "Save" },
      { keys: "Ctrl+Enter", action: "Save" },
      { keys: "F9", action: "Save and print" },
      { keys: "F10", action: "Clear the bill" },
      { keys: "Alt+P", action: "Park this bill" },
      { keys: "Alt+R", action: "Reprint last memo" },
      { keys: "Esc", action: "Close a dialog, or return to the scanner" },
    ],
  },
  {
    title: "Home",
    rows: [{ keys: "Alt+R", action: "Reprint last memo" }],
  },
  {
    title: "Sales Register",
    rows: [
      { keys: "F3", action: "Focus search" },
      { keys: "Alt+E", action: "Export CSV" },
    ],
  },
  {
    title: "Sale",
    rows: [
      { keys: "F8", action: "Focus payment amount if due" },
      { keys: "Ctrl+P", action: "Print" },
    ],
  },
  {
    title: "Products & Stock",
    rows: [
      { keys: "F3", action: "Focus search" },
      { keys: "Ctrl+N", action: "Add product and focus SKU" },
    ],
  },
  {
    title: "Customers",
    rows: [
      { keys: "F3", action: "Focus search" },
      { keys: "Ctrl+N", action: "Add customer and focus name" },
    ],
  },
];
