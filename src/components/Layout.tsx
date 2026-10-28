import { Dialog, DialogPanel } from "@headlessui/react";
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  CubeIcon,
  HomeIcon,
  ShoppingBagIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState, type ComponentType, type SVGProps } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useShortcuts } from "../hooks/useShortcuts";
import type { ArKey } from "../lib/i18n";
import { isAltDigit, isFKey } from "../lib/shortcuts";
import { Bi } from "./Bi";
import { ShortcutHint, ShortcutsDialog } from "./ShortcutsDialog";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const storeLinks: { to: string; k: ArKey; icon: Icon; end?: boolean }[] = [
  { to: "/", k: "home", icon: HomeIcon, end: true },
  { to: "/sale", k: "newSale", icon: ShoppingBagIcon },
  { to: "/sales", k: "salesRegister", icon: ClipboardDocumentListIcon },
  { to: "/products", k: "productsStock", icon: CubeIcon },
  { to: "/customers", k: "customers", icon: UsersIcon },
  { to: "/store", k: "storeProfile", icon: BuildingStorefrontIcon },
];

function pageTitle(pathname: string): string {
  if (pathname === "/") return "Home";
  if (pathname === "/sale") return "New Sale";
  if (pathname.match(/^\/sales\/[^/]+/)) return "Sale";
  if (pathname.startsWith("/sales")) return "Sales Register";
  if (pathname.startsWith("/products")) return "Products & Stock";
  if (pathname.match(/^\/customers\/[^/]+/)) return "Statement";
  if (pathname.startsWith("/customers")) return "Customers";
  if (pathname.startsWith("/store")) return "Store Profile";
  return "Makhzan";
}

function navClass(active: boolean) {
  return `flex items-start gap-2.5 rounded-md px-3 py-2 text-sm font-medium ${
    active ? "bg-black text-white" : "text-black hover:bg-gray-100"
  }`;
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-xs font-bold text-white">MK</div>
        <p className="font-bold text-black">Makhzan</p>
      </div>
      <p className="px-3 pt-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Store</p>
      <nav className="mt-2 flex-1 space-y-1 px-2">
        {storeLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={onNavigate}
            className={({ isActive }) => navClass(isActive)}
          >
            {({ isActive }) => (
              <>
                <link.icon className={`mt-0.5 h-5 w-5 shrink-0 ${isActive ? "text-white" : "text-black"}`} />
                <Bi k={link.k} mutedClass={isActive ? "text-gray-300" : "text-gray-500"} />
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t border-gray-200 px-2 py-3">
        <NavLink to="/store" onClick={onNavigate} className={({ isActive }) => navClass(isActive)}>
          {({ isActive }) => (
            <>
              <Cog6ToothIcon className={`mt-0.5 h-5 w-5 shrink-0 ${isActive ? "text-white" : "text-black"}`} />
              <Bi k="settings" mutedClass={isActive ? "text-gray-300" : "text-gray-500"} />
            </>
          )}
        </NavLink>
      </div>
    </>
  );
}

const ALT_ROUTES = ["/", "/sale", "/sales", "/products", "/customers", "/store"] as const;

export function Layout() {
  const { user, signOut } = useAuth();
  const { arabic, toggleArabic } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const go = (to: string) => {
    setHelpOpen(false);
    setMobileOpen(false);
    navigate(to);
  };

  useShortcuts([
    { match: (e) => isFKey(e, 1), preventDefault: true, run: () => setHelpOpen(true) },
    ...ALT_ROUTES.map((to, i) => ({
      match: (e: KeyboardEvent) => isAltDigit(e, String(i + 1)),
      preventDefault: true,
      run: () => go(to),
    })),
  ]);

  const leave = async () => {
    await signOut();
    navigate("/signin");
  };

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print hidden w-64 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex">
        <SidebarNav />
      </aside>

      <Dialog open={mobileOpen} onClose={setMobileOpen} className="relative z-50 lg:hidden">
        <div className="fixed inset-0 bg-black/25" aria-hidden="true" />
        <div className="fixed inset-0 flex">
          <DialogPanel className="flex h-full w-72 max-w-[80%] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-end px-3 pt-3">
              <button type="button" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" onClick={() => setMobileOpen(false)}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </DialogPanel>
        </div>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-1 text-gray-700 hover:bg-gray-100 lg:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">{pageTitle(location.pathname)}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="btn-ghost text-sm" onClick={() => setHelpOpen(true)}>
              Shortcuts
              <ShortcutHint keys="F1" />
            </button>
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 text-sm font-medium ${arabic ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"}`}
              aria-pressed={arabic}
              title="Arabic beside English"
              onClick={toggleArabic}
            >
              عربي
            </button>
            <p className="hidden truncate text-sm text-slate-500 sm:block">{user?.email}</p>
            <button type="button" className="btn-outline items-start text-sm" onClick={leave}>
              <ArrowRightOnRectangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <Bi k="signOut" />
            </button>
          </div>
        </header>
        <main className="flex-1 bg-gray-50">
          <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
