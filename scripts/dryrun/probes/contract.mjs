/**
 * Layer C — call our own routes and check the shape the mobile app relies on.
 *
 * Everything here is unauthenticated on purpose. That is not a limitation, it
 * is the safety property: /api/disease only persists a scan when a session is
 * present, so running it without a token guarantees no rows and no objects in
 * the private leaf-scans bucket. The guarantee is structural, not a promise.
 *
 * Five of these routes already report their own provenance — isRealData,
 * source, provider, configured, freshness — so the assertions are on what the
 * route says about itself rather than on a guess.
 */
import fs from "node:fs";
import path from "node:path";
import { STATUS, runProbe, classify429 } from "../lib/probe.mjs";
import { fetchRetry, readBody, clip, sleep } from "../lib/fetchx.mjs";
import { ROOT } from "../lib/env.mjs";

const ADDRESS = "Mysuru, Karnataka";

async function get(app, p, opts) {
  const { res, ms, attempts, error } = await fetchRetry(`${app}${p}`, {}, { retryOn429: false, ...opts });
  if (!res) return { down: true, ms, attempts, error };
  const { json, text } = await readBody(res);
  return { res, json, text, ms, attempts };
}

async function post(app, p, body, headers = {}, opts = {}) {
  const { res, ms, attempts, error } = await fetchRetry(
    `${app}${p}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    { retryOn429: false, timeoutMs: 60_000, ...opts }
  );
  if (!res) return { down: true, ms, attempts, error };
  const { json, text } = await readBody(res);
  return { res, json, text, ms, attempts };
}

const unreachable = (r) => ({
  status: STATUS.FAIL,
  ms: r.ms,
  attempts: r.attempts,
  verdict: `route unreachable: ${r.error?.message ?? r.error}`,
});

export async function contractProbes(app) {
  const out = [];

  // ── market: isRealData is the route's own honesty flag ───────────────────
  out.push(
    await runProbe(
      { id: "contract.market", layer: "contract", title: "/api/market serves real Agmarknet data", expected: [STATUS.LIVE] },
      async () => {
        const r = await get(app, `/api/market?address=${encodeURIComponent(ADDRESS)}`);
        if (r.down) return unreachable(r);
        const real = r.json?.isRealData;
        return {
          status: r.res.ok ? (real ? STATUS.LIVE : STATUS.FALLBACK) : STATUS.FAIL,
          ms: r.ms,
          attempts: r.attempts,
          evidence: {
            status: r.res.status,
            state: r.json?.state,
            isRealData: real,
            crops: r.json?.crops?.length,
            first: r.json?.crops?.[0],
          },
          verdict: `${r.res.status}; state=${r.json?.state}; isRealData=${real}; ${r.json?.crops?.length ?? 0} crops${
            real ? "" : " — SERVING ESTIMATES, the key or the resource failed"
          }`,
        };
      }
    )
  );

  out.push(
    await runProbe(
      { id: "contract.market.mandis", layer: "contract", title: "/api/market/mandis returns a mandi list", expected: [STATUS.LIVE] },
      async () => {
        const r = await get(app, `/api/market/mandis?address=${encodeURIComponent(ADDRESS)}&crop=Tomato`);
        if (r.down) return unreachable(r);
        const n = r.json?.mandis?.length ?? 0;
        return {
          status: r.res.ok && n > 0 ? STATUS.LIVE : r.res.ok ? STATUS.DEGRADED : STATUS.FAIL,
          ms: r.ms,
          attempts: r.attempts,
          evidence: { status: r.res.status, count: n, first: r.json?.mandis?.[0] },
          verdict: `${r.res.status}; ${n} mandi row(s)`,
        };
      }
    )
  );

  // ── news: which provider actually answered ───────────────────────────────
  out.push(
    await runProbe(
      {
        id: "contract.news",
        layer: "contract",
        title: "/api/news names the provider that answered",
        expected: [STATUS.LIVE, STATUS.FALLBACK],
      },
      async () => {
        const r = await post(app, "/api/news", { farmerCrops: ["Tomato", "Wheat"], state: "Karnataka" });
        if (r.down) return unreachable(r);
        const src = r.json?.source;
        const provider = r.json?.provider;
        return {
          status: !r.res.ok ? STATUS.FAIL : src === "live" ? STATUS.LIVE : src === "ai" ? STATUS.FALLBACK : STATUS.DEGRADED,
          ms: r.ms,
          attempts: r.attempts,
          evidence: { status: r.res.status, source: src, provider, articles: r.json?.articles?.length },
          verdict: `${r.res.status}; source=${src}; provider=${provider ?? "none"}; ${
            r.json?.articles?.length ?? 0
          } article(s)${src === "ai" ? " — Groq wrote these, no provider answered" : ""}`,
        };
      }
    )
  );

  // ── sensors: configured, and whose channel ───────────────────────────────
  out.push(
    await runProbe(
      { id: "contract.sensors", layer: "contract", title: "/api/sensors reports live metrics", expected: [STATUS.LIVE] },
      async () => {
        const r = await get(app, "/api/sensors");
        if (r.down) return unreachable(r);
        const metrics = r.json?.metrics ?? [];
        const live = metrics.filter((m) => m.configured && !m.placeholder);
        return {
          status: r.res.ok && r.json?.configured ? STATUS.LIVE : r.res.ok ? STATUS.ABSENT : STATUS.FAIL,
          ms: r.ms,
          attempts: r.attempts,
          evidence: {
            status: r.res.status,
            configured: r.json?.configured,
            updatedAt: r.json?.updatedAt,
            metrics: metrics.map((m) => ({ key: m.key, configured: m.configured, placeholder: m.placeholder, latest: m.latest })),
          },
          verdict: `${r.res.status}; configured=${r.json?.configured}; ${live.length}/${metrics.length} live metrics; updated ${r.json?.updatedAt}`,
        };
      }
    )
  );

  // ── geocode proxy (CSP blocks calling Nominatim from the client) ─────────
  out.push(
    await runProbe(
      { id: "contract.geocode", layer: "contract", title: "/api/geocode proxies Nominatim", expected: [STATUS.LIVE] },
      async () => {
        const r = await get(app, `/api/geocode?q=${encodeURIComponent("Mysuru")}`);
        if (r.down) return unreachable(r);
        const ok = r.res.ok && r.json?.lat != null;
        return {
          status: ok ? STATUS.LIVE : STATUS.FAIL,
          ms: r.ms,
          attempts: r.attempts,
          evidence: { status: r.res.status, ...r.json },
          verdict: ok ? `${r.res.status}; ${r.json.lat},${r.json.lng} ${r.json.district ?? ""} ${r.json.state ?? ""}` : `${r.res.status}; ${clip(r.text, 120)}`,
        };
      }
    )
  );

  // ── disease: the ground truth is in the filename ─────────────────────────
  const samples = [
    ["1-tomato-late-blight.jpg", false],
    ["5-not-a-leaf-forces-vision.png", true],
  ];
  for (const [file, forcesVision] of samples) {
    out.push(
      await runProbe(
        {
          id: `contract.disease.${file.split("-")[0]}`,
          layer: "contract",
          title: `/api/disease on ${file}`,
          expected: [STATUS.LIVE, STATUS.FALLBACK],
        },
        async () => {
          const full = path.join(ROOT, "ml", "test-samples", file);
          if (!fs.existsSync(full)) return { status: STATUS.SKIP, ms: 0, verdict: `fixture missing: ${file}` };
          const buf = fs.readFileSync(full);
          const form = new FormData();
          form.append(
            "image",
            new Blob([buf], { type: file.endsWith(".png") ? "image/png" : "image/jpeg" }),
            file
          );
          const { res, ms, attempts, error } = await fetchRetry(
            `${app}/api/disease`,
            { method: "POST", body: form },
            { retryOn429: false, timeoutMs: 90_000, retries: 0 }
          );
          if (!res) return { status: STATUS.FAIL, ms, attempts, verdict: `unreachable: ${error?.message ?? error}` };
          const { json, text } = await readBody(res);
          if (!res.ok) {
            return { status: STATUS.FAIL, ms, attempts, evidence: { status: res.status, body: clip(text, 300) }, verdict: `${res.status}: ${clip(text, 140)}` };
          }
          const src = json?.source;
          return {
            // The local CNN is not running, so "vision" is the correct,
            // documented fallback rather than a fault.
            status: src === "model" ? STATUS.LIVE : STATUS.FALLBACK,
            ms,
            attempts,
            evidence: {
              status: res.status,
              source: src,
              crop: json?.crop,
              disease: json?.disease,
              healthy: json?.healthy,
              confidence: json?.confidence,
              severity: json?.severity,
              hasTreatment: Boolean(json?.treatment?.organic?.length || json?.treatment?.chemical?.length),
            },
            verdict: `${res.status}; source=${src}; ${json?.crop ?? "?"} / ${json?.disease ?? (json?.healthy ? "healthy" : "?")} @ ${
              json?.confidence ?? "?"
            }${forcesVision && src !== "vision" ? " — expected the vision fallback here" : ""}`,
          };
        }
      )
    );
    await sleep(1000);
  }

  // ── chat + RAG, asserted over HTTP via the X-Rag-Sources header ──────────
  // The query in retrieve.ts's recorded ground truth ("cold storage") matches
  // ZERO chunks in the current 76-chunk corpus, so that benchmark is stale and
  // cannot be used as a baseline. "Kisan Credit Card" is a literal chunk title
  // and the keyword arm returns it in 4 rows, so it is genuinely covered.
  const ragCases = [
    ["covered", "what is the Kisan Credit Card and how do I apply", true],
    ["absent", "which tractor should I buy for 5 acres", false],
    ["offtopic", "who won the cricket match yesterday", false],
  ];
  for (const [label, q, wantSources] of ragCases) {
    out.push(
      await runProbe(
        {
          id: `contract.chat.rag.${label}`,
          layer: "contract",
          title: `/api/chat retrieval gate — ${label}`,
          expected: [STATUS.LIVE],
        },
        async () => {
          const { res, ms, attempts, error } = await fetchRetry(
            `${app}/api/chat`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messages: [{ role: "user", content: q }], locale: "en" }),
            },
            { retryOn429: false, timeoutMs: 90_000, retries: 0 }
          );
          if (!res) return { status: STATUS.FAIL, ms, attempts, verdict: `unreachable: ${error?.message ?? error}` };
          const text = await res.text().catch(() => "");
          if (res.status === 429) {
            const c = classify429(res, text);
            return { status: c.status, ms, attempts, verdict: `429 (${c.owner})` };
          }
          const header = res.headers.get("x-rag-sources");
          let sources = [];
          try {
            sources = header ? JSON.parse(Buffer.from(header, "base64").toString("utf8")) : [];
          } catch {
            /* leave empty */
          }
          const got = sources.length > 0;
          const matches = got === wantSources;
          return {
            status: res.ok && matches ? STATUS.LIVE : res.ok ? STATUS.DEGRADED : STATUS.FAIL,
            ms,
            attempts,
            evidence: {
              status: res.status,
              query: q,
              expectedSources: wantSources,
              sourceCount: sources.length,
              titles: sources.map((s) => s.title),
              replyHead: clip(text, 220),
            },
            verdict: `${res.status}; ${sources.length} citation(s) ${
              matches ? "as expected" : `— EXPECTED ${wantSources ? "≥1" : "0"}`
            }${sources.length ? `: ${sources.map((s) => s.title).join(", ")}` : ""}${
              !matches && wantSources
                ? ". Known cause: anon has no SELECT on knowledge_chunks, the match_* functions are SECURITY INVOKER, and Promise.allSettled swallows the permission error — so RAG is silently dead for every anonymous caller."
                : ""
            }`,
          };
        }
      )
    );
    await sleep(3000);
  }

  // ── authz: the routes that must refuse an anonymous caller ───────────────
  for (const [id, p, body] of [
    ["contract.authz.tts", "/api/tts", { text: "hello", locale: "en" }],
    ["contract.authz.hazards", "/api/hazards/check", {}],
    ["contract.authz.soil", "/api/soil-reading", undefined],
  ]) {
    out.push(
      await runProbe(
        { id, layer: "contract", title: `${p} refuses an anonymous caller`, expected: [STATUS.LIVE] },
        async () => {
          const r = await post(app, p, body);
          if (r.down) return unreachable(r);
          const ok = r.res.status === 401;
          return {
            status: ok ? STATUS.LIVE : STATUS.FAIL,
            ms: r.ms,
            attempts: r.attempts,
            evidence: { status: r.res.status, body: clip(r.text, 200) },
            verdict: ok ? "401 as required" : `expected 401, got ${r.res.status}: ${clip(r.text, 120)}`,
          };
        }
      )
    );
  }

  // ── service-role JWT must NOT be accepted as a user token ────────────────
  out.push(
    await runProbe(
      {
        id: "contract.authz.service_role_refused",
        layer: "contract",
        title: "A service-role JWT is refused as a bearer",
        expected: [STATUS.LIVE],
      },
      async () => {
        const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!svc) return { status: STATUS.SKIP, ms: 0, verdict: "no service-role key to test with" };
        const r = await post(app, "/api/hazards/check", {}, { Authorization: `Bearer ${svc}` });
        if (r.down) return unreachable(r);
        const ok = r.res.status === 401;
        return {
          status: ok ? STATUS.LIVE : STATUS.FAIL,
          ms: r.ms,
          attempts: r.attempts,
          evidence: { status: r.res.status, body: clip(r.text, 200) },
          verdict: ok
            ? "401 — isUserToken() correctly rejects role=service_role"
            : `CRITICAL: got ${r.res.status}, a service-role key was accepted as a farmer session`,
        };
      }
    )
  );

  // ── corpus health via a no-op reindex (costs zero embeddings) ────────────
  out.push(
    await runProbe(
      { id: "contract.reindex", layer: "contract", title: "Knowledge corpus is indexed and current", expected: [STATUS.LIVE] },
      async () => {
        const secret = process.env.CRON_SECRET;
        if (!secret) return { status: STATUS.ABSENT, ms: 0, verdict: "CRON_SECRET not set" };
        const bad = await post(app, "/api/admin/reindex", undefined, { Authorization: "Bearer wrong-secret" });
        if (bad.down) return unreachable(bad);
        if (bad.res.status !== 401) {
          return {
            status: STATUS.FAIL,
            ms: bad.ms,
            evidence: { status: bad.res.status },
            verdict: `a wrong CRON_SECRET returned ${bad.res.status}, expected 401`,
          };
        }
        const r = await post(app, "/api/admin/reindex", undefined, { Authorization: `Bearer ${secret}` }, { timeoutMs: 150_000 });
        if (r.down) return unreachable(r);
        return {
          status: r.res.ok ? STATUS.LIVE : STATUS.FAIL,
          ms: r.ms,
          attempts: r.attempts,
          evidence: { status: r.res.status, ...(r.json ?? { body: clip(r.text, 300) }) },
          verdict: r.res.ok
            ? `${r.res.status}; ${r.json?.total} chunks (${JSON.stringify(r.json?.bySource ?? {})}); stale=${
                r.json?.stale ?? 0
              }, embedded=${r.json?.embedded ?? 0}, failed=${r.json?.failed ?? 0}`
            : `${r.res.status}: ${clip(r.text, 140)}`,
        };
      }
    )
  );

  // ── the limiter, proved end to end for free ──────────────────────────────
  // checkRateLimit runs BEFORE getSessionFarmer and before formData(), so a
  // body-less POST costs nothing upstream: 1-10 are 401, the 11th is 429.
  // Deliberately last — it leaves this IP's bucket spent for up to a minute.
  out.push(
    await runProbe(
      { id: "contract.ratelimit", layer: "contract", title: "The rate limiter actually fires", expected: [STATUS.LIVE] },
      async () => {
        const codes = [];
        for (let i = 0; i < 12; i++) {
          const r = await post(app, "/api/soil-reading", undefined);
          if (r.down) return unreachable(r);
          codes.push(r.res.status);
          if (r.res.status === 429) {
            return {
              status: STATUS.LIVE,
              ms: r.ms,
              evidence: { codes, retryAfter: r.res.headers.get("retry-after"), body: clip(r.text, 160) },
              verdict: `429 on request ${i + 1} (limit is 10/min); Retry-After=${r.res.headers.get("retry-after")}`,
            };
          }
        }
        return {
          status: STATUS.FAIL,
          ms: 0,
          evidence: { codes },
          verdict: `12 requests and no 429 — the limiter did not fire (codes: ${codes.join(",")})`,
        };
      }
    )
  );

  return out;
}
