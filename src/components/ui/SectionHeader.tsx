import React from "react";

export default function SectionHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-secondary shrink-0">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink leading-tight truncate">{title}</h2>
          {subtitle && <p className="text-meta text-af-muted truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
