"use client";

/**
 * Oilseed awareness page — sits between "I am a Farmer" on the landing page and
 * the registration wizard.
 *
 * This is an agricultural education page, not an AI recommendation surface: no
 * model runs here and nothing is personalised. The farmer reads why oilseeds
 * matter and answers once. "I acknowledge and understand" asks the crop
 * recommender to surface a suitable oilseed among the options later; "No
 * thanks" leaves the existing recommendation logic exactly as it is. Either way
 * the farmer continues to the same, unchanged registration flow.
 */

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Coins,
  Droplets,
  Layers,
  Leaf,
  ShieldCheck,
  Sprout,
  TrendingUp,
} from "lucide-react";
import SmoothScroll from "@/components/SmoothScroll";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import SiteHeader from "@/components/landing/SiteHeader";
import { storeOilseedAnswer } from "@/lib/oilseed";
import { getCropProfile } from "@/lib/agronomy";

/* Oilseed photography, exported to webp from the full-size originals. */
const HERO_IMAGE = "/images/oilseed-hero.webp"; // mustard in flower, sunrise
const BAND_IMAGE = "/images/oilseed-sunflower.webp"; // sunflower rows, golden hour

/* Indicative national figures, shown as context rather than precise claims.
   Sources noted under the band; refresh against the latest DES / NMEO-Oilseeds
   releases before any public launch. */
const STATS = [
  { value: "~57%", label: "of India's edible oil is imported", sub: "Domestic production meets under half of demand" },
  { value: "~10%", label: "of gross cropped area is oilseeds", sub: "A small share of land for a large national need" },
  { value: "9", label: "major oilseed crops grown in India", sub: "Mustard, groundnut, soybean, sesame and more" },
  { value: "₹10,103 cr", label: "NMEO-Oilseeds mission outlay", sub: "Central support for oilseed expansion to 2030-31" },
];

const BENEFITS = [
  {
    icon: Coins,
    title: "A second income line",
    body:
      "Oilseeds are sold by weight at oil mills, mandis and processors, and most major oilseeds carry a Minimum Support Price. That gives you a price floor to plan against instead of depending on one crop's market.",
  },
  {
    icon: Layers,
    title: "Spreads your risk",
    body:
      "When your whole farm carries one crop, one bad price or one pest season hits all of it. Splitting land across crop families means a poor year for one rarely becomes a poor year for the farm.",
  },
  {
    icon: Sprout,
    title: "Feeds the soil",
    body:
      "Groundnut and soybean are legumes — they fix nitrogen and leave the field richer for the crop that follows. Deep-rooted oilseeds like castor and safflower open up compacted subsoil.",
  },
  {
    icon: Droplets,
    title: "Modest on water",
    body:
      "Mustard, sesame and safflower are grown successfully on rain-fed and limited-irrigation land. Where water is tight or the borewell is falling, they are often a more realistic crop than a water-heavy one.",
  },
  {
    icon: TrendingUp,
    title: "Demand that isn't going away",
    body:
      "Cooking oil is bought by every household, every month. Oil cake left after crushing is sold as cattle and poultry feed, so a single harvest reaches two different buyers.",
  },
  {
    icon: ShieldCheck,
    title: "Backed by government support",
    body:
      "Oilseed farmers are covered by MSP procurement, seed subsidy schemes and the National Mission on Edible Oils. Support for these crops is national policy, not a passing trend.",
  },
];

/* Cycle lengths come from the same agronomy engine the dashboard uses, so the
   durations shown here match the harvest countdowns the farmer sees later. */
