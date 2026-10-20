import {
  LayoutDashboard,
  Sprout,
  ShoppingCart,
  MapPin,
  Sparkles,
  FileText,
  Landmark,
  Settings,
  Microscope,
  Newspaper,
  Library,
  FlaskConical,
  Droplets,
  PackageSearch,
  type LucideIcon,
} from "lucide-react";

/**
 * The dashboard's navigation, in one place.
 *
 * Extracted from `Sidebar.tsx` when the mobile drawer was added. Two copies of
 * this list would drift the first time a page was added — and the failure mode
 * is invisible, because whoever adds the page is almost certainly testing on a
 * desktop where the drawer never opens.
 */

export type NavItem = {
  icon: LucideIcon;
  labelKey: string;
  href: string;
  /**
   * The cheapest tier that includes this destination, when it is not free.
   *
   * Drives a padlock in the rail, and nothing else. The page itself and the
   * routes behind it do the refusing — a nav item without a padlock would
   * still be refused, and a padlock removed in devtools unlocks nothing.
   */
  minPlan?: "pro" | "elite";
  /**
   * Set for destinations outside the dashboard shell (the Jaivik Sathi
   * eLibrary). They get `?from=<current path>` appended so their back button
   * returns the farmer to the page they left, rather than to the public
   * Jaivik Sathi landing page.
   */
  carryFrom?: boolean;
};

export type NavGroup = { titleKey: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    titleKey: "nav.overview",
    items: [
      { icon: LayoutDashboard, labelKey: "nav.dashboard", href: "/dashboard" },
      // Directly below Dashboard — the assistant is a core Agent Farmer feature.
      { icon: Sparkles, labelKey: "nav.assistant", href: "/dashboard/assistant" },
      { icon: Sprout, labelKey: "nav.crops", href: "/dashboard/crops" },
    ],
  },
  {
    titleKey: "nav.intelligence",
    items: [
      { icon: Microscope, labelKey: "nav.disease", href: "/dashboard/disease" },
      { icon: FlaskConical, labelKey: "nav.soilPh", href: "/dashboard/soil" },
      { icon: Droplets, labelKey: "nav.irrigation", href: "/dashboard/irrigation", minPlan: "pro" },
      { icon: ShoppingCart, labelKey: "nav.market", href: "/dashboard/market" },
      { icon: Newspaper, labelKey: "nav.news", href: "/dashboard/news" },
      { icon: MapPin, labelKey: "nav.storeLocator", href: "/dashboard/store-locator" },
      { icon: Library, labelKey: "nav.library", href: "/jaivik-sathi/library", carryFrom: true },
    ],
  },
  {
    titleKey: "nav.manage",
    items: [
      { icon: FileText, labelKey: "nav.expenses", href: "/dashboard/expenses", minPlan: "pro" },
      // Under Manage rather than Intelligence: comparing input prices is a
      // purchasing decision, so it belongs beside Expenses. (ShoppingCart is
      // already Market, which is about selling.)
      { icon: PackageSearch, labelKey: "nav.inputs", href: "/dashboard/inputs" },
      { icon: Landmark, labelKey: "nav.schemes", href: "/dashboard/schemes" },
      { icon: Settings, labelKey: "nav.settings", href: "/dashboard/settings" },
    ],
  },
];
