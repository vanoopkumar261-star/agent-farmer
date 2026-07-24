/**
 * Slow diagonal light sweep for dark/rich cards. Drop inside a
 * `relative overflow-hidden` container. Purely decorative.
 */
export default function Sheen() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
    >
      <div className="absolute -inset-y-8 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent blur-md animate-af-sheen motion-reduce:hidden" />
    </div>
  );
}
