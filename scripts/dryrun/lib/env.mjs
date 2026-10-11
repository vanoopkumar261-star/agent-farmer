/**
 * Reads .env.local and .env.admin.local.
 *
 * The repo has never had a .env.local loader — scripts/db-exec.mjs hand-parses
 * .env.admin.local and nothing reads the other file. This is that parser with
 * the three gaps its original does not need but we do:
 *
 *   · split on /\r?\n/  — this is Windows and the files have CRLF endings
 *   · skip comment lines — .env.example-derived files carry them
 *   · strip one layer of surrounding quotes
 *
 * Secrets are never printed. `fingerprint()` returns presence plus a short
 * digest, which is enough to answer "is it set" and "did it change between two
 * runs" without ever putting a key in a report.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));

function parse(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return {};
  const out = {};
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"') && val.length > 1) ||
      (val.startsWith("'") && val.endsWith("'") && val.length > 1)
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function loadEnv() {
  const app = parse(".env.local");
  const admin = parse(".env.admin.local");
  // Make them visible to anything that reads process.env, without clobbering a
  // value the shell already set (an operator overriding a key for one run wins).
  for (const [k, v] of Object.entries({ ...app, ...admin })) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return { app, admin, all: { ...app, ...admin } };
}

/** "set (a1b2c3)" / "empty" / "absent" — never the value itself. */
export function fingerprint(value) {
  if (value === undefined) return "absent";
  if (value === "") return "empty";
  const d = crypto.createHash("sha256").update(value).digest("hex").slice(0, 6);
  return `set (${d})`;
}

/** The keys whose presence changes what the harness can even attempt. */
export const KEYS_OF_INTEREST = [
  "GROQ_API_KEY",
  "GROQ_TEXT_MODEL",
  "GROQ_VISION_MODEL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_REF",
  "DATA_GOV_API_KEY",
  "GNEWS_API_KEY",
  "NEWS_API_KEY",
  "THINGSPEAK_CHANNEL_A_ID",
  "THINGSPEAK_CHANNEL_A_READ_KEY",
  "CRON_SECRET",
  "INFERENCE_URL",
  "TTS_URL",
  "RESEND_API_KEY",
  "GOOGLE_MAPS_API_KEY",
];
