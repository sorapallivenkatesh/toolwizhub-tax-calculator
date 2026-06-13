// Form 16 (Part B) PDF import — runs entirely in the browser via pdf.js loaded
// from CDN. The file is never uploaded anywhere. Because employer/TRACES
// layouts vary, extraction is best-effort: we surface the figures we find in an
// editable review panel and only write to the calculator when the user applies.

import { $ } from "./dom.js";

const PDFJS_VER = "4.7.76";
const PDFJS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER}/build/pdf.min.mjs`;
const WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER}/build/pdf.worker.min.mjs`;

let pdfjs = null;
let pendingFile = null; // kept so we can retry with a password
let applyFn = () => {};

async function loadPdfJs() {
  if (pdfjs) return pdfjs;
  pdfjs = await import(/* @vite-ignore */ PDFJS_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;
  return pdfjs;
}

function toNum(s) {
  return Number(String(s).replace(/[^\d.]/g, "")) || 0;
}

// Amount-looking tokens only: must carry a comma or decimal, or be >= 1000.
// This drops stray serial numbers like "11." or "(d)" that sit between rows.
function pickAmount(seg, pick) {
  const nums = (seg.match(/[\d,]+(?:\.\d{1,2})?/g) || [])
    .filter((r) => /[.,]/.test(r) || Number(r) >= 1000)
    .map(toNum)
    .filter((n) => n > 0);
  if (!nums.length) return null;
  if (pick === "max") return Math.max(...nums);
  if (pick === "first") return nums[0];
  return nums[nums.length - 1]; // "last" — the Deductible Amount column
}

// Read the amount for `startRe`, bounding the search at the next section/label
// so single-column layouts don't pull in the following row's figure. Chapter
// VI-A rows show "Gross Amount" then "Deductible Amount"; we want the last.
function field(text, startRe, { pick = "last", win = 120, stop } = {}) {
  const m = text.match(startRe);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  let end = win;
  if (stop) {
    const s = rest.search(stop);
    if (s >= 0) end = Math.min(win, s);
  }
  return pickAmount(rest.slice(0, end), pick);
}

// Boundary tokens that end a Chapter VI-A row.
const VIA_STOP = /\b80\s*[a-z]{1,4}\b|section\s*80|chapter|total\b|tax deducted|net tax/i;

export function parseForm16(text) {
  const t = text.replace(/\s+/g, " ");
  return {
    gross:
      field(t, /\(d\)\s*total/i, { pick: "first", win: 26 }) ?? // TRACES 1.(d) Total
      field(t, /gross salary/i, {
        pick: "max",
        win: 340,
        stop: /chapter|deduction under|total taxable|tax deducted|less\s*:/i,
      }),
    d80c: field(t, /\b80\s*c\b/i, { pick: "last", stop: VIA_STOP }),
    d80ccd1b: field(t, /80\s*ccd\s*\(?\s*1\s*b\s*\)?/i, {
      pick: "last",
      stop: VIA_STOP,
    }),
    d80d: field(t, /\b80\s*d\b/i, { pick: "last", stop: VIA_STOP }),
    taxable:
      field(t, /total\s+taxable\s+income/i, { pick: "first", win: 24 }) ??
      field(t, /total\s+income/i, { pick: "first", win: 24 }),
    tds:
      field(t, /tax\s+deducted\s+at\s+source/i, { pick: "first", win: 44 }) ??
      field(t, /net\s+tax\s+payable/i, { pick: "first", win: 24 }),
  };
}

function status(msg, kind = "") {
  const el = $("form16-status");
  if (el) el.innerHTML = `<span class="${kind}">${msg}</span>`;
}

function fmtINR(n) {
  return n == null ? "" : Math.round(n).toLocaleString("en-IN");
}

function renderReview(fields, rawText) {
  const rows = [
    ["f16-gross", "Gross Salary → Annual Gross (CTC)", fields.gross],
    ["f16-80c", "Section 80C", fields.d80c],
    ["f16-80ccd1b", "Section 80CCD(1B)", fields.d80ccd1b],
    ["f16-80d", "Section 80D", fields.d80d],
  ];
  const refs = [];
  if (fields.taxable != null)
    refs.push(`Total taxable income: ₹${fmtINR(fields.taxable)}`);
  if (fields.tds != null) refs.push(`TDS / tax payable: ₹${fmtINR(fields.tds)}`);

  $("form16-result").innerHTML = `
    <div class="doc-banner">
      Extracted figures below — <b>verify each one</b> against your Form 16, then apply.
      Basic salary isn't in Form 16, so it stays at 50% of gross. HRA/rent and
      other deductions may need manual entry.
    </div>
    <div class="f16-grid">
      ${rows
        .map(
          ([id, label, val]) => `
        <label class="f16-row">
          <span>${label}</span>
          <span class="rupee-field">
            <span>₹</span>
            <input type="number" id="${id}" value="${val != null ? Math.round(val) : ""}" placeholder="not found" />
          </span>
        </label>`,
        )
        .join("")}
    </div>
    ${refs.length ? `<p class="hint">For reference (not applied): ${refs.join(" · ")}</p>` : ""}
    <button id="f16-apply" class="ghost-btn" type="button" style="margin-top:12px">
      ✓ Apply to calculator
    </button>
    <details class="more" style="margin-top:12px">
      <summary>Raw extracted text</summary>
      <pre class="declaration" style="max-height:200px;overflow:auto">${rawText
        .replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c])
        .slice(0, 4000)}</pre>
    </details>`;

  $("f16-apply").addEventListener("click", () => {
    const set = (calcId, f16Id) => {
      const src = $(f16Id);
      const dst = $(calcId);
      if (src && dst && src.value !== "") dst.value = src.value;
    };
    set("gross", "f16-gross");
    set("d80c", "f16-80c");
    set("d80ccd1b", "f16-80ccd1b");
    set("d80d", "f16-80d");
    applyFn();
    status("Applied to calculator. Switch to the Simulator tab to see results.", "ok");
  });
}

async function handleFile(file, password) {
  try {
    status("Reading PDF…");
    const buf = await file.arrayBuffer();
    const lib = await loadPdfJs();
    const doc = await lib.getDocument({ data: buf, password }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      text += tc.items.map((it) => it.str).join(" ") + "\n";
    }
    if (text.trim().length < 40) {
      status(
        "This PDF has no extractable text (it may be a scanned image). Enter figures manually.",
        "warn-txt",
      );
      $("form16-result").innerHTML = "";
      return;
    }
    status(`Parsed ${doc.numPages} page(s).`, "ok");
    renderReview(parseForm16(text), text);
  } catch (err) {
    if (err && err.name === "PasswordException") {
      promptPassword();
    } else {
      console.error(err);
      status(
        "Couldn't read this file. If it's a CDN/offline issue, pdf.js may not have loaded.",
        "warn-txt",
      );
    }
  }
}

function promptPassword() {
  $("form16-result").innerHTML = `
    <div class="doc-banner">This Form 16 is password-protected (often your PAN in CAPS + date of birth as DDMMYYYY).</div>
    <div class="doc-actions">
      <input id="f16-pw" class="text-input" type="password" placeholder="PDF password" />
      <button id="f16-unlock" class="ghost-btn" type="button">Unlock</button>
    </div>`;
  $("f16-unlock").addEventListener("click", () => {
    const pw = $("f16-pw").value;
    if (pendingFile) handleFile(pendingFile, pw);
  });
}

function accept(file) {
  if (!file) return;
  if (file.type && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    status("Please drop a PDF file.", "warn-txt");
    return;
  }
  pendingFile = file;
  $("form16-result").innerHTML = "";
  handleFile(file);
}

export function initForm16(applyCallback) {
  applyFn = applyCallback || (() => {});
  const input = $("form16-file");
  const drop = $("form16-drop");
  if (!input || !drop) return;

  input.addEventListener("change", (e) => {
    accept(e.target.files?.[0]);
    e.target.value = "";
  });

  // Clicking the input (nested in the label) shouldn't re-trigger the label.
  input.addEventListener("click", (e) => e.stopPropagation());

  ["dragenter", "dragover"].forEach((evt) =>
    drop.addEventListener(evt, (e) => {
      e.preventDefault();
      drop.classList.add("dragover");
    }),
  );
  ["dragleave", "dragend"].forEach((evt) =>
    drop.addEventListener(evt, (e) => {
      e.preventDefault();
      if (evt === "dragleave" && drop.contains(e.relatedTarget)) return;
      drop.classList.remove("dragover");
    }),
  );
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("dragover");
    accept(e.dataTransfer?.files?.[0]);
  });
}
