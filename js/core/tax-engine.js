// Pure tax computation. No DOM access — it takes a plain `inputs` object
// (see js/dom/inputs.js) and returns a computed scenario result. This makes
// the engine independently testable.

import {
  getSlabs,
  surchargeRate,
  standardDeduction,
  rebate,
  CESS_RATE,
  VIA_CAPS,
  npsEmployerRate,
} from "../config/tax-rules.js";
import { FBP_COMPONENTS, FBP_NEW_REGIME_FROM_FY } from "../config/fbp.js";

export function hraExemption(basic, hraReceived, rentPaid, metro) {
  if (rentPaid <= 0 || hraReceived <= 0) return 0;
  const pct = metro ? 0.5 : 0.4;
  return Math.max(
    0,
    Math.min(hraReceived, rentPaid - 0.1 * basic, pct * basic),
  );
}

export function slabTax(ti, regime, fy) {
  let tax = 0;
  let remaining = ti;
  for (const [width, rate] of getSlabs(regime, fy)) {
    const taxable = Math.min(remaining, width);
    tax += taxable * rate;
    remaining -= taxable;
    if (remaining <= 0) break;
  }
  return tax;
}

// Sum exempt FBP for the active regime. "old" components only count under old.
function fbpExempt(fbp, regime) {
  return FBP_COMPONENTS.reduce((sum, c) => {
    if (c.regime === "old" && regime !== "old") return sum;
    return sum + (fbp[c.key] || 0);
  }, 0);
}

/**
 * Compute a single scenario.
 * @param {object} inputs    Collected form values.
 * @param {"old"|"new"} regime
 * @param {boolean} includeFBP
 * @returns {{lines, totalTax, ti, gross, pluxeeTotal, npsTotal, warning}}
 */
export function calc(inputs, regime, includeFBP) {
  const { fy, gross, basic } = inputs;
  const lines = [];
  lines.push(["Gross Salary", gross]);
  let ti = gross;

  let pluxeeTotal = 0;
  let npsTotal = 0;

  const fbpAllowedInNewRegime = fy >= FBP_NEW_REGIME_FROM_FY;
  const effectiveFBP =
    includeFBP && (regime === "old" || fbpAllowedInNewRegime);
  let warning = null;
  if (includeFBP && regime === "new" && !fbpAllowedInNewRegime) {
    warning =
      "FBP not utilisable in New Regime before FY 2026-27 — shown as no-FBP equivalent";
  }

  // FBP exemptions (annual amounts). Pluxee only loads what's tax-exempt
  // under the active regime; non-exempt items stay liquid in the bank.
  if (effectiveFBP) {
    const fbpTotal = fbpExempt(inputs.fbp, regime);
    pluxeeTotal = fbpTotal;
    if (fbpTotal > 0) {
      lines.push(["Less: FBP Exemptions", -fbpTotal]);
      ti -= fbpTotal;
    }
  }

  // Employer NPS 80CCD(2)
  if (inputs.npsEnabled) {
    const rate = npsEmployerRate(regime, fy);
    const npsAmt = basic * rate;
    npsTotal = npsAmt;
    if (npsAmt > 0) {
      lines.push([
        `Less: Employer NPS 80CCD(2) — ${(rate * 100).toFixed(0)}% of Basic`,
        -npsAmt,
      ]);
      ti -= npsAmt;
    }
  }

  // HRA exemption (old regime only)
  if (regime === "old") {
    const hraEx = hraExemption(basic, inputs.hra, inputs.rent, inputs.metro);
    if (hraEx > 0) {
      lines.push(["Less: HRA Exemption", -hraEx]);
      ti -= hraEx;
    }
  }

  // Standard deduction (new regime had none before FY23-24)
  const stdDed = standardDeduction(regime, fy);
  if (stdDed > 0) {
    lines.push(["Less: Standard Deduction", -stdDed]);
    ti -= stdDed;
  }

  // Chapter VI-A deductions + LTA (old regime only)
  if (regime === "old") {
    const v = inputs.via;
    if (v.lta > 0) {
      lines.push(["Less: LTA Exemption", -v.lta]);
      ti -= v.lta;
    }
    const via =
      Math.min(VIA_CAPS.d80c, v.d80c) +
      Math.min(VIA_CAPS.d80ccd1b, v.d80ccd1b) +
      v.d80d +
      v.d80e +
      Math.min(VIA_CAPS.d24b, v.d24b) +
      Math.min(VIA_CAPS.d80eea, v.d80eea) +
      Math.min(VIA_CAPS.d80eeb, v.d80eeb) +
      v.d80g;
    if (via > 0) {
      lines.push([
        "Less: Chapter VI-A (80C/80D/80E/24b/80EEA/80EEB/80G/80CCD1B)",
        -via,
      ]);
      ti -= via;
    }
  }

  ti = Math.max(0, ti);
  lines.push(["Taxable Income", ti, "total-ti"]);

  // Tax per slab
  let tax = slabTax(ti, regime, fy);
  lines.push(["Tax per slab", tax, "minor"]);

  // Section 87A rebate
  const reb = rebate(regime, fy);
  if (reb.full) {
    // New regime: full tax cancellation up to the threshold.
    if (ti <= reb.threshold) {
      lines.push([
        `Less: 87A Rebate (TI ≤ ₹${reb.threshold / 100000}L)`,
        -tax,
        "minor",
      ]);
      tax = 0;
    } else if (reb.marginalRelief) {
      const excess = ti - reb.threshold;
      if (tax > excess) {
        lines.push(["Less: Marginal Relief", -(tax - excess), "minor"]);
        tax = excess;
      }
    }
  } else if (ti <= reb.threshold && tax > 0) {
    // Old regime: rebate capped at maxRebate.
    const amount = Math.min(tax, reb.maxRebate);
    lines.push([`Less: 87A Rebate (TI ≤ ₹${reb.threshold / 100000}L)`, -amount, "minor"]);
    tax -= amount;
  }

  // Surcharge
  const sr = surchargeRate(ti, regime, fy);
  const sur = tax * sr;
  if (sur > 0) {
    lines.push([`Surcharge (${(sr * 100).toFixed(0)}%)`, sur, "minor"]);
  }

  // Cess
  const cess = (tax + sur) * CESS_RATE;
  if (cess > 0) {
    lines.push(["Health & Education Cess (4%)", cess, "minor"]);
  }

  const totalTax = tax + sur + cess;
  return {
    lines,
    totalTax,
    taxBeforeCess: tax + sur,
    cess,
    deductions: gross - ti,
    ti,
    gross,
    pluxeeTotal,
    npsTotal,
    warning,
  };
}

export const SCENARIOS = [
  { name: "Old Regime + FBP", regime: "old", fbp: true },
  { name: "Old Regime (no FBP)", regime: "old", fbp: false },
  { name: "New Regime + FBP", regime: "new", fbp: true },
  { name: "New Regime (no FBP)", regime: "new", fbp: false },
];

// Run every scenario for a given input set.
export function computeScenarios(inputs) {
  return SCENARIOS.map((s) => ({
    ...s,
    ...calc(inputs, s.regime, s.fbp),
  }));
}
