/**
 * Jaivik Sathi Library - Rich Book Content & Media Registry
 */

import type { LucideIcon } from "lucide-react";
import { Recycle, Bug, FlaskConical, Leaf, Award, Droplets } from "lucide-react";

export type BookPage = {
  header?: string;
  title: string;
  icon?: string;
  content: string[];
  bullets?: string[];
  tip?: string;
  quote?: string;
};

export type Book = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: "Composting" | "Bio-Inputs" | "Pest Control" | "Certification" | "Water";
  Icon: LucideIcon;
  image: string;
  duration: string;
  color: string; // Hardcover leather color
  accentColor: string;
  pdfUrl: string | null;
  youtubeId?: string;
  pages: BookPage[];
};

export const LIBRARY: Book[] = [
  {
    id: "composting-basics",
    slug: "composting-basics",
    title: "Composting Basics",
    subtitle: "Reclaiming the Soil Gold",
    description: "A complete masterclass on turning crop residue, cattle dung, and farm biomass into premium organic carbon for Indian soils.",
    category: "Composting",
    Icon: Recycle,
    image: "/images/library/composting.jpg",
    duration: "8 min read",
    color: "#2C3D28", // Forest Leather
    accentColor: "#4E6B3D",
    pdfUrl: "/library-pdfs/composting-basics.pdf",
    youtubeId: "egyNJ7xPyoQ",
    pages: [
      {
        header: "Introduction",
        title: "The Crisis of the Flame",
        icon: "🍂",
        content: [
          "Every winter, the horizons of Northern India glow with a destructive orange fire. Millions of tonnes of paddy straw and crop residue are set ablaze, sending clouds of choking smoke into the atmosphere.",
          "This is not just an air pollution crisis—it is an agricultural tragedy. In those flames, billions of rupees worth of nitrogen, phosphorus, potash, and active organic carbon are turned to ash.",
          "Our ancestors treated soil as a living organism. When we burn crop residue, we kill the soil's microbial heartbeat. Composting is our path back to a living soil."
        ],
        quote: "मृदा एव जीवनम् — Soil is Life itself."
      },
      {
        header: "Soil Science",
        title: "The Carbon-Nitrogen Equation",
        icon: "⚖️",
        content: [
          "Microbes decompose waste using a strict chemical ratio: Carbon (for energy) and Nitrogen (for building proteins). This is the Carbon-to-Nitrogen (C:N) ratio.",
          "To make perfect compost, aim for a C:N ratio of 30:1. If there's too much Carbon (straw, wood), decomposition stops. If there's too much Nitrogen (green grass, fresh dung), the pile smells foul and loses nutrients.",
          "Layering dry yellow materials with moist green cow dung balances this ratio naturally."
        ],
        bullets: [
          "BROWNS (Carbon): Wheat/paddy straw, sugarcane bagasse, dry leaves, dry weeds",
          "GREENS (Nitrogen): Fresh cattle dung, green weeds, pulse crop residues, vegetable scraps",
          "ACTIVATOR: Forest soil or mature cow dung slurry to seed local microbial strains"
        ],
        tip: "Avoid adding eucalyptus leaves, plastic, glass, or plants treated with chemical herbicides to the compost pile."
      },
      {
        header: "Engineering",
        title: "Building the Aerated Pile",
        icon: "🏗️",
        content: [
          "The compost pile must breathe. Without oxygen, anaerobic bacteria take over, creating sour odours and low-quality inputs.",
          "Choose a dry, shaded area on your farm. Build a pile that is 4 feet wide and 4 feet high. Piles smaller than 3 feet cube cannot retain the heat needed to self-pasteurize.",
          "Place a base layer of coarse twigs or dry crop stalks to allow fresh air to flow up from the bottom. Wet each layer with water as you build—it must feel like a damp, wrung-out sponge."
        ],
        tip: "A bamboo pole with holes drilled in it, placed vertically in the center of the pile, acts as an excellent passive ventilation pipe."
      },
      {
        header: "Thermodynamics",
        title: "The Fire Within",
        icon: "🔥",
        content: [
          "Within 72 hours, your pile should heat up to 55°C–65°C. This is not caused by the sun; it is the heat of billions of microbes consuming the biomass.",
          "This high temperature is crucial. It pasteurizes the compost, killing pathogens, fungal spores, and weed seeds, ensuring your final compost is clean and safe.",
          "Push a dry wooden stick into the center. Pull it out after 30 minutes. If it feels hot and damp, the pile is fermenting correctly."
        ],
        quote: "The heat of the compost is the flame of microbial life."
      },
      {
        header: "Maintenance",
        title: "Turning & Aerating",
        icon: "🔄",
        content: [
          "As microbes breathe, they consume the oxygen inside the pile. When oxygen levels drop, the pile cools down and decomposition slows.",
          "To restart the process, turn the pile inside out using a pitchfork. Move the cooler outer layers to the hot center, and the decomposed center to the outside.",
          "Turn the pile every 10–14 days. With each turn, you will notice the material turning darker, fluffier, and smelling sweeter. If the pile is dry during turning, sprinkle a little water."
        ]
      },
      {
        header: "Maturity",
        title: "Recognizing Soil Gold",
        icon: "✨",
        content: [
          "After 60–90 days, the pile will stop heating up. It will cool down to ambient air temperature, signifying that the microbes have completed their work.",
          "Finished compost is dark brown or black, has a rich crumbly texture like moist cake, and smells exactly like fresh forest soil after the first monsoon rain.",
          "The plastic bag test: place a handful of moist compost in a zip-lock bag. Leave it for 48 hours. Open and sniff. If it smells sweet, it is ready."
        ],
        tip: "Using unfinished compost on crops will lock up nitrogen in the soil, temporarily starving your young seedlings. Always wait for maturity."
      },
      {
        header: "Application",
        title: "Bringing Carbon to the Field",
        icon: "🚜",
        content: [
          "Compost is not a chemical shot of nutrients. It is a long-term upgrade to your soil structure, water holding capacity, and mineral exchange.",
          "Spread 3–5 tonnes of compost per acre during field preparation, 2–3 weeks before sowing. Till it gently into the top 4–6 inches of soil where seeds germinate.",
          "For vegetable beds, apply a rich 2-inch layer of compost directly inside the planting rows."
        ],
        bullets: [
          "Cereals (Wheat, Paddy): 2.5–3 tonnes per acre",
          "Vegetables (Tomato, Chilli): 4–5 tonnes per acre",
          "Horticulture (Mango, Citrus): 10 kg per tree annually",
          "Reclaiming sandy/dry fields: 6–8 tonnes per acre"
        ]
      },
      {
        header: "Traditional Wisdom",
        title: "The Circle of Return",
        icon: "🌾",
        content: [
          "Organic farming is the practice of returning what we borrow. The crop takes nutrients from the soil, the residue goes to the compost, and the compost returns home to the soil.",
          "By stopping the practice of burning and shifting to active composting, you can save up to ₹8,000 per acre in chemical inputs while restoring soil biology that will sustain your grandchildren.",
          "The carbon you bury today is the crop security of tomorrow."
        ],
        quote: "जैविक खेती ही सुखी खेती है — Organic farming is the path to happy farming."
      }
    ]
  },
  {
    id: "vermicompost-mastery",
    slug: "vermicompost-mastery",
    title: "Vermicompost Mastery",
    subtitle: "Harnessing the Earthworm Engine",
    description: "A professional operating guide to raising red wigglers, maintaining healthy breeding beds, and producing concentrated worm castings.",
    category: "Composting",
    Icon: Bug,
    image: "/images/library/vermicompost.jpg",
    duration: "9 min read",
    color: "#5C3E21",
    accentColor: "#8c6239",
    pdfUrl: "/library-pdfs/vermicompost-mastery.pdf",
    youtubeId: "6Ejq4pbANww",
    pages: [
      {
        header: "Worm Biology",
        title: "The Gut of the Earth",
        icon: "🪱",
        content: [
          "The earthworm's digestive tract is a natural bioreactor. As organic waste passes through the worm's gut, it is combined with calcium, enzymes, and millions of beneficial bacteria.",
          "Worm castings (vermicompost) contain 5 times more nitrogen, 7 times more phosphorus, and 11 times more potash than ordinary fertile topsoil.",
          "Unlike chemical inputs, these nutrients are bound inside organic capsules that slowly release as the plant roots demand them."
        ],
        quote: "Worms are the natural tillers of our fields."
      },
      {
        header: "Breeding",
        title: "Selecting Eisenia Fetida",
        icon: "🐛",
        content: [
          "Do not dig up local deep-burrowing worms for composting. Deep earthworms are soil miners, not surface feeders.",
          "For composting beds, we use Eisenia fetida (Red Wiggler). These surface-dwellers thrive in leaf litter and cow dung, consume their own weight in food daily, and breed rapidly.",
          "A healthy population of 10,000 Red Wigglers can process up to 5 kilograms of organic waste every single day."
        ],
        bullets: [
          "Optimal temperature: 20°C to 30°C",
          "Moisture level: 60%–70% (feels like a damp sponge)",
          "Avoid direct sunlight — UV rays paralyze and kill worms",
          "Worms reproduce by laying cocoons containing 2–7 baby worms"
        ]
      },
      {
        header: "Infrastructure",
        title: "Building the Vermibed",
        icon: "🏗️",
        content: [
          "Construct brick or bamboo beds measuring 10 ft long × 3 ft wide × 2 ft high. Keep the beds under a thatched roof or shade net.",
          "Line the bottom of the bed with a layer of dry, shredded coconut coir or dry leaves. This acts as a cushioning bed and emergency food source.",
          "Ensure the bed has a drainage outlet at the lowest point. This is crucial: standing water drowns worms, while the drained liquid is a potent tonic."
        ],
        tip: "Collect the runoff liquid from your vermibed. This 'Vermi-wash' is packed with plant growth hormones and makes an excellent foliar spray."
      },
      {
        header: "Feeding",
        title: "The Pre-Digestion Stage",
        icon: "🍽️",
        content: [
          "Worms have soft, delicate skin. Never add fresh cow dung or green leaves directly to a vermibed. Fresh materials ferment, releasing high heat and toxic ammonia gas.",
          "All worm food must be pre-digested. Mix cattle dung and crop residues in a separate pile and let it sit for 15 days, watering it occasionally.",
          "Once the heat and ammonia smell have gone, spread a 6-inch layer of this pre-digested material evenly over the vermibed."
        ],
        quote: "Feed the bed, don't bury the worms."
      },
      {
        header: "Bed Management",
        icon: "🌡️",
        title: "Managing Temperature",
        content: [
          "Worms are highly sensitive to their environment. Extreme cold slows their feeding; extreme heat kills them. In summer, check your beds daily.",
          "Cover the top of the bed with damp jute gunny bags. Sprinkle water over these bags twice a day during hot months to cool the bed through evaporation.",
          "Ensure the bedding is loose and aerated. Gently scratch the surface with a hand fork once a week. Never dig deep or disturb the worm layers."
        ]
      },
      {
        header: "Harvesting",
        title: "The Sun Separation Method",
        icon: "☀️",
        content: [
          "After 60 days, the top layers of the bed will turn into dark, granular castings resembling coffee grounds. It is now time to harvest.",
          "Stop watering the beds 3 days before harvesting. This coaxes the worms to move deeper into the moist lower layers of the bed.",
          "Gently scrape the dry, loose castings from the top. Form them into cone-shaped piles in the sun. The remaining worms will move to the very bottom center of the piles to escape light."
        ],
        tip: "Sieve the harvested vermicompost through a 2mm mesh to separate cocoons and uncomposted twigs. Put the cocoons back in the bed."
      },
      {
        header: "Usage Guide",
        title: "Applying Black Gold",
        icon: "🌿",
        content: [
          "Vermicompost is highly concentrated. You need much less than standard compost. It is ideal for seed beds, nurseries, and early crop transplantation.",
          "Mix vermicompost directly into the root zones of vegetable seedlings at transplanting. This drastically reduces transplant shock and accelerates root establishment.",
          "For horticultural orchards, apply vermicompost twice a year before the flowering season."
        ],
        bullets: [
          "Nursery Beds: 1 kg vermicompost per square meter",
          "Vegetable Transplants: 250–500 grams per planting hole",
          "Grain Fields: 1 to 1.5 tonnes per acre prior to sowing",
          "Floriculture: 500 grams per plant every 3 months"
        ]
      },
      {
        header: "Enterprise",
        title: "The Farm Income Multiplier",
        icon: "💰",
        content: [
          "Vermicomposting is not just a source of fertilizer—it is an excellent business model. Organic nurseries, tea estates, and urban gardeners are willing to pay ₹15–20 per kilogram.",
          "By maintaining 3–4 standard vermibeds, a farmer can easily generate 12–15 tonnes of premium vermicompost annually, creating a steady stream of secondary income.",
          "Combine your castings with certified PGS-India branding to command the highest premiums in urban organic markets."
        ],
        quote: "Turn waste into wealth, and earthworms into your partners."
      }
    ]
  },
  {
    id: "jeevamrutha-guide",
    slug: "jeevamrutha-guide",
    title: "Jeevamrutha Guide",
    subtitle: "Brewing the Microbial Elixir",
    description: "The complete science of culturing soil microbes using native cow products, sugar, and organic flours.",
    category: "Bio-Inputs",
    Icon: FlaskConical,
    image: "/images/library/jeevamrutha.jpg",
    duration: "7 min read",
    color: "#2C3D32",
    accentColor: "#397458",
    pdfUrl: null, // PDF not yet supplied
    youtubeId: "XFBMF4OFS5A",
    pages: [
      {
        header: "The Philosophy",
        title: "Feeding the Unseen Billions",
        icon: "🧪",
        content: [
          "Plants do not grow on sterile soil. They live in symbiosis with billions of microscopic fungi, bacteria, and soil organisms that live around their roots.",
          "These microbes act as miners, dissolving locked-up soil minerals and delivering them directly to plant roots. Jeevamrutha is a liquid microbial culture designed to rapidly multiply these helper organisms.",
          "It is the cornerstone of Zero Budget Natural Farming (ZBNF), proving that healthy crops can be grown without buying synthetic chemical bags."
        ],
        quote: "Soil without microbes is just sand; with microbes, it is a living system."
      },
      {
        header: "The Recipe",
        title: "The Six Sacred Ingredients",
        icon: "🌾",
        content: [
          "To prepare 200 litres of Jeevamrutha (enough for 1 acre of land), gather these fresh organic ingredients.",
          "The cow dung and urine must come from an indigenous (Desi) cow breed if possible. Native breeds have significantly higher microbial diversity in their digestive tracts than crossbreeds.",
          "The forest soil is critical: it introduces wild, native, highly resilient microbial strains that have survived for centuries without chemical inputs."
        ],
        bullets: [
          "10 kg fresh Desi Cow Dung",
          "5 to 10 litres Desi Cow Urine",
          "2 kg Jaggery (Gur) — acts as the energy/sugar source for microbes",
          "2 kg Pulse Flour (Besan/Gram flour) — provides nitrogen/proteins",
          "1 handful of undisturbed forest soil or field boundary soil",
          "200 litres of clean, chlorine-free water"
        ]
      },
      {
        header: "The Fermentation",
        icon: "⏳",
        title: "Brewing Under the Canopy",
        content: [
          "Mix all ingredients thoroughly in a 200-litre plastic drum. Stir the mixture clockwise with a wooden staff twice a day—once in the morning and once in the evening.",
          "Keep the drum in deep shade under a tree or inside a shed. Cover with a jute gunny bag to allow gases to escape while keeping out files and pests.",
          "Within 48 hours, fermentation begins. The pulse flour and jaggery feed the native microbes, causing their population to explode into billions per millilitre."
        ],
        tip: "Stirring clockwise creates a vortex that draws in oxygen, fueling the rapid multiplication of beneficial aerobic bacteria."
      },
      {
        header: "Timing & Quality",
        title: "The Peak of Nectar",
        icon: "📅",
        content: [
          "Microbial density reaches its absolute peak between days 4 and 6 of fermentation. During this window, the liquid is incredibly active.",
          "The smell will transition from raw dung to a sweet-sour, pleasant fermented aroma—similar to idli batter or yeast. If the liquid smells foul, it was not aerated enough.",
          "Apply the brew before day 8. After 8 days, the microbes exhaust their food supply and their numbers begin to decline rapidly."
        ],
        quote: "Timing is everything in organic biology."
      },
      {
        header: "Foliar Spray",
        title: "The Canopy Protection",
        icon: "💧",
        content: [
          "Jeevamrutha is also a powerful foliar spray. When sprayed on leaves, the beneficial microbes coat the leaf surface, forming a living protective shield.",
          "This shield prevents fungal pathogens like blights and mildews from establishing on the leaf, while the liquid nutrients are absorbed through the stomata.",
          "Dilute 5 litres of filtered Jeevamrutha in 100 litres of water for standard foliar sprays. Apply during cool morning or evening hours."
        ],
        tip: "Always filter the liquid through a fine cloth twice before putting it into a spray pump, to prevent the nozzle from clogging."
      },
      {
        header: "Soil Application",
        title: "Saturating the Root Zone",
        icon: "🌊",
        content: [
          "The most effective way to apply Jeevamrutha is through irrigation water. This allows the liquid to seep deep into the root zone.",
          "For flood irrigation, place the drum near the main water channel. Let the liquid drip slowly into the flowing water, mixing it evenly across the field.",
          "If using drip systems, dilute the filtered mixture 1:10 with water to prevent line clogs, and run a thorough flush cycle after application."
        ],
        bullets: [
          "Basal Dose: 200 Litres per acre, applied twice every month",
          "Vegetables: Apply 100 ml diluted solution to root base weekly",
          "Fruit Trees: Apply 2–5 litres per tree around the canopy edge monthly",
          "Soil Recovery: 400 Litres per acre for damaged or saline soils"
        ]
      },
      {
        header: "Ghana Jeevamrutha",
        title: "Solid Microbes for Drylands",
        icon: "🧱",
        content: [
          "For rain-fed farms or areas with scarce water, make solid Ghana Jeevamrutha.",
          "Mix 100 kg cow dung with 1 litre cow urine, 1 kg jaggery, 1 kg besan, and a handful of forest soil. Knead it into a dough, spread it on mats, and dry it in the shade.",
          "Pulverize the dried sheets into a powder. It can be stored in gunny bags for up to 6 months. Apply 200 kg per acre during sowing or till preparation."
        ],
        quote: "Ghana Jeevamrutha keeps the soil alive, waiting for the rain."
      }
    ]
  },
  {
    id: "natural-pest-control",
    slug: "natural-pest-control",
    title: "Natural Pest Control",
    subtitle: "Eco-Friendly Farm Protection",
    description: "An operational field guide to replacing toxic chemical pesticides with botanical sprays, companion planting, and natural predatory management.",
    category: "Pest Control",
    Icon: Leaf,
    image: "/images/library/pest-control.jpg",
    duration: "7 min read",
    color: "#5C5C21",
    accentColor: "#6E7A3D",
    pdfUrl: null, // PDF not yet supplied
    youtubeId: "_1BdRzoN-50",
    pages: [
      {
        header: "The Philosophy",
        title: "Balance, Not Eradication",
        icon: "🐞",
        content: [
          "Chemical pesticides are weapons of mass destruction. They kill 100% of insects—including the 95% that are helpful predators like ladybugs, spiders, and lacewings.",
          "When you kill the predators, the pests return stronger and develop chemical resistance, forcing you to buy even stronger poisons.",
          "Natural pest control aims for balance. We tolerate a small number of pests so our friendly predators have food to survive. We build an ecosystem that manages itself."
        ],
        quote: "In nature, every pest has a natural predator."
      },
      {
        header: "Botanicals",
        title: "Neem: The Bio-Inhibitor",
        icon: "🌳",
        content: [
          "Neem is the most powerful botanical insecticide in the world. Its active compound, azadirachtin, does not poison bugs instantly. Instead, it ruins their hormones.",
          "When insects eat neem-coated leaves, they forget to feed, forget to mate, and fail to molt into adults, stopping their lifecycle entirely.",
          "Because it must be eaten to work, neem is completely harmless to helpful predatory insects, honeybees, and birds."
        ],
        bullets: [
          "Neem Seed Kernel Extract (NSKE): Crush 5 kg dry neem seeds, soak in 10L water overnight. Dilute to 100L, spray.",
          "Neem Leaf Extract (NLE): Grind 10 kg fresh leaves, soak in 50L water for 24 hours. Strain and spray.",
          "Neem Oil Emulsion: Mix 1L pure neem oil with 100ml soap solution. Mix into 100L water and spray."
        ]
      },
      {
        header: "Bio-Sprays",
        title: "Agniastra & Bramhastra",
        icon: "🔥",
        content: [
          "For severe infestations of leaf-folders, borers, and large caterpillars, traditional natural farming uses highly concentrated fermented sprays.",
          "Agniastra uses hot chillies, garlic, and neem boiled in cow urine. It is an intense repellent and digestive disruptor for insects.",
          "Bramhastra is brewed by boiling neem, custard apple, papaya, and guava leaves in cow urine, creating a powerful bitter barrier."
        ],
        tip: "Always spray these concentrated botanical decoctions during early morning or late afternoon to prevent leaf-burn from intense midday heat."
      },
      {
        header: "Ecosystem Design",
        title: "Companion Planting",
        icon: "🌸",
        content: [
          "A monoculture farm is an open buffet for pests. Intercropping and companion planting confuse pests by blending visual cues and scents.",
          "Grow strongly scented companion plants at regular intervals. Marigolds, tulsi, coriander, fennel, and garlic repel pests or attract beneficial predators.",
          "Planting a single row of coriander for every five rows of wheat can reduce aphid populations by up to 70% naturally."
        ],
        bullets: [
          "Marigolds → repels nematodes and whiteflies (plant near tomatoes)",
          "Tulsi / Basil → repels thrips, flies, and mosquitoes",
          "Coriander / Fennel → attracts predatory hoverflies and wasps",
          "Garlic / Onion → deters beetles, aphids, and root flies"
        ]
      },
      {
        header: "Trap Crops",
        title: "The Defensive Border",
        icon: "🎯",
        content: [
          "A trap crop is a sacrificial crop planted along the boundaries of your main field. Pests prefer the trap crop, gathering there instead of eating your main crop.",
          "Once the pests are concentrated on the trap crop, you can spray only the border plants with a concentrated neem oil or soapy water mix, saving the main crop.",
          "This is smart strategic warfare—letting the pests have the borders while keeping your main harvest safe and clean."
        ],
        bullets: [
          "Main Crop: Cotton → Border with Okra (Bhindi) to trap bollworms",
          "Main Crop: Cabbage → Border with Mustard rows to trap diamondback moths",
          "Main Crop: Tomato → Border with Marigold to trap fruit borers",
          "Main Crop: Potato → Border with Castor to trap armyworms"
        ]
      },
      {
        header: "Predator Support",
        title: "Building the Insect Hotel",
        icon: "🕷️",
        content: [
          "The best pest controllers work for free. Spiders, dragonflies, ladybugs, and birds eat thousands of pests every single day.",
          "Install 'bird perches'—simple T-shaped wooden stands 5 feet tall—every 50 feet in your grain fields. Insect-eating birds will sit on them and hunt caterpillars.",
          "Leave patches of wild grass along field bunds. These act as breeding grounds and nesting sites for spiders and predatory beetles."
        ],
        tip: "Before you decide to spray any botanical, examine your crops. If you see active spiders or ladybug larvae, wait. Let nature do the work."
      },
      {
        header: "Field Formulas",
        title: "Chilli-Garlic-Soap Spray",
        icon: "🌶️",
        content: [
          "For immediate outbreaks of sucking pests like aphids, thrips, and jassids, use the trusted Chilli-Garlic-Soap formula.",
          "Blend 200g of hot green chillies and 200g of garlic into a smooth paste. Soak in 1 litre of water overnight. Strain, add 10 ml of liquid soap, and dilute 1:10 with water.",
          "The chilli irritates the bugs, the garlic repels them, and the soap suffocates their breathing pores, clearing infestations safely."
        ],
        quote: "Clean, non-toxic, and highly effective protection."
      }
    ]
  },
  {
    id: "organic-certification",
    slug: "organic-certification",
    title: "Organic Certification Path",
    subtitle: "Navigating the PGS-India Standard",
    description: "A practical roadmap to transitioning your farm, forming a local group, and securing PGS-India organic certification at zero cost.",
    category: "Certification",
    Icon: Award,
    image: "/images/library/certification.jpg",
    duration: "6 min read",
    color: "#4A3B22",
    accentColor: "#A0522D",
    pdfUrl: null, // PDF not yet supplied
    youtubeId: "QwX2I_5dSeY",
    pages: [
      {
        header: "The Value",
        title: "The Premium Market",
        icon: "🏆",
        content: [
          "Farming organically is noble, but certifying your farm is profitable. Certified organic produce commands a 30% to 100% price premium in Indian and urban markets.",
          "Consumers in metros are actively seeking chemical-free food and are willing to pay for proof. Certification is your bridge of trust to those buyers.",
          "It also protects your farm from market crashes—organic prices remain highly stable throughout the year, independent of standard mandi volatility."
        ],
        quote: "Trust is the most valuable crop you can harvest."
      },
      {
        header: "PGS-India",
        title: "Peer-to-Peer Trust",
        icon: "📜",
        content: [
          "India has a revolutionary certification system designed specifically for smallholders: PGS-India (Participatory Guarantee System).",
          "Unlike NPOP certification, which requires hiring expensive corporate auditors, PGS-India is peer-audited. Local groups of farmers inspect each other's fields.",
          "It is completely free, community-driven, and recognized across India for domestic organic sales."
        ],
        bullets: [
          "PGS-India Green → For farms in the 2-year conversion transition",
          "PGS-India Organic → Fully certified organic status",
          "Zero Audit Fees — managed through local agricultural offices",
          "Supported by PKVY (Paramparagat Krishi Vikas Yojana) subsidies"
        ]
      },
      {
        header: "Community",
        title: "Forming the Local Group",
        icon: "👥",
        content: [
          "You cannot get PGS certified alone. PGS requires forming a 'Local Group' of at least five neighboring organic farmers.",
          "This group structure ensures honesty. Because one member's dishonesty can ruin the certification for the entire group, farmers naturally keep each other accountable.",
          "Form a group of trusted neighbors who live in the same village and are committed to giving up chemicals."
        ],
        bullets: [
          "Minimum 5 farmers per Local Group (maximum 20)",
          "Earthy boundaries must be clearly mapped",
          "Members must elect a Group Leader and a Data Secretary",
          "Members must meet monthly and maintain meeting registers"
        ]
      },
      {
        header: "Administration",
        title: "The PGS-India Portal",
        icon: "💻",
        content: [
          "Your Local Group must register on the official PGS-India portal (pgsindia-ncof.gov.in) with the help of a Regional Council (RC).",
          "The RC is typically a local NGO, agricultural college, or KVK appointed by the government to train farmers and upload data.",
          "Once registered, the RC will issue your group a unique login. The Data Secretary will upload farm maps, crop sowing details, and peer-inspection dates."
        ],
        tip: "Regional Councils do not charge for upload services. They are funded by the Ministry of Agriculture to help you."
      },
      {
        header: "Transition",
        title: "The Conversion Period",
        icon: "⏳",
        content: [
          "Your soil needs time to flush out chemical residues. This transition period is called the Conversion Period.",
          "For seasonal crop fields (grains, vegetables), conversion takes 2 years. For perennial orchards (fruit trees, spices), it takes 3 years.",
          "During conversion, you must follow 100% organic practices. You will receive a 'PGS-Green' certificate, allowing you to sell as 'In-Conversion' at a partial premium."
        ],
        quote: "Soil healing takes time. Respect the process."
      },
      {
        header: "The Peer Audit",
        title: "Harvesting the Stamp of Trust",
        icon: "✅",
        content: [
          "Every season, before harvest, your group members will conduct physical audits of your fields. They check your soil, water source, and storage sheds.",
          "Once the group confirms compliance, your 'PGS-Organic' certificate and unique QR codes are issued online.",
          "You can now print the PGS-India organic logo on your packaging. Buyers scanning the QR code can see your name, village, and verified organic status instantly."
        ],
        bullets: [
          "✓ Entitles you to PKVY direct subsidies of ₹50,000 per hectare",
          "✓ Access to dedicated Organic Mandis and government retail stalls",
          "✓ Direct contracts with premium organic brands and urban supermarkets",
          "✓ Pride of growing clean, poison-free food for your country"
        ]
      }
    ]
  },
  {
    id: "water-conservation",
    slug: "water-conservation",
    title: "Water Conservation",
    subtitle: "Drop-by-Drop Prosperity",
    description: "Advanced dryland techniques including micro-irrigation, biological mulching, and farm-pond harvesting to survive water scarcity.",
    category: "Water",
    Icon: Droplets,
    image: "/images/library/water.jpg",
    duration: "7 min read",
    color: "#22353C",
    accentColor: "#4B7C8C",
    pdfUrl: null, // PDF not yet supplied
    youtubeId: "-evivoRwUZw",
    pages: [
      {
        header: "The Crisis",
        title: "The Shrinking Table",
        icon: "💧",
        content: [
          "Indian agriculture is built on water borrow-spending. Over 80% of our groundwater goes to farming, and the water table is dropping by up to 3 feet every year.",
          "Flood irrigation wastes up to 60% of water through evaporation and deep percolation, while washing away valuable topsoil and nutrients.",
          "Water conservation is no longer an ecological choice—it is a survival strategy. Farmers who master low-water cultivation today will secure their yields for tomorrow."
        ],
        quote: "बूँद-बूँद से घट भरे — Every single drop fills the vessel."
      },
      {
        header: "Micro-Irrigation",
        icon: "💦",
        title: "Precision Drip Systems",
        content: [
          "Drip irrigation delivers water directly to the root zone, drop by drop, through a network of plastic lines and emitters.",
          "By watering only the roots, drip irrigation saves up to 50% water compared to flooding, prevents weed growth in inter-rows, and boosts crop yield by 30%.",
          "Apply for drip irrigation subsidies under PMKSY (Pradhan Mantri Krishi Sinchayee Yojana), which cover 55% to 90% of installation costs for smallholders."
        ],
        bullets: [
          "In-line emitters: Best for close-spaced crops like vegetables and onions",
          "Online drippers: Best for wide-spaced crops like orchards and cotton",
          "Venturi injector: Allows applying Jeevamrutha directly through drip lines",
          "Filters: Sand and disc filters are mandatory to prevent emitter clogging"
        ]
      },
      {
        header: "Soil Mulching",
        title: "The Protective Blanket",
        icon: "🌾",
        content: [
          "Bare, exposed soil behaves like a boiling pan, losing up to 40% of its moisture directly to the sun through evaporation.",
          "Mulching is the practice of covering the soil surface with organic biomass like paddy straw, dry weeds, coconut husks, or dry leaves.",
          "Mulch acts as a thermal blanket, keeping soil cool in summer, retaining moisture for twice as long, and completely stopping weed growth."
        ],
        tip: "A 4-inch layer of paddy straw mulch can reduce your irrigation frequency from once every 4 days to once every 10 days."
      },
      {
        header: "Storage",
        title: "The Farm Pond Reservoir",
        icon: "🌧️",
        content: [
          "Indian monsoons are intense but brief. Most rain falls in 30 days and flows away unused. You must capture this rain on your own land.",
          "Dig a farm pond measuring 30ft × 30ft × 10ft at the lowest corner of your field. Line the bottom with a 500-micron plastic sheet to stop water from seeping away.",
          "This pond can store up to 2.5 lakh litres of rainwater—enough to provide emergency life-saving irrigation for 1 acre of crops during dry spells."
        ],
        quote: "Catch the rain where it falls, on your own farm."
      },
      {
        header: "Traditional Methods",
        title: "Furrow & Basin Redesign",
        icon: "🚜",
        content: [
          "If you cannot afford drip systems yet, you can still save 30% water by modifying your traditional irrigation layouts.",
          "Instead of flooding entire fields, dig furrows (channels) and sow crops on the raised ridges. Run water only inside the furrows, letting it soak sideways.",
          "For fruit orchards, use the Ring Basin method. Dig a circular basin around each tree canopy and irrigate only the ring, keeping the main soil dry."
        ],
        bullets: [
          "Ridge & Furrow: Cuts water use by 35% compared to flat flooding",
          "Ring Basin: Saves up to 50% water in orchards and plantations",
          "Double Basin: Prevents water from touching tree trunks, stopping collar rot"
        ]
      },
      {
        header: "Ecosystem",
        title: "Sponge Soil",
        icon: "🌿",
        content: [
          "The ultimate water reservoir is the soil itself. But soil can only hold water if it contains organic matter.",
          "One kilogram of organic carbon (humus) can hold up to six kilograms of water. It behaves exactly like a sponge buried underground.",
          "By adding rich compost, green manuring, and mulching, you increase soil organic matter, drought-proofing your farm for years to come."
        ],
        tip: "Increasing soil organic carbon from 0.5% to 1.5% increases the water holding capacity of your field by 1.5 lakh litres per acre."
      },
      {
        header: "Sowing Management",
        title: "Sowing with the Sun",
        icon: "⏰",
        content: [
          "Never water your fields during peak afternoon hours. Between 11 AM and 3 PM, up to 40% of irrigated water evaporates into the air before reaching roots.",
          "Always irrigate during early morning hours (5 AM to 8 AM). The cool air and low winds allow water to soak deep into the soil.",
          "For winter rabi crops, evening irrigation is ideal as it protects crops from frost damage during freezing nights."
        ],
        quote: "Water in the cool of the day, harvest in the warmth of prosperity."
      }
    ]
  }
];

export function getBookBySlug(slug: string): Book | undefined {
  return LIBRARY.find((b) => b.slug === slug);
}

export const CATEGORIES: { name: Book["category"]; count: number }[] = [
  { name: "Composting",     count: LIBRARY.filter((b) => b.category === "Composting").length },
  { name: "Bio-Inputs",     count: LIBRARY.filter((b) => b.category === "Bio-Inputs").length },
  { name: "Pest Control",   count: LIBRARY.filter((b) => b.category === "Pest Control").length },
  { name: "Certification",  count: LIBRARY.filter((b) => b.category === "Certification").length },
  { name: "Water",          count: LIBRARY.filter((b) => b.category === "Water").length },
];