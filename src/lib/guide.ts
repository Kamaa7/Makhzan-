/** One-page counter guide. Each block matches a screen the keeper already has. */

export const GUIDE_SECTIONS: { title: string; body: string; to: string; link: string }[] = [
  {
    title: "Shop and currency",
    body: "Open Store Profile. Enter the shop name and choose the currency before you type prices. The first saved sale locks that currency. Later amounts stay in it and are not converted.",
    to: "/store",
    link: "Open Store Profile",
  },
  {
    title: "Products and the barcode",
    body: "Open Products & Stock, then Add product. Click SKU / barcode and scan once. Type the name and sale price. Opening stock can wait. A scan on New Sale finds only a product already saved in this shop.",
    to: "/products",
    link: "Open Products & Stock",
  },
  {
    title: "Take a sale",
    body: "Open New Sale and scan each item. Totals update as lines are added. A cash memo is paid in full and can stay a walk-in. A bill needs a customer name, and the amount paid now can be less than the total. Save writes the sale and reduces stock.",
    to: "/sale",
    link: "Open New Sale",
  },
  {
    title: "Money still due",
    body: "Open the bill from Sales Register. Choose Record payment and enter what was paid. The bill moves from unpaid to partial, then to paid. The amount cannot be more than what is still due.",
    to: "/sales",
    link: "Open Sales Register",
  },
  {
    title: "Print",
    body: "On the saved sale, A4 opens the full page and Download PDF saves it. Receipt opens the narrow slip. On New Sale, Save and print saves the sale, then opens the page.",
    to: "/sales",
    link: "Open Sales Register",
  },
  {
    title: "Keep a backup",
    body: "On Home, Save backup downloads a file of this shop. Keep that file off this computer. On Store Profile, Download database does the same thing, and Import database puts a file back. Import replaces the shop on this computer. A different browser or PC starts empty until that file is imported.",
    to: "/",
    link: "Open Home",
  },
];
