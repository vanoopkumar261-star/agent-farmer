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
| **`/api/transcribe`, `/api/tts`** | **Needs a patch** | These two call `getSessionFarmer()`, which reads the session *only* from cookies (`next/headers`), not an `Authorization` header. Small, isolated fix: accept a Bearer token and verify it via `supabase.auth.getUser(token)`. |
| **Dashboard read layer** (`getDashboardData`, `getMarket`, `getWeather`, `computeFarmHealth`, `deriveAlerts`, task generation) | **Needs new API routes** | These currently run only inside React Server Components, not over HTTP, and several touch server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `DATA_GOV_API_KEY`). Wrap each in a thin `/api/*` route the mobile app can call — do not duplicate this logic client-side. |
| **Voice input/output** | **Native replacement required** | `window.speechSynthesis`, `SpeechRecognition`, and `MediaRecorder` don't exist in React Native. Replace with `expo-speech` (TTS) and either a native STT module or the same record-then-POST-to-`/api/transcribe` pattern using `expo-av`/`expo-audio` for recording. |
| **Disease-photo capture** | **Native replacement required** | The web version uses `<input type=file>` + HTML5 drag-drop. Swap for `expo-image-picker` (camera/gallery); the upload contract itself (`FormData` POST to `/api/disease`) is unchanged. |
| **Maps** (store locator, onboarding location picker) | **Native replacement required** | Leaflet has no RN equivalent — use `react-native-maps`. |
| **Charts** (Recharts) | **Native replacement required** | No direct RN port — pick a native charting library (e.g. `victory-native` or `react-native-gifted-charts`) and re-theme with `chartTheme.ts`'s existing color values. |

## 3. Phases

### Phase 0 — Scaffold ✅ done, verified 2026-08-19
Expo app (TypeScript + Expo Router) at `E:\My projects\agent-farmer-mobile` (its own repo — see "Repo location" above), Supabase client wired with `AsyncStorage` session persistence against the **same Supabase project**, a working sign-in/sign-up screen, and one authenticated home screen rendering real farm + weather data. Verified end-to-end in a real browser: signed up a live test account against Supabase Auth, confirmed session persistence across reload, saw the honest empty state for an account with no farm profile, then confirmed real farm/crop data and live Open-Meteo weather render correctly once a farm exists (test rows inserted and cleaned up via `scripts/db-exec.mjs` for the check). One bug found and fixed along the way: Expo's static web output pre-renders in a Node SSR pass with no `window`, which crashed the Supabase client's AsyncStorage-backed auth adapter — fixed with an SSR-safe storage guard in `src/lib/supabase.ts` (native builds never hit this, since there's no SSR step there).

### Phase 1 — Backend readiness
- Patch `/api/transcribe` and `/api/tts` to accept `Authorization: Bearer <token>`.
- Add thin API routes wrapping the currently-RSC-only dashboard reads (`/api/dashboard`, `/api/market`, etc.) so the mobile app never needs service-role secrets or duplicated business logic.
- Close the RLS migration-history gap noted in the developer report (§4.3 / a `015` migration) before scaling up who's writing to these tables from a second client.

### Phase 2 — Screen-by-screen port
One dashboard screen per work session, in roughly this order (simplest/highest-value first): crops → market → expenses → schemes → settings → disease scanner → assistant → store locator. Reuse existing API routes and TypeScript types directly from `src/lib` rather than re-deriving business logic in the mobile app.

### Phase 3 — Native module swaps
`expo-image-picker`/`expo-camera` for disease scanning, `expo-speech`/`expo-av` (or a cloud STT SDK) for voice, `react-native-maps` for location features, a native chart library for analytics. Re-evaluate the English-only voice scope decision for mobile — a cloud STT/TTS API might be worth the marginal cost on mobile where "install a Chrome voice pack" isn't an option the way it sort of is on desktop.

### Phase 4 — Polish & ship
Push notifications (native replacement for the in-app `notifications` table's web-only surface), offline handling for rural connectivity gaps, i18n parity with the 9-language web app, EAS Build/Submit for app-store packaging.

## 4. Open decisions for a later session

- Whether to keep the web app and mobile app as two clients of one Supabase backend indefinitely, or eventually make the mobile app the primary surface.
- STT/TTS vendor choice for mobile (device-native vs. cloud) given the MMS-TTS non-commercial licensing constraint already flagged in the developer report.
- ~~Whether Phase 2 screens get built in the existing web repo or as a separate repository~~ — **resolved:** separate repository (`agent-farmer-mobile`), decided 2026-08-19. Shared types/logic between the two repos will need to be copied by hand when needed (as `weather.ts` and the dashboard types already were for Phase 0) rather than imported directly, since there's no shared package boundary.
