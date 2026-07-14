# STYLE-NOTES.md

Design + structure conventions for cnctrig.com. Follow these when adding a new
calculator so it matches the existing pages. The fastest path: **copy
`calculators/triangle.html` as a starting template** and adapt the body — the
CSS in `styles.css` already covers every class below.

## Page skeleton (every page)

Wrap the whole page in the shared CRT shell:

```html
<div class="crt">
  <header class="term-bar">
    <a class="brand" href="../index.html" aria-label="CNC TRIG HOME">
      <span class="brand-mark" aria-hidden="true"></span>CNCTRIG.COM
    </a>
    <div class="term-meta">
      <span class="term-tag">PRG 03 · MILL</span>
      <span class="term-clock" data-clock>--:--:--</span>
    </div>
  </header>

  <main class="term-main">
    <!-- page content -->
  </main>

  <footer class="term-status">
    <span class="status-note">INCH / METRIC AGNOSTIC · NO TRACKING</span>
    <a href="../about-terms.html">ABOUT &amp; TERMS</a>
  </footer>
</div>
```

- `data-clock` on the clock span is required — `assets/ui.js` drives it.
- `<head>` must include: `<meta name="theme-color" content="#080a08">`, the
  favicon (`<link rel="icon" type="image/svg+xml" href="../assets/favicon.svg">`),
  and the stylesheet.
- Load scripts at the end of `<body>`: the calculator's own JS, then
  `<script src="../assets/ui.js"></script>` (clock + menu hotkeys).
- `.term-tag` names the program, e.g. `PRG 03 · MILL`.

## Calculator page body

```html
<section aria-labelledby="page-title">
  <div class="calc-topbar">
    <div>
      <h1 id="page-title">B-AXIS ROTATION SOLVER</h1>
      <p class="calc-guidance">One or two lines of plain-language instructions.</p>
    </div>
    <a class="back-link" href="../index.html">◀ MENU</a>
  </div>

  <div class="triangle-workspace">
    <div class="triangle-diagram-wrap" aria-label="DIAGRAM">
      <div class="diagram-caption" aria-hidden="true">
        <span>GRAPHIC</span>
        <span>SCALE AUTO</span>
      </div>
      <svg class="triangle-svg" viewBox="0 0 640 430" role="img" aria-labelledby="svg-title">
        <!-- diagram elements -->
      </svg>
    </div>

    <form class="triangle-controls" id="..." novalidate>
      <div class="precision-row">
        <label for="precision">DECIMAL PLACES</label>
        <select id="precision" name="precision"><!-- options 1–6, 4 selected --></select>
      </div>

      <div class="value-groups">
        <fieldset class="value-group">
          <legend>INPUTS</legend>
          <div class="value-field">
            <label for="...">X</label>
            <input id="..." data-key="X" type="number" step="any" inputmode="decimal" autocomplete="off">
          </div>
          <!-- more value-field rows -->
        </fieldset>
      </div>

      <div class="triangle-buttons">
        <button class="primary-button" type="submit">SOLVE</button>
        <button class="secondary-button" id="clear-button" type="button">CLEAR</button>
      </div>

      <p class="solver-message" id="solver-message" aria-live="polite">ENTER VALUES TO SOLVE.</p>
    </form>
  </div>

  <details class="work-panel" id="work-panel">
    <summary>SHOW CALCULATIONS</summary>
    <ol class="work-list" id="work-list">
      <li>SOLVE TO SEE THE CALCULATION STEPS.</li>
    </ol>
  </details>
</section>
```

## Conventions the CSS won't tell you

- **Inputs are DRO-style** (right-aligned bright digits) — that's automatic from
  `.value-field input`. Just use `type="number" step="any" inputmode="decimal"
  autocomplete="off"` and a `data-key`.
- **Entered vs. calculated coloring:** the JS must toggle `is-entered` (cyan) on
  fields the user typed and `is-calculated` (amber) on fields you solved for.
  Mirror how `calculators/triangle.js` applies these.
- **Calculation steps auto-number like G-code** (N10, N20, …) via a CSS counter
  on `.work-list li`. Just append plain `<li>` items in JS — don't add the
  numbers yourself.
- **Units are unlabeled** (inch/metric agnostic) and **every calculator has a
  decimal-places selector** — see `AGENTS.md`.
- **SOLVE is green (cycle-start), CLEAR is amber** — already handled by
  `.primary-button` / `.secondary-button`.
- **Color key note:** include the plain-text `io-legend` line (as on the triangle
  page) only if inputs and outputs share one section. If you split INPUTS and
  OUTPUT into separate labeled sections (as the chamfer page does), omit it.

## Diagram (if the calculator has a moving diagram)

- Use `viewBox="0 0 640 430"` and drive it from JS by setting SVG attributes, the
  same approach as `triangle.js` / `lathe-chamfer.js`.
- Reuse the established stroke classes/colors: profile/geometry lines in bright
  phosphor, dimension leaders/labels in amber, points/vertices in cyan. Pull
  colors from the CSS custom properties in `:root` (`--ph-bright`, `--amber`,
  `--cyan`, …) rather than hard-coding hex values.

## When the calculator goes live

Update its card on `index.html`: change `led-dev` → `led`, `IN DEV` → `READY`,
and replace the "COMING SOON." copy with a real one-line description. The
`data-hotkey` is already wired.

## Don't

- Don't add decorative elements that look interactive or like live machine status
  (fake READY lights, button-styled labels). Indicators must reflect something
  real — the menu LEDs (READY vs. IN DEV) are fine because they're truthful.
- Don't pull in frameworks or external dependencies (see `AGENTS.md`).
- Don't hard-code colors when a CSS variable exists.