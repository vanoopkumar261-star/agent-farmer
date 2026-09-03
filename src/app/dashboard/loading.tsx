import LoadingScreen from "@/components/brand/LoadingScreen";

/**
 * Loading state for everything under /dashboard.
 *
 * One file covers all eleven routes — schemes, news, market, crops, disease,
 * soil, expenses, settings, store-locator, assistant and the dashboard home —
 * because Next applies a segment's `loading.tsx` to every child that does not
 * define its own.
 *
 * The inline variant on purpose. This renders inside the dashboard layout, so
 * the sidebar and top bar stay put and only the content area animates. Clicking
 * News and then Market should feel like moving within one app, not like the app
 * restarting each time — which is exactly what a full-screen splash on every
 * navigation would look like.
 *
 * Worth knowing where the time actually goes: `/dashboard` awaits profile,
 * weather, expenses, mandi prices and task recording in sequence, and
 * `/dashboard/market` adds a mandi fetch per crop on top. This covers that gap;
 * it does not close it.
 */
export default function DashboardLoading() {
  return <LoadingScreen variant="inline" />;
}
