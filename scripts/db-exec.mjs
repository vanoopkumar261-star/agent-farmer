import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const adminEnv = Object.fromEntries(
  fs.readFileSync(path.join(root, ".env.admin.local"), "utf8")
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

const sqlArg = process.argv[2];
if (!sqlArg) {
  console.error("Usage: node scripts/db-exec.mjs <sql-file-or-inline-sql>");
  process.exit(1);
}

const sql = fs.existsSync(sqlArg) ? fs.readFileSync(sqlArg, "utf8") : sqlArg;

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}:`, text);
  process.exit(1);
}

try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
