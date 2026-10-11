/**
 * Throwaway farmer accounts, created and destroyed against the live project.
 *
 * There is no staging environment, so this is the one part of the harness that
 * writes to production data. Four things make that defensible:
 *
 *   1. Accounts are created with the Admin API, not signUp. That does not
 *      depend on the project's `mailer_autoconfirm` setting, so the harness
 *      never risks flipping a live auth config as a side effect — and deletion
 *      is the exact inverse call of creation.
 *   2. Every created id is appended to out/orphans.json BEFORE any assertion
 *      runs. A `process.on("exit")` handler cannot await, so teardown can never
 *      be truly guaranteed in-process; a machine-readable list that survives
 *      kill -9 plus `--reap` is the honest version of that guarantee.
 *   3. Teardown deletes by captured id only. Nothing here can express "delete
 *      where farmer_id is something else".
 *   4. A sweeper runs first, clearing anything a previous crashed run left.
 *
 * The session used for the actual assertions is obtained the way the app does
 * it — signInWithPassword with the anon key — because the RLS behaviour of a
 * genuine user JWT is the thing under test.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { OUT_DIR } from "./report.mjs";

const ORPHANS = path.join(OUT_DIR, "orphans.json");

/** Unmistakably a test account, and it passes EMAIL_RE in src/lib/validation.ts. */
export function testEmail(runId, suffix = "") {
  return `dryrun+${runId}${suffix}@example.com`;
}

const PASSWORD = "dryrun-" + crypto.randomBytes(9).toString("hex");

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key };
}

function recordOrphan(entry) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let list = [];
  try {
    list = JSON.parse(fs.readFileSync(ORPHANS, "utf8"));
  } catch {
    /* first write */
  }
  list.push({ ...entry, at: new Date().toISOString() });
  fs.writeFileSync(ORPHANS, JSON.stringify(list, null, 2), "utf8");
}

function clearOrphan(userId) {
  try {
    const list = JSON.parse(fs.readFileSync(ORPHANS, "utf8")).filter((e) => e.userId !== userId);
    fs.writeFileSync(ORPHANS, JSON.stringify(list, null, 2), "utf8");
  } catch {
    /* nothing to clear */
  }
}

/** POST /auth/v1/admin/users — email_confirm bypasses the mailer entirely. */
export async function createUser(email) {
  const a = admin();
  if (!a) throw new Error("no service-role key");
  const res = await fetch(`${a.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: a.key, Authorization: `Bearer ${a.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`admin createUser ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  recordOrphan({ userId: json.id, email });
  return { id: json.id, email, password: PASSWORD };
}

export async function deleteUser(userId) {
  const a = admin();
  if (!a) return false;
  const res = await fetch(`${a.url}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: { apikey: a.key, Authorization: `Bearer ${a.key}` },
  });
  if (res.ok) clearOrphan(userId);
  return res.ok;
}

/** A real user session, exactly as the mobile app obtains one. */
export async function signIn(email, password) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn failed: ${error.message}`);
  return { client, session: data.session, token: data.session?.access_token };
}

/**
 * Everything a test farmer needs to exercise the write path: a profile and one
 * farm, created through the user's own RLS-scoped client, mirroring
 * src/lib/onboarding.ts in the mobile app.
 */
export async function seedFarmer(client, userId, label) {
  const { data: profile, error: pErr } = await client
    .from("farmer_profiles")
    .insert({
      owner_id: userId,
      name: `ZZ Dry Run ${label}`,
      phone: "9000000000",
      house_address: "Mysuru, Karnataka",
    })
    .select("id")
    .single();
  if (pErr) throw new Error(`profile insert failed: ${pErr.message}`);

  const { data: farm, error: fErr } = await client
    .from("farms")
    .insert({ farmer_id: profile.id, farm_index: 1, area: 1.5, soil_type: "Loamy", irrigation: "Drip" })
    .select("id")
    .single();
  if (fErr) throw new Error(`farm insert failed: ${fErr.message}`);

  recordOrphan({ userId, profileId: profile.id, farmId: farm.id });
  return { profileId: profile.id, farmId: farm.id };
}

/**
 * Deletes by captured id only. Child rows first so foreign keys never block,
 * and each step reports whether it succeeded so a failed cleanup is visible in
 * the report rather than silent.
 */
export async function teardown(client, ids) {
  const steps = [];
  const del = async (table, column, value) => {
    if (!value) return;
    const { error, count } = await client.from(table).delete({ count: "exact" }).eq(column, value);
    steps.push({ table, column, value, ok: !error, removed: count ?? null, error: error?.message ?? null });
  };

  for (const p of ids.profileIds ?? []) {
    await del("soil_readings", "farmer_id", p);
    await del("farm_tasks", "farmer_id", p);
    await del("farm_expenses", "farmer_id", p);
    await del("chat_messages", "farmer_id", p);
    await del("crop_cycles", "farm_id", ids.farmByProfile?.[p]);
    await del("farms", "farmer_id", p);
    await del("farmer_profiles", "id", p);
  }
  for (const u of ids.userIds ?? []) {
    const ok = await deleteUser(u);
    steps.push({ table: "auth.users", column: "id", value: u, ok, removed: ok ? 1 : 0, error: null });
  }
  return steps;
}

/** Clears accounts a previous crashed run left behind. Safe to run always. */
export async function sweep() {
  let list = [];
  try {
    list = JSON.parse(fs.readFileSync(ORPHANS, "utf8"));
  } catch {
    return { swept: 0, remaining: 0 };
  }
  let swept = 0;
  for (const e of [...list]) {
    if (!e.userId) continue;
    if (await deleteUser(e.userId)) swept++;
  }
  let remaining = 0;
  try {
    remaining = JSON.parse(fs.readFileSync(ORPHANS, "utf8")).length;
  } catch {
    /* file gone */
  }
  return { swept, remaining };
}

export { ORPHANS };
