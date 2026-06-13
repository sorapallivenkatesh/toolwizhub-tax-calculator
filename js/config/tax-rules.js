// Statutory tax parameters for India, FY 2020-21 through FY 2026-27.
//
// Sources (verified June 2026):
//   - New regime 115BAC slabs by year: referencer.in (AY 2021-22), ClearTax,
//     Budget 2023 (FY23-24), Budget 2024 (FY24-25), Budget 2025 (FY25-26).
//   - Standard deduction in new regime: none until FY22-23, ₹50k from FY23-24,
//     ₹75k from FY24-25 (Budget 2024).
//   - 87A rebate threshold (new): ₹5L (≤FY22-23), ₹7L (FY23-24/24-25),
//     ₹12L (FY25-26+). Marginal relief on rebate introduced FY23-24.
//   - Surcharge: 37% top rate; capped at 25% for the new regime from FY23-24.
//   - 80CCD(2) employer NPS: 10% (old, all years); 14% for new regime from
//     FY24-25 (Budget 2024), 10% before.
//
// FY strings sort lexicographically ("2020-21" < "2023-24"), so `fy >= "..."`
// is a valid year comparison and is used throughout.

export const FINANCIAL_YEARS = [
  "2020-21",
  "2021-22",
  "2022-23",
  "2023-24",
  "2024-25",
  "2025-26",
  "2026-27",
];

// Current Indian financial year (Apr 2026 – Mar 2027).
export const DEFAULT_FY = "2026-27";

// Slabs are [width, rate] pairs applied progressively; the final band uses Infinity.

// New Regime (115BAC), FY 2020-21 → 2022-23: seven bands of ₹2.5L.
const NEW_2020 = [
  [250000, 0],
  [250000, 0.05],
  [250000, 0.1],
  [250000, 0.15],
  [250000, 0.2],
  [250000, 0.25],
  [Infinity, 0.3],
];

// New Regime, FY 2023-24: 0-3-6-9-12-15L.
const NEW_2023 = [
  [300000, 0],
  [300000, 0.05],
  [300000, 0.1],
  [300000, 0.15],
  [300000, 0.2],
  [Infinity, 0.3],
];

// New Regime, FY 2024-25 (Budget 2024 revision): 0-3-7-10-12-15L.
const NEW_2024 = [
  [300000, 0],
  [400000, 0.05],
  [300000, 0.1],
  [200000, 0.15],
  [300000, 0.2],
  [Infinity, 0.3],
];

// New Regime, FY 2025-26 onwards (Budget 2025): 0-4-8-12-16-20-24L.
const NEW_2025 = [
  [400000, 0],
  [400000, 0.05],
  [400000, 0.1],
  [400000, 0.15],
  [400000, 0.2],
  [400000, 0.25],
  [Infinity, 0.3],
];

const NEW_SLABS = {
  "2020-21": NEW_2020,
  "2021-22": NEW_2020,
  "2022-23": NEW_2020,
  "2023-24": NEW_2023,
  "2024-25": NEW_2024,
  "2025-26": NEW_2025,
  "2026-27": NEW_2025,
};

// Old Regime slabs — unchanged across all supported years.
const OLD_SLABS = [
  [250000, 0],
  [250000, 0.05],
  [500000, 0.2],
  [Infinity, 0.3],
];

export function getSlabs(regime, fy) {
  if (regime === "old") return OLD_SLABS;
  return NEW_SLABS[fy] || NEW_SLABS[DEFAULT_FY];
}

// Standard deduction. Old regime: ₹50k every year. New regime: none until
// FY22-23, ₹50k for FY23-24, ₹75k from FY24-25.
export function standardDeduction(regime, fy) {
  if (regime === "old") return 50000;
  if (fy >= "2024-25") return 75000;
  if (fy >= "2023-24") return 50000;
  return 0;
}

// Section 87A rebate parameters per regime + year.
// Old regime: cancels tax (max ₹12,500) when taxable income ≤ ₹5L.
// New regime: cancels tax fully when taxable income ≤ threshold; marginal
// relief applies above the threshold from FY23-24 onwards.
export function rebate(regime, fy) {
  if (regime === "old") {
    return { threshold: 500000, maxRebate: 12500, full: false, marginalRelief: false };
  }
  let threshold;
  if (fy >= "2025-26") threshold = 1200000;
  else if (fy >= "2023-24") threshold = 700000;
  else threshold = 500000;
  return { threshold, full: true, marginalRelief: fy >= "2023-24" };
}

// Surcharge on tax (before cess). Old regime tops out at 37%; the new regime's
// 37% band was removed (capped at 25%) from FY23-24.
export function surchargeRate(ti, regime, fy) {
  if (ti > 50_000_000) {
    if (regime === "old") return 0.37;
    return fy >= "2023-24" ? 0.25 : 0.37;
  }
  if (ti > 20_000_000) return 0.25;
  if (ti > 10_000_000) return 0.15;
  if (ti > 5_000_000) return 0.1;
  return 0;
}

export const CESS_RATE = 0.04;

// Chapter VI-A statutory caps used to clamp user input (old regime only).
export const VIA_CAPS = {
  d80c: 150000,
  d80ccd1b: 50000,
  d24b: 200000,
  d80eea: 150000,
  d80eeb: 150000,
};

// Employer NPS 80CCD(2) exemption as a fraction of basic.
// Old: 10% (all years). New: 14% from FY24-25, 10% before.
export function npsEmployerRate(regime, fy) {
  if (regime === "old") return 0.1;
  return fy >= "2024-25" ? 0.14 : 0.1;
}
