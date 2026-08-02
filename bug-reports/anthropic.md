# Bug Report Template — Anthropic Support
### To be modified as required and sent to: support@anthropic.com
### Example subject line provided below 

---

**To:** support@anthropic.com

**Subject:** FORMAL BUG REPORT: Virtualized rendering
introduced a regression in OS clipboard copy and all
browser-native export mechanisms in the claude.ai web
interface — working fix demonstrated

---

To the Anthropic Product and Engineering Team,

This is a formal bug report documenting a regression
in the claude.ai web interface that introduced the loss of
ability to copy conversation transcripts to the OS clipboard
and simultaneously introduced the same regression in every
other browser-native mechanism for retrieving page content.
The root cause has been independently identified after extensive
troubleshooting.

A working fix has been built and published at:
https://github.com/filteredwaterdev/true-ai-export

This report expects a formal engineering response with a remediation timeline.

---

## ENVIRONMENT

- Platform: claude.ai web interface (browser-based)
- Account type: [Free / Pro / Max]
- Date regression first observed: approximately June 2026

---

## PREVIOUS BEHAVIOUR

For many months the following workflows functioned completely
and reliably for conversations of any length:

**Clipboard copy:**
Selecting any arbitrary portion of a conversation — a sentence,
a paragraph, a single response, or the entire session via
Cmd-A / Ctrl-A — and copying to the OS clipboard via Cmd-C /
Ctrl-C reliably transferred the complete selected content.
Length, position in the conversation, and scroll state were
entirely irrelevant. This was a primary workflow for a
significant population of paying users.

**Browser-native export:**
File → Save Page As produced a complete, readable HTML file
of the full conversation. File → Print → Print to PDF produced
a complete PDF. DOM-reading browser extensions could read and
export the complete conversation.

---

## CURRENT BEHAVIOUR

**Clipboard copy:**

What transfers to the OS clipboard is now determined not by
what the user selected but by what happens to be mounted in
the browser DOM at that moment. The position and length of
what actually transfers bears no guaranteed relationship to
the user's selection. For long conversations, the overwhelming
majority of the transcript is absent from the clipboard.

There is no reported error. There is no warning. No indication
of any kind is given that the operation failed. The copy
appears to succeed. The data loss is invisible and may not be
discovered until much later. This is a silent data loss vector
affecting paying users who believe they have saved a complete
record when they have not.

A curious illustration of this regression: Cmd-F
browser search works correctly across the full conversation —
the browser can find text anywhere in the session regardless
of scroll position — while Cmd-C copies only the DOM fragment.
The content is accessible to the browser's own find function
but not to the clipboard.

**Save Page As, Print to PDF, DOM-reading extensions:**

All of these are subject to the same regression and produce
unusable output. The exact failure mode is unpredictable and
varies. In all cases the output does not constitute a usable
record of the conversation. These mechanisms are affected by
the same underlying regression as clipboard copy and are not
a viable alternative.

All failures across all mechanisms are silent. None produce
reported errors. All appear to succeed while delivering
unusable output when dealing with text samples of sufficient
size.

---

## ROOT CAUSE

The claude.ai web interface was migrated to virtualized
rendering. Under this architecture, only the messages near
the user's current scroll position are instantiated in the
browser DOM at any given time. Older messages are unloaded
as the user scrolls.

Every browser-native mechanism for retrieving page content
operates on what is in the DOM. The virtualized rendering
migration introduced a regression in not one export pathway
but the entire category of DOM-based content retrieval
simultaneously.

**This is not a server-side constraint.**

Virtualized rendering does not reduce Anthropic's server load.
It has no effect on backend infrastructure whatsoever. The
full conversation is fetched from Anthropic's servers
regardless — the complete data arrives in a single API
response every time a conversation is opened.

This has been confirmed empirically. The following endpoint
returns the complete conversation transcript in full, in under
one second, using the user's existing authenticated session:

/api/organizations/{orgId}/chat_conversations/{conversationId}
  ?tree=true&rendering_mode=messages&render_all_tools=true

This is the same endpoint claude.ai itself calls on every
page load. The data was never unavailable. It was simply not
exposed through a native export function. Virtualized
rendering is a client-side optimisation that affects only
what is mounted in the local browser DOM — it has no
relationship to what is available on the backend.

