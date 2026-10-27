import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-start gap-3">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="max-w-lg text-sm leading-relaxed text-slate-500">{body}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
