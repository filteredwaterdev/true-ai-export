# Browser Extensions

**Status: Planned — not yet built**

This directory is reserved for browser extension implementations
of the true-ai-export functionality. The console scripts in
`claude/` are the current working solution. The extensions will
provide the same functionality without requiring the user to open
a developer console.

If you are a developer who wants to build one of these, everything
you need is in this repository. Read this file first, then read
the console scripts in `claude/` — they are the reference
implementation. The core fetch logic is proven, stable, and
documented. Building an extension is a matter of wrapping that
logic in the appropriate extension architecture for each platform.

---

## Why Extensions

The console script workflow requires users to:

1. Open a developer console they may never have used before
2. Paste a block of code they are being asked to trust
3. Press Enter and hope it works

This is a reasonable workaround for a broken native feature. It
is not an acceptable permanent solution for non-technical users.
A browser extension reduces this to a single click — the same
interaction a native "Save to file" button would require.

The extension is not a replacement for a native Anthropic
implementation. It is a better workaround until that
implementation exists. The goal remains a native button. The
extension is what exists in the meantime.

---

## Proposed User Experience

The extension injects a **Save to file** button into the
claude.ai conversation interface. The button matches the visual
language of the existing claude.ai UI — outlined icon, consistent
stroke weight, same interaction patterns as adjacent controls.

Clicking the button opens a format picker menu:

```
Save to file
─────────────────
Markdown
Markdown (clean)
Plain text
Plain text (clean)
HTML
HTML (clean)
JSON
PDF — serif
PDF — serif (clean)
PDF — sans-serif
PDF — sans-serif (clean)
─────────────────
About these formats →
```

Selecting a format triggers the export immediately. On
Chromium-based browsers and Firefox, the file downloads
automatically. On Safari, the clipboard copy button behaviour
from the console scripts applies. PDF formats open a print
dialog.

The button label, icon, and menu structure are fully specified
in `assets/ui/menu-spec.md`. Icon assets in SVG, PNG, and React
component formats are in `assets/`.

---

## Core Logic

The export logic is identical to the console scripts. The
extension content script calls the same API endpoint:

```
/api/organizations/{orgId}/chat_conversations/{conversationId}
  ?tree=true&rendering_mode=messages&render_all_tools=true
```

The `orgId` is extracted from the `lastActiveOrg` cookie.
The `conversationId` is extracted from the page URL.
Both are validated as UUIDs before use.
The request uses `credentials: 'include'` to authenticate
with the user's existing session.
No external servers are contacted.
No credentials are stored or transmitted beyond claude.ai.

The output formatting logic for each format is in the
corresponding script in `claude/`. The extension imports or
mirrors this logic directly — it does not rewrite it.

---

## Target Platforms

### Chromium-based browsers (Chrome, Brave, Edge) — Manifest V3
```
browser-extensions/
  chromium/
    manifest.json
    content_script.js
    background.js
    popup/
      popup.html
      popup.js
    icons/
```

Standard Manifest V3 extension. Content script injected into
`claude.ai` pages. The format picker can be implemented as
either a popup or an injected DOM element. Injected DOM element
is preferred — it places the button directly in the conversation
UI rather than in the browser toolbar.

Permissions required:
- `activeTab`
- `cookies` (to read `lastActiveOrg`)
- `scripting`
- Host permission: `https://claude.ai/*`

### Firefox and Firefox-based browsers
```
browser-extensions/
  firefox/
    manifest.json
    content_script.js
    background.js
    popup/
      popup.html
      popup.js
    icons/
```

Firefox uses Manifest V3 with minor differences from Chrome.
The fetch and formatting logic is identical. The manifest
requires `browser_specific_settings` with a valid extension ID.
Firefox extensions can be self-distributed without going through
the Mozilla store for personal use, or submitted to AMO for
public distribution.

### Safari — Safari App Extension (Mac + iOS)
```
browser-extensions/
  safari/
    SafariExtension/
      manifest.json
      content_script.js
      background.js
    SafariExtensionApp/
      (Xcode project files)
    icons/
```

