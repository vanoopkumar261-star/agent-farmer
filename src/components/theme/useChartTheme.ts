"use client";

import { chartTheme, type ChartPalette } from "@/lib/chartTheme";
import { useTheme } from "@/components/theme/ThemeProvider";

/**
 * The chart palette for the theme currently on screen.
 *
 * Recharts takes literal colour strings, so charts cannot be themed with CSS
 * variables the way the rest of the app is. This is the bridge. Because
 * ThemeProvider seeds its state from the server cookie, the very first client
 * render already has the right palette — no chart paints light and then flips.
 */
export function useChartTheme(): ChartPalette {
  return chartTheme(useTheme().theme);
}
