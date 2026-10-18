/**
 * Layer U — talk to each third party directly, with the key from .env.local.
 *
 * Needs nothing running. Answers one question per integration: is the outside
 * world reachable and is our key good? Paired with the contract probes it
 * localises a fault without a debugger — U green + C red is our code, both red
 * is upstream, U red + C fallback means the degradation worked as designed.
 */
import { STATUS, runProbe, classify429 } from "../lib/probe.mjs";
import { fetchRetry, readBody, clip, sleep } from "../lib/fetchx.mjs";

/** The channel hardcoded in src/app/api/sensors/route.ts as a shared demo rig. */
const DEMO_CHANNEL_ID = "3469748";

async function probeJson({ url, init, ok = (r) => r.ok, describe }) {
  const { res, ms, attempts, error, tls } = await fetchRetry(url, init, { retryOn429: false });
  if (!res) {
    return {
      status: STATUS.FAIL,
      ms,
      attempts,
      evidence: { error: String(error?.message ?? error), tlsFailures: tls },
      verdict: `unreachable after ${attempts} attempt(s): ${error?.message ?? error}`,
    };
  }
  const { json, text } = await readBody(res);
  if (res.status === 429) {
    const c = classify429(res, text);
    return {
      status: c.status,
      ms,
      attempts,
      evidence: { status: 429, owner: c.owner, retryAfter: c.retryAfter, body: clip(text, 300) },
      verdict: `429 from ${c.owner}${c.retryAfter ? ` (retry after ${c.retryAfter}s)` : ""} — quota, not a key failure`,
    };
  }
  return { res, json, text, ms, attempts, tls, ok: ok(res) };
}

