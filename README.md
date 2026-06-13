# India Tax Calculator

Compares Old vs New tax regime, with and without FBP (Pluxee), across every
financial year from **FY 2020-21 to FY 2026-27**, to find the option that
retains the most cash. Pick the year from the dropdown (defaults to the current
FY). Each year uses the statutory rules that actually applied that year — slabs,
standard deduction, 87A rebate, surcharge cap and NPS 80CCD(2) rate all vary by
year and regime (see `js/config/tax-rules.js` for sources).

## Running

The app uses native ES modules, so it must be served over HTTP (opening
`index.html` directly via `file://` will be blocked by the browser's module
CORS policy). From this directory:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, etc.).

## Architecture

The app was split from a single 1285-line `index.html` into layers with one
responsibility each. Data flows one way: **inputs → engine → render**.

```
index.html              Markup only (form fields + results container)
css/
  styles.css            All styling (extracted verbatim)
js/
  main.js               Entry point — collect → compute → render on every input change
  config/
    tax-rules.js        Slabs, surcharge, rebate, caps, standard deduction (per FY/regime)
    fbp.js              FBP component list, New-regime cutoff FY, per-FY hint text
  core/
    tax-engine.js       Pure tax math — no DOM. Takes an inputs object, returns results
  ui/
    dom.js              $, num, chk, fmt helpers
    inputs.js           Reads the form into the engine's plain inputs object
    render.js           Builds result cards, syncs FBP toggle styles & hints
```

### Why this shape

- **`core/tax-engine.js` is pure** — it imports only config and touches no DOM,
  so it can be unit-tested in Node (see how `computeScenarios(inputs)` is called
  from `main.js`). Statutory rules live as data in `config/`, separate from the
  computation that applies them.
- **`config/fbp.js` is the single source of truth** for FBP components. Both the
  tax engine (which items are exempt in which regime) and the input-collection
  layer iterate the same `FBP_COMPONENTS` list, so they can't drift apart.
- **The UI layer is the only code that knows about the DOM.** Swapping the
  front-end (or rendering to a different target) would not touch the engine.

Behaviour is identical to the original single-file version; this was a pure
structural refactor.
