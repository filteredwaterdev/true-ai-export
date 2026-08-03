**Title:** [BUG] Virtualized rendering introduced a regression
in OS clipboard copy and all browser-native export mechanisms
in the claude.ai web interface — working fix demonstrated

---

**Labels:** bug, regression, web-ui, clipboard, transcript-export

---

## Summary

A regression in the claude.ai web interface introduced the
loss of ability to select and copy conversation transcripts
to the OS clipboard, and simultaneously introduced the same
regression in every other browser-native mechanism for
retrieving page content — Save Page As, Print to PDF, browser
print, and DOM-reading extensions. All of these rely on
content being present in the page. Virtualized rendering means
it is not.

The regression affects all users of the claude.ai web
interface who rely on copying or exporting conversation
content by any native browser mechanism.

A working fix has been built, tested, and published by an
affected user at:

**https://github.com/filteredwaterdev/true-ai-export**

The fix calls the same internal API endpoint that claude.ai
already uses on every page load. The engineering complexity of
a native export implementation is demonstrably trivial.

The working fix referenced in this report addresses transcript portability only — it provides a workaround for the export direction. It does not and cannot fix the broken clipboard copy behaviour. That requires a native fix to how virtualized rendering interacts with browser text selection. Both issues are real, both are documented here, and neither substitutes for the other.

---

## Environment

- Platform: claude.ai web interface (browser-based)
- Browsers confirmed affected: Brave, Firefox, Safari
- Date regression introduced: approximately June 2026

---

## Previous Behaviour

For many months the following workflows functioned completely
and reliably for conversations of any length:

**Clipboard copy:**
1. Select any arbitrary portion of a conversation — a sentence,
   a paragraph, a single response, or the entire session via
   `Cmd-A` / `Ctrl-A`
2. Copy to OS clipboard via `Cmd-C` / `Ctrl-C`
3. Paste into any external application

The length of the selection, its position in the conversation,
and its distance from the current scroll position were entirely
irrelevant. Whatever was selected transferred accurately and
completely to the clipboard. This was a primary workflow for a
significant population of paying users.

**Browser-native export:**
- File → Save Page As → produced a complete, readable HTML file
  of the full conversation
- File → Print → Print to PDF produced a complete PDF of the
  full conversation
- DOM-reading browser extensions could read and export the
  complete conversation

All of these worked reliably regardless of conversation length,
scroll position, or session duration.

---

## Current Behaviour

**Clipboard copy — detailed:**

What transfers to the OS clipboard is now determined not by
what the user selected but by what happens to be mounted in
the browser DOM at that moment. The position and length of
what actually transfers bears no guaranteed relationship to
the user's selection. For long conversations, the overwhelming
majority of the transcript is absent from the clipboard.
There is no reported error. There is no warning. No indication
of any kind is given that the operation failed. The copy
appears to succeed. The data loss is invisible and may not be
discovered until much later.

A curious illustration of this regression: Cmd-F
browser search works correctly across the full conversation —
the browser can find text anywhere in the session regardless
of scroll position — while Cmd-C copies only the DOM fragment.
The content is accessible to the browser's own find function
but not to the clipboard.

**Save Page As, Print to PDF, DOM-reading extensions:**

All of these are subject to the same regression and produce
unusable output. The exact nature of the broken output is
unpredictable and varies — it is not described in detail here
because it cannot be reliably characterised — but in all cases
the output does not constitute a usable record of the
conversation when dealing with text samples of sufficient size.
These mechanisms are not a viable alternative. They are subject
to the same underlying regression and all appear to succeed
while delivering unusable output.

All failures across all mechanisms are silent. None produce
reported errors.

---

## Root Cause

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

### This is not a server-side constraint

Virtualized rendering does not reduce Anthropic's server load.
It has no effect on backend infrastructure. The full
conversation is fetched from Anthropic's servers regardless —
the complete data arrives in a single API response every time
a conversation is opened.

This has been confirmed empirically. The following API endpoint
returns the complete conversation transcript in full, in under
one second, regardless of conversation length, using the user's
existing authenticated session:

```
/api/organizations/{orgId}/chat_conversations/{conversationId}
  ?tree=true&rendering_mode=messages&render_all_tools=true
```

This is the same endpoint claude.ai itself calls on every page
load. The data is there. It has always been there. Virtualized
rendering is a client-side optimisation that affects only what
is mounted in the local browser DOM — it has no relationship
to what is available on the backend.

