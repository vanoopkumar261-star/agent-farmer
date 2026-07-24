export type Scheme = {
  id: string;
  name: string;
  short: string;
  category: "Income Support" | "Insurance" | "Credit" | "Subsidy" | "Advisory";
  benefit: string;
  eligibility: string[];
  deadline: string;
  authority: string;
  link: string;
};

// Curated real Indian central agriculture schemes.
export const SCHEMES: Scheme[] = [
  {
    id: "pm-kisan",
    name: "PM-KISAN",
    short: "₹6,000/year direct income support",
    category: "Income Support",
    benefit: "₹6,000 per year in 3 installments, paid directly to the bank account.",
    eligibility: ["Small & marginal landholding farmers", "Valid land records", "Aadhaar-linked bank account"],
    deadline: "Open · rolling registration",
    authority: "Ministry of Agriculture & Farmers Welfare",
    link: "https://pmkisan.gov.in",
  },
  {
    id: "pmfby",
    name: "PM Fasal Bima Yojana",
    short: "Crop insurance against yield loss",
    category: "Insurance",
    benefit: "Insurance cover for crop loss from natural calamities, pests & disease. Low premium (1.5–2%).",
    eligibility: ["Farmers growing notified crops", "Loanee & non-loanee farmers", "Enrol before the season cut-off"],
    deadline: "Kharif: 31 Jul · Rabi: 31 Dec",
    authority: "Ministry of Agriculture & Farmers Welfare",
    link: "https://pmfby.gov.in",
  },
  {
    id: "kcc",
    name: "Kisan Credit Card",
    short: "Low-interest crop loans up to ₹3 lakh",
    category: "Credit",
    benefit: "Short-term credit at 4% effective interest (with prompt repayment) for crops & allied activities.",
    eligibility: ["All farmers — owner/tenant cultivators", "Self-help groups & joint liability groups"],
    deadline: "Open · apply at any bank",
    authority: "NABARD / Banks",
    link: "https://www.myscheme.gov.in",
  },
  {
    id: "soil-health",
    name: "Soil Health Card",
    short: "Free soil testing & nutrient advice",
    category: "Advisory",
    benefit: "Field-level soil nutrient report with crop-wise fertilizer recommendations every 2 years.",
    eligibility: ["All farmers with cultivable land"],
    deadline: "Open · at soil testing centres",
    authority: "Department of Agriculture",
    link: "https://soilhealth.dac.gov.in",
  },
  {
    id: "pm-kusum",
    name: "PM-KUSUM",
    short: "Subsidy on solar pumps & panels",
    category: "Subsidy",
    benefit: "Up to 60% subsidy for solar irrigation pumps and grid-connected solar plants on farmland.",
    eligibility: ["Individual farmers & cooperatives", "Farmers with grid-connected pumps"],
    deadline: "State-wise · check portal",
    authority: "Ministry of New & Renewable Energy",
    link: "https://pmkusum.mnre.gov.in",
  },
  {
    id: "enam",
    name: "e-NAM",
    short: "Online national mandi marketplace",
    category: "Advisory",
    benefit: "Sell produce across mandis online for better price discovery and transparent payments.",
    eligibility: ["Registered farmers", "FPOs & traders"],
    deadline: "Open · free registration",
    authority: "Ministry of Agriculture & Farmers Welfare",
    link: "https://enam.gov.in",
  },
  {
    id: "agri-infra",
    name: "Agriculture Infrastructure Fund",
    short: "3% interest subvention on farm infra loans",
    category: "Credit",
    benefit: "Loans up to ₹2 crore for post-harvest infra (storage, cold chain) with 3% interest subvention.",
    eligibility: ["Farmers, FPOs, PACS, agri-entrepreneurs"],
    deadline: "Open till 2032-33",
    authority: "Ministry of Agriculture & Farmers Welfare",
    link: "https://agriinfra.dac.gov.in",
  },
  {
    id: "pmksy",
    name: "PM Krishi Sinchayee Yojana",
    short: "Micro-irrigation (drip/sprinkler) subsidy",
    category: "Subsidy",
    benefit: "Subsidy on drip & sprinkler systems under 'Per Drop More Crop' to improve water-use efficiency.",
    eligibility: ["Farmers adopting micro-irrigation", "Priority for water-scarce regions"],
    deadline: "State-wise · rolling",
    authority: "Department of Agriculture",
    link: "https://pmksy.gov.in",
  },
];
