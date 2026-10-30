# FRIDAY — Product Models, How They Work & Architecture

> One platform, three product models. FRIDAY is the sensing-and-advisory layer of
> Agent Farmer. It reads a field with the same three sensors everywhere, interprets
> those readings against the same crop-aware rulebook, and speaks or shows advice —
> but it ships in three hardware forms for three kinds of farmer.
>
> **Status key:** ✅ built in code · 🔶 proposed / design-locked but not procured · ⏳ open decision
>
> Source of truth for the product direction: `docs/FRIDAY_Product_Models_Concept_Note.docx` (2026-10-27).
> This document expands it with the as-built architecture. Last updated 2026-10-30.

---

## 1. The one-platform idea

Every FRIDAY model does the same four things in the same order:

1. **Read** soil moisture + temperature + humidity from the field.
2. **Interpret** those numbers against the farmer's **selected crop and growth stage**
   using a tested agronomy **rulebook** — not a free-floating AI guess.
3. **Advise** in the farmer's language, by voice and/or on screen.
4. **Remember / sync** — locally on the box, or up to the Agent Farmer cloud via the phone.

What changes between models is **where the intelligence lives** and **who owns the device**:

| | Model 1 — Panchayat Box | Model 2A — Fixed Kit | Model 2B — Portable Kit |
|---|---|---|---|
| **For** | Farmers *without* a reliable smartphone | Smartphone users, continuous monitoring | Smartphone users, occasional spot readings |
| **Ownership** | Shared (Gram Panchayat), checked out & returned | Personal, installed in the field | Personal, carried to the field |
| **Brain** | **On-device** (Raspberry Pi 5, offline) | The farmer's **phone** (Agent Farmer app) | The farmer's **phone** (Agent Farmer app) |
| **Raspberry Pi** | ✅ Yes | ❌ No | ❌ No |
| **Connectivity** | Offline-first; cloud optional | 🔶 On-board 4G + GNSS (SIM7600G-H) | Phone link (BLE ✅), phone syncs cloud |
| **Voice** | ✅ Full local voice (STT+LLM+TTS on Pi) | Via phone | Via phone |
| **Cost posture** | Highest (self-contained computer) | Mid (radio + rugged enclosure) | Lowest (bare sensor controller) |

**Architecture rule (explicit and load-bearing):** the Raspberry Pi and the local
voice intelligence exist **only** in the Panchayat box. The two personal kits stay
deliberately cheap and let the phone do the interactive AI. This keeps the
smartphone products affordable and concentrates the expensive "thinks for itself
offline" capability where it's actually needed — the shared box for farmers with no
phone.

---

## 2. The shared foundation (common to all three)

### 2.1 The sensing stack

All three models sense the same field with the same physical chain:

```
Soil-moisture probe ┐
Temp/humidity (DHT)  ├─► Arduino (analog read + DHT) ──UART──► ESP32 ──► uplink
                     ┘                                          (WiFi / BLE / to-Pi)
```

- An **Arduino** does the raw analog soil-moisture read and the DHT temp/humidity read.
- It streams a line to the **ESP32** over UART (in the reference firmware, ESP32 UART2:
  `RXD2=16`, `TXD2=17`).
- The ESP32 is the **uplink**: it either publishes to the cloud (old WiFi/ThingSpeak
  path) or advertises over **BLE** (new path), or — in the Panchayat box — feeds the
  Raspberry Pi.
- ⏳ **Open:** the exact ESP32-vs-Arduino division of labour inside the box is still
  being finalised (one controller may absorb the other).

### 2.2 The canonical reading shape

Every reading, whatever the transport, is packaged as:

```
{ device ID, measurement, unit, timestamp }
```

Over BLE the device notifies a compact JSON line that maps to this shape:

```json
{ "temp_c": 27.4, "humidity": 61, "moisture": 38 }
```

(This exact line is what the Arduino→ESP32 firmware emits and what both the Pi and
the phone parse.)

### 2.3 The advisory principle — rulebook first, AI second

This is the single most important design decision across the platform:

- A **rulebook** (crop + growth stage → threshold table → flags + severity +
  warm base advice) is the **source of truth**. In the Pi box this is `friday/advice/rules.py`.
