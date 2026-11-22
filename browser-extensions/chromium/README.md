# Chromium extension

Manifest V3 extension for Chrome, Brave, Edge and other
Chromium-based browsers. It does what the console scripts in
`claude/v1.2.0/` do, without the developer console.

On a claude.ai conversation page a **Save to file** button appears
in the bottom-right corner. Clicking it opens a menu of the eleven
formats. Choosing one fetches the conversation from Anthropic's
own conversation API, builds the file, and downloads it — or, for
the PDF formats, opens a print-optimised document and the print
dialog.

The export logic is not a reimplementation. The formatting code is
copied from the console scripts, and the output is verified against
them.

---

## Install from source

There is no build step. The directory loads exactly as it is in
this repository.

1. Download or clone this repository.
2. Open `chrome://extensions` in the browser.
   Brave uses `brave://extensions`, Edge uses `edge://extensions`.
3. Turn on **Developer mode** — the toggle in the top-right corner.
4. Click **Load unpacked**.
5. Select the `browser-extensions/chromium` directory. Select the
   directory itself, not `manifest.json` and not the repository
   root.
6. The extension card appears, listing one host permission for
   `claude.ai`. Open or reload a claude.ai conversation and the
   **Save to file** button appears in the bottom-right corner.

To pick up changes to the source, press **Reload** on the
extension card, then reload the claude.ai tab.

A Chrome Web Store listing may follow. Developer mode installation
works without one and requires no account, no store submission,
and no signing.

---

## Formats

Eleven entries, each mirroring one console script:

| Menu entry | Script it mirrors | Output |
|---|---|---|
| Markdown | `export-markdown.js` | `.md` download |
| Markdown (clean) | `export-markdown-clean.js` | `-clean.md` download |
| Plain text | `export-plaintext.js` | `.txt` download |
| Plain text (clean) | `export-plaintext-clean.js` | `-clean.txt` download |
| HTML | `export-html.js` | `.html` download |
| HTML (clean) | `export-html-clean.js` | `-clean.html` download |
| JSON | `export-json.js` | `.json` download |
| PDF — serif | `export-pdf-serif.js` | Print dialog |
| PDF — serif (clean) | `export-pdf-clean-serif.js` | Print dialog |
| PDF — sans-serif | `export-pdf-sans.js` | Print dialog |
| PDF — sans-serif (clean) | `export-pdf-clean-sans.js` | Print dialog |

JSON has no clean variant — structured data is always complete by
nature. Downloaded files are named after the conversation title,
lowercased, with spaces and reserved characters replaced by
underscores, exactly as the console scripts name them.

**About these formats** at the bottom of the menu expands a short
description of each entry in place and scrolls it into view within
the menu. It opens nothing and navigates nowhere.

---

## Output is identical to the console scripts

`claude/v1.2.0/` is the reference implementation. Any extension
that produces different output for the same conversation has a
bug.

Output was verified rather than assumed. Every one of the eleven
formats was compared byte for byte against the matching console
script over synthetic fixtures covering multiple turns, timestamps,
attachments, images, tool use, tool results, thinking blocks,
unknown content block types, unicode, an empty conversation and a
single-message conversation — including the derived filename and
the wording of every refusal. The download produced by the button
in a real browser was compared against the output of the same
console script run on the same page.

The seven text formatters are byte-identical source to the
functions in the console scripts. The four PDF documents are built
by one parameterised builder rather than four copies; its output
was compared against all four scripts. The document written into
the print tab is identical to the console script's apart from one
Content-Security-Policy `<meta>`, inserted as the first element of
`<head>`. It blocks scripts, remote loads, forms and `<base>` in
that tab and allows only the document's own stylesheet, so the tab
stays inert even if escaping ever regressed, whatever headers
claude.ai itself sends.

---

## Permissions

The extension requests one thing.

| Requested | Why |
|---|---|
| `host_permissions: https://claude.ai/*` | The only site the extension runs on. It is the origin of the content script, the origin of the single API request, and what lets the toolbar popup tell whether the current tab is a conversation page. |

`"permissions": []`. Nothing else is requested.

`browser-extensions/README.md` proposed `activeTab`, `cookies`,
`scripting` and the host permission. The three that are not
requested were each dropped because the extension demonstrably
works without them:

| Not requested | Why it is unnecessary |
|---|---|
| `activeTab` | Nothing is injected programmatically. The content script is declared statically in the manifest and runs on claude.ai only. |
| `scripting` | Same reason. `chrome.scripting` is for programmatic injection; the manifest does the injection. |
| `cookies` | `lastActiveOrg` is not `HttpOnly`, so the content script reads it from `document.cookie` on claude.ai. The `cookies` permission is only needed for `HttpOnly` cookies or reads from outside the page. |
| `downloads` | The file is delivered with a Blob object URL and a temporary anchor carrying the `download` attribute, which is what the console scripts do. No download API is used. |
| `tabs` | The popup reads the active tab's URL, which is granted by the claude.ai host permission alone for tabs the extension may already access. |
| `storage` | Nothing is stored. There are no settings and no state between exports. |

