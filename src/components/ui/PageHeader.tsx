import React from "react";

/**
 * The title block at the top of a dashboard page.
 *
 * Six pages had their own copy of this markup (`crops`, `expenses`, `market`,
 * `settings`, `store-locator`, and `CropDetailCard`). Five agreed; the sixth —
 * the market page — had drifted to `text-[26px] font-extrabold`, making it the
 * only `<h1>` in the dashboard breaking the weight ceiling. That is exactly
 * the drift a shared component prevents.
 *
 * `SectionHeader` is the smaller sibling for headings *inside* a page; this one
 * carries the larger 44px icon chip and the `text-heading` title.
 *
 * `title` and `subtitle` take nodes rather than strings so a server component
 * can pass `<T k="title.crops" />` — the translator is a client island, and an
 * icon crossing the boundary must be a rendered element (`<Sprout />`), never
 * the component type.
 */
export default function PageHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <span className="flex items-center justify-center w-11 h-11 shrink-0 rounded-2xl bg-af-sage text-af-primary">
            {icon}
          </span>
        )}
        {/* No truncate: translated titles run longer than English and a page
            title is the one string that must never be clipped. */}
        <div className="min-w-0">
          <h1 className="text-heading font-semibold text-af-ink">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-af-ink-2">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
