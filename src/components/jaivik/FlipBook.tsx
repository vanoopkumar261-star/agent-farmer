"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, X, Download, Play,
  BookOpen, Lightbulb, Quote, List, ZoomIn, ZoomOut, BookOpenCheck
} from "lucide-react";
import type { Book, BookPage } from "@/lib/jaivikLibrary";
import { useT } from "@/components/i18n/LanguageProvider";

const CATEGORY_KEYS: Record<Book["category"], string> = {
  "Composting": "library.category.composting",
  "Bio-Inputs": "library.category.bioInputs",
  "Pest Control": "library.category.pestControl",
  "Certification": "library.category.certification",
  "Water": "library.category.water",
};

export default function FlipBook({
  book,
  onClose,
}: {
  book: Book;
  onClose: () => void;
}) {
  const { t } = useT();
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDir, setFlipDir] = useState<"next" | "prev" | null>(null);
  const [hoverSide, setHoverSide] = useState<"left" | "right" | null>(null);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [zoom, setZoom] = useState(1.0);

  // Spreads count:
  // Spread 0: Front Cover (Right side)
  // Spread 1..N: Inner Spreads
  // Spread N+1: Back Cover (Left side)
  const innerSpreadCount = Math.ceil(book.pages.length / 2);
  const totalSpreads = innerSpreadCount + 2;

  const isCover = spreadIndex === 0;
  const isBackCover = spreadIndex === totalSpreads - 1;

  // Pages currently visible on the stage (1-based page numbers)
  // Page 0 = Inside Front Cover Lining
  // Page 1..N = book.pages[0..N-1]
  // Page N+1 = Inside Back Cover Lining
  const getPageObj = (pageNum: number): BookPage | undefined => {
    if (pageNum <= 0 || pageNum > book.pages.length) return undefined;
    return book.pages[pageNum - 1];
  };

  // Current Spread resting page numbers
  const currentLeftNum = isCover ? -1 : (spreadIndex - 1) * 2 + 1;
  const currentRightNum = isCover ? 0 : currentLeftNum + 1;

  // Next Spread page numbers
  const nextLeftNum = (spreadIndex) * 2 + 1;
  const nextRightNum = nextLeftNum + 1;

  // Prev Spread page numbers
  const prevLeftNum = (spreadIndex - 2) * 2 + 1;
  const prevRightNum = prevLeftNum + 1;

  const flipNext = () => {
    if (isFlipping || spreadIndex >= totalSpreads - 1) return;
    setHoverSide(null);
    setFlipDir("next");
    setIsFlipping(true);
  };

  const flipPrev = () => {
    if (isFlipping || spreadIndex <= 0) return;
    setHoverSide(null);
    setFlipDir("prev");
    setIsFlipping(true);
  };

  const handleFlipComplete = () => {
    if (flipDir === "next") {
      setSpreadIndex((prev) => prev + 1);
    } else if (flipDir === "prev") {
      setSpreadIndex((prev) => prev - 1);
    }
    setIsFlipping(false);
    setFlipDir(null);
  };

  const handlePageClick = (e: React.MouseEvent, action: () => void) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input")) return;
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) return;
    action();
  };

  const jumpToSpread = (idx: number) => {
    if (isFlipping) return;
    setSpreadIndex(idx + 1);
    setShowBookmarks(false);
  };

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") flipNext();
      if (e.key === "ArrowLeft") flipPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const pageWidth = Math.round(440 * zoom);
  const pageHeight = Math.round(580 * zoom);

  return (
    <div className="fixed inset-0 z-50 bg-[#EFECE1] overflow-y-auto flex flex-col justify-between select-none">
      
      {/* ── TOP HEADER BAR ── */}
      <div className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 border-b border-[#D4C5A9] bg-[#FAF8F5]/95 backdrop-blur shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg shadow-sm"
            style={{ backgroundColor: book.color }}
          >
            <book.Icon size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[#2C1F16]">{book.title}</h1>
            <p className="font-mono text-[9px] uppercase tracking-wider text-[#6B4F35]">
              {isCover
                ? t("library.flip.frontCover")
                : isBackCover
                ? t("library.flip.backCover")
                : t("library.flip.pagesOf", {
                    left: currentLeftNum,
                    right: currentRightNum <= book.pages.length ? currentRightNum : "",
                    total: book.pages.length,
                  })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          <div className="hidden md:flex items-center gap-1 border-r border-[#D4C5A9] pr-3 mr-1">
            <button
              onClick={() => setZoom(Math.max(0.8, zoom - 0.1))}
              className="p-1.5 rounded hover:bg-[#F8F3E8] text-[#2C1F16] transition"
              title={t("library.flip.zoomOut")}
            >
              <ZoomOut size={14} />
            </button>
            <span className="font-mono text-[10px] text-[#6B4F35] min-w-[36px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(1.25, zoom + 0.1))}
              className="p-1.5 rounded hover:bg-[#F8F3E8] text-[#2C1F16] transition"
              title={t("library.flip.zoomIn")}
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <button
            onClick={() => setShowBookmarks(!showBookmarks)}
            className="flex items-center gap-1.5 rounded-full border border-[#D4C5A9] bg-[#FAF8F5] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#2C1F16] hover:bg-[#F8F3E8] transition shadow-sm"
          >
            <List size={12} />
            {t("library.flip.bookmarks")}
          </button>

          {/* Download PDF Button — hidden until the PDF asset exists */}
          {book.pdfUrl && (
            <a
              href={book.pdfUrl}
              download={`${book.slug}.pdf`}
              className="flex items-center gap-1.5 rounded-full border border-[#D4C5A9] bg-[#FAF8F5] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#2C1F16] hover:bg-[#F8F3E8] transition shadow-sm"
            >
              <Download size={12} />
              {t("library.flip.download")}
            </a>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-[#D4C5A9] bg-[#FAF8F5] text-[#2C1F16] hover:bg-[#F8F3E8] transition shadow-sm"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Bookmarks panel */}
      <AnimatePresence>
        {showBookmarks && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-[65px] right-6 z-40 w-80 max-h-[70vh] overflow-y-auto rounded-2xl border border-[#D4C5A9] bg-[#FAF8F5] p-3 shadow-2xl"
          >
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#6B4F35]/50 px-3 pt-2 pb-3 border-b border-[#D4C5A9]/40 mb-2">
              {t("library.flip.bookmarksTitle")}
            </div>
            {Array.from(new Array(innerSpreadCount), (_, i) => {
              const pageA = book.pages[i * 2];
              return (
                <button
                  key={i}
                  onClick={() => jumpToSpread(i)}
                  className={`w-full flex items-start gap-3 text-left rounded-xl px-3 py-2.5 transition border ${
                    spreadIndex === i + 1
                      ? "bg-[#6B4F35]/10 border-[#D4C5A9]"
                      : "hover:bg-[#F8F3E8] border-transparent"
                  }`}
                >
                  <span className="font-mono text-xs text-[#6B4F35]/40 mt-1 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[#2C1F16] line-clamp-1">
                      {pageA?.icon} {pageA?.title}
                    </div>
                    <div className="text-[10px] text-[#6B4F35]/60 line-clamp-1">
                      {pageA?.header ?? book.title}
                    </div>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3D PHYSICAL BOOK STAGE (FIXED 2-PAGE SPREAD WIDE AT ALL TIMES) ── */}
      <div className="flex-1 max-w-[1240px] w-full mx-auto flex flex-col items-center justify-start space-y-8 py-6 px-6">
        
        {/* Book Container with physical page depth edges */}
        <div className="relative p-3 rounded-2xl bg-[#FAF8F5] border border-[#D4C5A9] shadow-[0_30px_60px_rgba(44,31,22,0.18)] flex justify-center">
          
          {/* Page Edge Thickness Details */}
          <div className="absolute right-1 inset-y-4 w-1.5 bg-[#E8E2D2] border-r border-[#D4C5A9] rounded-r shadow-inner" />
          <div className="absolute left-1 inset-y-4 w-1.5 bg-[#E8E2D2] border-l border-[#D4C5A9] rounded-l shadow-inner" />

          {/* ── STAGE STAYS ALWAYS 2 PAGES WIDE (880px * zoom) TO PREVENT JUMPING ── */}
          <div
            className="relative flex items-center justify-center overflow-visible bg-[#FAF8F5] rounded shadow-md"
            style={{
              perspective: "2200px",
              width: pageWidth * 2,
              height: pageHeight,
            }}
          >
            {/* Center Spine Crease Line */}
            <div className="absolute left-1/2 -translate-x-1/2 inset-y-0 w-8 pointer-events-none z-30 bg-gradient-to-r from-black/5 via-black/15 to-black/5" />

            {/* ════════ 1. AT REST SPREAD (WHEN NOT ANIMATING) ════════ */}
            {!isFlipping && (
              <div className="w-full h-full flex relative">
                
                {/* LEFT HALF */}
                <div
                  onClick={(e) => handlePageClick(e, flipPrev)}
                  onMouseEnter={() => setHoverSide("left")}
                  onMouseLeave={() => setHoverSide(null)}
                  className={`w-1/2 h-full relative border-r border-[#D4C5A9]/50 overflow-hidden ${
                    spreadIndex > 0 ? "cursor-pointer group" : ""
                  }`}
                >
                  {isCover ? (
                    /* Blank Table Surface / Desk behind Cover */
                    <div className="w-full h-full bg-[#EFECE1]/60 flex items-center justify-center border-r border-[#D4C5A9]/60">
                      <span className="font-serif text-xs italic text-[#6B4F35]/30">Agent Farmer Handbook</span>
                    </div>
                  ) : isBackCover ? (
                    /* Back Cover on Left Side */
                    <CoverPage book={book} isBack={true} width={pageWidth} height={pageHeight} onRestart={() => setSpreadIndex(0)} onExit={onClose} />
                  ) : (
                    /* Standard Inner Left Page */
                    <HTMLBookPage page={getPageObj(currentLeftNum)} pageNum={currentLeftNum} book={book} width={pageWidth} height={pageHeight} />
                  )}

                  {/* Corner Peel Hover Effect */}
                  {hoverSide === "left" && spreadIndex > 0 && (
                    <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black/10 to-transparent pointer-events-none z-20" />
                  )}
                </div>

                {/* RIGHT HALF */}
                <div
                  onClick={(e) => handlePageClick(e, flipNext)}
                  onMouseEnter={() => setHoverSide("right")}
                  onMouseLeave={() => setHoverSide(null)}
                  className={`w-1/2 h-full relative overflow-hidden ${
                    spreadIndex < totalSpreads - 1 ? "cursor-pointer group" : ""
                  }`}
                >
                  {isCover ? (
                    /* Front Cover on Right Side */
                    <CoverPage book={book} isBack={false} width={pageWidth} height={pageHeight} onOpen={flipNext} />
                  ) : isBackCover ? (
                    /* Blank Table Surface behind Back Cover */
                    <div className="w-full h-full bg-[#EFECE1]/60 flex items-center justify-center border-l border-[#D4C5A9]/60">
                      <span className="font-serif text-xs italic text-[#6B4F35]/30">Soil Wisdom Edition</span>
                    </div>
                  ) : (
                    /* Standard Inner Right Page */
                    <HTMLBookPage page={getPageObj(currentRightNum)} pageNum={currentRightNum} book={book} width={pageWidth} height={pageHeight} />
                  )}

                  {/* Corner Peel Hover Effect */}
                  {hoverSide === "right" && spreadIndex < totalSpreads - 1 && (
                    <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/10 to-transparent pointer-events-none z-20" />
                  )}
                </div>
              </div>
            )}

            {/* ════════ 2. 3D PAGE FLIP ANIMATION STAGE ════════ */}
            {isFlipping && (
              <div className="w-full h-full flex relative overflow-visible">
                
                {/* ── FLIP NEXT (Right Sheet turns 0deg -> -180deg onto Left) ── */}
                {flipDir === "next" && (
                  <>
                    {/* Underlying Left Page (Stays Current Left) */}
                    <div className="w-1/2 h-full overflow-hidden border-r border-[#D4C5A9]/50">
                      {isCover ? (
                        <div className="w-full h-full bg-[#EFECE1]/60" />
                      ) : (
                        <HTMLBookPage page={getPageObj(currentLeftNum)} pageNum={currentLeftNum} book={book} width={pageWidth} height={pageHeight} />
                      )}
                    </div>

                    {/* Underlying Right Page (Reveals Upcoming Right Page) */}
                    <div className="w-1/2 h-full overflow-hidden">
                      {spreadIndex + 1 === totalSpreads - 1 ? (
                        <div className="w-full h-full bg-[#EFECE1]/60" />
                      ) : (
                        <HTMLBookPage page={getPageObj(nextRightNum)} pageNum={nextRightNum} book={book} width={pageWidth} height={pageHeight} />
                      )}
                    </div>

                    {/* 3D TURNING LEAF (Pivots at x=50% Center Spine) */}
                    <motion.div
                      className="absolute right-0 top-0 w-1/2 h-full z-40"
                      style={{
                        transformOrigin: "left center",
                        transformStyle: "preserve-3d",
                      }}
                      initial={{ rotateY: 0, skewY: 0, scaleX: 1.0 }}
                      animate={{
                        rotateY: [-0, -90, -180],
                        skewY: [0, -3.5, 0],
                        scaleX: [1.0, 0.96, 1.0],
                      }}
                      transition={{ duration: 0.65, ease: [0.34, 1.3, 0.64, 1] }}
                      onAnimationComplete={handleFlipComplete}
                    >
                      {/* FRONT FACE of turning leaf (0deg .. 90deg) */}
                      <div
                        className="absolute inset-0 w-full h-full bg-[#FAF8F5] shadow-2xl overflow-hidden"
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        {isCover ? (
                          <CoverPage book={book} isBack={false} width={pageWidth} height={pageHeight} />
                        ) : (
                          <HTMLBookPage page={getPageObj(currentRightNum)} pageNum={currentRightNum} book={book} width={pageWidth} height={pageHeight} />
                        )}
                        
                        {/* Moving Specular Sheen Light */}
                        <motion.div
                          className="absolute inset-0 pointer-events-none bg-gradient-to-l from-black/25 via-white/20 to-transparent"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 0.5, 0] }}
                          transition={{ duration: 0.65 }}
                        />
                      </div>

                      {/* BACK FACE of turning leaf (90deg .. 180deg) */}
                      <div
                        className="absolute inset-0 w-full h-full bg-[#FAF8F5] shadow-2xl overflow-hidden"
                        style={{
                          backfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                        }}
                      >
                        <HTMLBookPage page={getPageObj(nextLeftNum)} pageNum={nextLeftNum} book={book} width={pageWidth} height={pageHeight} />
                        
                        {/* Landing Shadow */}
                        <motion.div
                          className="absolute inset-0 pointer-events-none bg-gradient-to-r from-black/30 via-transparent to-transparent"
                          initial={{ opacity: 0.6 }}
                          animate={{ opacity: 0 }}
                          transition={{ duration: 0.35, delay: 0.3 }}
                        />
                      </div>
                    </motion.div>
                  </>
                )}

                {/* ── FLIP PREV (Left Sheet turns -180deg -> 0deg onto Right) ── */}
                {flipDir === "prev" && (
                  <>
                    {/* Underlying Left Page (Reveals Previous Left Page) */}
                    <div className="w-1/2 h-full overflow-hidden border-r border-[#D4C5A9]/50">
                      {spreadIndex - 1 === 0 ? (
                        <div className="w-full h-full bg-[#EFECE1]/60" />
                      ) : (
                        <HTMLBookPage page={getPageObj(prevLeftNum)} pageNum={prevLeftNum} book={book} width={pageWidth} height={pageHeight} />
                      )}
                    </div>

                    {/* Underlying Right Page (Stays Current Right Page) */}
                    <div className="w-1/2 h-full overflow-hidden">
                      {isBackCover ? (
                        <CoverPage book={book} isBack={true} width={pageWidth} height={pageHeight} />
                      ) : (
                        <HTMLBookPage page={getPageObj(currentRightNum)} pageNum={currentRightNum} book={book} width={pageWidth} height={pageHeight} />
                      )}
                    </div>

                    {/* 3D TURNING LEAF (Pivots at x=50% Center Spine) */}
                    <motion.div
                      className="absolute left-0 top-0 w-1/2 h-full z-40"
                      style={{
                        transformOrigin: "right center",
                        transformStyle: "preserve-3d",
                      }}
                      initial={{ rotateY: 0, skewY: 0, scaleX: 1.0 }}
                      animate={{
                        rotateY: [0, 90, 180],
                        skewY: [0, 3.5, 0],
                        scaleX: [1.0, 0.96, 1.0],
                      }}
                      transition={{ duration: 0.65, ease: [0.34, 1.3, 0.64, 1] }}
                      onAnimationComplete={handleFlipComplete}
                    >
                      {/* FRONT FACE of backward turning leaf */}
                      <div
                        className="absolute inset-0 w-full h-full bg-[#FAF8F5] shadow-2xl overflow-hidden"
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        {isBackCover ? (
                          <CoverPage book={book} isBack={true} width={pageWidth} height={pageHeight} />
                        ) : (
                          <HTMLBookPage page={getPageObj(currentLeftNum)} pageNum={currentLeftNum} book={book} width={pageWidth} height={pageHeight} />
                        )}
                        <motion.div
                          className="absolute inset-0 pointer-events-none bg-gradient-to-r from-black/25 via-white/20 to-transparent"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 0.5, 0] }}
                          transition={{ duration: 0.65 }}
                        />
                      </div>

                      {/* BACK FACE landing on Right */}
                      <div
                        className="absolute inset-0 w-full h-full bg-[#FAF8F5] shadow-2xl overflow-hidden"
                        style={{
                          backfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                        }}
                      >
                        {spreadIndex - 1 === 0 ? (
                          <CoverPage book={book} isBack={false} width={pageWidth} height={pageHeight} />
                        ) : (
                          <HTMLBookPage page={getPageObj(prevRightNum)} pageNum={prevRightNum} book={book} width={pageWidth} height={pageHeight} />
                        )}
                        <motion.div
                          className="absolute inset-0 pointer-events-none bg-gradient-to-l from-black/30 via-transparent to-transparent"
                          initial={{ opacity: 0.6 }}
                          animate={{ opacity: 0 }}
                          transition={{ duration: 0.35, delay: 0.3 }}
                        />
                      </div>
                    </motion.div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER PAGE NAVIGATION ── */}
        <div className="w-full max-w-[900px] flex items-center justify-between border-t border-[#D4C5A9]/60 pt-4">
          <button
            onClick={flipPrev}
            disabled={spreadIndex === 0 || isFlipping}
            className="flex items-center gap-1 rounded-full border border-[#D4C5A9] bg-[#FAF8F5] px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-[#2C1F16] hover:bg-[#F8F3E8] disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
          >
            <ChevronLeft size={13} />
            {t("library.flip.prevPage")}
          </button>

          <span className="font-mono text-xs text-[#6B4F35]">
            {isCover
              ? t("library.flip.frontCover")
              : isBackCover
              ? t("library.flip.backCover")
              : t("library.flip.spreadOf", { spread: spreadIndex, total: innerSpreadCount })}
          </span>

          <button
            onClick={flipNext}
            disabled={spreadIndex === totalSpreads - 1 || isFlipping}
            className="flex items-center gap-1 rounded-full border border-[#D4C5A9] bg-[#FAF8F5] px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-[#2C1F16] hover:bg-[#F8F3E8] disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
          >
            {t("library.flip.nextPage")}
            <ChevronRight size={13} />
          </button>
        </div>

        {/* ── YOUTUBE VIDEO TUTORIAL SECTION ── */}
        {book.youtubeId && (
          <div className="w-full max-w-[900px] border-t border-[#D4C5A9] pt-10 pb-12 space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 text-red-600 shadow-sm">
                <Play size={18} fill="currentColor" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#2C1F16]">{t("library.flip.watchVideo")}</h3>
                <p className="text-xs text-[#6B4F35]">{t("library.flip.videoSubtitle")}</p>
              </div>
            </div>

            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-[#D4C5A9] shadow-md bg-[#FAF8F5]">
              <iframe
                src={`https://www.youtube.com/embed/${book.youtubeId}`}
                title={t("library.flip.videoIframeTitle", { title: book.title })}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── HARDCOVER RENDERER (Front / Back) ──
function CoverPage({
  book,
  isBack,
  width,
  height,
  onOpen,
  onRestart,
  onExit,
}: {
  book: Book;
  isBack: boolean;
  width: number;
  height: number;
  onOpen?: () => void;
  onRestart?: () => void;
  onExit?: () => void;
}) {
  const { t } = useT();
  if (isBack) {
    return (
      <div
        className="p-10 flex flex-col justify-between text-white relative overflow-hidden shadow-xl text-center select-none"
        style={{
          backgroundColor: book.color,
          width,
          height,
          backgroundImage: "url('https://www.transparenttextures.com/patterns/leather-stitching.png')",
        }}
      >
        <div className="absolute inset-0 bg-black/20 z-0" />
        <div className="relative z-10 h-full flex flex-col justify-between items-center border-2 border-white/20 p-6 rounded-lg">
          <div className="my-auto space-y-4">
            <BookOpenCheck size={44} className="mx-auto text-white/80" />
            <h3 className="font-serif text-xl font-bold">{t("library.flip.completeTitle")}</h3>
            <p className="text-xs text-white/70 leading-relaxed max-w-[240px] mx-auto">
              {t("library.flip.completeBody")}
            </p>
          </div>

          <div className="space-y-2 w-full max-w-[240px]">
            {onRestart && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRestart();
                }}
                className="w-full text-center bg-white/10 hover:bg-white/20 border border-white/25 rounded-lg py-2 font-mono text-[9px] uppercase tracking-widest text-white transition cursor-pointer"
              >
                {t("library.flip.restart")}
              </button>
            )}
            {onExit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExit();
                }}
                className="w-full text-center bg-[#FAF8F5] hover:bg-[#EFECE1] text-[#2C1F16] rounded-lg py-2 font-mono text-[9px] uppercase tracking-widest font-bold transition cursor-pointer"
              >
                {t("library.flip.exit")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-10 flex flex-col justify-between text-white relative overflow-hidden shadow-xl select-none"
      style={{
        backgroundColor: book.color,
        width,
        height,
        backgroundImage: "url('https://www.transparenttextures.com/patterns/leather-stitching.png')",
      }}
    >
      <div className="absolute inset-0 bg-black/15 z-0" />
      <div className="absolute left-0 inset-y-0 w-3 bg-black/25 z-10 shadow-inner" />

      <div className="relative z-10 h-full flex flex-col justify-between border-2 border-white/20 p-6 rounded-lg">
        <div>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/60 border border-white/25 rounded px-2.5 py-1">
            {t("library.flip.edition", { category: t(CATEGORY_KEYS[book.category]) })}
          </span>
          <h1 className="mt-8 font-serif text-3xl font-bold tracking-tight text-white">
            {book.title}
          </h1>
          <p className="mt-2 text-sm italic text-white/80">{book.subtitle}</p>
        </div>

        <div>
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mb-4">
            <book.Icon size={20} className="text-white" />
          </div>
          <p className="text-[12px] text-white/70 leading-relaxed max-w-[320px]">
            {book.description}
          </p>
          {onOpen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="mt-6 w-full text-center bg-[#FAF8F5] hover:bg-[#EFECE1] text-[#2C1F16] rounded-lg py-2.5 font-mono text-[10px] uppercase tracking-widest font-bold transition shadow cursor-pointer"
            >
              Open Handbook →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── HTML BOOK PAGE RENDERER ──
function HTMLBookPage({
  page,
  pageNum,
  book,
  width,
  height,
}: {
  page: BookPage | undefined;
  pageNum: number;
  book: Book;
  width: number;
  height: number;
}) {
  if (!page) {
    return (
      <div
        className="bg-[#FAF8F5] flex items-center justify-center p-8 text-center"
        style={{ width, height }}
      >
        <p className="font-serif text-sm italic text-[#6B4F35]/40">End of pages</p>
      </div>
    );
  }

  return (
    <div
      className="p-10 flex flex-col justify-between text-[#2C1F16] bg-[#FAF8F5] select-text overflow-y-auto"
      style={{ width, height }}
    >
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-[#D4C5A9]/50 pb-2.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-[#6B4F35]">
          {page.header ?? book.title}
        </span>
        <span className="font-mono text-[9px] text-[#6B4F35]/60">{pageNum}</span>
      </div>

      {/* Main Chapter Content */}
      <div className="my-auto space-y-4">
        <div className="flex items-start gap-3">
          {page.icon && <span className="text-3xl shrink-0">{page.icon}</span>}
          <h2 className="font-serif text-lg font-bold tracking-tight text-[#2C1F16] leading-tight">
            {page.title}
          </h2>
        </div>

        {/* Content Paragraphs */}
        <div className="space-y-3.5 text-[13px] leading-relaxed text-[#544133]">
          {page.content.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {/* Optional Bullet Lists */}
        {page.bullets && page.bullets.length > 0 && (
          <div className="space-y-2 pt-1">
            {page.bullets.map((b, i) => (
              <div
                key={i}
                className="flex gap-2 items-start bg-[#F8F3E8] border border-[#D4C5A9] rounded-lg p-2.5 text-[11px] leading-relaxed text-[#544133]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#8c6239] mt-1.5 shrink-0" />
                <span>{b}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pro Tip Box */}
        {page.tip && (
          <div className="flex gap-2.5 items-start bg-[#6B4F35]/5 border-l-2 border-[#8c6239] p-3 text-[11px] text-[#544133] italic leading-relaxed rounded-r-lg">
            <Lightbulb size={14} className="text-[#8c6239] shrink-0 mt-0.5" />
            <span>{page.tip}</span>
          </div>
        )}

        {/* Quote Block */}
        {page.quote && (
          <div className="flex gap-2 items-start border-t border-b border-[#D4C5A9]/40 py-2.5 text-[11px] italic text-[#6B4F35] font-serif">
            <Quote size={10} className="text-[#D4C5A9] shrink-0 mt-1" />
            <span>{page.quote}</span>
          </div>
        )}
      </div>

      {/* Page Footer */}
      <div className="border-t border-[#D4C5A9]/30 pt-2.5 flex justify-between text-[8px] font-mono tracking-widest text-[#6B4F35]/50">
        <span>JAIVIK SATHI HANDBOOK</span>
        <span>EDITION VI</span>
      </div>
    </div>
  );
}