import { extractStateFromAddress } from "@/lib/market";
import { getMandiRowsForState } from "@/lib/market-server";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Mandi list + APMC fee breakdown for one crop, split from GET /api/market so
 * the mobile client only pays for the (heavier, per-crop) mandi lookup when a
 * farmer actually taps into a crop, not for every crop on every page load.
 */
export async function GET(req: Request) {
  const rl = await checkRateLimit(req, "market");
  if (!rl.ok) return rateLimited(rl);

  const url = new URL(req.url);
  const address = url.searchParams.get("address") ?? "";
  const crop = url.searchParams.get("crop") ?? "";
  if (!crop) return Response.json({ error: "Missing crop." }, { status: 400 });

  const state = extractStateFromAddress(address);

  const mandis = await getMandiRowsForState(crop, state);
  return Response.json({ mandis });
}
