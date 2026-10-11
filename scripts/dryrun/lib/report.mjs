/**
 * Terminal table, JSON, and markdown for a run.
 *
 * No colour: this runs in Windows Terminal under Git Bash and PowerShell, and
 * padEnd plus a leading status word reads fine in all of them. Same idiom as
 * scripts/check-validation.mjs, which is the closest thing this repo has to a
 * test reporter.
 */
import fs from "node:fs";
import path from "node:path";
import { STATUS, isBad, meetsExpectation } from "./probe.mjs";
import { ROOT } from "./env.mjs";

export const OUT_DIR = path.join(ROOT, "scripts", "dryrun", "out");

const ORDER = ["preflight", "upstream", "model", "contract", "speech", "data"];

export function printTable(records) {
  const byLayer = new Map();
  for (const r of records) {
    if (!byLayer.has(r.layer)) byLayer.set(r.layer, []);
    byLayer.get(r.layer).push(r);
  }

  const layers = [...byLayer.keys()].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  for (const layer of layers) {
    const line = `── ${layer} `.padEnd(78, "─");
    console.log(`\n${line}`);
    for (const r of byLayer.get(layer)) {
      const flag = meetsExpectation(r) ? " " : "!";
      const status = r.status.padEnd(9);
      const ms = String(r.ms).padStart(6);
      const id = r.id.padEnd(34);
      const tries = r.attempts > 1 ? ` (${r.attempts} tries)` : "";
      console.log(`${flag}${status} ${ms}ms  ${id} ${r.verdict}${tries}`);
    }
  }

  const tally = {};
  for (const r of records) tally[r.status] = (tally[r.status] ?? 0) + 1;
  const parts = Object.entries(tally)
    .sort()
    .map(([k, v]) => `${k} ${v}`)
    .join("   ");
  const unmet = records.filter((r) => !meetsExpectation(r));
  console.log(`\n${"".padEnd(78, "─")}`);
  console.log(parts);
  if (unmet.length) {
    console.log(`\n${unmet.length} probe(s) did not meet expectation:`);
    for (const r of unmet) {
      console.log(`  ! ${r.id}  expected [${r.expected.join("|")}] got ${r.status}`);
      console.log(`      ${r.verdict}`);
    }
  }
  return records.some((r) => isBad(r.status)) ? 1 : 0;
}

export function writeJson(runId, meta, records) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `dryrun-${runId}.json`);
  fs.writeFileSync(file, JSON.stringify({ runId, ...meta, probes: records }, null, 2), "utf8");
  return file;
}

export function writeMarkdown(runId, meta, records) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `dryrun-${runId}.md`);

  const rows = (list) =>
    [
      "| status | probe | ms | what came back |",
      "|---|---|---|---|",
      ...list.map(
        (r) =>
          `| \`${r.status}\`${meetsExpectation(r) ? "" : " ⚠"} | \`${r.id}\` | ${r.ms} | ${String(
            r.verdict
          ).replace(/\|/g, "\\|")} |`
      ),
    ].join("\n");

  const layer = (name) => records.filter((r) => r.layer === name);
  const unmet = records.filter((r) => !meetsExpectation(r));

  const md = `# Dry run ${runId}

${meta.startedAt} · node ${meta.node} · ${meta.branch ?? "?"}@${(meta.gitCommit ?? "").slice(0, 8)}

## Verdict

${
  unmet.length === 0
    ? "Every probe met its declared expectation."
    : `${unmet.length} probe(s) did not meet expectation:\n\n${unmet
        .map((r) => `- \`${r.id}\` — expected \`${r.expected.join("|")}\`, got \`${r.status}\`. ${r.verdict}`)
        .join("\n")}`
}

## Environment

${Object.entries(meta.env ?? {})
  .map(([k, v]) => `- \`${k}\` — ${v}`)
  .join("\n")}

${["preflight", "upstream", "model", "contract", "speech", "data"]
  .filter((l) => layer(l).length)
  .map((l) => `## ${l[0].toUpperCase()}${l.slice(1)}\n\n${rows(layer(l))}`)
  .join("\n\n")}

## Evidence

${records
  .filter((r) => r.evidence != null)
  .map(
    (r) =>
      `### \`${r.id}\`\n\n\`\`\`json\n${JSON.stringify(r.evidence, null, 2).slice(0, 4000)}\n\`\`\``
  )
  .join("\n\n")}
`;

  fs.writeFileSync(file, md, "utf8");
  return file;
}

export { STATUS };
