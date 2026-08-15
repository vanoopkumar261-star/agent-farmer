import React from "react";

export default function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      <div className="w-12 h-12 rounded-2xl bg-af-sage flex items-center justify-center text-af-secondary">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-af-ink">{title}</h3>
      {body && <p className="mt-1 text-sm text-af-muted max-w-xs">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
