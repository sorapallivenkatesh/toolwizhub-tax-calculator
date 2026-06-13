// Renders the command-center view from computed scenarios. A single `bestIdx`
// (lowest total tax = highest retained, since gross is constant) drives every
// highlight — hero, scenario cards, and matrix can never disagree.

import { $, fmt } from "./dom.js";
import { FBP_HINTS } from "../config/fbp.js";
import { computeScenarios } from "../core/tax-engine.js";
import { renderDocuments } from "./documents.js";
import {
  FINANCIAL_YEARS,
  getSlabs,
  standardDeduction,
  rebate,
  npsEmployerRate,
  VIA_CAPS,
} from "../config/tax-rules.js";

const M = (n) => fmt(n / 12); // monthly
const pct = (part, whole) => (whole > 0 ? (part / whole) * 100 : 0);

// Distribution colors (Bank / Pluxee / NPS / Tax)
const SEG = {
  bank: "#7c8cff",
  pluxee: "#a78bfa",
  nps: "#22d3ee",
  tax: "#f87171",
};

function applyHints(fy) {
  const hints = FBP_HINTS[fy] || FBP_HINTS["2026-27"];
  for (const key in hints) {
    const el = $("hint_" + key);
    if (el) el.textContent = hints[key];
  }
}

function syncFbpToggleStyles() {
  document.querySelectorAll(".fbp-toggle").forEach((cb) => {
    const wrap = cb.closest(".fbp-item");
    if (wrap) wrap.classList.toggle("off", !cb.checked);
  });
}

// Which scenario the hero/cashflow are showing. null = follow the recommended
// (best) scenario; a number = a card the user explicitly clicked. Scenario
// order is fixed (see SCENARIOS), so the index stays stable across re-renders.
let selectedIdx = null;
let lastResults = null;
let lastInputs = null;

function bestIndex(results) {
  let best = 0;
  results.forEach((r, i) => {
    if (r.totalTax < results[best].totalTax) best = i;
  });
  return best;
}

function renderHero(results, idx, bestIdx) {
  const r = results[idx];
  const isBest = idx === bestIdx;
  const retained = r.gross - r.totalTax;
  const bank = retained - r.pluxeeTotal - r.npsTotal;

  // Compare best take-home against the plain Old Regime (no FBP) baseline.
  const baseline = results.find((x) => x.regime === "old" && !x.fbp);
  const baseRetained = baseline ? baseline.gross - baseline.totalTax : retained;
  const deltaPct = pct(retained - baseRetained, baseRetained);
  const deltaCls = deltaPct < 0 ? " neg" : "";
  const deltaTxt =
    Math.abs(deltaPct) < 0.05
      ? "matches Old Regime"
      : `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}% vs Old Regime`;

  const segs = [
    ["bank", "Bank", bank],
    ["pluxee", "Pluxee", r.pluxeeTotal],
    ["nps", "NPS", r.npsTotal],
    ["tax", "Tax", r.totalTax],
  ].filter(([, , v]) => v > 0);

  const barHtml = segs
    .map(([k, , v]) => {
      const p = pct(v, r.gross);
      return `<div class="dist-seg" style="flex:${p};background:${SEG[k]}">${p >= 7 ? p.toFixed(0) + "%" : ""}</div>`;
    })
    .join("");

  const legendHtml = segs
    .map(
      ([k, label, v]) =>
        `<span><i style="background:${SEG[k]}"></i>${label}: ${M(v)}</span>`,
    )
    .join("");

  const eyebrow = isBest
    ? "Recommended Selection"
    : `Viewing: ${r.name}`;
  const recoNote = isBest
    ? ""
    : `<span class="hero-reco" data-reco="1">← Recommended is ${results[bestIdx].name}</span>`;

  $("hero").innerHTML = `
    <div class="hero-left">
      <span class="hero-eyebrow">${eyebrow} ${recoNote}</span>
      <div class="hero-amount">${M(retained)} <span class="hero-delta${deltaCls}">${deltaTxt}</span></div>
      <p class="hero-sub">
        Monthly take-home (retained) on <b>${r.name}</b> — your CTC minus tax,
        split across Bank, Pluxee &amp; NPS.
      </p>
    </div>
    <div class="hero-right">
      <div class="dist-head">
        <span class="eyebrow">Income Distribution</span>
        <div class="dist-ctc"><span>Monthly CTC</span><b>${M(r.gross)}</b></div>
      </div>
      <div class="dist-bar">${barHtml}</div>
      <div class="dist-legend">${legendHtml}</div>
    </div>`;
}

