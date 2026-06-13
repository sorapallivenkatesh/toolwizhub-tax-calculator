// Flexible Benefit Plan (Pluxee) component definitions.
// `regime: "both"` items are exempt under Old and New; `regime: "old"` items
// are exempt under the Old regime only. The same list drives the input cards
// and the tax engine, so the two can never drift apart.

export const FBP_COMPONENTS = [
  { key: "meal", label: "Meal (Pluxee Card)", regime: "both", default: true },
  { key: "tel", label: "Telephone & Data", regime: "both", default: true },
  { key: "driver", label: "Driver Salary", regime: "both", default: false },
  { key: "fuel", label: "Fuel Reimbursement", regime: "both", default: false },
  { key: "uniform", label: "Uniform / Office Wear", regime: "old", default: false },
  { key: "books", label: "Books & Periodicals", regime: "old", default: false },
  { key: "health", label: "Health & Wellness Reimbursement", regime: "old", default: false },
  { key: "cea", label: "Children Education Allowance", regime: "old", default: false },
];

// FBP is only utilisable under the New Regime from this FY onwards (company policy).
export const FBP_NEW_REGIME_FROM_FY = "2026-27";

// Per-FY maximum exempt annual amount for each component (the "Max" button).
// Driver/fuel pre-FY26-27 follow the older perquisite limits; FY26-27 uses the
// current Pluxee policy caps (fuel max = ₹84,000 for >1.6L vehicles).
const LEGACY_MAX = {
  meal: 26400,
  tel: 24000,
  driver: 300000,
  fuel: 300000,
  uniform: 36000,
  books: 40000,
  health: 36000,
  cea: 72000,
};

export const FBP_MAX = {
  "2020-21": LEGACY_MAX,
  "2021-22": LEGACY_MAX,
  "2022-23": LEGACY_MAX,
  "2023-24": LEGACY_MAX,
  "2024-25": {
    meal: 39600,
    tel: 24000,
    driver: 300000,
    fuel: 300000,
    uniform: 36000,
    books: 40000,
    health: 36000,
    cea: 72000,
  },
  "2025-26": {
    meal: 39600,
    tel: 24225,
    driver: 300000,
    fuel: 300000,
    uniform: 23500,
    books: 23333,
    health: 36000,
    cea: 72000,
  },
  "2026-27": {
    meal: 105600,
    tel: 24000,
    driver: 36000,
    fuel: 84000,
    uniform: 60000,
    books: 60000,
    health: 0,
    cea: 72000,
  },
};

// Per-FY guidance text shown under each component input.
// FY 2020-21 → 2023-24 predate the current Pluxee policy, so the limits below
// reflect the general statutory exemption basis rather than company-specific
// figures.
const LEGACY_HINTS = {
  meal: "Meal vouchers: ₹50/meal exempt (~₹26,400/yr) · valid bills",
  tel: "Telephone & internet: actual bills reimbursed by employer",
  driver: "Driver salary: exempt against actual cost · perquisite rules",
  fuel: "Fuel/conveyance: actual cost · RC + monthly log",
  uniform: "Uniform allowance: actual expenditure on office wear",
  books: "Books & periodicals: actual work-related expenditure",
  health: "Medical/wellness reimbursement against valid bills",
  cea: "₹36,000/child/yr · max ₹72,000/yr (2 children)",
};

export const FBP_HINTS = {
  "2020-21": LEGACY_HINTS,
  "2021-22": LEGACY_HINTS,
  "2022-23": LEGACY_HINTS,
  "2023-24": LEGACY_HINTS,
  "2024-25": {
    meal: "FY24-25: ~₹39,600/yr (₹3,300/m, pre-Pluxee)",
    tel: "FY24-25: ~₹24,000/yr (₹2,000/m)",
    driver: "FY24-25: up to ~₹3,00,000/yr (₹25,000/m)",
    fuel: "FY24-25: up to ~₹3,00,000/yr (₹25,000/m) · RC + monthly log",
    uniform: "FY24-25: ~₹36,000/yr (₹3,000/m)",
    books: "FY24-25: ~₹40,000/yr (₹3,333/m) · work-related only",
    health: "FY24-25: ~₹36,000/yr (₹3,000/m) · medical/wellness bills",
    cea: "₹36,000/child/yr · max ₹72,000/yr (2 children)",
  },
  "2025-26": {
    meal: "FY25-26: ₹39,600/yr (₹3,300/m, from your payslip)",
    tel: "FY25-26: up to ~₹24,225/yr (₹2,019/m avg)",
    driver: "FY25-26: up to ₹3,00,000/yr (₹25,000/m)",
    fuel: "FY25-26: up to ₹3,00,000/yr (₹25,000/m) · RC + monthly log",
    uniform: "FY25-26: up to ₹23,500/yr (₹1,958/m avg)",
    books: "FY25-26: up to ₹23,333/yr (₹1,944/m avg) · work-related only",
    health: "FY25-26: ₹36,000/yr (₹3,000/m) · medical/wellness bills",
    cea: "₹36,000/child/yr · max ₹72,000/yr (2 children)",
  },
  "2026-27": {
    meal: "FY26-27: ₹1,05,600/yr (₹8,800/m, new Pluxee policy)",
    tel: "FY26-27: ₹24,000/yr (₹2,000/m)",
    driver: "FY26-27: ₹36,000/yr (₹3,000/m) · bills + driver's licence",
    fuel: "FY26-27: ₹60,000/yr (≤1.6L, ₹5K/m) or ₹84,000/yr (>1.6L, ₹7K/m) · RC + monthly log",
    uniform: "FY26-27: ₹60,000/yr (₹5,000/m)",
    books: "FY26-27: ₹60,000/yr (₹5,000/m) · work-related only",
    health: "Not in FY26-27 Pluxee policy (discontinued)",
    cea: "₹36,000/child/yr · max ₹72,000/yr (2 children)",
  },
};