export async function upstreamProbes() {
  const out = [];
  const env = process.env;

  // ── Open-Meteo — keyless, and the app's only weather source ──────────────
  out.push(
    await runProbe(
      { id: "upstream.openmeteo", layer: "upstream", title: "Open-Meteo forecast", expected: [STATUS.LIVE] },
      async () => {
        const r = await probeJson({
          url: "https://api.open-meteo.com/v1/forecast?latitude=12.30&longitude=76.65&current=temperature_2m&daily=precipitation_probability_max&timezone=auto",
        });
        if (r.status) return r;
        const t = r.json?.current?.temperature_2m;
        return {
          status: r.ok && t !== undefined ? STATUS.LIVE : STATUS.FAIL,
          ms: r.ms,
          attempts: r.attempts,
          evidence: { status: r.res.status, current: r.json?.current, days: r.json?.daily?.time?.length },
          verdict: `${r.res.status}; Mysuru ${t}°C; ${r.json?.daily?.time?.length ?? 0} forecast days`,
        };
      }
    )
  );

  // ── Open-Meteo agronomy fields — what the irrigation engine computes on ──
  //
  // Separate from the forecast probe above on purpose. These two parameters
  // are the entire reason a FAO-56 water balance is possible without a paid
  // service, and they are easy to lose silently: Open-Meteo would still return
  // 200 with the rest of the forecast intact if either were renamed or
  // withdrawn, and the engine would quietly fall to ET0 = 0 — producing "no
  // watering needed", for ever, on every farm. A failure here must be loud.
  out.push(
    await runProbe(
      {
        id: "upstream.openmeteo.agronomy",
        layer: "upstream",
        title: "Open-Meteo ET₀ + rainfall (irrigation engine)",
        expected: [STATUS.LIVE],
      },
      async () => {
        const r = await probeJson({
          url:
            "https://api.open-meteo.com/v1/forecast?latitude=12.30&longitude=76.65" +
            "&daily=precipitation_sum,et0_fao_evapotranspiration&timezone=auto&forecast_days=7",
        });
        if (r.status) return r;
        const et0 = r.json?.daily?.et0_fao_evapotranspiration;
        const rain = r.json?.daily?.precipitation_sum;
        const et0Ok = Array.isArray(et0) && et0.length > 0 && et0.every((v) => typeof v === "number");
        const rainOk = Array.isArray(rain) && rain.length > 0;
        const missing = [!et0Ok && "et0_fao_evapotranspiration", !rainOk && "precipitation_sum"].filter(Boolean);
        return {
          status: r.ok && et0Ok && rainOk ? STATUS.LIVE : STATUS.FAIL,
          ms: r.ms,
          attempts: r.attempts,
          evidence: {
            status: r.res.status,
            days: r.json?.daily?.time?.length,
            et0Today: Array.isArray(et0) ? et0[0] : null,
            et0Units: r.json?.daily_units?.et0_fao_evapotranspiration,
            rainToday: Array.isArray(rain) ? rain[0] : null,
            missing,
          },
          verdict: missing.length
            ? `${r.res.status} but missing ${missing.join(" + ")} — the water balance cannot run`
            : `${r.res.status}; ET₀ today ${Array.isArray(et0) ? et0[0] : "?"} ${r.json?.daily_units?.et0_fao_evapotranspiration ?? "mm"}; rain ${Array.isArray(rain) ? rain[0] : "?"} mm; ${r.json?.daily?.time?.length ?? 0} days`,
        };
      }
    )
  );

  // ── NVIDIA Riva Translate — the Hindi half of the irrigation page ────────
  //
  // Checks the one thing about this endpoint that fails silently. The language
  // pair is passed as a system-message tag (`en-hi`), and when the model does
  // not recognise it the request still returns 200 with a confident-looking
  // translation into the wrong language — `en-hi-in` returns Danish, and a
  // plain-prose instruction returns Danish too. Nothing downstream can detect
  // that: `translate.ts` would cache it and the page would render Danish under
  // a Hindi UI.
  //
  // So the assertion is on the script of the reply, not merely on the status
  // code: Devanagari present, and the English not echoed back unchanged.
  out.push(
    await runProbe(
      {
        id: "upstream.nvidia.translate",
        layer: "upstream",
        title: "NVIDIA Riva Translate (en→hi)",
        expected: [STATUS.LIVE, STATUS.SKIP],
      },
      async () => {
        if (!env.NVIDIA_API_KEY) {
          return {
            status: STATUS.SKIP,
            evidence: { NVIDIA_API_KEY: "unset" },
            verdict:
              "NVIDIA_API_KEY unset — the irrigation engine's prose stays English in every locale, which is the documented fallback",
          };
        }

        const source = "Irrigate today";
        const r = await probeJson({
          url: "https://integrate.api.nvidia.com/v1/chat/completions",
          init: {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: env.NVIDIA_TRANSLATE_MODEL || "nvidia/riva-translate-4b-instruct-v2",
              messages: [
                { role: "system", content: "en-hi" },
                { role: "user", content: source },
              ],
              temperature: 0,
              max_tokens: 128,
            }),
          },
        });
        if (r.status) return r;

        const text = r.json?.choices?.[0]?.message?.content?.trim() ?? "";
        const devanagari = /[ऀ-ॿ]/.test(text);
        const echoed = text.toLowerCase() === source.toLowerCase();

        return {
          status: r.ok && devanagari && !echoed ? STATUS.LIVE : STATUS.FAIL,
          ms: r.ms,
          attempts: r.attempts,
          evidence: {
            status: r.res.status,
            model: r.json?.model,
            source,
            translated: text,
            devanagari,
            echoed,
          },
          verdict: !r.ok
            ? `${r.res.status}; translation unavailable`
            : echoed
              ? `${r.res.status} but the English came back unchanged — the en-hi tag was not applied`
              : !devanagari
                ? `${r.res.status} but the reply is not Devanagari ("${text}") — wrong target language`
                : `${r.res.status}; "${source}" → "${text}"`,
        };
      }
    )
  );

  // ── Nominatim — 1 req/s policy, real User-Agent required ─────────────────
  await sleep(1100);
  out.push(
    await runProbe(
      { id: "upstream.nominatim", layer: "upstream", title: "Nominatim geocode", expected: [STATUS.LIVE] },
      async () => {
        const r = await probeJson({
          url: "https://nominatim.openstreetmap.org/search?q=Mysuru%2C%20Karnataka&format=json&limit=1",
          init: { headers: { "User-Agent": "AgentFarmer-DryRun/1.0 (verification harness)" } },
        });
        if (r.status) return r;
        const hit = r.json?.[0];
        return {
          status: r.ok && hit ? STATUS.LIVE : STATUS.FAIL,
          ms: r.ms,
          attempts: r.attempts,
          evidence: { status: r.res.status, display_name: hit?.display_name, lat: hit?.lat, lon: hit?.lon },
          verdict: hit ? `${r.res.status}; resolved to ${hit.lat},${hit.lon}` : `${r.res.status}; no result`,
        };
      }
    )
  );

  // ── SACHET CAP feed — the hazard source, no key ──────────────────────────
  out.push(
    await runProbe(
      {
        id: "upstream.sachet",
        layer: "upstream",
        title: "NDMA SACHET CAP feed",
        // The GitHub workflow treats a 502 here as success: this feed is
        // genuinely flaky and that is upstream, not us.
        expected: [STATUS.LIVE, STATUS.FALLBACK],
      },
      async () => {
        const { res, ms, attempts, error } = await fetchRetry(
          "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml",
          { headers: { "User-Agent": "AgentFarmer-DryRun/1.0" } },
          { retries: 1, timeoutMs: 20_000 }
        );
        if (!res) {
          return {
            status: STATUS.FALLBACK,
            ms,
            attempts,
            evidence: { error: String(error?.message ?? error) },
            verdict: `unreachable — known-flaky upstream; hazards fall back to cached events`,
          };
        }
        const text = await res.text().catch(() => "");
        const items = (text.match(/<item>/g) ?? []).length;
        return {
          status: res.ok && items > 0 ? STATUS.LIVE : STATUS.FALLBACK,
          ms,
          attempts,
          evidence: { status: res.status, bytes: text.length, items },
          verdict: `${res.status}; ${items} CAP item(s), ${text.length} bytes`,
        };
      }
    )
  );

  // ── ThingSpeak — and the demo-channel discriminator ──────────────────────
  out.push(
    await runProbe(
      {
        id: "upstream.thingspeak",
        layer: "upstream",
        title: "ThingSpeak channel is ours, not the shared demo rig",
        expected: [STATUS.LIVE],
      },
      async () => {
        const id = env.THINGSPEAK_CHANNEL_A_ID;
        const key = env.THINGSPEAK_CHANNEL_A_READ_KEY;
        if (!id) return { status: STATUS.ABSENT, verdict: "THINGSPEAK_CHANNEL_A_ID not set — route uses the shared demo channel" };
        const isDemo = id === DEMO_CHANNEL_ID;
        const url = `https://api.thingspeak.com/channels/${id}/feeds.json?results=1${key ? `&api_key=${key}` : ""}`;
        const r = await probeJson({ url });
        if (r.status) return r;
        const feed = r.json?.feeds?.[0];
        const evidence = {
          status: r.res.status,
          channelId: id,
          isSharedDemoChannel: isDemo,
          lastEntryAt: feed?.created_at ?? null,
          name: r.json?.channel?.name,
        };
        if (!r.ok || !feed) {
          return { status: STATUS.FAIL, ms: r.ms, attempts: r.attempts, evidence, verdict: `${r.res.status}; no feed entries` };
        }
        const ageMin = Math.round((Date.now() - Date.parse(feed.created_at)) / 60000);
        return {
          status: isDemo ? STATUS.FALLBACK : STATUS.LIVE,
          ms: r.ms,
          attempts: r.attempts,
          evidence: { ...evidence, ageMinutes: ageMin },
          verdict: isDemo
            ? `configured channel IS the hardcoded demo rig ${DEMO_CHANNEL_ID} — reporting this as "configured" would be a lie`
            : `channel ${id} ("${r.json?.channel?.name}") last wrote ${ageMin} min ago`,
        };
      }
    )
  );

  // ── Agmarknet via data.gov.in ────────────────────────────────────────────
  out.push(
    await runProbe(
      { id: "upstream.datagov.agmarknet", layer: "upstream", title: "Agmarknet mandi prices", expected: [STATUS.LIVE] },
      async () => {
        const key = env.DATA_GOV_API_KEY;
        if (!key) return { status: STATUS.ABSENT, verdict: "DATA_GOV_API_KEY not set — market falls back to estimates" };
        const url = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${key}&format=json&limit=5&filters%5Bstate%5D=Karnataka`;
        const r = await probeJson({ url });
        if (r.status) return r;
        const n = r.json?.records?.length ?? 0;
        const total = r.json?.total ?? null;
        return {
          status: r.ok && n > 0 ? STATUS.LIVE : STATUS.DEGRADED,
          ms: r.ms,
          attempts: r.attempts,
          evidence: { status: r.res.status, returned: n, total, sample: r.json?.records?.[0] ?? null },
          verdict: `${r.res.status}; ${n} record(s) returned, ${total} total for Karnataka`,
        };
      }
    )
  );

  // ── News providers — separate "bad key" from "quota spent" ───────────────
  out.push(
    await runProbe(
      { id: "upstream.gnews", layer: "upstream", title: "GNews.io (the production news provider)", expected: [STATUS.LIVE] },
      async () => {
        const key = env.GNEWS_API_KEY;
        if (!key) return { status: STATUS.ABSENT, verdict: "GNEWS_API_KEY not set" };
        // A placeholder left in .env.local is not the same fault as a revoked
        // key, and saying "400" would hide which one it is.
        if (/paste|your|here|xxx|placeholder|change_?me/i.test(key)) {
          return {
            status: STATUS.ABSENT,
            ms: 0,
            evidence: { keyLength: key.length, looksLikePlaceholder: true },
            verdict: `GNEWS_API_KEY is still a placeholder (${key.length} chars, matches PASTE/YOUR/HERE) — never configured locally, so the local news feed has only ever exercised the NewsAPI fallback`,
          };
        }
        const r = await probeJson({
          url: `https://gnews.io/api/v4/search?q=agriculture%20India&lang=en&max=3&apikey=${key}`,
        });
        if (r.status) return r;
        if (r.res.status === 401 || r.res.status === 403 || r.res.status === 400) {
          return {
            status: STATUS.FAIL,
            ms: r.ms,
            attempts: r.attempts,
            evidence: { status: r.res.status, body: clip(r.text.replace(key, "<KEY>"), 300) },
            verdict: `${r.res.status} — the key is rejected, not a quota problem: ${clip(
              r.text.replace(key, "<KEY>"),
              120
            )}`,
          };
        }
        const n = r.json?.articles?.length ?? 0;
        return {
          status: r.ok && n > 0 ? STATUS.LIVE : STATUS.DEGRADED,
          ms: r.ms,
          attempts: r.attempts,
          evidence: { status: r.res.status, articles: n, totalArticles: r.json?.totalArticles, first: r.json?.articles?.[0]?.title },
          verdict: `${r.res.status}; ${n} article(s); first: ${clip(r.json?.articles?.[0]?.title ?? "—", 80)}`,
        };
      }
    )
  );

  out.push(
    await runProbe(
      {
        id: "upstream.newsapi",
        layer: "upstream",
        title: "NewsAPI.org (free tier is localhost-only by design)",
        expected: [STATUS.LIVE, STATUS.FALLBACK],
      },
      async () => {
        const key = env.NEWS_API_KEY;
        if (!key) return { status: STATUS.ABSENT, verdict: "NEWS_API_KEY not set" };
        const r = await probeJson({
          url: `https://newsapi.org/v2/everything?q=agriculture%20India&pageSize=3&apiKey=${key}`,
          init: { headers: { "User-Agent": "AgentFarmer-DryRun/1.0" } },
        });
        if (r.status) return r;
        const n = r.json?.articles?.length ?? 0;
        return {
          status: r.ok && n > 0 ? STATUS.LIVE : STATUS.FALLBACK,
          ms: r.ms,
          attempts: r.attempts,
          evidence: { status: r.res.status, code: r.json?.code, articles: n, message: clip(r.json?.message, 200) },
          verdict: r.ok ? `${r.res.status}; ${n} article(s)` : `${r.res.status} ${r.json?.code ?? ""} — secondary provider, GNews is production`,
        };
      }
    )
  );

  // ── Supabase REST + the embedding edge function ──────────────────────────
  out.push(
    await runProbe(
      { id: "upstream.supabase.rest", layer: "upstream", title: "Supabase PostgREST reachable", expected: [STATUS.LIVE] },
      async () => {
        const url = env.NEXT_PUBLIC_SUPABASE_URL;
        const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !anon) return { status: STATUS.ABSENT, verdict: "Supabase URL/anon key not set" };
        const r = await probeJson({ url: `${url}/rest/v1/`, init: { headers: { apikey: anon } } });
        if (r.status) return r;
        return {
          status: r.res.status < 500 ? STATUS.LIVE : STATUS.FAIL,
          ms: r.ms,
          attempts: r.attempts,
          evidence: { status: r.res.status, host: new URL(url).host },
          verdict: `${r.res.status} from ${new URL(url).host}`,
        };
      }
    )
  );

  out.push(
    await runProbe(
      {
        id: "upstream.supabase.embed",
        layer: "upstream",
        title: "gte-small edge function returns 384 unit-norm dims",
        expected: [STATUS.LIVE],
      },
      async () => {
        const url = env.NEXT_PUBLIC_SUPABASE_URL;
        const svc = env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !svc) return { status: STATUS.ABSENT, verdict: "Supabase URL / service-role key not set" };
        const r = await probeJson({
          url: `${url}/functions/v1/embed`,
          init: {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${svc}` },
            body: JSON.stringify({ texts: ["cold storage subsidy for farmers"] }),
          },
        });
        if (r.status) return r;
        const v = r.json?.embeddings?.[0];
        if (!Array.isArray(v)) {
          return {
            status: STATUS.FAIL,
            ms: r.ms,
            attempts: r.attempts,
            evidence: { status: r.res.status, body: clip(r.text, 300) },
            verdict: `${r.res.status}; no embedding array returned`,
          };
        }
        const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
        const okDims = v.length === 384;
        const okNorm = Math.abs(norm - 1) < 1e-3;
        return {
          status: okDims && okNorm ? STATUS.LIVE : STATUS.DEGRADED,
          ms: r.ms,
          attempts: r.attempts,
          evidence: { status: r.res.status, dims: v.length, l2Norm: Number(norm.toFixed(6)), model: r.json?.model },
          verdict: `${r.res.status}; ${v.length} dims, L2 norm ${norm.toFixed(6)}${okDims && okNorm ? "" : " — EXPECTED 384 @ 1.0"}`,
        };
      }
    )
  );

  // ── The local inference server. Absent is a documented, correct state. ───
  out.push(
    await runProbe(
      {
        id: "upstream.mlserver",
        layer: "upstream",
        title: "Local FastAPI inference server (disease CNN + MMS-TTS)",
        expected: [STATUS.LIVE, STATUS.ABSENT],
      },
      async () => {
        const base = env.INFERENCE_URL?.replace(/\/+$/, "") || "http://127.0.0.1:8008";
        const { res, ms, attempts, error } = await fetchRetry(`${base}/health`, {}, { retries: 0, timeoutMs: 3000 });
        if (!res) {
          return {
            status: STATUS.ABSENT,
            ms,
            attempts,
            evidence: { base, error: String(error?.message ?? error) },
            verdict: `not running at ${base} — /api/tts will 503 and /api/disease will use Groq vision. Documented, correct degradation.`,
          };
        }
        const { json } = await readBody(res);
        return {
          status: STATUS.LIVE,
          ms,
          attempts,
          evidence: { base, ...json },
          verdict: `up at ${base}; model_present=${json?.model_present}; device=${json?.device}; tts=${(json?.tts_languages ?? []).length} langs`,
        };
      }
    )
  );

  // ── Things that are absent on purpose. Assert, don't call. ───────────────
  for (const [id, key, effect] of [
    ["upstream.places", "GOOGLE_MAPS_API_KEY", "store locator falls through to keyless Overpass"],
    ["upstream.resend", "RESEND_API_KEY", "/api/feedback returns 503 'not configured'"],
  ]) {
    out.push(
      await runProbe(
        { id, layer: "upstream", title: `${key} configuration`, expected: [STATUS.ABSENT, STATUS.LIVE] },
        async () => ({
          status: env[key] ? STATUS.LIVE : STATUS.ABSENT,
          ms: 0,
          evidence: { key, set: Boolean(env[key]) },
          verdict: env[key] ? `${key} is set` : `${key} not set — ${effect}. No request made.`,
        })
      )
    );
  }

  return out;
}