- An AI model may **re-word** that verdict to sound human, but it **must never invent
  agronomy or replace the rulebook**. On any model failure, the advisor speaks the
  rulebook's own words.
- Advice is **useful offline**; the cloud is secondary.

Model 1 runs this rulebook **on the Pi**. Models 2A/2B send readings to the phone,
where the **Agent Farmer app** applies the equivalent crop-aware interpretation.

### 2.4 Honest, shared limitations

- The **soil-moisture sensor needs calibration** before its `%` can be trusted.
- The crop rulebook covers a **handful of crops** well; others fall back to generic advice.
- Local/offline voice is strong for **Hindi and English**; other languages are weaker offline.

---

## 3. Model 1 — Panchayat FRIDAY Smart Box

### 3.1 Who it's for & how it's used

For farmers **without a reliable smartphone**. The box is a **shared community asset**
kept at the **Gram Panchayat**:

1. A farmer **checks it out**.
2. Takes it to the field, **places the sensors**.
3. Hears **crop-aware spoken advice**, and can **converse** with it by voice.
4. **Returns it** to the Panchayat.

Because it is shared, it uses a **temporary session profile** and **clears the
farmer's data on handover**. (⏳ The checkout → session → reset-on-return flow is a
design item still to be finalised, and the current v2 code saves one *permanent*
profile — see §3.5.)

### 3.2 What it does

- **Automatic mode:** on a timer / threshold, it reads the sensors and speaks **only
  when something is wrong *and* has changed** — no nagging.
- **On-demand mode:** a physical **button** triggers a reading + advice.
- **Onboarding by voice:** first use asks name → crop → stage, reads GPS, and seats a
  session profile.
- Works **fully offline** on the farm (no internet required).

### 3.3 Architecture (on-device, offline)

```
   ┌──────────────────── Panchayat FRIDAY Smart Box ────────────────────┐
   │                                                                     │
   │  Soil / Temp / Humidity ─► Arduino ─► ESP32 ──JSON line──►          │
   │                                                          │          │
   │                                              ┌───────────▼────────┐ │
   │   Mic ──► Vosk (local STT) ───────────────►  │   Raspberry Pi 5   │ │
   │                                              │                    │ │
   │                                              │  advisor.py        │ │
   │                                              │   ├─ rules.py  ◄── SOURCE OF TRUTH
   │                                              │   │   (crop+stage │ │
   │                                              │   │    thresholds)│ │
   │                                              │   └─ llm.py (Ollama, 1–1.5B)
   │                                              │        re-words only│ │
   │  Speaker ◄── Piper (local TTS) ◄─────────────┤  persona.py        │ │
   │                                              │  memory.py / onboarding.py
   │  Button / LED ──────────────────────────────►  main.py (VoiceBox) │ │
   │                                              └────────────────────┘ │
   │                        (cloud optional / secondary)                 │
   └─────────────────────────────────────────────────────────────────────┘
```

- **Compute:** Raspberry Pi 5 (4 GB).
- **STT:** Vosk, local (`audio/stt_local.py`).
- **LLM:** small model via **Ollama** — Llama 3.2 1B / Qwen2.5 1.5B (`advice/llm.py`,
  `OllamaLLM`); re-wording only.
- **TTS:** Piper, local (`audio/tts_local.py`).
- **Advisory:** `advice/rules.py` (truth) → `advice/advisor.py` (`advise()` +
  `should_announce(prev, curr)`) → `advice/persona.py` (talks like a neighbour, never
  like an AI).
- **State:** `memory.py` (`Profile`: name/crop/stage/lat/lon/stage_set_on/locale) +
  `onboarding.py`.
- **Sensors:** soil moisture + temp + humidity via Arduino → ESP32 JSON line.
- **GPS:** `hw/gps.py` — ⏳ real module wiring pending.

### 3.4 Bill of materials (indicative)

Raspberry Pi 5 (4 GB) · USB mic + speaker · ESP32 sensor node (+ Arduino) ·
soil-moisture + temp/humidity sensors · button + LED · portable enclosure + battery.
Indicative total ≈ **₹20,650** (screenshot in `agent-farmer/Screenshots/`).

