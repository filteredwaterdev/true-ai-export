/**
 * true-ai-export — the widget's stylesheet and icons, as strings.
 *
 * Everything the injected UI needs is in this file. Nothing is fetched:
 * no remote stylesheet, no remote font, no icon file. Icons are inline
 * SVG strings so the extension needs no web_accessible_resources and
 * cannot be fingerprinted by the page.
 *
 * The stylesheet is scoped by the shadow root, so these plain class
 * names cannot leak onto claude.ai and claude.ai's CSS cannot reach in.
 * No selector here refers to a claude.ai class name or DOM path.
 *
 * Colour pairs are chosen for contrast, not for looks: body text and
 * meaningful icons at 4.5:1 or better against their own background,
 * borders and the focus ring at 3:1 or better. Colour is never the only
 * signal — every state also has an icon shape and a sentence of text.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport;

  // 24x24 outlined icons, 1.5 stroke, matching the repository's own
  // icon in assets/svg/export-icon.svg.
  const ICON = {
    export:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' +
      '<path d="M2 22V2h7l4 4v16H2z"/>' +
      '<path d="M9 2v4h4"/>' +
      '<path d="M14 12h8"/>' +
      '<path d="M19 9l3 3-3 3"/>' +
      '</svg>',
    chevron:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' +
      '<path d="M6 9l6 6 6-6"/>' +
      '</svg>',
    // Busy: a broken ring. Under reduced motion it stops spinning and
    // the status text carries the progress instead.
    busy:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" ' +
      'aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="12" r="9" opacity="0.3"/>' +
      '<path d="M21 12a9 9 0 0 0-9-9"/>' +
      '</svg>',
    complete:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="12" r="9"/>' +
      '<path d="M8 12.5l2.5 2.5L16 9.5"/>' +
      '</svg>',
    // Triangle, deliberately a different shape from the check circle so
    // the two states are distinguishable without colour.
    flagged:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' +
      '<path d="M12 3.5L22 20H2L12 3.5z"/>' +
      '<path d="M12 10v4"/>' +
      '<path d="M12 17h.01"/>' +
      '</svg>',
    error:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="12" r="9"/>' +
      '<path d="M15 9l-6 6"/>' +
      '<path d="M9 9l6 6"/>' +
      '</svg>',
    info:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="12" r="9"/>' +
      '<path d="M12 11v5"/>' +
      '<path d="M12 8h.01"/>' +
      '</svg>'
  };

  const CSS = `
*, *::before, *::after { box-sizing: border-box; }

.root {
  --surface: #ffffff;
  --surface-hover: #f2f0eb;
  --surface-active: #e7e4dc;
  --text: #1a1a1a;
  --text-muted: #57534e;
  /* --border draws the edge of a control or a floating panel, so it
     carries 3:1 against both the surface it sits on and the page
     behind it. --border-soft is the decorative rule between menu
     items, which conveys nothing on its own. */
  --border: #8a8578;
  --border-soft: #d6d2c8;
  --ring: #0b57d0;
  --complete: #166534;
  --flagged: #92400e;
  --error: #991b1b;
  --shadow: 0 6px 24px rgba(0, 0, 0, 0.18);

  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
    Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.45;
  color: var(--text);
  text-align: left;
  direction: ltr;
}

@media (prefers-color-scheme: dark) {
  .root {
    --surface: #2b2a27;
    --surface-hover: #3a3834;
    --surface-active: #464440;
    --text: #f0eee6;
    --text-muted: #c4bfb4;
    --border: #7d7970;
    --border-soft: #4b4842;
    --ring: #a8c7fa;
    --complete: #7ee2a8;
    --flagged: #fbbf5a;
    --error: #ff9d9d;
    --shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
  }
}

.wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

/* ── Trigger button ────────────────────────────────────────────── */

.trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  min-width: 44px;
  padding: 0 14px;
  margin: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  box-shadow: var(--shadow);
  transition: background-color 120ms ease, border-color 120ms ease;
}

.trigger:hover { background: var(--surface-hover); }
.trigger:active { background: var(--surface-active); }

.trigger:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.trigger[aria-disabled="true"] {
  cursor: default;
  color: var(--text-muted);
}

.trigger .icon {
  width: 18px;
  height: 18px;
  flex: none;
}

.trigger .icon svg { width: 100%; height: 100%; display: block; }

.trigger .chevron {
  width: 14px;
  height: 14px;
  flex: none;
  color: var(--text-muted);
  transition: transform 120ms ease;
}

.trigger .chevron svg { width: 100%; height: 100%; display: block; }

.trigger[aria-expanded="true"] .chevron { transform: rotate(180deg); }

.label { white-space: nowrap; }

/* ── Status line ───────────────────────────────────────────────── */

.status {
  display: none;
  align-items: flex-start;
  gap: 8px;
  max-width: 320px;
  margin-bottom: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow);
  font-size: 13px;
}

.status[data-state="busy"],
.status[data-state="complete"],
.status[data-state="flagged"],
.status[data-state="error"] { display: flex; }

.status .icon { width: 18px; height: 18px; flex: none; margin-top: 1px; }
.status .icon svg { width: 100%; height: 100%; display: block; }

.status[data-state="busy"] .icon { color: var(--text-muted); }
.status[data-state="complete"] .icon { color: var(--complete); }
.status[data-state="flagged"] .icon { color: var(--flagged); }
.status[data-state="error"] .icon { color: var(--error); }

.status[data-state="complete"] .text { color: var(--complete); }
.status[data-state="flagged"] .text { color: var(--flagged); }
.status[data-state="error"] .text { color: var(--error); }

.status[data-state="busy"] .icon svg {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── Menu ──────────────────────────────────────────────────────── */

.menu {
  display: none;
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  min-width: 260px;
  max-height: min(70vh, 560px);
  overflow-y: auto;
  margin: 0;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.menu[data-open="true"] { display: block; }
.menu[data-placement="below"] { bottom: auto; top: calc(100% + 8px); }
.menu[data-align="left"] { right: auto; left: 0; }

.menu-title {
  padding: 6px 10px 8px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.menuitem {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 44px;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 100ms ease;
}

.menuitem:hover { background: var(--surface-hover); }

.menuitem:focus-visible,
.menuitem:focus {
  outline: 2px solid var(--ring);
  outline-offset: -2px;
  background: var(--surface-hover);
}

.separator {
  height: 1px;
  margin: 6px 8px;
  background: var(--border-soft);
}

/* ── About panel ───────────────────────────────────────────────── */

.about {
  display: none;
  padding: 4px 10px 8px;
  color: var(--text-muted);
  font-size: 12.5px;
}

.about[data-open="true"] { display: block; }
.about p { margin: 0 0 8px; }
.about p:last-child { margin-bottom: 0; }
.about strong { color: var(--text); font-weight: 600; }

/* ── Screen reader only ────────────────────────────────────────── */

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  white-space: nowrap;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
}

/* ── Reduced motion ────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
  }
}
`;

  ns.styles = { CSS, ICON };
})();
