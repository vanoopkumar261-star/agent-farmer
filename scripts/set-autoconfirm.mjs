// Turns OFF email confirmation (sets mailer_autoconfirm = true) so username/
// password accounts sign in immediately without any confirmation email.
// Reversible: set AUTOCONFIRM=false to require confirmation again.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const adminEnv = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env.admin.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const token = adminEnv.SUPABASE_ACCESS_TOKEN;
const ref = adminEnv.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF in .env.admin.local");
  process.exit(1);
}

const autoconfirm = process.env.AUTOCONFIRM !== "false";

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ mailer_autoconfirm: autoconfirm }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}:`, text);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  parsed = {};
}
console.log(`mailer_autoconfirm is now: ${parsed.mailer_autoconfirm}`);
