# Agent Farmer — Native Mobile App Roadmap

*The plan for turning Agent Farmer into a real Android/iOS app. Companion to `docs/DEVELOPER_REPORT.md`, which this roadmap assumes you've read.*

**Repo location:** the mobile app lives at `E:\My projects\agent-farmer-mobile` — a **separate project with its own git repository**, sibling to this one, not a subfolder of it. No shared `node_modules`, no shared git history, nothing that touches this repo's commits or Vercel builds. It talks to the same Supabase project as this web app (same URL/anon key), which is the only thing the two codebases share.

## Why native, and what it costs

Agent Farmer's users are Indian farmers — mobile-first, often on patchy connectivity, and better served by an installable app (offline tolerance, camera/mic access, push notifications) than a mobile browser tab. That's the case for going native over further web polish.

The honest cost: this is a **from-scratch build**, not a wrapper. There is currently zero mobile scaffolding in the repo (no React Native, Expo, Capacitor, or even a PWA manifest — confirmed by direct search). Roughly 60–70% of the *backend* is directly reusable (see §2); the UI is a full rebuild across 9 dashboard screens plus auth/onboarding, and three subsystems (voice, disease-photo capture, maps) need native module replacements because they're built on browser-only APIs.

## 1. Stack decision: Expo (React Native) + Expo Router

- **Why Expo over bare React Native:** camera, image picker, secure storage, speech, and maps are all available as maintained Expo modules — no native build toolchain required until you actually need it (EAS Build handles that later), which matters for iterating fast without Xcode/Android Studio friction.
- **Why not Capacitor (wrap the existing web app):** it would inherit every browser-only limitation this report documents (Web Speech API, `<input type=file>`, Leaflet) instead of solving them, and farmers on low-end Android devices are exactly the audience where a wrapped web view performs worst.
- **Compatibility:** the web app runs React 18 + TypeScript 5, both compatible with current Expo SDK generations — type-only modules from `src/lib` (e.g. `DiseaseResult`, `FarmerProfile`, `WeatherData`) can be shared or copied into the mobile project without translation.

## 2. What ports directly vs. what needs new work

| Layer | Status | Detail |
|---|---|---|
| **Auth** | Direct port | Supabase Auth email/password works identically from `@supabase/supabase-js` in React Native — swap the `@supabase/ssr` cookie adapter for `AsyncStorage`. (Built with AsyncStorage, not `expo-secure-store` — a Supabase session object routinely exceeds SecureStore's 2048-byte per-item limit, so AsyncStorage is Supabase's own documented pattern for React Native.) Same Supabase project, same accounts. |
| **RLS-scoped CRUD** (farms, crop_cycles, expenses, tasks, notifications, settings) | Direct port | The web app already writes these directly from the browser client (`supabase.from(...).insert(...)`), relying on Postgres RLS for authorization — a mobile client's own session does the same, no Next.js involvement needed either way. |
| **Weather** (Open-Meteo) | Direct port | Keyless public API, callable straight from the mobile app. |
| **`/api/chat`, `/api/crop-guide`, `/api/market-advice`, `/api/recommendations`, `/api/scheme-match`, `/api/disease`, `/api/feedback`** | Direct port | Plain JSON/multipart REST endpoints, session-optional or unauthenticated — callable from mobile `fetch` as-is. |
| **`/api/transcribe`, `/api/tts`, `/api/soil-reading`** | ✅ done 2026-09-01 | These called `getSessionFarmer()`, which read the session *only* from cookies (`next/headers`). Rather than thread a request through the ~10 call sites of `createSupabaseServer()`, the fix went into the client factory itself (`src/lib/supabase-server.ts`): `bearerToken()` reads the header via `next/headers`, and when one is present it is forwarded to PostgREST/Storage so owner-scoped RLS resolves to that farmer. `getSessionUser()` verifies it with `supabase.auth.getUser(token)`. Every route and every downstream read inherited this with no call-site change, including the rate limiter's per-farmer bucketing. |
| **Dashboard read layer** (`getDashboardData`, `getMarket`, `getWeather`, `computeFarmHealth`, `deriveAlerts`, task generation) | **Needs new API routes** | These currently run only inside React Server Components, not over HTTP, and several touch server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `DATA_GOV_API_KEY`). Wrap each in a thin `/api/*` route the mobile app can call — do not duplicate this logic client-side. |
| **Voice input/output** | **Native replacement required** | `window.speechSynthesis`, `SpeechRecognition`, and `MediaRecorder` don't exist in React Native. Replace with `expo-speech` (TTS) and either a native STT module or the same record-then-POST-to-`/api/transcribe` pattern using `expo-av`/`expo-audio` for recording. |
| **Disease-photo capture** | **Native replacement required** | The web version uses `<input type=file>` + HTML5 drag-drop. Swap for `expo-image-picker` (camera/gallery); the upload contract itself (`FormData` POST to `/api/disease`) is unchanged. |
| **Maps** (store locator, onboarding location picker) | **Native replacement required** | Leaflet has no RN equivalent. Built with `@maplibre/maplibre-react-native` (not `react-native-maps`): OpenFreeMap's Liberty style needs no API key, so nothing has to ship in the bundle. |
| **Charts** (Recharts) | **Native replacement required** | No direct RN port — built instead as a small hand-drawn `react-native-svg` area chart (`src/components/ui/Sparkline.tsx` in the mobile repo) reusing the web palette's hues — the app needs one line and a fill, not an axis/legend system. |

