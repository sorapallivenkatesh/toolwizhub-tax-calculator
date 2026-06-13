// Small DOM + formatting helpers shared across the UI layer.

export const $ = (id) => document.getElementById(id);
export const num = (id) => Number($(id)?.value) || 0;
export const chk = (id) => Boolean($(id)?.checked);

export const fmt = (n) =>
  (n < 0 ? "−" : "") +
  "₹" +
  Math.round(Math.abs(n)).toLocaleString("en-IN");