The extension also declares no `web_accessible_resources`. Icons
in the injected interface are inlined as SVG strings, so no page
can fingerprint the extension by probing for its files.

---

## PDF formats and the print dialog

The four PDF entries do not download a file. They open a
print-optimised document in a new tab and call the browser's print
dialog, the same way the PDF console scripts do.

- Choose your printer, or **Save as PDF** to save locally.
- Page breaks never split a message. Page numbers are in the
  footer.
- Serif is Georgia and Times New Roman. Sans-serif is system-ui,
  Helvetica and Arial.
- Recommended settings: paper size A4 or Letter, default margins,
  background graphics off. The document supplies its own page
  numbers, so browser headers and footers can be left on or off.
- If the browser blocks the new tab, the widget says so. Allow
  pop-ups for claude.ai and choose the format again.

The print tab is opened at the moment of the click rather than
after the conversation has been fetched, because a browser only
allows a new tab while the click that asked for it is still
current. The document written into that tab is unchanged apart
from the policy meta described above.

---

## Keyboard

The button is a standard menu button. At rest it is the only part
of the widget in the tab order; menu items are reached with the
arrow keys.

| Key | Behaviour |
|---|---|
| `Tab` | Move to the button |
| `Enter`, `Space`, `ArrowDown` on the button | Open the menu, focus the first entry |
| `ArrowUp` on the button | Open the menu, focus the last entry |
| `ArrowDown` / `ArrowUp` in the menu | Move focus, wrapping at both ends |
| `Home` / `End` | First and last entry |
| `Enter` / `Space` on an entry | Start that export, close the menu |
| `Escape` | Close the menu, return focus to the button |
| `Escape` on an error | Dismiss the error |
| `Tab` in the menu | Close the menu, continue to the next element on the page |
| Outside click | Close the menu, start nothing |

The status is announced through a live region as well as shown, so
progress, completion and errors are not conveyed by colour alone.
Light and dark are both supported, and
`prefers-reduced-motion: reduce` removes every transition and
animation.

---

## Status and errors

The status sits above the button and clears itself after an export
finishes.

- **In progress** — the button is disabled for the duration, so a
  second click cannot start a duplicate export. If the fetch takes
  more than about two seconds the text says what is happening.
- **Complete** — how many human and Claude messages were saved.
- **Complete, with flags** — the same, plus what was flagged in
  the file or omitted from it. A clean export that dropped tool
  use, tool results or thinking blocks reports this state, never
  the plain complete state.
- **Error** — shown in the widget, never as a browser alert.
  Session expired, wrong page, and an empty conversation each say
  what happened and what to do next. Nothing is written to disk
  when an export fails.

The button is absent on any page that is not a conversation. That
is not an error state.

---

## Privacy

No data leaves the device.

- The extension contacts exactly one origin, `claude.ai`, and
  makes exactly one request per export — the same endpoint the
  claude.ai page itself calls to load the conversation.
- No external server, no telemetry, no analytics, no error
  reporting, no CDN, no remote font, no remote script or
  stylesheet, and no dependency of any kind.
- Session cookies attach to that request because it is made from
  the claude.ai page itself, exactly as they do for the page. No
  credential is read, stored or transmitted anywhere else.
- Nothing is stored. No `chrome.storage`, no settings, no history
  of exports.
- The conversation is turned into a file in the page and handed to
  the browser's own download, or written into a local print tab.
- Everything injected into the page is removed when the button is
  removed.

---

## Layout

```
browser-extensions/chromium/
  manifest.json
  content_script.js      bootstrap, route detection, orchestration
  lib/
    walk.js              shared helpers copied from the console scripts
    api.js               id resolution, validation, fetch, error mapping
    filename.js          filename derivation
    summary.js           widget status line
    format-markdown.js
    format-plaintext.js
    format-html.js
    format-json.js
    format-pdf.js        both typefaces, full and clean
    deliver.js           Blob download, print tab
  ui/
    styles.js            stylesheet as a string
    button.js            floating button, status, live region
    menu.js              format picker
  icons/                 copied from assets/png/
  popup/
    popup.html
    popup.js
```

Content scripts are classic scripts, listed in the manifest in
dependency order and sharing one `globalThis.TrueAiExport`
namespace. No bundler, no transpiler, no lockfile, no
`node_modules`, no minification.

The widget is a fixed-position element with a Shadow DOM root. It
is anchored to the viewport, not to any claude.ai class name or DOM
path, so a claude.ai redesign cannot move or break it.

---

## Known behaviour

- The button appears only on `claude.ai/chat/<uuid>`. Project
  pages, the home page and settings pages leave it absent.
- claude.ai is a single page app, so navigating between
  conversations mounts and unmounts the button without a page
  load.
- The extension uses an undocumented internal API endpoint, as the
  console scripts do. It may change without notice if Anthropic
  updates its infrastructure.
- Very long conversations may be subject to API pagination. If
  messages appear missing from the start of an export, please open
  an issue.

---

This extension is a workaround for a missing native export
function, not a replacement for one. The goal is still a button in
claude.ai itself.
