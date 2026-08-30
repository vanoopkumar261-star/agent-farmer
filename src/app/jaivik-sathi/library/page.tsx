"use client";

import { Suspense, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft, Search, BookOpen, Clock, Layers, Leaf,
  ArrowRight, Filter, Library
} from "lucide-react";
import { LIBRARY as BOOKS, CATEGORIES, type Book } from "@/lib/jaivikLibrary";
import { getLocalizedBook } from "@/lib/i18n/library-content";
import { LanguageProvider, useT, T } from "@/components/i18n/LanguageProvider";

/** Where "back" goes for a visitor who arrived from the public site. */
const DEFAULT_BACK = "/jaivik-sathi";

/**
 * The `from` param is attacker-controllable, so it is only honoured when it is
 * a same-origin path: a bare "/..." and never "//evil.example" (which a browser
 * reads as protocol-relative) or a full URL. Anything else falls back to the
 * Jaivik Sathi home page rather than becoming an open redirect.
 */
function safeInternalPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

const CATEGORY_KEYS: Record<Book["category"], string> = {
  "Composting": "library.category.composting",
  "Bio-Inputs": "library.category.bioInputs",
  "Pest Control": "library.category.pestControl",
  "Certification": "library.category.certification",
  "Water": "library.category.water",
};

// Dynamically import FlipBook with SSR disabled to prevent server-side canvas/webpack crashes
const FlipBook = dynamic(() => import("@/components/jaivik/FlipBook"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 bg-[#EFECE1]/90 backdrop-blur-md flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-2 border-[#5C3E21] border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 font-mono text-xs text-[#5C3E21] tracking-widest uppercase"><T k="library.loading.openingHandbook" /></p>
    </div>
  ),
});