Safari extensions are packaged as Xcode projects and require
a Mac developer account for distribution. A Safari App Extension
built for macOS also runs on iOS Safari — one implementation
covers both platforms. This is the only path to iOS support
without a native app.

The content script logic is identical to Chromium and Firefox.
The packaging and distribution path is significantly more
involved — Xcode, code signing, and either TestFlight or
App Store distribution for iOS.

Note on clipboard: Safari blocks `navigator.clipboard.writeText()`
from content script context the same way it blocks it from the
DevTools console. The extension button click will be a genuine
user gesture and should satisfy Safari's clipboard requirement —
but this needs to be confirmed during implementation. The DOM
button approach from the 1.2.0 console scripts is the proven
fallback if needed.

Note on PDF: PDF scripts open a print dialog via `window.open()`
and `window.print()`. Safari does not auto-fire the print dialog
— the user will need to press Cmd-P after the document opens.
This behaviour is the same in the console scripts and should
carry over to the extension implementation.

---

## Implementation Notes

**Button injection:**
Inject the button as a fixed-position floating element
independent of claude.ai's DOM structure. This makes it immune
to claude.ai UI changes. A toolbar-injected button that depends
on claude.ai's internal element structure will break whenever
Anthropic updates their front end.

**Format picker:**
Implement as an injected dropdown attached to the floating
button. Standard dropdown behaviour — appears on click,
dismisses on outside click or Escape, navigable by arrow keys.
Full keyboard accessibility spec is in `assets/ui/menu-spec.md`.

**orgId extraction:**
The `lastActiveOrg` cookie is same-origin and accessible from
the content script context on claude.ai. No special permissions
beyond `cookies` and host permission are required.

**Error handling:**
Mirror the error handling from the console scripts — HTTP 403
(session expired), HTTP 404 (wrong page), and empty response
are the three cases to handle. Display errors in the button UI,
not as browser alerts.

**Safari on iOS:**
The content script logic is identical. The UI injection works
the same way in Mobile Safari. The main constraint is that the
developer console is not available on iOS, so the extension is
the only viable path for iOS users. This makes the Safari
extension the highest-impact platform to build.

**PDF on all platforms:**
PDF scripts open a new window and trigger `window.print()`.
Chromium-based browsers and Firefox fire the print dialog
automatically. Safari opens the tab but requires the user to
press Cmd-P manually. Document this behaviour clearly in the
extension UI.

---

## What Is Not Required

- No backend
- No server
- No API keys
- No accounts
- No external dependencies
- No data leaves the user's device except as a local file
  download, clipboard write, or print dialog

The extension is entirely client-side. It is as auditable as
the console scripts.

---

## Distribution

**Chromium-based browsers:** Chrome Web Store. Can also be
side-loaded in developer mode for personal use without store
submission.

**Firefox and Firefox-based browsers:** Mozilla Add-ons (AMO).
Can also be temporarily installed in developer mode.

**Safari Mac + iOS:** App Store via Xcode. TestFlight for
beta distribution. No side-loading on iOS without a developer
account.

Given the maintenance intent of this project — a workaround,
not a permanent solution — informal distribution (GitHub
releases, developer mode installation) may be more appropriate
than store submission, which requires ongoing maintenance and
compliance with store policies.

---

## Contributing

If you build any of these extensions, please open a pull
request against this repository. The PR should include:

- The complete extension source in the appropriate subdirectory
- A brief README in that subdirectory documenting install
  instructions for both store and developer mode installation
- Confirmation that the export output matches the console
  script output for the same conversation

The framing should remain consistent with the rest of the
project: these are workarounds for problems that the platforms
themselves are responsible for solving.

---

## Reference Implementation

The console scripts in `claude/` are the authoritative
reference implementation. Any extension that produces
different output for the same conversation has a bug.
Test against the console scripts, not against expectations.

The distributed .xpi file is a direct zip of the source files in this directory. A SHA-256 checksum is published with every release. Anyone can verify that what they install matches what is in this repository. This applies to any distribution of this extension — no one can legitimately charge for something that is verifiably identical to freely available source code.