---

## Impact

This regression completely destroys a legitimate, high-value
workflow that functioned reliably and that users paid for.

The users most severely affected are those doing text-based
knowledge work — research, writing, analysis, legal work,
strategy — in long sessions where the conversation transcript
is the work product. For these users, the web interface IS
the product. There is no API alternative. There is no fallback.

The fact that the virtualized rendering migration introduced
a regression in every DOM-based export mechanism
simultaneously — clipboard, Save Page As, Print to PDF,
extensions — means there is no native browser workaround.
Every path a user might try to retrieve their content is
subject to the same regression.

This regression is underrepresented in community feedback for
a structural reason: the most technically vocal Claude users
— developers and engineers — access the platform via API or
local tooling and are entirely unaffected. The affected users
are less represented in the communities Anthropic monitors.
The regression appears smaller than it is from inside
Anthropic's feedback systems. It is not small.

A note on a related but separate issue: I and many other users
have independently noted that large text pastes into the Claude
input box are silently converted to empty file attachments.
That is a distinct regression affecting the paste-in direction.
It is not the focus of this issue or of the specific linked project,
but it is noted here because it affects the exact same user
population and compounds the impact. Claude web UI is broken. 

---

## Working Fix

The working fix referenced in this report addresses transcript portability only — it provides a workaround for the export direction. It does not and cannot fix the broken clipboard copy behaviour. That requires a native fix to how virtualized rendering interacts with browser text selection. Both issues are real, both are documented here, and neither substitutes for the other.

A user built a working fix and published it at:

**https://github.com/filteredwaterdev/true-ai-export**

The project provides browser console scripts that call the API
endpoint documented above directly, retrieve the complete
conversation transcript regardless of length, and deliver it
locally in multiple formats:

- Markdown (full and clean)
- Plain text (full and clean)
- HTML (full and clean)
- JSON
- PDF — serif (full and clean)
- PDF — sans-serif (full and clean)

Eleven scripts in total, tested and confirmed working on:
- Brave / Edge (macOS, Windows)
- Firefox (macOS, Windows)
- Safari (macOS) — with one additional user step due to
  Safari's clipboard security policy

The fix demonstrates two things:

1. The complete conversation data is fully accessible via
   Anthropic's own backend API using the user's existing
   session — no new infrastructure is required
2. The implementation of a native export function is trivially
   simple — the hard part is already built and already running
   on every page load

---

## Requested Resolution

### Primary request

Implement a native **Save to file** button in the claude.ai
interface that calls the above API endpoint and opens a format
picker menu, downloading the result immediately as a local file
in the format of the user's choosing.

The `true-ai-export` repository includes:
- Eleven working export scripts across four formats plus PDF
  variants, in full and clean versions
- Complete UI specification for the button and format picker
  menu at `assets/ui/menu-spec.md`
- Icon assets in SVG, PNG, and React component formats at
  `assets/`
- A proposed button label ("Save to file") and function
  category name ("Transcript Portability")

Everything needed to implement this natively is in that
repository. The proposed API call is already running.

### Secondary request

Separately restore the ability to select and copy arbitrary
text to the OS clipboard. Restore Save Page As and Print
to PDF to produce complete and usable output. These require
addressing how virtualized rendering interacts with
browser-native content retrieval. They cannot be substituted
for by an export script. Both the native export function and
the restoration of native browser mechanisms are required.

### At minimum

Acknowledge this publicly as a regression, provide a timeline
for resolution, and add it to the public roadmap.

---

## Steps to Reproduce

**Clipboard:**
1. Open any conversation of substantial length on claude.ai
2. Press `Cmd-A` / `Ctrl-A`
3. Press `Cmd-C` / `Ctrl-C`
4. Paste into any plain text editor

Expected: Complete conversation transcript. 
Actual: Fragment — only messages near current scroll position
— with no reported error or indication the output is incomplete.

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

## Additional Context

The `true-ai-export` project also includes a formal bug report
template at `bug-reports/anthropic.md` that affected users can
copy and submit directly to support@anthropic.com.

This issue is filed in `anthropics/claude-code` in the absence
of a dedicated public repository for the claude.ai web
interface. It is a web interface regression, not a Claude Code
issue. A dedicated public feedback repository for the web
interface would be a valuable addition.

---

*Filed by an affected user. The linked repository was built
by a user who needed their own data back. That is the context
in which this issue exists.*
