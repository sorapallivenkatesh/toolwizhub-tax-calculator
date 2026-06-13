// Documents tab — all client-side (localStorage + file download/upload):
//   • Saved profiles + JSON export/import (raw form snapshot for fidelity)
//   • Proof / document checklist derived from entered figures
//   • Printable tax computation statement + CSV export of the scenario matrix
//   • Investment declaration figures to hand to payroll

import { $, fmt } from "./dom.js";
import { FBP_COMPONENTS } from "../config/fbp.js";

const STORE_KEY = "taxcalc.profiles";

// --- form snapshot (round-trips every control by id) ---
function snapshotForm() {
  const snap = {};
  document.querySelectorAll("input, select").forEach((el) => {
    if (!el.id) return;
    snap[el.id] = el.type === "checkbox" ? { checked: el.checked } : { value: el.value };
  });
  return snap;
}

function restoreForm(snap) {
  Object.entries(snap || {}).forEach(([id, v]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!v.checked;
    else if (v.value !== undefined) el.value = v.value;
  });
}

// --- profiles (localStorage) ---
function loadProfiles() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}
function persistProfiles(p) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p));
  } catch {
    /* storage may be unavailable */
  }
}

function download(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

let rerender = () => {};

export function initDocuments(renderFn) {
  rerender = renderFn || (() => {});

  $("save-profile")?.addEventListener("click", () => {
    const nameEl = $("profile-name");
    const name = (nameEl.value || "").trim();
    if (!name) {
      nameEl.focus();
      return;
    }
    const profiles = loadProfiles();
    profiles[name] = snapshotForm();
    persistProfiles(profiles);
    nameEl.value = "";
    rerender();
  });

  // Load / delete via delegation (rows are re-rendered).
  $("profiles-list")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const name = btn.dataset.name;
    const profiles = loadProfiles();
    if (btn.dataset.act === "load" && profiles[name]) {
      restoreForm(profiles[name]);
      rerender();
    } else if (btn.dataset.act === "del") {
      delete profiles[name];
      persistProfiles(profiles);
      rerender();
    }
  });

  $("export-json")?.addEventListener("click", () => {
    download("tax-config.json", JSON.stringify(snapshotForm(), null, 2), "application/json");
  });

  $("import-json")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        restoreForm(JSON.parse(reader.result));
        rerender();
      } catch {
        alert("Could not read that file — expected a tax-config JSON export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  $("print-statement")?.addEventListener("click", () => window.print());

  $("export-csv")?.addEventListener("click", () => {
    if (csvCache) download("tax-scenarios.csv", csvCache, "text/csv");
  });

  $("copy-declaration")?.addEventListener("click", async () => {
    const btn = $("copy-declaration");
    try {
      await navigator.clipboard.writeText(declarationCache);
      const old = btn.textContent;
      btn.textContent = "✓ Copied";
      setTimeout(() => (btn.textContent = old), 1500);
    } catch {
      alert("Copy failed — select the text manually.");
    }
  });
}

// --- dynamic content (re-rendered on every input change) ---
let csvCache = "";
let declarationCache = "";

function renderProfiles() {
  const list = $("profiles-list");
  if (!list) return;
  const profiles = loadProfiles();
  const names = Object.keys(profiles);
  if (!names.length) {
    list.innerHTML = `<p class="hint">No saved profiles yet.</p>`;
    return;
  }
  list.innerHTML = names
    .map(
      (name) => `
      <div class="profile-row">
        <span class="profile-name">${name}</span>
        <span class="profile-meta">FY ${profiles[name].fy?.value || "—"} · ₹${Number(profiles[name].gross?.value || 0).toLocaleString("en-IN")}</span>
        <button class="mini-btn" data-act="load" data-name="${name}">Load</button>
        <button class="mini-btn danger" data-act="del" data-name="${name}">Delete</button>
      </div>`,
    )
    .join("");
}

function renderChecklist(inputs, results, bestIdx) {
  const v = inputs.via;
  const best = results[bestIdx];
  const newRegime = best.regime === "new";
  const items = [];
  const add = (cond, text, appliesNew) => {
    if (cond) items.push({ text, appliesNew });
  };

  add(v.d80c > 0, `80C (${fmt(v.d80c)}) — ELSS / PPF / LIC / EPF / tuition receipts`, false);
  add(v.d80ccd1b > 0, `80CCD(1B) (${fmt(v.d80ccd1b)}) — NPS contribution statement`, false);
  add(v.d80d > 0, `80D (${fmt(v.d80d)}) — health insurance premium receipt`, false);
  add(v.d80e > 0, `80E — education loan interest certificate`, false);
  add(v.d24b > 0, `24(b) (${fmt(v.d24b)}) — home loan interest certificate`, false);
  add(v.d80eea > 0, `80EEA — affordable-housing loan certificate`, false);
  add(v.d80eeb > 0, `80EEB — EV loan interest certificate`, false);
  add(v.d80g > 0, `80G — donation receipts (with 80G reg. number)`, false);
  add(v.lta > 0, `LTA — domestic travel tickets / bills`, false);
  if (inputs.rent > 0) {
    const pan = inputs.rent > 100000 ? " + landlord PAN (rent > ₹1,00,000/yr)" : "";
    add(true, `HRA — monthly rent receipts${pan}`, false);
  }
  // FBP components that are on with an amount.
  FBP_COMPONENTS.forEach((c) => {
    const amt = inputs.fbp[c.key] || 0;
    if (amt > 0)
      add(true, `FBP ${c.label} (${fmt(amt)}) — bills / Pluxee statement`, c.regime === "both");
  });
  add(inputs.npsEnabled, `Employer NPS 80CCD(2) — Form 16 Part B`, true);

  const banner = newRegime
    ? `<div class="doc-banner">Recommended pick is a <b>New Regime</b> scenario. Items tagged <span class="tag-new">New</span> reduce tax there; the rest are needed only if you file under the Old Regime.</div>`
    : "";

  $("checklist").innerHTML =
    banner +
    (items.length
      ? `<ul class="checklist">` +
        items
          .map(
            (it) =>
              `<li><input type="checkbox" /> <span>${it.text}</span>${
                it.appliesNew ? '<span class="tag-new">New</span>' : ""
              }</li>`,
          )
          .join("") +
        `</ul>`
      : `<p class="hint">Enter deductions or FBP amounts to build your proof checklist.</p>`);
}

function renderStatement(results, bestIdx) {
  const r = results[bestIdx];
  const rows = r.lines
    .filter((l) => (l[2] || "") !== "minor")
    .map(
      ([label, amt]) =>
        `<div class="stmt-line"><span>${label}</span><span>${fmt(amt)}</span></div>`,
    )
    .join("");
  $("statement").innerHTML = `
    <div class="stmt">
      <div class="stmt-brand">
        <img src="assets/logo-horizontal.webp" alt="ToolWizHub" />
      </div>
      <div class="stmt-head">${r.name} · FY ${r.fy}</div>
      ${rows}
      <div class="stmt-line stmt-tax"><span>Total Tax</span><span>${fmt(r.totalTax)}</span></div>
      <div class="stmt-line stmt-net"><span>Take-home (retained)</span><span>${fmt(r.gross - r.totalTax)}</span></div>
    </div>`;
}

function buildCsv(results) {
  const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const header = ["Component", ...results.map((r) => r.name)];
  const rowsDef = [
    ["Annual Gross (CTC)", (r) => r.gross],
    ["Exemptions / Deductions", (r) => r.deductions],
    ["Taxable Income", (r) => r.ti],
    ["Income Tax", (r) => Math.round(r.taxBeforeCess)],
    ["Cess (4%)", (r) => Math.round(r.cess)],
    ["Net Tax Liability", (r) => Math.round(r.totalTax)],
    ["Take-home (retained)", (r) => Math.round(r.gross - r.totalTax)],
  ];
  const lines = [header.map(esc).join(",")];
  for (const [label, pick] of rowsDef) {
    lines.push([esc(label), ...results.map((r) => pick(r))].join(","));
  }
  return lines.join("\n");
}

function renderDeclaration(inputs, results, bestIdx) {
  const best = results[bestIdx];
  const lines = [
    `Tax Declaration — FY ${inputs.fy}`,
    `Preferred regime: ${best.regime === "new" ? "New" : "Old"} Regime`,
    `Annual Gross (CTC): ${fmt(inputs.gross)}`,
    `Annual Basic: ${fmt(inputs.basic)}`,
  ];
  const fbpOn = FBP_COMPONENTS.filter((c) => (inputs.fbp[c.key] || 0) > 0);
  if (fbpOn.length) {
    lines.push("FBP / Pluxee declaration:");
    fbpOn.forEach((c) => lines.push(`  • ${c.label}: ${fmt(inputs.fbp[c.key])}`));
  }
  if (inputs.npsEnabled) lines.push("Opt in to Employer NPS 80CCD(2): Yes");
  if (best.regime === "old") {
    if (inputs.rent > 0) lines.push(`HRA — annual rent: ${fmt(inputs.rent)}`);
    const v = inputs.via;
    const dec = [];
    if (v.d80c > 0) dec.push(`80C ${fmt(v.d80c)}`);
    if (v.d80ccd1b > 0) dec.push(`80CCD(1B) ${fmt(v.d80ccd1b)}`);
    if (v.d80d > 0) dec.push(`80D ${fmt(v.d80d)}`);
    if (v.d24b > 0) dec.push(`24(b) ${fmt(v.d24b)}`);
    if (dec.length) lines.push("Planned deductions: " + dec.join(", "));
  }
  declarationCache = lines.join("\n");
  $("declaration").innerHTML = `<pre class="declaration">${declarationCache}</pre>`;
}

export function renderDocuments(inputs, results, bestIdx) {
  csvCache = buildCsv(results);
  renderProfiles();
  renderChecklist(inputs, results, bestIdx);
  renderStatement(results, bestIdx);
  renderDeclaration(inputs, results, bestIdx);
}
