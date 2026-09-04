/**
 * The arrival half of the loading transition.
 *
 * A `loading.tsx` cannot animate its own exit — React unmounts a Suspense
 * fallback synchronously and gives the component no signal — so the splash will
 * always cut rather than fade. Animating what *arrives* buys the same perceived
 * smoothness for four lines, because the eye tracks the incoming element and
 * both layers share `--af-bg`, so there is no colour flash at the cut.
 *
 * This is a `template.tsx`, not a `layout.tsx`, because a template remounts on
 * every navigation and that is what makes the animation replay per route. It
 * sits inside the dashboard layout and wraps only `{children}`, so the sidebar,
 * the top bar and LanguageProvider are untouched and keep their state.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="af-page-in">{children}</div>;
}
