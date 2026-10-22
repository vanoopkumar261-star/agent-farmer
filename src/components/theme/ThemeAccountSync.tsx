"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { saveThemePreference } from "@/lib/theme";
import type { Theme } from "@/lib/theme/config";

/**
 * Ties the theme to the signed-in farmer. Renders nothing.
 *
 * Mounted in the dashboard shell, which is the only place we know who is
 * using the app — `ThemeProvider` itself stays account-free so it can keep
 * serving the landing page and /login.
 *
 * Precedence, written down so it is not re-litigated:
 *
 *   • the COOKIE wins the first paint. It is what the server rendered
 *     against, and overriding it before paint is how you get a flash.
 *   • the ACCOUNT wins on a new device, where there is no cookie to be wrong
 *     about. A farmer who chose dark on the phone they carry to the field
 *     should find dark on the laptop at home.
 *
 * So the stored preference is applied once, after mount, and only when it
 * actually differs — at which point `setTheme` writes a cookie and the
 * question never arises again on this device.
 */
export default function ThemeAccountSync({
  farmerId,
  preference,
}: {
  farmerId: string;
  /** From `themeFromPreferences(farmer.preferences)` — null if never chosen. */
  preference: Theme | null;
}) {
  const { theme, setTheme } = useTheme();

  // What the account is believed to hold. Seeded from the server value so the
  // first render does not write back a preference that is already stored.
  const stored = useRef<Theme | null>(preference);
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    if (preference && preference !== theme) setTheme(preference);
    // Mount only; later changes flow through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!applied.current || theme === stored.current) return;
    stored.current = theme;
    // Fire-and-forget, never awaited: a farmer with no signal still gets their
    // theme, and the next toggle re-syncs. The same bargain `markTourSeen`
    // makes with the same jsonb column.
    void saveThemePreference(farmerId, theme);
  }, [theme, farmerId]);

  return null;
}