### 3.5 Privacy & the shared-device rule

- **Temporary session profile per checkout**; **wipe on return**.
- ⚠️ **Gap:** the v2 code currently persists **one permanent** profile
  (`memory.py` / `onboarding.py`). Model 1 needs **per-checkout session + reset-on-return**
  instead. This is the key code change outstanding for this model.

### 3.6 Code & tests

Repo: `E:\My projects\agent-farmer-friday` (Python, own git repo). `main.py`'s
`VoiceBox`: `build()` wires everything; `run()` = (onboard if needed) → greet →
loop(auto check + button). **66 tests green** (all mocks, ~0.2s). `DEPLOY.md` =
push-to-Pi steps (install Ollama + `ollama pull llama3.2:1b`, Piper + Vosk models,
`requirements-pi.txt`, prove offline).

---

## 4. Model 2A — Connected Fixed Kit

### 4.1 Who it's for & how it's used

For **smartphone users who want continuous monitoring**. The kit is **installed in the
field and left there**, streaming readings to the Agent Farmer cloud on its own radio.
The farmer reads trends and gets advice in the **phone app**.

### 4.2 What it does

- Sits in the field, powered, taking readings continuously.
- **Sends readings to Agent Farmer** over its own cellular link (no phone tethering
  needed for uplink).
- Carries **location** so a fixed installation is geolocated.
- The **phone app** does all interpretation, voice, and conversation.

### 4.3 Architecture (no Pi; on-board radio)

```
   ┌──────────── Connected Fixed Kit (in-field, installed) ────────────┐
   │  Soil / Temp / Humidity ─► Arduino ─► ESP32/controller            │
   │                                          │                        │
   │                               🔶 SIM7600G-H 4G HAT + GNSS         │
   │                                          │                        │
   └──────────────────────────────────────────┼────────────────────────┘
                                               │ 4G (cellular)
                                               ▼
                                     Agent Farmer cloud
                                               │
                                               ▼
                                   Farmer's phone (app)
                              interpretation · voice · history
```

- **No Raspberry Pi.** Sensor controller only.
- 🔶 **Connectivity / location:** proposed **Waveshare SIM7600G-H 4G HAT with GNSS**
  (GNSS lives *here*, not necessarily in the shared box).
- **Enclosure:** rugged, IP-rated (⏳ exact IP rating + tamper + battery runtime TBD).
- **Brain:** the Agent Farmer app on the farmer's phone, reading from the cloud.

### 4.4 Open decisions

- ⏳ Validate **SIM7600G-H** against **Indian LTE bands / operator** + GNSS antenna +
  backup runtime.
- ⏳ Fixed enclosure **IP rating + tamper resistance + battery**.

---

## 5. Model 2B — Connected Portable Kit

### 5.1 Who it's for & how it's used

For **smartphone users who want occasional spot readings**. The cheapest kit: no Pi,
no cellular radio, no GNSS. The farmer **carries it to the field**, it hands readings
to the **phone**, and the phone **syncs to the cloud when online**.

### 5.2 What it does

- Carried to the field for a **spot reading**.
- **Transfers readings to the phone** over a short-range link.
- Phone interprets, speaks, and **syncs to cloud when connectivity returns**.

### 5.3 Architecture (phone is the hub) — ✅ BLE link now implemented

```
   ┌────────── Portable Kit ──────────┐        ┌──────── Farmer's phone ────────┐
   │ Soil/Temp/Humidity ─► Arduino    │  BLE   │  Agent Farmer app              │
   │        ─► ESP32 (BLE peripheral) │ ─────► │   useBleSensors() hook         │
   │   advertises "FRIDAY-Sensor"     │ notify │    ├─ scan + connect            │
   │   service f1a70001-…             │ JSON   │    ├─ subscribe to readings char│
   │   readings char f1a70002-…       │        │    └─ SensorSnapshot ─► SensorCard
   └──────────────────────────────────┘        │  (interpretation · voice · UI) │
                                                │           │                    │
                                                │           ▼  when online       │
                                                │     Agent Farmer cloud (sync)  │
                                                └────────────────────────────────┘
```

