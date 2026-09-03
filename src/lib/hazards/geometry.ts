/**
 * Turning a district boundary into something drawable.
 *
 * Pure maths, no React and no server imports, so it runs identically wherever
 * it is called and can be reasoned about on its own.
 *
 * The projection is a plain equirectangular fit to the district's own bounding
 * box, with an ×cos(latitude) correction on x. At district scale — well under a
 * degree across — that is exact enough that identifying a real projection would
 * be false precision. Without the cosine term the shape is visibly stretched
 * east–west: at Dharwad's ~15°N a degree of longitude is 0.966 of a degree of
 * latitude, and by Ludhiana's ~31°N only 0.857. That is the difference between
 * a district a farmer recognises and one they do not.
 *
 * This mirrors the discipline in `src/components/landing/IndiaMap.tsx`, whose
 * header records how its own fit was measured rather than assumed.
 */

export type Ring = [number, number][];
export type GeoJsonGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

export type Point = { x: number; y: number };

/**
 * Every outer ring in the geometry.
 *
 * A Polygon's first ring is its outline and any further rings are holes; a
 * MultiPolygon is a list of those. Coastal districts really do come back as
 * MultiPolygon — Thiruvananthapuram does, because of its islands — so treating
 * the coordinates as a single Polygon would draw one ring and silently discard
 * the rest of the district.
 *
 * Holes are dropped deliberately. At this size they are a few pixels, and the
 * shape is a status backdrop rather than a survey.
 */
export function outerRings(geom: GeoJsonGeometry | null | undefined): Ring[] {
  if (!geom || !Array.isArray(geom.coordinates)) return [];
  try {
    if (geom.type === "Polygon") {
      const first = (geom.coordinates as number[][][])[0];
      return first && first.length >= 3 ? [first as Ring] : [];
    }
    if (geom.type === "MultiPolygon") {
      return (geom.coordinates as number[][][][])
        .map((poly) => poly?.[0])
        .filter((r): r is number[][] => Array.isArray(r) && r.length >= 3) as Ring[];
    }
  } catch {
    /* malformed geometry — draw nothing rather than throw */
  }
  return [];
}

export type Extent = { west: number; east: number; south: number; north: number };

/** Lon/lat extent across every ring. */
export function extentOf(rings: Ring[]): Extent | null {
  let west = Infinity,
    east = -Infinity,
    south = Infinity,
    north = -Infinity;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }
  if (!Number.isFinite(west) || east <= west || north <= south) return null;
  return { west, east, south, north };
}

/**
 * A lon/lat → viewBox projector fitted to `extent`, preserving aspect ratio and
 * centring the shape in the box with `pad` units of margin.
 */
export function makeProjector(extent: Extent, size: number, pad: number) {
  const midLat = (extent.north + extent.south) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180); // metres-per-degree correction

  const spanX = (extent.east - extent.west) * kx;
  const spanY = extent.north - extent.south;

  const usable = size - pad * 2;
  // One scale for both axes: independent scales would fit the box exactly and
  // deform the district, which is the whole thing we are trying to avoid.
  const scale = Math.min(usable / spanX, usable / spanY);

  const drawnW = spanX * scale;
  const drawnH = spanY * scale;
  const offsetX = pad + (usable - drawnW) / 2;
  const offsetY = pad + (usable - drawnH) / 2;

  return function project(lng: number, lat: number): Point {
    return {
      x: offsetX + (lng - extent.west) * kx * scale,
      // SVG y grows downward; latitude grows upward.
      y: offsetY + (extent.north - lat) * scale,
    };
  };
}

