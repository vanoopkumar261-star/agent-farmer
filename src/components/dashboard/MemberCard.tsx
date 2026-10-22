"use client";

/*
  The membership card at the top of Settings.

  A farmer's identity in this app is three facts: their name, the tier they
  are on, and the id their records hang off. Those used to be three form
  rows among nine. Here they are one object you can tilt, which is the only
  thing on the page that is theirs rather than a control.

  Two deliberate choices:

  - No `videoSrc`. The card can reflect a looping video, and `hero.mp4` is
    sitting right there in /public — but it is 11MB, and spending that on a
    reflection in a settings page is not a trade worth making. Without a
    video the shader reflects its own procedural studio, which is what the
    screenshot below the fold shows anyway.

  - The tint is keyed to the plan, so the metal itself says which tier you
    are on: steel for Mitra, forest for Pro, warm brass for Elite. It reads
    as a material, not a badge, and it cannot drift from `plans.ts` because
    the tier comes from `planOf()` on the server.
*/

import type { CSSProperties } from "react";

import ReflectiveCard from "@/components/dashboard/ReflectiveCard";
import { useT } from "@/components/i18n/LanguageProvider";
import { PLANS, type PlanId } from "@/lib/plans";
import { useChartTheme } from "@/components/theme/useChartTheme";

/** Metal per tier. Forest and brass both sit in the app's own palette. */
const TINT: Record<PlanId, string> = {
  free: "#e8ecea",
  pro: "#cfe3d4",
  elite: "#ecdcb0",
};

/**
 * A uuid is 32 hex characters and nobody reads one. The first twelve, in
 * groups of four, are enough to quote over the phone to support and still
 * look like a member number rather than a database key.
 */
function memberId(id: string): string {
  const hex = id.replace(/[^0-9a-f]/gi, "").slice(0, 12).toUpperCase();
  return (hex.match(/.{1,4}/g) ?? [hex]).join(" ");
}

export default function MemberCard({
  name,
  plan,
  id,
}: {
  name: string;
  plan: PlanId;
  id: string;
}) {
  const { t } = useT();
  const { MARK } = useChartTheme();

  return (
    <ReflectiveCard
      name={name.trim() || t("settings.card.unnamed")}
      role={t(PLANS[plan].taglineKey)}
      badge={t(PLANS[plan].nameKey)}
      status={t("settings.card.status")}
      statusColor={MARK.active}
      idLabel={t("settings.card.idLabel")}
      idValue={memberId(id)}
      /*
        Stays "dark" in both app themes. This is the component's own metal,
        not the app's surface: a graphite plate is what the membership card IS,
        the way a bank card is a colour rather than a theme. Flipping it to
        silver in light mode would also change a page that is supposed to look
        exactly as it did before dark mode existed.
      */
      theme="dark"
      tint={TINT[plan]}
      metalness={1}
      roughness={0.18}
      blurStrength={3}
      warp={0.35}
      shine={1}
      glare={0.45}
      bevel={3}
      tiltStrength={10}
      width="100%"
      height={420}
      radius={22}
      /*
        The theme's own tile is a violet graphite, which is the one thing on
        the card that belongs to no palette we use. Neutral-green graphite
        instead, so the fingerprint plate reads as part of the same metal.
      */
      style={
        {
          "--rc-tile": "linear-gradient(180deg, #343c36 0%, #232a25 100%)",
        } as CSSProperties
      }
    />
  );
}
