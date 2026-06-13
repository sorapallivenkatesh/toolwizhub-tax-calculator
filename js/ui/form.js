// Builds the FBP component controls from config so the form can never drift
// from the engine's component list. Each item is a toggle + annual-amount
// input + a per-FY hint slot (filled by render.js).

import { FBP_COMPONENTS } from "../config/fbp.js";

export function buildFbpControls(container) {
  if (!container) return;
  container.innerHTML = FBP_COMPONENTS.map((c) => {
    const chip =
      c.regime === "old"
        ? '<span class="chip old">Old only</span>'
        : '<span class="chip">Both</span>';
    const off = c.default ? "" : " off";
    const checked = c.default ? " checked" : "";
    return `
      <div class="fbp-item${off}" id="fbp_${c.key}_wrap">
        <label class="fbp-item-head">
          <input type="checkbox" class="fbp-toggle" id="fbp_${c.key}_on"${checked} />
          <span>${c.label}</span>
          ${chip}
        </label>
        <div class="rupee-field">
          <span>₹</span>
          <input type="number" id="fbp_${c.key}" value="0" placeholder="Annual amount" />
          <button type="button" class="max-btn" data-fbp="${c.key}">Max</button>
        </div>
        <div class="hint" id="hint_${c.key}"></div>
      </div>`;
  }).join("");
}