function renderScenarioCards(results, bestIdx, activeIdx) {
  $("scenario-cards").innerHTML = results
    .map((r, i) => {
      const retained = r.gross - r.totalTax;
      const isBest = i === bestIdx;
      const isActive = i === activeIdx;
      return `
      <button type="button" class="scard ${isBest ? "best" : ""} ${isActive ? "selected" : ""}" data-idx="${i}">
        ${isBest ? '<span class="scard-badge">BEST</span>' : ""}
        <div class="scard-name">${r.name}</div>
        <div class="scard-amt">${fmt(retained)} <small>/yr</small></div>
        <div class="scard-foot">Tax ${fmt(r.totalTax)}</div>
      </button>`;
    })
    .join("");

  // Clicking a card drives the hero + cashflow to that scenario.
  document.querySelectorAll("#scenario-cards .scard").forEach((el) => {
    el.addEventListener("click", () => {
      selectedIdx = Number(el.dataset.idx);
      if (lastResults && lastInputs) renderResults(lastResults, lastInputs);
    });
  });
}

function renderMatrix(results, bestIdx) {
  const colCls = (i) => (i === bestIdx ? "col-best" : "");
  const head = `<thead><tr><th>Component</th>${results
    .map((r, i) => `<th class="${colCls(i)}">${r.name}</th>`)
    .join("")}</tr></thead>`;

  const row = (label, pick, opts = {}) => {
    const cls = opts.rowCls || "";
    const cells = results
      .map((r, i) => {
        const val = pick(r);
        const neg = opts.negative ? " neg" : "";
        const text = opts.negative && val ? `(${fmt(val)})` : fmt(val);
        return `<td class="${colCls(i)}${neg}">${text}</td>`;
      })
      .join("");
    return `<tr class="${cls}"><td>${label}</td>${cells}</tr>`;
  };

  const body = `<tbody>
    ${row("Annual Gross (CTC)", (r) => r.gross)}
    ${row("Exemptions / Deductions", (r) => r.deductions, { negative: true })}
    ${row("Taxable Income", (r) => r.ti, { rowCls: "row-ti" })}
    ${row("Income Tax", (r) => r.taxBeforeCess)}
    ${row("Cess (4%)", (r) => r.cess)}
    ${row("Net Tax Liability", (r) => r.totalTax, { rowCls: "row-net" })}
  </tbody>`;

  $("matrix").innerHTML = head + body;
}

function renderCashflow(results, activeIdx) {
  const r = results[activeIdx];
  const retained = r.gross - r.totalTax;
  const bank = retained - r.pluxeeTotal - r.npsTotal;
  const rows = [
    ["bank", "Bank (liquid)", bank],
    ["pluxee", "Pluxee Card", r.pluxeeTotal],
    ["nps", "NPS (locked)", r.npsTotal],
    ["tax", "Tax outgo", r.totalTax],
  ].filter(([, , v]) => v > 0);

  $("cashflow").innerHTML = rows
    .map(
      ([k, label, v]) => `
      <div class="cashflow-row">
        <i style="background:${SEG[k]}"></i>
        <span class="cf-label">${label}</span>
        <span class="cf-track"><span class="cf-fill" style="width:${pct(v, r.gross)}%;background:${SEG[k]}"></span></span>
        <span class="cf-amt">${M(v)}/m</span>
      </div>`,
    )
    .join("");
}

function renderInsights(results, bestIdx) {
  const r = results[bestIdx];
  const items = [];

  const oldBase = results.find((x) => x.regime === "old" && !x.fbp);
  const newBase = results.find((x) => x.regime === "new" && !x.fbp);
  if (oldBase && newBase) {
    const diff = oldBase.totalTax - newBase.totalTax;
    if (Math.abs(diff) > 1) {
      const cheaper = diff > 0 ? "New" : "Old";
      items.push(
        `Before FBP, the <b>${cheaper} Regime</b> is cheaper by <b>${fmt(Math.abs(diff))}</b>/yr in tax.`,
      );
    }
  }

  // FBP benefit within the recommended regime.
  const sameRegimeNoFbp = results.find(
    (x) => x.regime === r.regime && !x.fbp,
  );
  if (sameRegimeNoFbp) {
    const fbpSaving = sameRegimeNoFbp.totalTax - r.totalTax;
    if (r.fbp && fbpSaving > 1) {
      items.push(
        `FBP loads <b>${fmt(r.pluxeeTotal)}</b>/yr tax-free and cuts tax by <b>${fmt(fbpSaving)}</b>/yr.`,
      );
    }
  }

  if (r.npsTotal > 0) {
    items.push(
      `Employer NPS routes <b>${fmt(r.npsTotal)}</b>/yr tax-free (locked till retirement).`,
    );
  }

  const worst = results.reduce((a, b) => (b.totalTax > a.totalTax ? b : a));
  const saving = worst.totalTax - r.totalTax;
  if (saving > 1) {
    items.push(
      `Picking <b>${r.name}</b> over the worst option saves <b>${fmt(saving)}</b>/yr.`,
    );
  }

  // Surface any regime/FY warning attached to scenarios.
  results
    .filter((x) => x.warning)
    .slice(0, 1)
    .forEach((x) => items.push({ warn: true, text: x.warning }));

  if (!items.length) items.push("Enter your salary to see tailored insights.");

  $("insights").innerHTML = items
    .map((it) =>
      typeof it === "string"
        ? `<li><span>${it}</span></li>`
        : `<li class="warn"><span>${it.text}</span></li>`,
    )
    .join("");
}

