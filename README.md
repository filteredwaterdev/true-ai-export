# true-ai-export

This project addresses two distinct things that are broken or missing
in current AI web interfaces, and both need to be stated clearly. One is something that worked up until a recent regression. The other is one that has never existed in any useful form. 

**The first** is the ability to select any arbitrary portion of a
conversation — a single sentence, a paragraph, a specific response,
or hundreds of messages spanning the entire session — and copy that
selection reliably and accurately to the OS clipboard. Whatever is
selected should be what transfers. The length of the selection, its
position in the conversation, and its distance from the current
scroll position should be irrelevant. This is not a feature. It is
a basic and long-established property of text in every application
on every operating system. It was silently removed from AI web
interfaces as a side effect of an architectural change that the
platforms responsible have not announced, not fixed, and not
provided any workaround for. What currently copies to the OS
clipboard is determined not by what the user selected but by what
happens to be mounted in the DOM at that moment — which is
arbitrary, unpredictable, and bears no guaranteed relationship to
the selection. It remains broken. No script fixes it. No workaround
adequately substitutes for it. It needs to be restored natively by
the platforms that broke it. That demand stands regardless of
anything else in this repository.

**The second** is the ability to export a complete conversation
transcript — the entire session, every message, in order — as a
portable, readable file that you own and can use outside the
platform. This is what this project addresses. It does not fix
the first problem. It solves a different and equally legitimate
need: full transcript portability. The ability to have your
complete work product in a file on your own machine, independent
of any platform's decisions about rendering, retention, or access.

Both matter. Neither makes the other redundant. This project
exists alongside the demand to fix normal copy-to-clipboard
behaviour — not instead of it.

---

## The Problem

AI web interfaces have widely adopted virtualized rendering as a
client-side performance optimisation. Under this architecture,
only the messages near the user's current scroll position are
instantiated in the browser's DOM at any given time. As the user
scrolls, older messages are unloaded and newer ones are swapped
in.

This is a reasonable approach to reducing browser memory usage
and improving scroll performance on the user's local machine.

It was shipped without solving transcript portability first. And
it silently broke the most fundamental text operation available
on any computing platform: select, copy to clipboard, paste.

The result: the standard copy-to-clipboard workflow —
Select All → Copy → Paste — now silently captures only whatever
fragment of the conversation happens to be mounted in the DOM at
that moment. The OS clipboard receives an incomplete transcript
with no error, no warning, and no indication that anything went
wrong. The operation appears to succeed. The data loss is
invisible.

One illustration of the absurdity of this regression: Cmd-F
browser search works correctly across the full conversation —
the browser can find text anywhere in the session — while
Cmd-C copies only the DOM fragment. The content is accessible
to the browser's own find function but not to the clipboard.

This has been confirmed on Claude.ai and at least one other
noteworthy AI web interface.

### This is not a server-side constraint

Virtualized rendering does not reduce server load. It has no
effect on the platform's infrastructure whatsoever. The full
conversation is fetched from the platform's backend regardless
— the complete data arrives in a single API response every time
a conversation is opened. This is demonstrably true: the scripts
in this repository retrieve entire transcripts in one API call
in under a second.

Virtualized rendering is a client-side optimisation that benefits
only the user's local browser. Every time you open a Claude
conversation, the complete transcript is retrieved from
Anthropic's servers instantly — automatically, silently, in the
background. That same retrieval is precisely what these scripts
do. The infrastructure for immediate, complete, per-conversation
data access has existed since the product launched.

This matters because it removes any technical justification for
the absence of a native export function. There is no server cost.
There is no infrastructure constraint. There is no engineering
complexity standing in the way. The data is there. It comes back
instantly. The only missing piece is a button — which would call
the exact same API endpoint these scripts already call.

### The clipboard dimension

A separate but related regression affects the paste-in direction.
On Claude.ai, large text pastes into the input box are silently
converted to file attachments — which then arrive at Claude's end
as empty documents. Claude reports it cannot read the content.

This means both directions of basic text I/O are simultaneously
broken in the same product:

- Copy transcript to OS clipboard: broken
- Paste large text from OS clipboard: broken

