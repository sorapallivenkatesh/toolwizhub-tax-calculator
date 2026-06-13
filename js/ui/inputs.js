// Reads the form into the plain inputs object consumed by the tax engine.
// This is the only place that knows the engine's input shape comes from DOM.

import { num, chk } from "./dom.js";
import { DEFAULT_FY } from "../config/tax-rules.js";
import { FBP_COMPONENTS } from "../config/fbp.js";

export function getFY() {
  const el = document.getElementById("fy");
  return el && el.value ? el.value : DEFAULT_FY;
}

export function collectInputs() {
  // Each FBP value is gated by its toggle here, so the engine sees 0 when off.
  const fbp = {};
  for (const c of FBP_COMPONENTS) {
    fbp[c.key] = chk(`fbp_${c.key}_on`) ? num(`fbp_${c.key}`) : 0;
  }

  return {
    fy: getFY(),
    gross: num("gross"),
    basic: num("basic"),
    hra: num("hra"),
    rent: num("rent"),
    metro: chk("metro"),
    npsEnabled: chk("fbp_nps_on"),
    via: {
      d80c: num("d80c"),
      d80ccd1b: num("d80ccd1b"),
      d80d: num("d80d"),
      d80e: num("d80e"),
      d24b: num("d24b"),
      d80eea: num("d80eea"),
      d80eeb: num("d80eeb"),
      d80g: num("d80g"),
      lta: num("lta"),
    },
    fbp,
  };
}