// Marginal slab rate: the rate of the band that the last rupee of `ti` lands in.
function marginalRate(ti, regime, fy) {
  let acc = 0;
  let rate = 0;
  for (const [width, r] of getSlabs(regime, fy)) {
    rate = r;
    acc += width;
    if (ti <= acc) break;
  }
  return rate;
}

function renderStatStrip(results, idx) {
  const r = results[idx];
  const effective = r.gross > 0 ? (r.totalTax / r.gross) * 100 : 0;
  const marginal = marginalRate(r.ti, r.regime, r.fy) * 100;
  const stats = [
    ["Effective tax rate", `${effective.toFixed(1)}%`, "tax / gross CTC"],
    ["Marginal rate", `${marginal.toFixed(0)}%`, "on your next ₹ earned"],
    ["Deductions used", fmt(r.deductions), "exemptions + deductions"],
    ["Take-home rate", `${(100 - effective).toFixed(1)}%`, "retained of CTC"],
  ];
  $("stat-strip").innerHTML = stats
    .map(
      ([label, val, sub]) => `
      <div class="stat">
        <span class="stat-label">${label}</span>
        <b class="stat-val">${val}</b>
        <span class="stat-sub">${sub}</span>
      </div>`,
    )
    .join("");
}

function renderYoY(inputs, currentFy) {
  // Tax the same inputs under each year's rules; take the best regime per year.
  const points = FINANCIAL_YEARS.map((fy) => {
    const res = computeScenarios({ ...inputs, fy });
    const best = res[bestIndex(res)];
    return { fy, tax: best.totalTax, take: best.gross - best.totalTax, name: best.name };
  });
  const maxTake = Math.max(...points.map((p) => p.take), 1);

  $("yoy").innerHTML = points
    .map((p) => {
      const h = Math.max(4, (p.take / maxTake) * 100);
      const cur = p.fy === currentFy ? " current" : "";
      return `
      <div class="yoy-col${cur}" title="${p.name}: take-home ${fmt(p.take)} · tax ${fmt(p.tax)}">
        <span class="yoy-val">${fmt(p.take)}</span>
        <div class="yoy-bar" style="height:${h}%"></div>
        <span class="yoy-tax">tax ${fmt(p.tax)}</span>
        <span class="yoy-fy">${p.fy}</span>
      </div>`;
    })
    .join("");
}

function renderAssumptions(fy) {
  const newSlabsTxt = getSlabs("new", fy)
    .map(([w, r], i, a) => {
      const lo = a.slice(0, i).reduce((s, [ww]) => s + ww, 0);
      const hi = w === Infinity ? "+" : `–${(lo + w) / 100000}L`;
      return `${(lo / 100000) | 0}${hi} @ ${(r * 100).toFixed(0)}%`;
    })
    .join(", ");
  const reb = rebate("new", fy);
  const std = standardDeduction("new", fy);
  const items = [
    `<b>New Regime slabs (FY ${fy}):</b> ${newSlabsTxt}.`,
    `<b>Standard deduction:</b> New ${std ? fmt(std) : "none this year"}, Old ${fmt(50000)}.`,
    `<b>87A rebate (New):</b> full rebate up to taxable income ${fmt(reb.threshold)}${reb.marginalRelief ? " (marginal relief above)" : " (no marginal relief)"}.`,
    `<b>Employer NPS 80CCD(2):</b> ${(npsEmployerRate("new", fy) * 100).toFixed(0)}% of Basic (New), ${(npsEmployerRate("old", fy) * 100).toFixed(0)}% (Old).`,
    `<b>Old Regime:</b> slabs unchanged across all years; HRA, 80C/80D and Chapter VI-A apply only here.`,
    `<b>FBP / Pluxee</b> caps follow company policy; usable in the New Regime only from FY 2026-27.`,
    `Figures are estimates for salaried individuals (age &lt; 60) and exclude state-specific levies. Verify with a tax professional before filing.`,
  ];
  $("assumptions").innerHTML = items.map((t) => `<li>${t}</li>`).join("");
}

