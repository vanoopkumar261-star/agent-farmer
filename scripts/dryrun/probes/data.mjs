/**
 * Layer D — the tables, and whether they behave the way the migrations claim.
 *
 * This is the suite the agentic build actually depends on. Autonomous writes
 * are only safe because a wrong-farm insert is refused and every write has an
 * inverse; both of those are claims about Postgres that nobody had tested from
 * the client path the app uses.
 *
 * The assertions are on SQLSTATE codes, not on "it errored". 42501 (RLS refused
 * it) and 23514 (a CHECK constraint refused it) mean different things, and a
 * probe that accepts either cannot tell you which guard actually fired — or
 * notice when the wrong one does.
 */
import { STATUS, runProbe } from "../lib/probe.mjs";
import { fetchRetry, readBody, clip } from "../lib/fetchx.mjs";
import { createUser, signIn, seedFarmer, teardown, sweep, testEmail } from "../lib/account.mjs";

const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Names the guard that fired, so a probe can assert the right one did. */
function guardOf(error) {
  if (!error) return null;
  const code = error.code ?? "";
  if (code === "42501") return "RLS";
  if (code === "23514") return "CHECK";
  if (code === "23503") return "FK";
  if (code === "23505") return "UNIQUE";
  return code || "unknown";
}

export async function dataProbes(app) {
  const out = [];
  const runId = `${Date.now().toString(36)}`;
  const ids = { userIds: [], profileIds: [], farmByProfile: {} };
  let A = null;
  let B = null;

  // ── sweep anything a previous crashed run left behind ────────────────────
  out.push(
    await runProbe(
      { id: "data.sweep", layer: "data", title: "Clear orphans from earlier runs", expected: [STATUS.LIVE] },
      async () => {
        const s = await sweep();
        return {
          status: STATUS.LIVE,
          ms: 0,
          evidence: s,
          verdict: s.swept ? `swept ${s.swept} orphaned account(s)` : "no orphans from earlier runs",
        };
      }
    )
  );

  try {
    // ── set up two independent farmers ─────────────────────────────────────
    out.push(
      await runProbe(
        { id: "data.setup", layer: "data", title: "Two throwaway farmers exist", expected: [STATUS.LIVE] },
        async () => {
          const uA = await createUser(testEmail(runId, "-a"));
          ids.userIds.push(uA.id);
          const sA = await signIn(uA.email, uA.password);
          const fA = await seedFarmer(sA.client, uA.id, `A-${runId}`);
          ids.profileIds.push(fA.profileId);
          ids.farmByProfile[fA.profileId] = fA.farmId;
          A = { ...uA, ...sA, ...fA };

          const uB = await createUser(testEmail(runId, "-b"));
          ids.userIds.push(uB.id);
          const sB = await signIn(uB.email, uB.password);
          const fB = await seedFarmer(sB.client, uB.id, `B-${runId}`);
          ids.profileIds.push(fB.profileId);
          ids.farmByProfile[fB.profileId] = fB.farmId;
          B = { ...uB, ...sB, ...fB };

          return {
            status: STATUS.LIVE,
            ms: 0,
            evidence: {
              A: { userId: A.id, profileId: A.profileId, farmId: A.farmId },
              B: { userId: B.id, profileId: B.profileId, farmId: B.farmId },
            },
            verdict: `A and B created via the Admin API, each with a profile and one farm, signed in with real user JWTs`,
          };
        }
      )
    );

    if (!A || !B) throw new Error("setup did not complete");

    // ── D1: the ordinary owned write ───────────────────────────────────────
    let readingId = null;
    out.push(
      await runProbe(
        { id: "data.d1.owned_insert", layer: "data", title: "An owned soil reading inserts", expected: [STATUS.LIVE] },
        async () => {
          const { data, error } = await A.client
            .from("soil_readings")
            .insert({ farmer_id: A.profileId, farm_id: A.farmId, ph: 6.4, source: "manual" })
            .select("id, ph")
            .single();
          if (error) {
            return { status: STATUS.FAIL, ms: 0, evidence: { error }, verdict: `refused: ${error.code} ${error.message}` };
          }
          readingId = data.id;
          return {
            status: STATUS.LIVE,
            ms: 0,
            evidence: { id: data.id, ph: data.ph },
            verdict: `inserted id=${data.id} ph=${data.ph}`,
          };
        }
      )
    );

    // ── D2a: migration 021's WITH CHECK ownership walk on farm_id ──────────
    out.push(
      await runProbe(
        {
          id: "data.d2a.cross_farm_id",
          layer: "data",
          title: "A reading naming another farmer's farm is refused by RLS",
          expected: [STATUS.LIVE],
        },
        async () => {
          const { data, error } = await A.client
            .from("soil_readings")
            .insert({ farmer_id: A.profileId, farm_id: B.farmId, ph: 6.4, source: "manual" })
            .select("id");
          const guard = guardOf(error);
          if (!error) {
            return {
              status: STATUS.FAIL,
              ms: 0,
              evidence: { inserted: data },
              verdict: `CRITICAL: farmer A wrote a row against farmer B's farm. Migration 021's WITH CHECK did not fire.`,
            };
          }
          return {
            status: guard === "RLS" ? STATUS.LIVE : STATUS.DEGRADED,
            ms: 0,
            evidence: { code: error.code, guard, message: error.message },
            verdict:
              guard === "RLS"
                ? `refused with 42501 — migration 021's ownership walk fired`
                : `refused, but by ${guard} (${error.code}) rather than RLS — the right outcome via the wrong guard`,
          };
        }
      )
    );

    // ── D2b: the same walk on farmer_id ────────────────────────────────────
    out.push(
      await runProbe(
        {
          id: "data.d2b.cross_farmer_id",
          layer: "data",
          title: "A reading claiming another farmer's id is refused",
          expected: [STATUS.LIVE],
        },
        async () => {
          const { data, error } = await A.client
            .from("soil_readings")
            .insert({ farmer_id: B.profileId, ph: 6.4, source: "manual" })
            .select("id");
          const guard = guardOf(error);
          if (!error) {
            return {
              status: STATUS.FAIL,
              ms: 0,
              evidence: { inserted: data },
              verdict: `CRITICAL: farmer A wrote a row owned by farmer B`,
            };
          }
          return {
            status: guard === "RLS" ? STATUS.LIVE : STATUS.DEGRADED,
            ms: 0,
            evidence: { code: error.code, guard, message: error.message },
            verdict: `refused by ${guard} (${error.code})`,
          };
        }
      )
    );

    // ── D3: migration 017's pH bounds — and that it is CHECK, not RLS ──────
    out.push(
      await runProbe(
        {
          id: "data.d3.ph_bounds",
          layer: "data",
          title: "pH 15 is refused by the CHECK constraint, not by RLS",
          expected: [STATUS.LIVE],
        },
        async () => {
          const { error } = await A.client
            .from("soil_readings")
            .insert({ farmer_id: A.profileId, farm_id: A.farmId, ph: 15, source: "manual" })
            .select("id");
          const guard = guardOf(error);
          if (!error) {
            return { status: STATUS.FAIL, ms: 0, verdict: `pH 15 was accepted — migration 017's CHECK is missing` };
          }
          return {
            // The distinction matters: if RLS refuses this, the CHECK is
            // untested and a pH of 15 could land the moment RLS changes.
            status: guard === "CHECK" ? STATUS.LIVE : STATUS.DEGRADED,
            ms: 0,
            evidence: { code: error.code, guard, message: error.message },
            verdict:
              guard === "CHECK"
                ? `refused with 23514 — the pH CHECK fired, which is the guard that should have`
                : `refused by ${guard} (${error.code}) instead of the CHECK — the bound itself is untested`,
          };
        }
      )
    );

    // ── D4: farm_tasks per-day idempotency (migration 010) ─────────────────
    out.push(
      await runProbe(
        {
          id: "data.d4.task_idempotent",
          layer: "data",
          title: "farm_tasks upserts are idempotent per day",
          expected: [STATUS.LIVE],
        },
        async () => {
          const key = `dryrun-${runId}`;
          const row = (day) => ({
            farmer_id: A.profileId,
            task_key: key,
            title: "Dry run task",
            meta: "harness",
            tone: "neutral",
            status: "done",
            due_date: day,
          });
          const opts = { onConflict: "farmer_id,task_key,due_date" };

          const one = await A.client.from("farm_tasks").upsert(row(today()), opts).select("id").single();
          if (one.error) {
            return { status: STATUS.FAIL, ms: 0, evidence: { error: one.error }, verdict: `first upsert failed: ${one.error.message}` };
          }
          const two = await A.client.from("farm_tasks").upsert(row(today()), opts).select("id").single();
          if (two.error) {
            return { status: STATUS.FAIL, ms: 0, evidence: { error: two.error }, verdict: `second upsert failed: ${two.error.message}` };
          }
          // Yesterday's copy of the same key must be a separate row: completion
          // is per day, which is exactly what an offline outbox replayed a day
          // late would get wrong.
          const y = await A.client.from("farm_tasks").upsert(row(yesterday()), opts).select("id").single();
          const { count } = await A.client
            .from("farm_tasks")
            .select("id", { count: "exact", head: true })
            .eq("farmer_id", A.profileId)
            .eq("task_key", key);

          const sameId = one.data.id === two.data.id;
          const distinctDay = y.data && y.data.id !== one.data.id;
          return {
            status: sameId && distinctDay && count === 2 ? STATUS.LIVE : STATUS.FAIL,
            ms: 0,
            evidence: { todayId: one.data.id, repeatId: two.data.id, yesterdayId: y.data?.id, rowsForKey: count },
            verdict: `same id on repeat=${sameId}; yesterday is a distinct row=${distinctDay}; ${count} row(s) for the key — per-day semantics ${
              sameId && distinctDay && count === 2 ? "hold" : "DO NOT hold"
            }`,
          };
        }
      )
    );

    // ── D5: RLS filters cross-farmer reads silently ───────────────────────
    out.push(
      await runProbe(
        {
          id: "data.d5.cross_read",
          layer: "data",
          title: "Farmer A cannot read farmer B's rows",
          expected: [STATUS.LIVE],
        },
        async () => {
          const r1 = await A.client.from("soil_readings").select("id").eq("farmer_id", B.profileId);
          const r2 = await A.client.from("farms").select("id").eq("id", B.farmId);
          const leaked = (r1.data?.length ?? 0) + (r2.data?.length ?? 0);
          return {
            status: leaked === 0 ? STATUS.LIVE : STATUS.FAIL,
            ms: 0,
            evidence: {
              soilRows: r1.data?.length ?? 0,
              soilError: r1.error?.message ?? null,
              farmRows: r2.data?.length ?? 0,
              farmError: r2.error?.message ?? null,
            },
            verdict:
              leaked === 0
                ? `0 rows returned and no error — RLS filters silently, which is the correct shape`
                : `LEAK: ${leaked} of farmer B's row(s) were visible to farmer A`,
          };
        }
      )
    );

    // ── D6: the inverse path — the mechanism autonomous undo depends on ────
    out.push(
      await runProbe(
        {
          id: "data.d6.inverse",
          layer: "data",
          title: "An expense can be written and then reversed",
          expected: [STATUS.LIVE],
        },
        async () => {
          const ins = await A.client
            .from("farm_expenses")
            .insert({
              farmer_id: A.profileId,
              kind: "expense",
              category: "Fertilizer",
              item_name: "Urea (dry run)",
              amount: 2000,
              txn_date: today(),
            })
            .select("id, amount")
            .single();
          if (ins.error) {
            return { status: STATUS.FAIL, ms: 0, evidence: { error: ins.error }, verdict: `insert failed: ${ins.error.message}` };
          }
          const del = await A.client.from("farm_expenses").delete().eq("id", ins.data.id);
          const after = await A.client.from("farm_expenses").select("id").eq("id", ins.data.id);
          const gone = (after.data?.length ?? 0) === 0;
          return {
            status: !del.error && gone ? STATUS.LIVE : STATUS.FAIL,
            ms: 0,
            evidence: { id: ins.data.id, amount: ins.data.amount, deleteError: del.error?.message ?? null, rowsAfter: after.data?.length },
            verdict: !del.error && gone
              ? `₹${ins.data.amount} logged as id=${ins.data.id}, then reversed — the undo mechanism works end to end`
              : `reversal failed: ${del.error?.message ?? "row still present"}`,
          };
        }
      )
    );

    // ── D7: bearer transport, four tokens against one authed route ────────
    if (app) {
      const cases = [
        ["valid", A.token, (s) => s !== 401, "a real user JWT is accepted"],
        ["malformed", "not.a.jwt", (s) => s === 401, "a malformed bearer is refused"],
        [
          "tampered",
          A.token ? A.token.slice(0, -3) + (A.token.slice(-3) === "aaa" ? "bbb" : "aaa") : "x",
          (s) => s === 401,
          "a token with a corrupted signature is refused — proving the server verifies with GoTrue rather than trusting the shape",
        ],
        ["service_role", process.env.SUPABASE_SERVICE_ROLE_KEY, (s) => s === 401, "a service-role JWT is refused as a user token"],
      ];
      for (const [label, token, ok, why] of cases) {
        out.push(
          await runProbe(
            { id: `data.d7.bearer.${label}`, layer: "data", title: why, expected: [STATUS.LIVE] },
            async () => {
              if (!token) return { status: STATUS.SKIP, ms: 0, verdict: "no token available" };
              const { res, ms, attempts, error } = await fetchRetry(
                `${app}/api/hazards/check`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: "{}",
                },
                { retryOn429: false, retries: 0, timeoutMs: 45_000 }
              );
              if (!res) return { status: STATUS.FAIL, ms, attempts, verdict: `unreachable: ${error?.message ?? error}` };
              const { json, text } = await readBody(res);
              const pass = ok(res.status);
              return {
                status: pass ? STATUS.LIVE : STATUS.FAIL,
                ms,
                attempts,
                evidence: { status: res.status, district: json?.district ?? null, freshness: json?.freshness ?? null, body: clip(text, 160) },
                verdict: pass
                  ? `${res.status} — ${why}`
                  : `${res.status} — EXPECTED otherwise. ${label === "service_role" ? "CRITICAL: a service-role key was accepted as a farmer session." : ""}`,
              };
            }
          )
        );
      }
    }
  } finally {
    // ── teardown, always ──────────────────────────────────────────────────
    const client = A?.client ?? B?.client;
    let steps = [];
    if (client) {
      try {
        steps = await teardown(client, ids);
      } catch (e) {
        steps = [{ table: "-", ok: false, error: String(e?.message ?? e) }];
      }
    }
    // Anything the user's own client could not remove, remove as admin.
    const failed = steps.filter((s) => !s.ok);
    out.push(
      await runProbe(
        { id: "data.teardown", layer: "data", title: "Every created row and account is removed", expected: [STATUS.LIVE] },
        async () => ({
          status: failed.length === 0 ? STATUS.LIVE : STATUS.FAIL,
          ms: 0,
          evidence: { steps, ids },
          verdict:
            failed.length === 0
              ? `${steps.length} cleanup step(s), all clean — ${ids.userIds.length} account(s) and their rows removed`
              : `${failed.length} cleanup step(s) FAILED — see out/orphans.json and run with --reap`,
        })
      )
    );
  }

  return out;
}