Both failures are silent. Neither has been publicly acknowledged.
Neither has a native workaround.

Recent OS-level changes to clipboard sandboxing — particularly
on macOS — have added a further layer of complexity to
copy-to-clipboard workflows that may compound these failures for
some users.

---

## Who This Affects

The users most severely affected are those doing text-based
knowledge work — research, writing, analysis, legal work,
strategy, knowledge development — in long sessions that
accumulate real value over time. For these users, the
conversation transcript is the work product. If you cannot
retrieve your work product, you do not have a professional tool.

This failure is underrepresented in public bug reports for a
structural reason: the most technically vocal AI users —
developers and engineers — predominantly access these platforms
via API or local tooling. Their sessions are stored independently
of the web interface. They are entirely unaffected by this
regression and therefore do not report it.

The affected users are less represented in the communities and
feedback channels that these platforms monitor. The bug looks
smaller than it is from inside the platform's feedback systems.
It is not small.

---

## Why This Solution Works

The web interface does not scrape its own rendered page to
display conversations. It requests the full conversation from
the backend API and then renders a virtualized window of it
on screen.

This means the complete transcript exists on the platform's
servers and is accessible via their own internal API using the
user's existing authenticated session. The data was never
unavailable. It was simply not exposed through a native export
function.

These scripts call that same API endpoint directly. They never
touch the DOM. Virtualized rendering is entirely irrelevant to
them. The complete conversation is retrieved regardless of
length, built into a readable output file, and delivered
locally to the user's machine.

This fix was produced by a user of the product. Not by the
platform's engineering team. A user needed their own data and
worked out how to retrieve it. That is the context in which
this repository exists.

---

## Current State

### Claude.ai

Two versions of each script are provided:

**Full** — exports everything. Every non-text content block
(tool use, tool results, images, attachments, thinking blocks,
unknown types) is flagged inline with a clearly visible warning.
Nothing is silently dropped. Nothing is invisibly absent.
For users who need a complete auditable record of exactly what
happened in a session.

**Clean** — exports the human-readable conversation only.
Tool use, tool results, and internal reasoning blocks are
omitted. Attachments and images are still flagged since they
directly affect the visible conversation. For users who want
the text of what was said without technical infrastructure
detail.

| Script | Version | Status | Output |
|--------|---------|--------|--------|
| `claude/export-markdown.js` | Full | ✅ Tested | Markdown `.md` |
| `claude/export-markdown-clean.js` | Clean | ✅ Tested | Markdown `.md` |
| `claude/export-plaintext.js` | Full | ✅ Tested | Plain text `.txt` |
| `claude/export-plaintext-clean.js` | Clean | ✅ Tested | Plain text `.txt` |
| `claude/export-html.js` | Full | ✅ Tested | HTML `.html` |
| `claude/export-html-clean.js` | Clean | ✅ Tested | HTML `.html` |
| `claude/export-json.js` | Full | ✅ Tested | JSON `.json` |
| `claude/export-pdf-clean-serif.js` | Clean | ✅ Tested | PDF (print dialog, serif) |
| `claude/export-pdf-serif.js` | Full | ✅ Tested | PDF (print dialog, serif) |
| `claude/export-pdf-clean-sans.js` | Clean | ✅ Tested | PDF (print dialog, sans-serif) |
| `claude/export-pdf-sans.js` | Full | ✅ Tested | PDF (print dialog, sans-serif) |

JSON has no clean version — structured data is always complete
by nature.

### A note on the PDF scripts

The PDF scripts work differently from all other scripts in this
project. Rather than downloading a file, they open a
print-optimised document in a new browser tab and trigger the
print dialog. From there, select your printer or choose
"Save as PDF" to save locally.

Two typeface options are provided:

**Serif** (Georgia, Times New Roman) — suited to formal, legal,
and archival use. The typography and layout match the conventions
of professional printed documents.

**Sans-serif** (system-ui, Helvetica, Arial) — suited to general
professional use. Clean and modern.

Each typeface is available in both full and clean variants,
giving four PDF scripts in total.

### A note on the JSON version

