import { extractStateFromAddress } from "@/lib/market";
import { getMarketForState } from "@/lib/market-server";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Thin HTTP wrapper around lib/market.ts's getMarket, for the mobile app.
 * The web dashboard calls getMarket() directly from a React Server Component;
 * mobile has no equivalent, and DATA_GOV_API_KEY must stay server-side, so
 * this route exists purely to cross that boundary. See
 * docs/MOBILE_APP_ROADMAP.md §Phase 1.
 *
 * Unauthenticated like the other AI/data routes (crop-guide, market-advice) —
 * the state is derived from whatever address the caller supplies, not from a
 * session, so there is nothing farmer-specific to protect here.
 */
export async function GET(req: Request) {
  const rl = await checkRateLimit(req, "market");
  if (!rl.ok) return rateLimited(rl);

  const url = new URL(req.url);
  const address = url.searchParams.get("address") ?? "";

  const state = extractStateFromAddress(address);

  const crops = await getMarketForState(state);
  const isRealData = crops.some((c) => c.isReal);

  return Response.json({ state, isRealData, crops });
}