/** `d` attribute for a set of projected rings. */
export function ringsToPath(rings: Ring[], project: (lng: number, lat: number) => Point): string {
  const parts: string[] = [];
  for (const ring of rings) {
    let d = "";
    for (let i = 0; i < ring.length; i++) {
      const [lng, lat] = ring[i];
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      const p = project(lng, lat);
      d += `${d === "" ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    }
    if (d) parts.push(d + "Z");
  }
  return parts.join(" ");
}

/**
 * Area-weighted centroid of the largest ring.
 *
 * The largest ring, not all of them: for a MultiPolygon the mean of every
 * vertex drifts toward whichever fragment has the most points, which for an
 * island-heavy coastal district can land the centre out at sea.
 *
 * Falls back to the vertex mean for a degenerate ring where the shoelace area
 * comes out zero.
 */
export function centroidOf(rings: Ring[]): [number, number] | null {
  if (!rings.length) return null;

  let best: Ring | null = null;
  let bestAbsArea = -1;
  for (const ring of rings) {
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    }
    const abs = Math.abs(a / 2);
    if (abs > bestAbsArea) {
      bestAbsArea = abs;
      best = ring;
    }
  }
  if (!best) return null;

  let area = 0,
    cx = 0,
    cy = 0;
  for (let i = 0, j = best.length - 1; i < best.length; j = i++) {
    const [x0, y0] = best[j];
    const [x1, y1] = best[i];
    const f = x0 * y1 - x1 * y0;
    area += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  area /= 2;
  if (Math.abs(area) < 1e-12) {
    const n = best.length;
    return [best.reduce((s, p) => s + p[0], 0) / n, best.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (6 * area), cy / (6 * area)];
}

/**
 * Concentric inner rings, made by scaling each ring toward the centroid.
 *
 * NOT true polygon offsetting — a correct inward buffer needs a straight
 * skeleton and self-intersection handling, which is a large amount of code for
 * something drawn at 12% opacity. Scaling toward the centre gives the same
 * visual read for the compact, roughly convex shapes districts tend to be.
 *
 * These rings carry NO data. They are visual structure only, which is exactly
 * why they must stay uniform: rings whose spacing varied would be read as
 * isobars, implying a per-area severity we do not have and cannot get.
 */
export function contourRings(rings: Ring[], centroid: [number, number], factors: number[]): Ring[][] {
  const [cxLng, cyLat] = centroid;
  return factors.map((f) =>
    rings.map((ring) =>
      ring.map(([lng, lat]) => [cxLng + (lng - cxLng) * f, cyLat + (lat - cyLat) * f] as [number, number])
    )
  );
}

/**
 * Reduce a ring to `n` points, spaced evenly along its length.
 *
 * A contour that traced every wobble of the boundary would be a scaled-down
 * photocopy of it — three of those nested inside the outline read as scribble,
 * not structure. Real contours generalise as they go inward, so each ring gets
 * fewer points than the one outside it, and the innermost is nearly a blob.
 */
export function resampleRing(ring: Ring, n: number): Ring {
  if (ring.length <= n || n < 3) return ring;
  const out: Ring = [];
  const step = ring.length / n;
  for (let i = 0; i < n; i++) out.push(ring[Math.floor(i * step)]);
  return out;
}

/**
 * A closed path through the points, smoothed with Catmull-Rom converted to
 * cubic Béziers.
 *
 * Straight segments between resampled points would put a visible corner at
 * every vertex; the curve is what makes a decimated ring look deliberate
 * rather than lossy.
 */
export function smoothClosedPath(points: Point[]): string {
  const n = points.length;
  if (n < 3) return "";
  const at = (i: number) => points[((i % n) + n) % n];

  let d = `M${at(0).x.toFixed(2)} ${at(0).y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    // Catmull-Rom (tension 0.5) → Bézier control points.
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${c1x.toFixed(2)} ${c1y.toFixed(2)},${c2x.toFixed(2)} ${c2y.toFixed(2)},${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d + "Z";
}

/** Resample + smooth every ring in a contour level into one path string. */
export function contourPath(
  rings: Ring[],
  project: (lng: number, lat: number) => Point,
  points: number
): string {
  return rings
    .map((ring) => smoothClosedPath(resampleRing(ring, points).map(([lng, lat]) => project(lng, lat))))
    .filter(Boolean)
    .join(" ");
}

/** Is this point inside the extent? Guards against a mis-matched district. */
export function withinExtent(extent: Extent, lng: number, lat: number): boolean {
  return lng >= extent.west && lng <= extent.east && lat >= extent.south && lat <= extent.north;
}