Anthropic provides a JSON export natively — but only as a bulk
dump of your entire account history, initiated through Settings
→ Privacy → Export Data, delivered via an emailed download link
that expires after 24 hours, covering everything at once with
no option to export a single conversation.

There is no technical reason for that process to work that way.
Every time you open a Claude conversation, the complete
transcript is retrieved from Anthropic's servers instantly —
automatically, in under a second, using the same API endpoint
the JSON script in this repository calls. Immediate
per-conversation JSON export has always been technically trivial.
The infrastructure has always been there.

This script provides what Anthropic's own export does not: a
single conversation as JSON, immediately, on demand, no email,
no expiry link, no bulk dump, no wait.

---

## What Gets Exported

### Full versions
- ✅ Every human message — full text, with timestamps
- ✅ Every Claude response — full text, with timestamps
- ⚠️ Every non-text content block flagged inline — attachments,
  images, tool use, tool results, thinking blocks, unknown types.
  Nothing is silently dropped. Nothing is invisibly absent.
- 📋 Export summary at the end of every file or document

### Clean versions
- ✅ Every human message — full text, with timestamps
- ✅ Every Claude response — full text, with timestamps
- ⚠️ Attachments and images flagged — these are visible
  conversation content and must not be silently omitted
- ➖ Tool use, tool results, and thinking blocks omitted —
  internal technical operations not part of the readable
  conversation
- 📋 Export summary at the end of every file or document
  noting what was omitted

### PDF-specific notes
- PDF scripts open a print dialog rather than downloading a file
- Select "Save as PDF" in the print dialog to save locally
- Page breaks are handled automatically — messages are not
  split across pages
- Page numbers are included in the footer
- Chromium-based browsers and Firefox open the print dialog
  automatically. Safari opens the document in a new tab —
  press Cmd-P to open the print dialog manually.

---

## Usage

No installation required. No extensions. No third-party services.
Runs directly in your browser's developer console.

**Step 1.** Open the conversation you want to export.

**Step 2.** Open the browser developer console:

| Browser | Mac | Windows / Linux |
|---------|-----|-----------------|
| Chrome / Brave / Edge | Cmd + Option + J | F12 → Console tab |
| Firefox | Cmd + Option + K | F12 → Console tab |
| Safari | First enable: Safari Settings → Advanced → Show Develop menu. Then: Cmd + Option + I → Console tab | — |

**Step 3.** Copy the entire contents of the script you want
from this repository.

**Step 4.** Click inside the console, paste the script, press
Enter.

**Step 5.** Retrieve your export:

*Markdown, plain text, HTML, JSON — Chromium-based browsers,
Firefox and derivatives:* A file downloads automatically to
your Downloads folder, named after your conversation. Clean
versions append `-clean` to the filename.

*Markdown, plain text, HTML, JSON — Safari:* A
**"📋 Click to copy transcript"** button appears in the
top-right corner of the page. Click it once. Then open any
text editor, paste, and save the file with the appropriate
extension. The suggested filename is printed to the console.
If the button disappears before you click it, run this in
the console:
```javascript
copy(window._trueAiLastExport.content)
```

*PDF scripts — Chromium-based browsers, Firefox and
derivatives:* A print dialog opens automatically. Select your
printer or choose "Save as PDF".

*PDF scripts — Safari:* The document opens in a new tab.
Press **Cmd-P** to open the print dialog manually.

*In the PDF print dialog:*
- Paper size: A4 or Letter depending on your region
- Margins: Default (the script sets its own)
- Background graphics: Off (recommended)
- Headers and footers: On or off — the script provides its
  own page numbers, but browser headers and footers can be
  left on if preferred

**Step 6.** Watch the status indicator in the top-right corner
of the page:
- **Blue** — export in progress
- **Green** — export complete, no content gaps detected
- **Orange** — export complete, content gaps or attachments
  flagged in the file

---

## Output Format Previews

*Screenshots of each format will be added to this section.
Each use case is different — no format is prioritised over
another.*

