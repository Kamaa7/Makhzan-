import {
  ChartBarIcon,
  CubeIcon,
  DocumentTextIcon,
  LockClosedIcon,
  RocketLaunchIcon,
  SparklesIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, ReactNode, SVGProps } from "react";

const signInCards = [
  { title: "Customers", body: "Keep walk-in and credit buyers on this computer.", icon: UsersIcon },
  { title: "Cash Memos & Bills", body: "Issue memos and bills without leaving the counter.", icon: DocumentTextIcon },
  { title: "Stock Records", body: "Scan, count, and adjust on-hand quantities.", icon: CubeIcon },
  { title: "Secure & Reliable", body: "Your ledger stays in this browser until you export it.", icon: LockClosedIcon },
];

const registerCards = [
  { title: "Get Started", body: "Create a keeper account for this shop computer.", icon: RocketLaunchIcon },
  { title: "Insights", body: "See today’s sales, dues, and low stock at a glance.", icon: SparklesIcon },
  { title: "Analytics", body: "Filter the register and export CSV when you need it.", icon: ChartBarIcon },
  { title: "Secure", body: "Email and password stay local. Nothing is sent to a cloud CRM.", icon: LockClosedIcon },
];

export function AuthShell({
  variant,
  title,
  subtitle,
  children,
  footer,
}: {
  variant: "signin" | "signup";
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const cards = variant === "signin" ? signInCards : registerCards;

  return (
    <div className="flex min-h-screen bg-white">
      <div className="relative hidden overflow-hidden bg-black lg:flex lg:w-1/2">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-primary-800" />
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col justify-center px-10 py-12 text-white">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs font-bold text-black">MK</div>
            <p className="text-xl font-bold">Makhzan</p>
          </div>
          <p className="text-3xl font-bold leading-tight">Your inventory under control.</p>
          <p className="mt-3 text-sm text-white/80">A local counter for stock, memos, and dues on this computer.</p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {cards.map((card) => (
              <GlassCard key={card.title} title={card.title} body={card.body} icon={card.icon} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="mt-2 text-gray-600">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-sm text-slate-500">{footer}</div>
        </div>
      </div>
    </div>
  );
}

function GlassCard({
  title,
  body,
  icon: Icon,
}: {
  title: string;
  body: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}) {
  return (
    <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
      <Icon className="h-5 w-5 text-white" />
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-white/75">{body}</p>
    </div>
  );
}
