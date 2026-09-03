import LoadingScreen from "@/components/brand/LoadingScreen";

/**
 * Root loading state — the full-screen one.
 *
 * This renders ABOVE the dashboard layout, so it covers arriving at the app,
 * a hard refresh, and moving between the landing, login and onboarding routes:
 * the moments where there is no shell on screen yet and a bare page would look
 * broken. Navigation that happens once you are already inside the dashboard is
 * handled by `src/app/dashboard/loading.tsx`, which keeps the sidebar in place.
 *
 * It fades in only after ~400ms, so a fast route never flashes it.
 */
export default function Loading() {
  return <LoadingScreen variant="full" />;
}
