/**
 * Dry-run verification harness.
 *
 *   node scripts/dryrun/run.mjs                 upstream + model (safe, no writes)
 *   node scripts/dryrun/run.mjs --only model
 *   node scripts/dryrun/run.mjs --contract      also probe our own /api routes
 *
 * Starts nothing. Imports nothing from src/lib — 24 of those modules open with
 * `import "server-only"` and use @/ aliases only Next's compiler resolves, so
 * everything here goes over HTTP or reimplements the few helpers it needs.
 *
 * Before --contract, start the app yourself:
 *     npx next build && npx next start
 * Not `next dev`: it compiles per route on first visit (5-13s) and every
 * latency figure in the report would be a compile time.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadEnv, fingerprint, KEYS_OF_INTEREST, ROOT } from "./lib/env.mjs";
import { STATUS, runProbe, isBad } from "./lib/probe.mjs";
import { fetchRetry, readBody } from "./lib/fetchx.mjs";
import { printTable, writeJson, writeMarkdown } from "./lib/report.mjs";
import { upstreamProbes } from "./probes/upstream.mjs";
import { modelProbes } from "./probes/model.mjs";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : null;
};

const only = valueOf("--only");
const wantContract = has("--contract");
const wantWrites = has("--with-writes");
const wantSpeech = has("--speech");
const wantReap = has("--reap");
const full = has("--full");
const APP = process.env.DRYRUN_APP_URL || "http://127.0.0.1:3000";

function runId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
}

function git(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
}

/**
 * Preflight decides what the rest can even attempt. Nothing here costs quota.
 * A missing dependency makes downstream probes `skip`, never `fail` — a probe
 * that could not run tells you nothing about the integration.
 */
async function preflight(env) {
  const out = [];

  out.push(
    await runProbe(
      { id: "preflight.env", layer: "preflight", title: "Keys present", expected: [STATUS.LIVE] },
      async () => {
        const table = {};
        for (const k of KEYS_OF_INTEREST) table[k] = fingerprint(env.all[k]);
        const absent = KEYS_OF_INTEREST.filter((k) => env.all[k] === undefined);
        return {
          status: STATUS.LIVE,
          ms: 0,
          evidence: table,
          verdict: `${KEYS_OF_INTEREST.length - absent.length}/${KEYS_OF_INTEREST.length} set; absent: ${
            absent.join(", ") || "none"
          }`,
        };
      }
    )
  );

  out.push(
    await runProbe(
      {
        id: "preflight.app",
        layer: "preflight",
        title: "Next.js app reachable",
        expected: [STATUS.LIVE, STATUS.ABSENT],
      },
      async () => {
        const { res, ms, error } = await fetchRetry(`${APP}/api/sensors`, {}, { retries: 0, timeoutMs: 8000 });
        if (!res) {
          return {
            status: STATUS.ABSENT,
            ms,
            evidence: { url: APP, error: String(error?.message ?? error) },
            verdict: `not running at ${APP} — contract probes will skip. Start it with: npx next build && npx next start`,
          };
        }
        // A production build serves this in well under a second; `next dev`
        // compiles the route on first visit and takes 5-13s.
        const looksLikeDev = ms > 4000;
        return {
          status: STATUS.LIVE,
          ms,
          evidence: { url: APP, status: res.status, firstByteMs: ms, looksLikeDev },
          verdict: looksLikeDev
            ? `${res.status} in ${ms}ms — that is next-dev compile time. Rebuild and use "next start", or every latency in this report is a compile time.`
            : `${res.status} in ${ms}ms (production build)`,
        };
      }
    )
  );

  out.push(
    await runProbe(
      {
        id: "preflight.build_freshness",
        layer: "preflight",
        title: "The built app matches the source tree",
        expected: [STATUS.LIVE, STATUS.ABSENT],
      },
      async () => {
        const buildId = path.join(ROOT, ".next", "BUILD_ID");
        if (!fs.existsSync(buildId)) return { status: STATUS.ABSENT, ms: 0, verdict: "no .next build present" };
        const builtAt = fs.statSync(buildId).mtimeMs;
        let newest = 0;
        let newestFile = null;
        const walk = (dir) => {
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p);
            else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) {
              const m = fs.statSync(p).mtimeMs;
              if (m > newest) {
                newest = m;
                newestFile = path.relative(ROOT, p);
              }
            }
          }
        };
        walk(path.join(ROOT, "src"));
        const stale = newest > builtAt;
        return {
          status: stale ? STATUS.DEGRADED : STATUS.LIVE,
          ms: 0,
          evidence: {
            builtAt: new Date(builtAt).toISOString(),
            newestSource: newestFile,
            newestSourceAt: new Date(newest).toISOString(),
            stale,
          },
          verdict: stale
            ? `STALE — ${newestFile} is newer than the build. Contract probes would test old code.`
            : `build is newer than every file under src/`,
        };
      }
    )
  );

  return out;
}