---

## IMPACT

This regression completely destroys a legitimate, high-value
workflow that functioned reliably and that subscribers paid for. 

Paying subscribers doing text-based knowledge work in
long sessions where the conversation transcript is the work
product have no alternative. The claude.ai web interface IS
the product for this user population. There is no API alternative for this use case.
There is no fallback. The web interface is what was sold.
The web interface is what is broken.

The fact that the virtualized rendering migration introduced
a regression in every DOM-based export mechanism
simultaneously — clipboard, Save Page As, Print to PDF,
extensions — means there is no native browser workaround of
any kind. Every path a user might take to retrieve their
content is subject to the same regression.

This regression is underrepresented in your feedback systems
for a structural reason: the most technically vocal Claude
users — developers and engineers — access the platform via
API or local tooling and are entirely unaffected. They do
not experience this regression and therefore do not report
it. The affected users are less represented in the
communities and feedback channels Anthropic monitors. This
regression looks smaller than it is from inside your systems.
It is not small.

A note on a related but separate issue: many users have independently 
noted that moderate to large text pastes into the Claude
input box are silently converted to empty file attachments.
That is a distinct regression affecting the paste-in direction.
It is not the focus of this issue or of the specific linked project,
but it is noted here because it affects the exact same user
population and compounds the impact. Claude web UI is broken. 

---

## WORKING FIX — BUILT BY AN AFFECTED USER

Because no native workaround exists, one was built by an affected 
user. It is published at:

https://github.com/filteredwaterdev/true-ai-export

The project provides browser console scripts that call the
API endpoint documented above directly, retrieve the complete
conversation transcript regardless of length, and deliver it
locally in multiple formats:

- Markdown (full and clean)
- Plain text (full and clean)
- HTML (full and clean)
- JSON
- PDF — serif (full and clean)
- PDF — sans-serif (full and clean)

Eleven scripts in total, tested and confirmed working across
Chromium-based browsers, Firefox, and Safari.

This fix demonstrates two things:

1. The complete conversation data is fully accessible via
   Anthropic's own backend API using the user's existing
   session — no new infrastructure is required
2. A native export function is trivially simple to implement
   — it calls the same endpoint that already runs on every
   page load

The repository also includes:
- Complete UI specification for a native "Save to file"
  button that opens a format picker menu
- Icon assets in SVG, PNG, and React component formats
- A proposed button label ("Save to file") and function
  category name ("Transcript Portability")

Everything needed to implement this natively is there.

---

## STEPS TO REPRODUCE

**Clipboard:**
1. Open any conversation of substantial length on claude.ai
2. Press Cmd-A or Ctrl-A
3. Press Cmd-C or Ctrl-C
4. Paste into any plain text editor

Expected: Complete conversation transcript.
Actual: Fragment with no indication the output is incomplete.

**Save Page As:**
1. Open any conversation of substantial length on claude.ai
2. File → Save Page As → Save as HTML
3. Open the saved file

Expected: Complete, usable conversation record.
Actual: Broken, unusable output.

**Print to PDF:**
1. Open any conversation of substantial length on claude.ai
2. File → Print → Save as PDF
3. Open the PDF

Expected: Complete, usable conversation record.
Actual: Broken, unusable output.

---

## REQUESTED RESOLUTION

**Primary:** Implement a native Save to file button in the
claude.ai interface that opens a format picker menu and
delivers the selected format immediately. The true-ai-export
repository contains a complete reference implementation, UI
specification, and icon assets.

**Secondary:** Restore the ability to select and copy
arbitrary text to the OS clipboard. Restore Save Page As
and Print to PDF to produce complete, usable output. These
require addressing how virtualized rendering interacts with
browser-native content retrieval and cannot be substituted
for by an export script.

**At minimum:** Acknowledge this publicly as a regression,
provide a remediation timeline, and add it to the public
roadmap.

---

This report warrants confirmation of receipt of this report and a
substantive response regarding remediation timeline. A
working fix exists and is publicly available. The
infrastructure to implement it natively already exists
and already runs on every page load. There is no technical
justification for further delay.

---

*This bug report template is published at:*
*https://github.com/filteredwaterdev/true-ai-export/bug-reports/anthropic.md*
*It is available for any affected user to copy, personalise,*
*and submit.*
