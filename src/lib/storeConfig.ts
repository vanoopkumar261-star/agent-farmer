/**
 * How far the store locator looks, shared by the server and the browser.
 *
 * It lives in its own module rather than in `stores.ts` because that file is
 * `server-only` — it holds the Places key handling and the service-role client.
 * Importing the constant from there into the map component would drag
 * `server-only` into a client bundle and fail the build, so the one number both
 * sides need sits somewhere neither owns.
 *
 * 100 km is further than it sounds. Google's own location bias will not accept
 * it — the API caps a bias circle at 50,000 m — so the radius is assembled from
 * a 50 km bias plus a distance filter, and the map has to be framed for a
 * 200 km-wide circle rather than the 20 km one it used to draw.
 */
export const SEARCH_RADIUS_KM = 100;

/** Beyond this, a shop is a planned trip rather than an errand. */
export const NEARBY_THRESHOLD_KM = 25;
