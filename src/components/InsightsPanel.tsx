"use client";

export default function InsightsPanel() {
  return (
    <aside className="w-[320px] h-screen bg-white border-l border-outline/20 p-6 hidden xl:block">
      <h2 className="font-semibold text-lg mb-6">AI Insights</h2>
      <div className="bg-surface-container-low rounded-lg p-4 text-sm text-on-surface/70">
        Live intelligence modules will appear here.
      </div>
    </aside>
  );
}
