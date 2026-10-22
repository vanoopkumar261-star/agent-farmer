/**
 * Shrinks a photo in the browser before it is uploaded.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * Vercel caps a serverless function's request body at **4.5 MB**, and that cap
 * is enforced by the platform *before* the function runs. Nothing in
 * `/api/disease` or `/api/soil-reading` ever executes, so the farmer gets an
 * opaque platform 413 instead of the friendly message those routes carry — and
 * `MAX_UPLOAD_MB` in the route, which is 5, never gets to apply.
 *
 * A photo straight off a phone camera is routinely 4-8 MB, so this was not an
 * edge case: the disease scanner worked on localhost (no such limit) and failed
 * on the deployed site for most real photos. That is exactly the shape of bug
 * that survives a long time, because every developer tests it locally.
 *
 * ── Why resize rather than just raise the limit ──────────────────────────────
 *
 * The limit is Vercel's, not ours, so it cannot be raised. And the server
 * immediately downscales to 1600px anyway (`normalizeImage` in src/lib/image.ts),
 * so every byte above that was going to be thrown away after being uploaded over
 * a rural mobile connection. Doing it here makes the upload roughly 10-20x
 * smaller and the scan noticeably faster, on top of fixing the failure.
 *
 * The 1600px longest edge matches `MAX_DIMENSION` on the server deliberately:
 * re-encoding to the same size there is then a no-op rather than a second,
 * lossier pass. EXIF is dropped as a side effect of drawing to a canvas, but
 * that is not the privacy mechanism — the server still strips metadata itself,
 * because anything a client does is a convenience, never a guarantee.
 *
 * ── Failure ──────────────────────────────────────────────────────────────────
 *
 * Every failure path returns the ORIGINAL file. A browser without canvas
 * support, a HEIC the decoder refuses, a tainted canvas — in all of them the
 * upload proceeds exactly as it did before this file existed, and the server's
 * own size check produces the honest error. Shrinking is an optimisation; it
 * must never be the reason a scan cannot be attempted.
 */

/** Longest edge after resizing. Matches MAX_DIMENSION in src/lib/image.ts. */
const MAX_DIMENSION = 1600;

/**
 * Files at or below this are sent untouched.
 *
 * Re-encoding a small image costs quality and buys nothing — and a photo this
 * size is already far inside the platform limit.
 */
const SKIP_BELOW_BYTES = 512 * 1024;

/** JPEG quality for the re-encode. 0.85 is visually clean for leaf detail. */
const QUALITY = 0.85;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

/**
 * Returns a downscaled JPEG, or the original file if shrinking is unnecessary
 * or impossible. Never throws.
 */
export async function shrinkImageForUpload(file: File): Promise<File> {
  try {
    if (typeof document === "undefined") return file;
    if (file.size <= SKIP_BELOW_BYTES) return file;

    const img = await loadImage(file);
    const { width, height } = img;
    if (!width || !height) return file;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", QUALITY)
    );
    if (!blob) return file;

    // A re-encode can come out larger than the original — a small, already
    // heavily-compressed JPEG that needed no resizing, for instance. Keeping
    // whichever is smaller means this can only ever help.
    if (blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "leaf";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Decode failure, tainted canvas, out of memory — send the original and let
    // the server decide. See the Failure note above.
    return file;
  }
}