| Format | Best for |
|--------|----------|
| Markdown | Note-taking apps, Obsidian, Notion, GitHub, editors |
| Plain text | Maximum compatibility, paste anywhere, no syntax |
| HTML | Reading, archiving, sharing — opens in any browser |
| JSON | Structured data, analysis, programmatic use |
| PDF (serif) | Formal, legal, archival — print or save as PDF |
| PDF (sans-serif) | General professional use — print or save as PDF |

---

## Browser Compatibility

| Browser | Platform | Text/HTML/JSON export | PDF export |
|---------|----------|-----------------------|------------|
| Chrome / Brave / Edge | Mac, Windows, Linux | Auto file download | Print dialog auto-opens |
| Firefox | Mac, Windows, Linux | Auto file download | Print dialog auto-opens |
| Safari | Mac | Click-to-copy button, then paste and save | Document opens in new tab — press Cmd-P |
| Safari | iOS | Not yet supported — extension planned | Not yet supported |

---

## Privacy and Security

- All network requests go only to the platform's own servers —
  no external servers are contacted at any point
- Conversation data is saved locally only — nothing is uploaded
  anywhere
- On Safari, content is written to the OS clipboard only on
  explicit user click — the clipboard is not accessed on any
  other browser
- PDF scripts send conversation data only to your local print
  dialog — nothing is uploaded anywhere
- Session credentials are used only to authenticate with the
  platform's own API — identical to what the page itself does
- All DOM elements created by the scripts are removed after
  export completes
- Full source available for audit — MIT licensed

---

## What Should Actually Happen

These scripts call an endpoint that the platform's own
application already uses internally. The correct fix — from
the platform's side — is a native export function that calls
this same endpoint and downloads the result as a readable file
in a format of the user's choosing from a simple menu.

That is the entire fix. The infrastructure already exists. The
data is already accessible. The engineering complexity is
demonstrably trivial. A button and a menu are missing.

Separately and additionally, the ability to select and copy
arbitrary text to the OS clipboard must be restored. That
requires a different fix — one that addresses how virtualized
rendering interacts with browser text selection — and it cannot
be substituted for by an export script. Both fixes are required.
Neither is optional.

If you are affected by this on Claude.ai, the most effective
thing you can do is report it directly and specifically through
official channels:

- **Support:** support@anthropic.com
- **In-product feedback:** the feedback option in Claude's
  settings or via the help menu

A template bug report is available in this repository at
`bug-reports/anthropic.md`. It documents both regressions
in precise technical terms. Copy it, add your own account
details and subscription tier, and send it. A specific,
documented report from an affected user carries more weight
than general complaints.

If you are affected by this on a different platform, the same
approach applies — contact that platform's support directly
with specific technical detail about what broke and when.

---

## Known Limitations

- Non-text content cannot be exported as plain text in the
  text-based formats — every instance is flagged inline in
  full versions, attachments and images flagged in clean
  versions
- Very long conversations may be subject to API pagination —
  if messages appear missing from the start of an export,
  please open an issue
- Scripts use undocumented internal API endpoints — these may
  change without notice if the platform updates its
  infrastructure
- Safari requires one additional user step for text/HTML/JSON
  exports — a click-to-copy button rather than an automatic
  file download — due to Safari's clipboard security policy
- Safari does not auto-fire the print dialog for PDF exports —
  press Cmd-P after the document opens
- PDF print output appearance varies slightly between browsers
  and operating systems

---

## License

MIT.

Use it, copy it, modify it, build on it freely. If any platform
wants to use this code as the basis for a native export feature,
they are explicitly welcome to do so. That is the intended
outcome.

---

## Maintenance and Intent

This repository was created by a user of these products.

It is not a permanent solution. It is evidence that the fix is
trivial, and a working demonstration of what native export
should look like. The moment any affected platform ships a
proper native export function, the relevant scripts in this
repository become unnecessary. That is the goal.

Developers who want to extend this — additional output formats,
additional platforms, pagination handling, a browser extension
— are welcome to do so. The core fetch logic is stable,
documented, and deliberately separated from the output
formatting layer to make new format support straightforward
to add.

Pull requests are welcome. Issues are welcome. The framing
should stay honest: these are workarounds for problems that
the platforms themselves are responsible for solving.