function renderHeadroom(inputs, results, bestIdx) {
  const v = inputs.via;
  const meters = [
    ["Section 80C", Math.min(v.d80c, VIA_CAPS.d80c), VIA_CAPS.d80c],
    ["NPS 80CCD(1B)", Math.min(v.d80ccd1b, VIA_CAPS.d80ccd1b), VIA_CAPS.d80ccd1b],
    ["80D — Health (typical ₹25k)", Math.min(v.d80d, 25000), 25000],
    ["24(b) — Home loan", Math.min(v.d24b, VIA_CAPS.d24b), VIA_CAPS.d24b],
  ];
  const oldIsBest = results[bestIdx].regime === "old";
  const note = oldIsBest
    ? ""
    : `<p class="hint">Note: the recommended pick is a <b>New Regime</b> scenario, where these deductions don't reduce tax. They matter only if you choose the Old Regime.</p>`;
  $("headroom").innerHTML =
    meters
      .map(([label, used, cap]) => {
        const p = Math.min(100, (used / cap) * 100);
        const left = Math.max(0, cap - used);
        return `
      <div class="meter">
        <div class="meter-top">
          <span>${label}</span>
          <span class="meter-amt">${fmt(used)} / ${fmt(cap)}</span>
        </div>
        <div class="meter-track"><div class="meter-fill" style="width:${p}%"></div></div>
        <span class="meter-left">${left > 0 ? `${fmt(left)} headroom left` : "fully used"}</span>
      </div>`;
      })
      .join("") + note;
}

function renderOptTips(inputs, results, bestIdx) {
  const v = inputs.via;
  const best = results[bestIdx];
  const oldMarginal = marginalRate(
    results.find((r) => r.regime === "old" && !r.fbp).ti,
    "old",
    inputs.fy,
  );
  const tips = [];

  if (best.regime === "old") {
    const c80 = VIA_CAPS.d80c - Math.min(v.d80c, VIA_CAPS.d80c);
    if (c80 > 0)
      tips.push(
        `Invest <b>${fmt(c80)}</b> more in 80C to save about <b>${fmt(c80 * oldMarginal)}</b>/yr in tax.`,
      );
    const cnps = VIA_CAPS.d80ccd1b - Math.min(v.d80ccd1b, VIA_CAPS.d80ccd1b);
    if (cnps > 0)
      tips.push(
        `Add <b>${fmt(cnps)}</b> to NPS 80CCD(1B) to save about <b>${fmt(cnps * oldMarginal)}</b>/yr.`,
      );
    if (inputs.hra === 0 || inputs.rent === 0)
      tips.push(
        `Enter HRA received and rent paid — HRA exemption can be a large Old-Regime saver.`,
      );
  } else {
    tips.push(
      `You're best off in the <b>New Regime</b>: most deductions (80C, 80D, HRA) won't change your tax, so don't lock money away purely to "save tax".`,
    );
    if (!inputs.npsEnabled)
      tips.push(
        `Enable Employer NPS 80CCD(2) — it's the one major deduction that still works in the New Regime.`,
      );
  }

  const oldNoFbp = results.find((r) => r.regime === "old" && !r.fbp);
  const oldFbp = results.find((r) => r.regime === "old" && r.fbp);
  if (oldFbp && oldNoFbp && oldFbp.totalTax < oldNoFbp.totalTax - 1)
    tips.push(
      `Turning on FBP components saves <b>${fmt(oldNoFbp.totalTax - oldFbp.totalTax)}</b>/yr under the Old Regime — use the Max buttons to fill statutory limits.`,
    );

  if (!tips.length)
    tips.push("Your inputs are already well optimized for the selected year.");

  $("opt-tips").innerHTML = tips
    .map((t) => `<li><span>${t}</span></li>`)
    .join("");
}

export function renderResults(results, inputs) {
  // Remember the latest data so a card click can re-render without recomputing.
  lastResults = results;
  lastInputs = inputs;
  const fy = inputs.fy;

  syncFbpToggleStyles();
  applyHints(fy);

  const pill = $("fy-pill-label");
  if (pill) pill.textContent = `FY ${fy} Active`;

  const bestIdx = bestIndex(results);
  // Hero + cashflow follow the user's selected card, else the recommended one.
  const activeIdx =
    selectedIdx != null && selectedIdx < results.length ? selectedIdx : bestIdx;

  // Deductions total reflects the recommended (best) scenario's deductions.
  const dedTotal = $("ded-total");
  if (dedTotal) dedTotal.textContent = fmt(results[bestIdx].deductions);

  renderHero(results, activeIdx, bestIdx);
  renderStatStrip(results, activeIdx);
  renderScenarioCards(results, bestIdx, activeIdx);
  renderMatrix(results, bestIdx);
  renderCashflow(results, activeIdx);
  renderInsights(results, bestIdx);
  renderYoY(inputs, fy);
  renderAssumptions(fy);
  renderHeadroom(inputs, results, bestIdx);
  renderOptTips(inputs, results, bestIdx);
  renderDocuments(inputs, results, bestIdx);
}