async function main() {
  const env = loadEnv();

  if (wantReap) {
    const { sweep } = await import("./lib/account.mjs");
    const r = await sweep();
    console.log(`reaped ${r.swept} orphaned account(s); ${r.remaining} entr(y/ies) left in out/orphans.json`);
    process.exit(0);
  }

  const id = runId();
  const meta = {
    startedAt: new Date().toISOString(),
    node: process.version,
    gitCommit: git("git rev-parse HEAD"),
    branch: git("git rev-parse --abbrev-ref HEAD"),
    app: APP,
    env: Object.fromEntries(KEYS_OF_INTEREST.map((k) => [k, fingerprint(env.all[k])])),
  };

  console.log(`Agent Farmer — dry run ${id}`);
  console.log(`${meta.branch}@${(meta.gitCommit ?? "").slice(0, 8)} · node ${meta.node}`);

  const records = [];
  records.push(...(await preflight(env)));

  const appUp = records.find((r) => r.id === "preflight.app")?.status === STATUS.LIVE;

  if (!only || only === "upstream") {
    console.log("\nrunning upstream probes…");
    records.push(...(await upstreamProbes()));
  }

  let usage = null;
  if (!only || only === "model") {
    console.log("running model probes (paced under the 6k tokens/min free tier)…");
    const m = await modelProbes();
    records.push(...m.records);
    usage = m.usage;
  }

  if (wantContract && (only === null || only === "contract")) {
    if (!appUp) {
      records.push(
        await runProbe(
          { id: "contract.all", layer: "contract", title: "Contract probes", expected: [STATUS.SKIP] },
          async () => ({ status: STATUS.SKIP, ms: 0, verdict: `app not reachable at ${APP}` })
        )
      );
    } else {
      const { contractProbes } = await import("./probes/contract.mjs");
      console.log("running contract probes against " + APP + "…");
      records.push(...(await contractProbes(APP)));
    }
  }

  if (wantSpeech && (only === null || only === "speech")) {
    const { speechProbes } = await import("./probes/speech.mjs");
    console.log("running speech round-trip probes…");
    records.push(...(await speechProbes(appUp ? APP : null, { full })));
  }

  // Writes go last, so a failure anywhere earlier never leaves an account
  // behind waiting on a teardown that will not run.
  if (wantWrites && (only === null || only === "data")) {
    const { dataProbes } = await import("./probes/data.mjs");
    console.log("running data + authority probes (creates and destroys throwaway accounts)…");
    records.push(...(await dataProbes(appUp ? APP : null)));
  }

  if (usage) meta.groqUsage = usage;

  const code = printTable(records);
  const jsonFile = writeJson(id, meta, records);
  const mdFile = writeMarkdown(id, meta, records);
  console.log(`\nreport: ${path.relative(ROOT, jsonFile)}`);
  console.log(`        ${path.relative(ROOT, mdFile)}`);
  if (usage) {
    console.log(
      `groq:   ${usage.calls} calls, ${usage.promptTokens} prompt + ${usage.completionTokens} completion = ${usage.totalTokens} tokens`
    );
  }
  process.exit(code);
}

main().catch((e) => {
  console.error("harness failed:", e);
  process.exit(2);
});