**The link method decision has landed as BLE.** The concept note left the portable
kit's phone-link method open (BLE / Wi-Fi / USB); the mobile app now ships a **BLE
sensor client** (replacing the old WiFi/ThingSpeak path):

- **Peripheral:** ESP32 advertises as **`FRIDAY-Sensor`**, service
  `f1a70001-5b3c-4b7e-9d2a-9a6f6d0c1a01`, readings characteristic
  `f1a70002-5b3c-4b7e-9d2a-9a6f6d0c1a01`, notifying the `{temp_c, humidity, moisture}`
  JSON line. Firmware: `docs/esp32code_agent_farmer_BLE/esp32code_agent_farmer_BLE.ino`.
- **Central:** the phone. The app's `useBleSensors()` hook (`src/lib/ble/sensors.ts`,
  via `react-native-ble-plx`) scans by name, connects, subscribes, and emits the **same
  `SensorSnapshot` shape** the old HTTP path produced — so `SensorCard` renders a BLE
  reading with no change to its tiles, charts, or freshness badge. With no kit
  connected, the card falls back to the cloud snapshot as before.
- ⚠️ **Note:** BLE is a **native module** — it requires a native dev/production build
  of the app (it cannot run in Expo Go, which this app already doesn't use).

### 5.4 Open decisions

- ⏳ Although BLE is implemented, the note's broader "link method (BLE / Wi-Fi / USB)"
  question can now be considered **answered as BLE** for the app — confirm this is the
  final call before hardware procurement.

---

## 6. Side-by-side architecture summary

| Aspect | Model 1 — Panchayat Box | Model 2A — Fixed Kit | Model 2B — Portable Kit |
|---|---|---|---|
| Compute brain | Raspberry Pi 5 (on-device) | Phone (cloud-fed) | Phone (direct link) |
| Sensors | Soil moisture, temp, humidity | Soil moisture, temp, humidity | Soil moisture, temp, humidity |
| Controller | Arduino → ESP32 | Arduino → ESP32/controller | Arduino → ESP32 (BLE peripheral) |
| Uplink | Offline (cloud optional) | 🔶 4G (SIM7600G-H) | ✅ BLE to phone → cloud |
| Location | GPS module (⏳ wiring pending) | 🔶 GNSS on SIM7600G-H | From phone |
| Voice | ✅ Local STT/LLM/TTS on Pi | Phone | Phone |
| Advisory engine | `rules.py` on Pi (rulebook+LLM) | Agent Farmer app | Agent Farmer app |
| Data model | `{device ID, measurement, unit, timestamp}` | same | same |
| Ownership | Shared (Panchayat) | Personal, installed | Personal, carried |
| Data handling | Session + wipe on return (⏳) | Per-farmer cloud account | Per-farmer cloud account |
| Relative cost | Highest | Mid | Lowest |

---

## 7. Consolidated open decisions (to finalise before procurement)

1. ⏳ **ESP32-vs-Arduino split** inside the box (who reads what; can one absorb the other).
2. ✅/⏳ **Portable kit link method** — implemented as **BLE**; confirm as final.
3. ⏳ **SIM7600G-H** validation — Indian LTE bands/operator, GNSS antenna, backup runtime.
4. ⏳ **Fixed enclosure** — IP rating, tamper resistance, battery.
5. ⏳ **Panchayat checkout/session/reset** flow — and the matching code change in the
   Pi box (`memory.py`/`onboarding.py`) from one permanent profile to per-checkout
   session + reset-on-return.
6. ⏳ **GPS module wiring** for the Pi box (`hw/gps.py`).
7. ⏳ **Soil-moisture calibration** procedure for all three (shared prerequisite).

---

*References: `docs/FRIDAY_Product_Models_Concept_Note.docx`; friday repo
`E:\My projects\agent-farmer-friday` (`friday/advice/*`, `friday/audio/*`, `main.py`);
mobile `src/lib/ble/sensors.ts` + `src/components/SensorCard.tsx`; firmware
`docs/esp32code_agent farmer.txt` (WiFi) and `docs/esp32code_agent_farmer_BLE/` (BLE).*
