import { Leaf } from "lucide-react";
import { T } from "@/components/i18n/LanguageProvider";

export default function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-af-border px-6 lg:px-8 py-5 mt-4">
      <div className="max-w-[1320px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-af-muted">
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-af-primary/10">
            <Leaf className="w-3.5 h-3.5 text-af-primary" />
          </span>
          <span className="text-meta font-semibold text-af-ink-2">Agent Farmer</span>
          <span className="font-mono text-[10px] tracking-[0.16em] uppercase">AI Farm OS</span>
        </div>
        <div className="flex items-center gap-4 text-[12px] text-af-muted">
          <a href="#" className="hover:text-af-ink-2 transition"><T k="appFooter.privacy" /></a>
          <a href="#" className="hover:text-af-ink-2 transition"><T k="appFooter.terms" /></a>
          <a href="#" className="hover:text-af-ink-2 transition"><T k="appFooter.support" /></a>
          <span className="hidden sm:inline">© {year} Agent Farmer</span>
        </div>
      </div>
    </footer>
  );
}