const CROP_NOTES: { crop: string; season: string; note: string }[] = [
  { crop: "mustard", season: "Rabi", note: "Cool-season crop for northern and central plains; tolerates limited irrigation." },
  { crop: "groundnut", season: "Kharif / Rabi", note: "Legume — fixes nitrogen and suits light, well-drained sandy and red soils." },
  { crop: "soybean", season: "Kharif", note: "Rain-fed legume widely grown on black soils; short cycle frees the field early." },
  { crop: "sesame", season: "Kharif / Summer", note: "Very short duration and heat-hardy; fits as a catch crop between main seasons." },
  { crop: "sunflower", season: "Any season", note: "Photo-insensitive, so it can be sown across seasons where water allows." },
];

const COMPLEMENTS = [
  {
    title: "Rotate after a cereal",
    body:
      "Follow wheat or paddy with mustard or groundnut. The oilseed uses residual moisture and nutrients, and breaks the pest and disease cycle that builds up when the same cereal returns year after year.",
  },
  {
    title: "Use the gap between seasons",
    body:
      "Short-duration crops like sesame mature in roughly three months — enough to fit between two main crops instead of leaving the field bare.",
  },
  {
    title: "Start with one plot",
    body:
      "You don't have to convert the farm. Many farmers begin with a single plot, learn the crop and the local buyer, and expand only once the returns are proven on their own land.",
  },
];

export default function OilseedsAwarenessPage() {
  return (
    <SmoothScroll>
      <LanguageProvider>
        <AwarenessContent />
      </LanguageProvider>
    </SmoothScroll>
  );
}

