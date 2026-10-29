/**
 * The voice assistant's tool table.
 *
 * Lifted out of the route so it can be exercised directly. A routing probe
 * that rebuilt this array by hand would be testing a copy, and the copy is
 * exactly the thing that drifts — the point of a probe here is to catch a new
 * tool stealing an old one's phrasing, which only works if it reads the
 * shipped table.
 *
 * Nothing in this file may import server-only code: it is loaded both by the
 * route and by scripts run outside Next.
 *
 * Adding a tool is additive: an entry here, a case in the mobile client's
 * executor (agent-farmer-mobile/src/lib/agent/tools.ts or a handler in
 * VoiceAgent.tsx), and a line in the probe.
 */

export const VOICE_TOOLS = [
  {
    type: "function",
    function: {
      name: "log_expense",
      description:
        "Record a farm expense or income the farmer just described out loud, e.g. " +
        "'I spent two thousand rupees on fertilizer' or 'sold wheat for fifteen thousand'. " +
        "Only call this for a CLEAR statement of money spent or earned on the farm — never " +
        "for a vague mention of money, a question about past spending, or general advice.",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["expense", "income"],
            description: "'expense' for money spent, 'income' for money earned (e.g. a crop sale, a subsidy).",
          },
          category: {
            type: "string",
            enum: [
              "Seeds",
              "Fertilizer",
              "Pesticide",
              "Labor",
              "Machinery",
              "Irrigation",
              "Transport",
              "Crop Sale",
              "Subsidy",
              "Other",
            ],
            description: "Nearest matching category. Use 'Other' if nothing fits well.",
          },
          item_name: {
            type: "string",
            description: "A short label, e.g. 'Fertilizer' or 'Wheat sale'. Reuse the category name if nothing more specific was said.",
          },
          amount: {
            type: "number",
            description: "The amount in rupees as a plain number, e.g. 2000 (not '₹2,000' or 'two thousand').",
          },
        },
        required: ["kind", "category", "item_name", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate",
      description:
        "Open a screen of the app, when the farmer asks to see something rather than asking a question. " +
        "The app already routes literal phrases like 'open the market' on its own without the model, so only " +
        "call this for a request that names no screen outright — 'where can I buy urea' (stores), " +
        "'what am I owed from the government' (schemes), 'show me what I planted' (crops). " +
        // The leaf example that used to sit in this list claimed a sentence
        // scan_leaf's own description also claims, and the model split roughly
        // 50/50 between the two across runs. navigate("scan") opens the screen
        // with the camera shut, so the farmer still has to tap — which is the
        // one thing a hands-free agent must not require. Anything about
        // photographing a leaf or a meter belongs to scan_leaf and
        // read_soil_meter; do not reintroduce an example here that overlaps them.
        "Never use this to reach the camera: scan_leaf and read_soil_meter open it directly.",
      parameters: {
        type: "object",
        properties: {
          screen: {
            type: "string",
            // Exactly the set agent-farmer-mobile VoiceAgent.tsx SCREENS accepts.
            // A name outside it is discarded by the client, so the two lists
            // must not drift.
            enum: [
              "hub",
              "today",
              "crops",
              "market",
              "money",
              "scan",
              "soil",
              "stores",
              "news",
              "learn",
              "schemes",
              "alerts",
              "settings",
              "language",
              "irrigation",
              "inputs",
            ],
            description:
              "today = the day's tasks and weather; crops = the farmer's fields; money = the expense ledger; " +
              "scan = photograph a leaf for disease; soil = pH and nutrients; stores = nearby input shops; " +
              "learn = the reading library; schemes = government schemes; alerts = hazard warnings; " +
              "irrigation = how much water each field needs and when; " +
              "inputs = what seed, fertiliser and pesticide cost.",
          },
        },
        required: ["screen"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "go_back",
      description: "Return to the previous screen, when the farmer says to go back or close what they are looking at.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "sleep",
      description:
        "Stop listening, when the farmer says they are done — 'that's all', 'bye', 'stop listening'. " +
        "Never call this merely because the farmer's question has been answered; the assistant stays in " +
        "conversation until it is dismissed or falls quiet on its own.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "scan_leaf",
      description:
        "Open the camera to photograph a leaf for disease diagnosis. Call this both when the farmer " +
        "describes a symptom they can see — spots, yellowing, wilting, holes — and when they simply ask to " +
        "check, scan or look at a leaf ('scan this leaf', 'I want to check my leaf for disease'). Looking " +
        "at the leaf beats guessing from a description. Do not call navigate for these.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_task_done",
      description:
        "Tick one of today's tasks off the list. This works from anywhere in the app — the farmer does not " +
        "have to be looking at the Today screen. Pass task_number when the numbered list appears in the " +
        "context above and they named a position ('the first one'). Otherwise pass task, describing the " +
        "job in their own words ('watering farm 1', 'the nitrogen one') and the app will match it.",
      parameters: {
        type: "object",
        properties: {
          task_number: {
            type: "integer",
            description:
              "The task's position in the numbered list shown in the context, starting at 1. Only when " +
              "that list is actually in the context — never guess a number that is not in it.",
          },
          task: {
            type: "string",
            description:
              "What the farmer said they finished, in their words. Use this whenever the numbered list is " +
              "not in the context above, or when they described the job instead of counting to it.",
          },
        },
        // Neither is required on its own, but the client refuses a call with
        // neither — stated here so the model always sends one.
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_soil_meter",
      description:
        "Open the camera to photograph a handheld soil pH meter, so the app can read the number off its " +
        "display and save it. This requires the farmer to be HOLDING A METER right now: only call it when " +
        "they say so — 'read my pH meter', 'मेरा पी-एच मीटर पढ़ो', 'I have the meter, take the reading'. " +
        // 'check the soil' and 'मिट्टी की जाँच करो' used to be listed here as
        // examples, and they are the ordinary way of asking to SEE the soil
        // screen. The camera opened instead, which is why asking for the soil
        // section appeared to do nothing useful. A request to look at soil is
        // a navigation; only a meter in hand is this tool.
        "A request to see or open the soil screen — 'show me the soil', 'मिट्टी वाला पेज खोलो', " +
        "'check the soil', 'मिट्टी की जाँच करो' — is navigate with screen 'soil', NOT this. " +
        "For a question about a pH value already on file, answer from the data above instead.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "check_price",
      description:
        "Say today's mandi prices out loud, without opening a screen. TWO ways to call it: " +
        "(1) with a crop, when the farmer names ONE — 'what is cotton going for', 'कपास का भाव क्या है' — " +
        "says just that crop's price; (2) with NO crop, when they ask for prices in general with no crop named — " +
        "'what are today's mandi rates', 'show me the prices', 'मंडी के भाव बताओ', 'all prices' — reads out " +
        "EVERY available crop's price. Prefer this over navigate for a general prices request: the farmer asked " +
        "to be told, not shown. Never ask them which crop — if they named none, leave crop out and it reads them all.",
      parameters: {
        type: "object",
        properties: {
          crop: {
            type: "string",
            description:
              "The crop name as the farmer said it, in English where possible ('Cotton', 'Wheat'). The app " +
              "matches it against the crops this farmer actually grows and the mandi list for their state. " +
              "OMIT this entirely for a general 'what are the prices' request — that reads out every crop.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_language",
      description:
        "Switch the whole app, and this assistant, to another language. Call this whenever the farmer names " +
        "a language they want — full requests ('speak in Tamil', 'हिंदी में बोलो', 'ಕನ್ನಡದಲ್ಲಿ ಮಾತಾಡಿ') AND " +
        "terse ones ('only hindi', 'hindi', 'in english', 'Tamil please', 'अंग्रेज़ी', 'english only'). A bare " +
        "language name is a switch request, never off-topic: switch, never answer it with a disclaimer or a " +
        "clarifying question. This is a setting change, not a navigation: do not open the language screen instead.",
      parameters: {
        type: "object",
        properties: {
          locale: {
            type: "string",
            // Exactly LOCALES in agent-farmer-mobile src/lib/i18n/config.ts.
            // A code outside this set is discarded by the client.
            enum: ["en", "hi", "kn", "ta", "te", "ml", "mr", "bn", "pa"],
            description:
              "en English, hi Hindi, kn Kannada, ta Tamil, te Telugu, ml Malayalam, mr Marathi, " +
              "bn Bengali, pa Punjabi.",
          },
        },
        required: ["locale"],
      },
    },
  },

  /*
    ── The beta set ──────────────────────────────────────────────────────────

    Every tool below earns its place by being something the model CANNOT
    answer from the context block above. That block already carries the
    farms, their crops, stage and harvest dates, live weather, the latest
    soil pH with its advice, the last five disease scans and a ledger
    summary — so "what is the weather", "when do I harvest", "how much have
    I spent" and "what was wrong with my crop" are already answered in prose.
    Declaring tools for those would spend tokens and invite mis-routing to
    buy nothing.

    What is left is of two kinds: live data computed on the DEVICE or fetched
    per-request (the task list, the FAO-56 water balance, the health score,
    input prices, nearby shops, the scheme desk, hazard alerts), and actions
    that change something (recording a pH by voice, opening the add-farm
    sheet, the theme, replaying the tutorial).

    Descriptions here are deliberately terse. The nine above are long because
    each sentence was bought with a measured mis-routing; these are new, and
    the tool array is sent on EVERY turn against an 8000 TPM ceiling, so they
    start tight and earn words only when a probe shows they need them.
  */
  {
    type: "function",
    function: {
      name: "check_tasks",
      description:
        "Say today's farm jobs out loud. For 'what should I do today', 'आज क्या काम है', 'is anything left'. " +
        "The list is generated on the device from the farms and the weather, so it is not in the data above.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "check_irrigation",
      description:
        "Say whether a field needs watering today, how much, and for how long. For 'should I water', " +
        "'how much water does farm 2 need', 'कितना पानी देना है'. A full water balance, not a weather guess.",
      parameters: {
        type: "object",
        properties: {
          farm_number: {
            type: "integer",
            description: "Which field, if they named one ('farm 2' -> 2). Omit to cover every field.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_health",
      description:
        "Say a field's health score out loud and the one condition dragging it down. For 'how is my farm doing', " +
        "'खेत की सेहत कैसी है'. The score is computed on the device; quoting a different number would contradict the screen.",
      parameters: {
        type: "object",
        properties: {
          farm_number: { type: "integer", description: "Which field, if named. Omit for the whole farm." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_input_price",
      description:
        "Say what a named farm INPUT costs — seed, fertiliser or pesticide. For 'what does a bag of urea cost', " +
        "'यूरिया का दाम क्या है'. Not for crops being sold: that is check_price.",
      parameters: {
        type: "object",
        properties: {
          item: { type: "string", description: "What they asked the price of, in English where possible ('Urea', 'DAP')." },
          category: {
            type: "string",
            enum: ["fertiliser", "seed", "pesticide"],
            description: "Which kind of input it is. Guess from the item when they did not say.",
          },
        },
        required: ["item"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_store",
      description:
        "Find the nearest shop selling something and say how far it is. For 'where can I buy urea', " +
        "'खाद की दुकान कहाँ है'. Needs the phone's location, so it cannot be answered from the data above.",
      parameters: {
        type: "object",
        properties: {
          item: { type: "string", description: "What they want to buy, if they said ('urea', 'seed')." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_scheme",
      description:
        "Say which government scheme is most relevant to this farmer and what it pays. For 'what subsidy can I get', " +
        "'सरकारी योजना क्या मिलेगी', 'am I owed anything'. Fetched live; not in the data above.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "check_alerts",
      description:
        "Say any active warnings for this farm — weather risk, missed work, a crop at a vulnerable stage. " +
        "For 'any warnings', 'कोई चेतावनी है', 'is anything wrong'.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "set_soil_ph",
      description:
        "Record a soil pH the farmer READ OUT to you, with no photograph. For 'my meter says six point four', " +
        "'पी-एच छह दशमलव चार है'. If they want the app to read the meter instead, that is read_soil_meter.",
      parameters: {
        type: "object",
        properties: {
          ph: { type: "number", description: "The pH they said, 0-14." },
          farm_number: { type: "integer", description: "Which field, if they named one." },
        },
        required: ["ph"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_farm",
      description:
        "Open the sheet for registering another field. For 'add a new field', 'नया खेत जोड़ना है'. " +
        "The sheet is not a screen, so navigate cannot reach it.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "set_theme",
      description:
        "Switch the app between dark and light. For 'night mode on', 'रात का मोड चालू करो', 'make it brighter'.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["dark", "light"], description: "Which one they asked for." },
        },
        required: ["mode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "replay_tutorial",
      description:
        "Start the walkthrough of the app again. For 'show me how to use this', 'ऐप कैसे चलाना है सिखाओ'.",
      parameters: { type: "object", properties: {} },
    },
  },
] as const;

/** Tool names the mobile client has a handler for — see VoiceAgent.tsx and lib/agent/tools.ts. */
export const VOICE_TOOL_NAMES: ReadonlySet<string> = new Set<string>(
  VOICE_TOOLS.map((t) => t.function.name),
);