## 3. Phases

### Phase 0 — Scaffold ✅ done, verified 2026-08-19
Expo app (TypeScript + Expo Router) at `E:\My projects\agent-farmer-mobile` (its own repo — see "Repo location" above), Supabase client wired with `AsyncStorage` session persistence against the **same Supabase project**, a working sign-in/sign-up screen, and one authenticated home screen rendering real farm + weather data. Verified end-to-end in a real browser: signed up a live test account against Supabase Auth, confirmed session persistence across reload, saw the honest empty state for an account with no farm profile, then confirmed real farm/crop data and live Open-Meteo weather render correctly once a farm exists (test rows inserted and cleaned up via `scripts/db-exec.mjs` for the check). One bug found and fixed along the way: Expo's static web output pre-renders in a Node SSR pass with no `window`, which crashed the Supabase client's AsyncStorage-backed auth adapter — fixed with an SSR-safe storage guard in `src/lib/supabase.ts` (native builds never hit this, since there's no SSR step there).

### Phase 1 — Backend readiness
- ~~Patch `/api/transcribe` and `/api/tts` to accept `Authorization: Bearer <token>`~~ — **done 2026-09-01**, and it covers every route rather than those two (see §2). Verified end to end against a throwaway account: no token → 401, malformed token → 401, valid token → past the gate, and an RLS-scoped insert as that user → 201.
- Add thin API routes wrapping the currently-RSC-only dashboard reads (`/api/dashboard`, `/api/market`, etc.) so the mobile app never needs service-role secrets or duplicated business logic.
- ~~Close the RLS migration-history gap noted in the developer report (§4.3 / a `015` migration)~~ — closed by `scripts/sql/015_reapply_owner_rls.sql`.

### Phase 2 — Screen-by-screen port ✅ core screens done
Built: home, crops, market, expenses, schemes, settings, disease scanner, assistant, store locator, onboarding — plus, on 2026-09-01, the three surfaces the web app gained on 2026-08-30: the **live sensor card** on Home (`src/components/SensorCard.tsx`), the **news feed** (`NewsScreen.tsx`, with a two-headline doorway on Home), and the **Jaivik Sathi eLibrary** (`LibraryScreen.tsx` + `library/BookReader.tsx`). Onboarding now also captures the **house PIN code** into `preferences.house_pincode`, matching where the web app stores it.

Still web-only: the soil-pH camera flow, and the oilseeds interstitial.

Reuse existing API routes and TypeScript types directly from `src/lib` rather than re-deriving business logic in the mobile app.

### Phase 3 — Native module swaps
`expo-image-picker`/`expo-camera` for disease scanning, `expo-speech`/`expo-av` (or a cloud STT SDK) for voice, MapLibre for location features (done), a native chart library for analytics (done — see §2). Re-evaluate the English-only voice scope decision for mobile — a cloud STT/TTS API might be worth the marginal cost on mobile where "install a Chrome voice pack" isn't an option the way it sort of is on desktop.

### Phase 4 — Polish & ship
Push notifications (native replacement for the in-app `notifications` table's web-only surface), offline handling for rural connectivity gaps, i18n parity with the 9-language web app (the mobile app is still English-only), EAS Build/Submit for app-store packaging.

**Blocking a real-device demo:** `EXPO_PUBLIC_API_BASE_URL` is still `http://10.0.2.2:3000`, the Android emulator's alias for the host machine. On a physical phone that resolves to nothing, so market, scan, assistant, sensors, news and the library PDFs all degrade silently. Point it at the deployed Vercel URL before handing the APK to anyone. The eLibrary's text and covers are bundled, so it is the one screen that works regardless.

## 4. Open decisions for a later session

- Whether to keep the web app and mobile app as two clients of one Supabase backend indefinitely, or eventually make the mobile app the primary surface.
- STT/TTS vendor choice for mobile (device-native vs. cloud) given the MMS-TTS non-commercial licensing constraint already flagged in the developer report.
- ~~Whether Phase 2 screens get built in the existing web repo or as a separate repository~~ — **resolved:** separate repository (`agent-farmer-mobile`), decided 2026-08-19. Shared types/logic between the two repos will need to be copied by hand when needed (as `weather.ts` and the dashboard types already were for Phase 0) rather than imported directly, since there's no shared package boundary.
