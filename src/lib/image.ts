import "server-only";
import sharp from "sharp";

/**
 * Image inspection and normalisation for uploaded leaf photographs.
 *
 * `sniffImageType` decides whether the bytes are an image at all (the declared
 * MIME is not trusted). `normalizeImage` then re-encodes through `sharp`, which
 * in one pass: strips every metadata segment (EXIF/GPS, XMP, IPTC, colour
 * profiles), applies EXIF orientation, caps the dimensions, and — via
 * `limitInputPixels` — refuses a decompression bomb before it is decoded.
 *
 * `stripImageMetadata` is the dependency-free fallback, kept for the case where
 * `sharp` itself throws on an odd-but-valid file: dropping metadata by walking
 * the byte stream is better than storing the original.
 */

export type AllowedMime = "image/jpeg" | "image/png" | "image/webp";

/** ~25 megapixels. Anything larger is refused rather than decoded. */
const MAX_INPUT_PIXELS = 25_000_000;
/** Longest edge of the stored image. A leaf photo needs nothing bigger. */
const MAX_DIMENSION = 2048;

export class ImageRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageRejectedError";
  }
}

/**
 * Re-encodes an uploaded image into a clean, bounded JPEG (or PNG for PNG
 * input). Throws `ImageRejectedError` if the source is a decompression bomb or
 * `sharp` cannot decode it.
 */
export async function normalizeImage(
  buf: Buffer,
  mime: AllowedMime
): Promise<{ bytes: Buffer; mime: "image/jpeg" | "image/png" }> {
  let pipeline: sharp.Sharp;
  try {
    pipeline = sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // bake in EXIF orientation before metadata is dropped
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      });
    // No .withMetadata() — the default drops everything, which is the point.
    if (mime === "image/png") {
      return { bytes: await pipeline.png({ compressionLevel: 8 }).toBuffer(), mime: "image/png" };
    }
    return {
      bytes: await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer(),
      mime: "image/jpeg",
    };
  } catch (e) {
    throw new ImageRejectedError(
      e instanceof Error && /pixel|limitInputPixels/i.test(e.message)
        ? "That image is too large to process."
        : "That image could not be read."
    );
  }
}

/**
 * Identifies an image by its actual bytes, ignoring the declared type.
 *
 * `file.type` on a multipart upload is whatever the client wrote there, so it
 * says nothing about the content. A `.txt` renamed `.jpg` arrives claiming
 * `image/jpeg`. Signatures cannot be spoofed without actually producing a file
 * of that format, which is the property worth checking.
 *
 * Returns null when the bytes are not one of the formats we accept.
 */
export function sniffImageType(buf: Buffer): AllowedMime | null {
  if (buf.length < 12) return null;

  // JPEG: SOI marker FF D8, followed by another marker FF xx.
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";

  // PNG: the 8-byte signature.
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: RIFF container whose form type is WEBP.
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }

  return null;
}

/**
 * Removes metadata segments that can carry location and device identity.
 *
 * This matters more than it looks: a farmer photographs a leaf in their own
 * field, and a phone camera writes the GPS coordinates of that field into EXIF.
 * Storing the image unmodified stores the location of the farm.
 *
 * Pixel data is never touched — only metadata segments are dropped, so the
 * image still decodes identically. Returns the original buffer unchanged if the
 * format is not one we know how to walk, which is safe: it is the same bytes
 * that would have been stored anyway.
 */
export function stripImageMetadata(buf: Buffer, mime: AllowedMime): Buffer {
  try {
    if (mime === "image/jpeg") return stripJpegMetadata(buf);
    if (mime === "image/png") return stripPngMetadata(buf);
    return buf; // WebP: metadata is possible but rare from phone cameras.
  } catch {
    // A malformed file is the scanner's problem, not this function's — hand
    // back what we were given rather than failing the upload.
    return buf;
  }
}

/**
 * Walks JPEG segments and drops the metadata-bearing ones.
 *
 * A JPEG is SOI followed by `FF <marker> <2-byte length> <payload>` segments.
 * EXIF (including GPS) lives in APP1, and Photoshop/IPTC blocks live in APP13.
 * APP0 is JFIF density information and is kept — dropping it changes how some
 * decoders scale the image.
 *
 * Scanning stops at SOS (start of scan): everything after it is entropy-coded
 * pixel data with no segment structure, and must be copied through untouched.
 */
function stripJpegMetadata(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;

  const out: Buffer[] = [buf.subarray(0, 2)]; // SOI
  let i = 2;

  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) break; // Not a marker boundary — stop and copy the rest.

    const marker = buf[i + 1];

    // Start of scan: copy everything from here to the end verbatim.
    if (marker === 0xda) {
      out.push(buf.subarray(i));
      return Buffer.concat(out);
    }

    // Standalone markers carry no length field.
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      out.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }

    if (i + 4 > buf.length) break;
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) break; // Malformed — bail out.

    const isExif = marker === 0xe1;   // APP1 — EXIF and XMP
    const isIptc = marker === 0xed;   // APP13 — Photoshop/IPTC
    const isComment = marker === 0xfe; // COM

    if (!isExif && !isIptc && !isComment) {
      out.push(buf.subarray(i, i + 2 + len));
    }
    i += 2 + len;
  }

  if (i < buf.length) out.push(buf.subarray(i));
  return Buffer.concat(out);
}

/**
 * Rebuilds a PNG without its textual and EXIF chunks.
 *
 * PNG is a signature followed by `<4-byte length> <4-byte type> <data> <4-byte
 * CRC>` chunks. Metadata rides in tEXt/iTXt/zTXt (text), eXIf (EXIF, including
 * GPS) and tIME. Every other chunk — including IHDR, IDAT and IEND — is copied
 * through, so the CRCs of the chunks we keep stay valid and no recompute is
 * needed.
 */
function stripPngMetadata(buf: Buffer): Buffer {
  const SIG = 8;
  if (buf.length < SIG) return buf;

  const drop = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME"]);
  const out: Buffer[] = [buf.subarray(0, SIG)];
  let i = SIG;

  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString("ascii", i + 4, i + 8);
    const total = 12 + len; // length + type + data + CRC
    if (len > buf.length || i + total > buf.length) break; // Malformed — bail out.

    if (!drop.has(type)) out.push(buf.subarray(i, i + total));

    i += total;
    if (type === "IEND") return Buffer.concat(out);
  }

  if (i < buf.length) out.push(buf.subarray(i));
  return Buffer.concat(out);
}