function LibraryContent() {
  const { t, locale } = useT();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [openBook, setOpenBook] = useState<Book | null>(null);

  // The library is reached both from the public Jaivik Sathi site and from
  // inside the farmer app; "back" has to land wherever the reader actually
  // came from, not always on the marketing page.
  const backHref = safeInternalPath(useSearchParams().get("from")) ?? DEFAULT_BACK;
  const backLabel = backHref.startsWith("/dashboard")
    ? t("library.nav.backToDashboard")
    : t("library.nav.back");

  const localizedBooks = useMemo(
    () => BOOKS.map((b) => getLocalizedBook(b, locale)),
    [locale]
  );

  const filteredBooks = localizedBooks.filter((b) => {
    const matchesCategory = !selectedCategory || b.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#F8F3E8] text-[#2C1F16]">
      {/* 3D PDF Flipbook overlay */}
      {openBook && (
        <FlipBook book={openBook} onClose={() => setOpenBook(null)} />
      )}

      {/* Top Navigation */}
      <nav className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-5 border-b border-[#D4C5A9] bg-[#FAF8F5]/80 backdrop-blur-md">
        <Link href="/jaivik-sathi" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#5C7A3D]">
            <Leaf size={16} strokeWidth={2} className="text-white" />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-[#2C1F16]">
            Jaivik Sathi · {t("library.nav.subtitle")}
          </span>
        </Link>

        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#D4C5A9] bg-[#FAF8F5] px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-[#2C1F16] hover:bg-[#F8F3E8] transition shadow-sm"
        >
          <ArrowLeft size={12} />
          {backLabel}
        </Link>
      </nav>

      {/* Header section */}
      <header className="pt-32 pb-14 px-6 max-w-[1100px] mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-5"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#D4C5A9] bg-[#FAF8F5] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#5C7A3D]">
            <Library size={12} />
            {t("library.badge")}
          </div>
          <h1 className="font-serif text-[clamp(2.2rem,5vw,3.5rem)] font-bold leading-tight text-[#2C1F16] max-w-3xl mx-auto">
            {t("library.hero.title")}
          </h1>
          <p className="max-w-2xl mx-auto text-[15px] sm:text-[16px] leading-relaxed text-[#6B4F35]">
            {t("library.hero.subtitle")}
          </p>

          <div className="pt-4 flex items-center justify-center gap-8 sm:gap-12 border-t border-b border-[#D4C5A9] py-4 max-w-lg mx-auto">
            {[
              { value: BOOKS.length.toString(), label: t("library.stat.handbooks") },
              { value: t("library.stat.formatValue"), label: t("library.stat.format") },
              { value: t("library.stat.costValue"), label: t("library.stat.cost") },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-xl font-bold text-[#2C1F16]">{s.value}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-[#6B4F35]/70 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </header>

      {/* Search & Category Filter Controls */}
      <section className="px-6 max-w-[1100px] mx-auto">
        <div className="rounded-2xl border border-[#D4C5A9] bg-[#FAF8F5] p-5 shadow-sm space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#6B4F35]/55" />
            <input
              type="text"
              placeholder={t("library.search.placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-5 py-3.5 rounded-xl bg-[#F8F3E8]/50 border border-[#D4C5A9] text-sm text-[#2C1F16] placeholder:text-[#6B4F35]/40 outline-none focus:border-[#5C7A3D] focus:ring-1 focus:ring-[#5C7A3D] transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#D4C5A9]/40">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#6B4F35]/60 mr-2 flex items-center gap-1">
              <Filter size={11} /> {t("library.filters.label")}
            </span>

            <button
              onClick={() => setSelectedCategory(null)}
              className={`rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-widest transition ${
                !selectedCategory
                  ? "bg-[#6B4F35] text-white"
                  : "bg-transparent text-[#2C1F16] hover:bg-[#F8F3E8] border border-[#D4C5A9]"
              }`}
            >
              {t("library.filters.all")}
            </button>

            {CATEGORIES.map((c) => (
              <button
                key={c.name}
                onClick={() => setSelectedCategory(c.name)}
                className={`rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-widest transition ${
                  selectedCategory === c.name
                    ? "bg-[#6B4F35] text-white"
                    : "bg-transparent text-[#2C1F16] hover:bg-[#F8F3E8] border border-[#D4C5A9]"
                }`}
              >
                {t(CATEGORY_KEYS[c.name])} ({c.count})
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Bookshelf Grid */}
      <section className="py-12 px-6 max-w-[1100px] mx-auto">
        {filteredBooks.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <BookOpen size={36} className="text-[#6B4F35]/30 mx-auto" />
            <p className="text-sm text-[#6B4F35]/60 font-serif">{t("library.empty")}</p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBooks.map((book, i) => (
              <motion.div
                key={book.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-5%" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
              >
                <button
                  onClick={() => setOpenBook(book)}
                  className="group w-full h-full text-left rounded-xl bg-[#FAF8F5] border border-[#D4C5A9] shadow-sm hover:shadow-md transition duration-300 overflow-hidden flex flex-col justify-between"
                >
                  {/* Spine Header with Vivid Cover Graphic */}
                  <div className="relative h-44 flex items-end p-5 overflow-hidden" style={{ backgroundColor: book.color }}>
                    <div className="absolute left-0 inset-y-0 w-3 bg-black/25 z-10 shadow-inner" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent z-[1]" />
                    
                    <img
                      src={book.image}
                      alt={book.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 transition-all duration-700"
                    />

                    <div className="relative z-10 space-y-1">
                      <span className="font-mono text-[8px] uppercase tracking-widest text-white/70 border border-white/30 rounded px-1.5 py-0.5 backdrop-blur-sm">
                        {t(CATEGORY_KEYS[book.category])}
                      </span>
                      <h3 className="font-serif text-lg font-bold text-white leading-tight mt-1 line-clamp-1">
                        {book.title}
                      </h3>
                    </div>
                  </div>

                  {/* Summary & Metadata */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: book.accentColor }}>
                        {book.subtitle}
                      </p>
                      <p className="text-[13px] text-[#544133] leading-relaxed mt-2 line-clamp-3">
                        {book.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#D4C5A9]/40 flex items-center justify-between">
                      <div className="flex gap-3">
                        <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-[#6B4F35]/70">
                          <Layers size={11} /> {t("library.card.type")}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-[#6B4F35]/70">
                          <Clock size={11} /> {book.duration}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider font-bold transition-all group-hover:translate-x-1" style={{ color: book.accentColor }}>
                        {t("library.card.readBook")} <ArrowRight size={11} />
                      </span>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Decorative Wooden Shelf Plinth */}
      <div className="w-full max-w-[1100px] h-3 bg-[#E8E2D2] border-b border-t border-[#D4C5A9] shadow-sm mx-auto shrink-0 mb-12 rounded" />

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-[#D4C5A9] bg-[#FAF8F5]">
        <div className="max-w-[1100px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div>
            <h4 className="text-[15px] font-bold text-[#2C1F16]">जैविक साथी · Jaivik Sathi Library</h4>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#6B4F35] mt-0.5">{t("library.footer.tagline")}</p>
          </div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#D4C5A9] bg-[#F8F3E8] px-4.5 py-2 font-mono text-[10px] uppercase tracking-wider text-[#2C1F16] hover:bg-[#FAF8F5] transition"
          >
            <ArrowLeft size={12} />
            {backLabel}
          </Link>
        </div>
      </footer>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <LanguageProvider>
      {/* useSearchParams needs a Suspense boundary for this page to keep
          prerendering; the fallback is never really seen because the shell
          renders instantly. */}
      <Suspense fallback={<div className="min-h-screen bg-[#F8F3E8]" />}>
        <LibraryContent />
      </Suspense>
    </LanguageProvider>
  );
}