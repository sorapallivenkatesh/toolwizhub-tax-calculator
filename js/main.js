// Entry point: build dynamic controls, then collect → compute → render on change.

import { collectInputs } from "./ui/inputs.js";
import { computeScenarios } from "./core/tax-engine.js";
import { renderResults } from "./ui/render.js";
import { buildFbpControls } from "./ui/form.js";
import { initDocuments } from "./ui/documents.js";
import { initForm16 } from "./ui/form16.js";
import { getFY } from "./ui/inputs.js";
import { FINANCIAL_YEARS, DEFAULT_FY } from "./config/tax-rules.js";
import { FBP_MAX } from "./config/fbp.js";

const BASIC_RATIO = 0.5; // default Basic = 50% of Gross until user edits Basic

function populateFY() {
  const sel = document.getElementById("fy");
  if (!sel) return;
  sel.innerHTML = [...FINANCIAL_YEARS]
    .reverse()
    .map(
      (fy) =>
        `<option value="${fy}" ${fy === DEFAULT_FY ? "selected" : ""}>FY ${fy}</option>`,
    )
    .join("");
}

function render() {
  const inputs = collectInputs();
  renderResults(computeScenarios(inputs), inputs);
}

function wireTabs() {
  const tabs = [...document.querySelectorAll(".tab[data-view]")];
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll("[data-view]").forEach((v) => {
        if (v.classList.contains("tab")) return;
        v.hidden = v.dataset.view !== tab.dataset.view;
      });
    });
  });
}

function wireInputs() {
  document.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });
}

function wireBasicSync() {
  const gross = document.getElementById("gross");
  const basic = document.getElementById("basic");
  if (!gross || !basic) return;

  let basicEdited = false;
  // Seed Basic from Gross on load.
  basic.value = Math.round((Number(gross.value) || 0) * BASIC_RATIO);

  basic.addEventListener("input", () => {
    basicEdited = true;
  });
  gross.addEventListener("input", () => {
    if (!basicEdited) {
      basic.value = Math.round((Number(gross.value) || 0) * BASIC_RATIO);
    }
  });
}

function wireMaxButtons() {
  document.querySelectorAll(".max-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.fbp;
      const max = (FBP_MAX[getFY()] || {})[key] ?? 0;
      const input = document.getElementById(`fbp_${key}`);
      const toggle = document.getElementById(`fbp_${key}_on`);
      if (input) input.value = max;
      if (toggle && !toggle.checked) toggle.checked = true;
      render();
    });
  });
}

function wireActions() {
  const reset = document.getElementById("reset-all");
  if (reset) {
    reset.addEventListener("click", () => {
      document.querySelectorAll('input[type="number"]').forEach((el) => {
        el.value = el.id === "gross" || el.id === "basic" ? el.value : 0;
      });
      render();
    });
  }
  const pdf = document.getElementById("export-pdf");
  if (pdf) pdf.addEventListener("click", () => window.print());
}

buildFbpControls(document.getElementById("fbp-list"));
populateFY();
wireBasicSync(); // before wireInputs so Basic updates before re-render
wireInputs();
wireMaxButtons();
wireActions();
wireTabs();
initDocuments(render);
initForm16(render);
render();