function AwarenessContent() {
  const router = useRouter();

  const answer = (choice: "yes" | "no") => {
    storeOilseedAnswer(choice);
    router.push("/onboarding");
  };

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden font-sans">
      {/* Page background: the same continuous wash + contour texture as the
          landing page, kept far behind the content. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="of-canvas absolute inset-0" />
        <div className="of-topo absolute inset-0 opacity-70" />
        <div className="animate-af-drift absolute -left-40 top-[10%] h-[38rem] w-[38rem] rounded-full bg-of-primary/10 blur-[130px]" />
        <div className="animate-af-drift-2 absolute -right-48 bottom-[8%] h-[42rem] w-[42rem] rounded-full bg-of-forest/[0.09] blur-[140px]" />
        <div className="of-grain absolute inset-0 opacity-[0.05]" />
      </div>

      <SiteHeader />

      {/* ── Hero ── */}
      <section className="relative mx-auto max-w-[1180px] px-6 pt-16 sm:pt-24">
        <div className="of-ring rounded-[32px] p-px shadow-of-float">
          <div className="relative overflow-hidden rounded-[31px] bg-of-forest">
            <img
              src={HERO_IMAGE}
              alt="A mustard field in full yellow flower at sunrise, with a village treeline on the horizon"
              className="h-[380px] w-full object-cover sm:h-[520px]"
            />
            {/* Legibility scrim, weighted to the left where the copy sits rather
                than across the base — a bottom-heavy scrim would bury the
                mustard yellow, which is the whole point of the photograph. */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: [
                  "linear-gradient(100deg, rgba(6,78,59,0.95) 0%, rgba(6,78,59,0.82) 36%, rgba(6,78,59,0.34) 66%, rgba(6,78,59,0) 88%)",
                  "linear-gradient(to top, rgba(6,78,59,0.55) 0%, rgba(6,78,59,0) 42%)",
                ].join(","),
              }}
            />

            <div className="absolute inset-x-0 bottom-0 p-8 sm:p-14">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 backdrop-blur">
                <Leaf className="h-3.5 w-3.5 text-white" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-white/90">
                  Farmer Awareness
                </span>
              </span>

              <h1 className="mt-5 max-w-[20ch] font-sans text-[34px] font-extrabold leading-[1.06] tracking-[-0.03em] text-white sm:text-[58px]">
                India grows enough food. It doesn&apos;t grow enough oil.
              </h1>

              <p className="mt-5 max-w-[62ch] text-[15px] leading-[1.65] text-white/85 sm:text-[17px]">
                More than half the cooking oil in Indian kitchens is imported. Oilseed crops
                like mustard, groundnut and sesame close that gap — and for the farmer who
                grows them, they add a second income, ease pressure on the soil and spread
                the risk of a bad season. Here is what that means for your land.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats band ── */}
      <section className="mx-auto mt-14 max-w-[1180px] px-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-[18px] border border-of-border bg-of-surface p-6 shadow-of-card"
            >
              <div className="font-sans text-[30px] font-extrabold tracking-[-0.02em] text-of-forest sm:text-[36px]">
                {s.value}
              </div>
              <div className="mt-2 text-[13px] font-bold leading-snug text-of-ink">{s.label}</div>
              <div className="mt-1.5 text-[12px] leading-relaxed text-of-muted">{s.sub}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-of-muted">
          Indicative national figures, drawn from Government of India edible-oil and
          NMEO-Oilseeds reporting. Shown for context — they are not a forecast for your farm.
        </p>
      </section>

      {/* ── Why it matters ── */}
      <Section
        kicker="Why oilseeds matter"
        title="A gap the country fills with imports"
        lead="Oilseeds occupy a modest share of India's cropped land, yet the demand they serve keeps growing. That mismatch is met by imported palm, soy and sunflower oil — paid for in foreign exchange, priced by overseas markets."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <PlainCard
            title="Demand outruns supply"
            body="Edible oil consumption rises with income and population. Domestic oilseed production has not kept pace, so the shortfall is imported year after year."
          />
          <PlainCard
            title="Prices follow world markets"
            body="Because so much oil is imported, Indian edible-oil prices move with global ones. Growing more at home steadies prices for farmers and households alike."
          />
          <PlainCard
            title="The support is already in place"
            body="MSP coverage, seed distribution and a dedicated national mission exist for oilseeds. The buyers, the crushers and the policy support are established."
          />
        </div>
      </Section>

      {/* ── Benefits ── */}
      <Section
        kicker="What it means for your farm"
        title="Six practical reasons to grow an oilseed"
        lead="Not every reason will apply to your land. Read them against what you know about your own soil, water and market."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="rounded-[18px] border border-of-border bg-of-surface p-6 shadow-of-card transition-shadow hover:shadow-of-float"
            >
              <span className="of-grad-emerald flex h-11 w-11 items-center justify-center rounded-2xl shadow-of-glow">
                <b.icon className="h-5 w-5 text-white" />
              </span>
              <h3 className="mt-4 text-[16px] font-extrabold tracking-[-0.01em] text-of-ink">
                {b.title}
              </h3>
              <p className="mt-2 text-[13.5px] leading-[1.65] text-of-body">{b.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Photographic break: keeps the run of white cards from flattening ── */}
      <section className="mx-auto mt-20 max-w-[1180px] px-6">
        <div className="relative overflow-hidden rounded-[24px] shadow-of-card">
          <img
            src={BAND_IMAGE}
            alt="Rows of sunflowers in a field at golden hour, curving toward the horizon"
            className="h-[260px] w-full object-cover sm:h-[340px]"
          />
          {/* Scrim weighted to the left, where the copy sits. */}
          <div className="absolute inset-0 bg-gradient-to-r from-of-forest via-of-forest/70 to-transparent" />
          <div className="absolute inset-y-0 left-0 flex max-w-[56ch] flex-col justify-center p-8 sm:p-14">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">
              Sunflower
            </span>
            <p className="mt-3 font-sans text-[19px] font-bold leading-[1.4] tracking-[-0.01em] text-white sm:text-[26px]">
              Because it doesn&apos;t depend on day length, sunflower can be sown across
              seasons — so it fits around the calendar you already farm.
            </p>
          </div>
        </div>
      </section>

      {/* ── The crops themselves ── */}
      <Section
        kicker="The crops"
        title="Common Indian oilseeds, and where each one fits"
        lead="Growing durations below come from the same crop engine that drives your harvest countdown after registration."
      >
        <div className="overflow-x-auto rounded-[18px] border border-of-border bg-of-surface shadow-of-card">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-of-border">
                {["Crop", "Season", "Seed to harvest", "Where it suits"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-of-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CROP_NOTES.map((c) => {
                const profile = getCropProfile(c.crop);
                return (
                  <tr key={c.crop} className="border-b border-of-border/70 last:border-0">
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-of-primary/10">
                          <Sprout className="h-4 w-4 text-of-primary-deep" />
                        </span>
                        <span className="text-[14px] font-bold text-of-ink">
                          {profile.displayName}
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[13px] text-of-body">{c.season}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-[13px] font-semibold text-of-forest">
                      ~{profile.cycleDays} days
                    </td>
                    <td className="px-5 py-4 text-[13px] leading-relaxed text-of-body">{c.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Fitting alongside existing crops ── */}
      <Section
        kicker="Alongside what you already grow"
        title="An addition, not a replacement"
        lead="Oilseeds are meant to sit beside your main crop — in the rotation, in the gap between seasons, or on a single trial plot."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {COMPLEMENTS.map((c, i) => (
            <div
              key={c.title}
              className="rounded-[18px] border border-of-border bg-of-surface p-6 shadow-of-card"
            >
              <span className="font-mono text-[11px] font-bold tracking-[0.18em] text-of-primary-deep">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-[16px] font-extrabold tracking-[-0.01em] text-of-ink">
                {c.title}
              </h3>
              <p className="mt-2 text-[13.5px] leading-[1.65] text-of-body">{c.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Decision ── */}
      <section className="mx-auto mt-20 max-w-[1180px] px-6 pb-24">
        <div className="of-ring rounded-[28px] p-px shadow-of-float">
          <div className="rounded-[27px] bg-of-forest px-8 py-12 text-center sm:px-14 sm:py-16">
            <h2 className="mx-auto max-w-[24ch] font-sans text-[28px] font-extrabold leading-[1.12] tracking-[-0.02em] text-white sm:text-[38px]">
              Would you like oilseeds considered for your farm?
            </h2>
            <p className="mx-auto mt-4 max-w-[60ch] text-[14.5px] leading-[1.65] text-white/80">
              Say yes and we&apos;ll make sure a suitable oilseed appears among your crop
              options — but only where it genuinely fits your soil, water and season. Your
              registration is the same either way, and you can always choose a different
              crop.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={() => answer("yes")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 font-sans text-[14px] font-bold text-of-forest transition-transform hover:-translate-y-0.5 sm:w-auto"
              >
                I acknowledge and understand
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => answer("no")}
                className="inline-flex w-full items-center justify-center rounded-full border border-white/30 bg-white/5 px-8 py-3.5 font-sans text-[14px] font-semibold text-white/90 backdrop-blur transition-colors hover:border-white/60 sm:w-auto"
              >
                No thanks
              </button>
            </div>

            <p className="mt-6 text-[12px] text-white/55">
              Either choice takes you to sign-up, then farm registration.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ── Layout helpers ── */

function Section({
  kicker,
  title,
  lead,
  children,
}: {
  kicker: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto mt-20 max-w-[1180px] px-6">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-of-primary-deep">
        {kicker}
      </span>
      <h2 className="mt-3 max-w-[22ch] font-sans text-[28px] font-extrabold leading-[1.12] tracking-[-0.025em] text-of-ink sm:text-[40px]">
        {title}
      </h2>
      <p className="mt-4 max-w-[68ch] text-[15px] leading-[1.7] text-of-body">{lead}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function PlainCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[18px] border border-of-border bg-of-surface p-6 shadow-of-card">
      <h3 className="text-[15px] font-extrabold tracking-[-0.01em] text-of-ink">{title}</h3>
      <p className="mt-2 text-[13.5px] leading-[1.65] text-of-body">{body}</p>
    </div>
  );
}
