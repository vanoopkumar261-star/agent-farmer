export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-af-border/50 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-af-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}
