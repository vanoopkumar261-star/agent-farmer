"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useT } from "@/components/i18n/LanguageProvider";

/**
 * The light/dark switch.
 *
 * Borrows the language chip's exact recipe from TopBar so the two read as one
 * control group rather than two unrelated buttons that happen to sit together.
 *
 * Deliberately NOT `hidden sm:block` the way the language chip is: the phone
 * is where a farmer actually reads this app after dark, so hiding the switch
 * on small screens would hide it from the people it is for.
 *
 * The icon shows the theme you would GET, not the one you are in — a moon
 * means "go dark". That is the convention every OS uses, and the aria-label
 * says it in words for anyone the icon does not reach.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const { t } = useT();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? t("theme.switchToLight") : t("theme.switchToDark")}
      title={dark ? t("theme.switchToLight") : t("theme.switchToDark")}
      className={`inline-flex items-center justify-center rounded-[10px] border border-af-border bg-af-card p-2 text-af-ink-2 hover:text-af-ink hover:border-af-primary/30 transition ${className}`.trim()}
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
