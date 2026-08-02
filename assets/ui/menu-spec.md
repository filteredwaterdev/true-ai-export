# UI Specification — Save to File Menu

## Button placement

The "Save to file" button should appear in the conversation
action bar — the row of icons that appears at the top or
bottom of a conversation, alongside existing actions such
as Share and New conversation.

## Button states

**Default:** Document + right arrow icon, label "Save to file"
**Hover:** Standard hover state consistent with adjacent buttons
**Active/open:** Dropdown menu visible, button in pressed state
**Loading:** Brief spinner while API fetch completes (typically
under one second for text formats; print dialog opens
immediately for PDF formats)
**Success:** Brief checkmark or "Downloaded" confirmation
(text formats only — PDF formats open the print dialog
and do not download a file)

## Dropdown menu

Appears below the button on click. Standard dropdown styling
consistent with existing claude.ai menus.

```
┌──────────────────────────┐
│ Save to file             │
├──────────────────────────┤
│ Markdown                 │
│ Markdown (clean)         │
│ Plain text               │
│ Plain text (clean)       │
│ HTML                     │
│ HTML (clean)             │
│ JSON                     │
│ PDF — serif              │
│ PDF — serif (clean)      │
│ PDF — sans-serif         │
│ PDF — sans-serif (clean) │
├──────────────────────────┤
│ About these formats      │
└──────────────────────────┘
```

## Format descriptions (tooltip or About page)

**Markdown** — Full transcript with all content flagged.
For note-taking apps, Obsidian, Notion, GitHub.

**Markdown (clean)** — Human-readable conversation only.
Tool use and internal operations omitted.

**Plain text** — Full transcript, no formatting syntax.
Maximum compatibility. Paste anywhere.

**Plain text (clean)** — Human-readable conversation only,
no formatting syntax.

**HTML** — Full transcript as a styled document. Opens in
any browser. Good for archiving and sharing.

**HTML (clean)** — Human-readable conversation as a styled
document.

**JSON** — Complete structured data. For programmatic use,
analysis, or building on top of the conversation.

**PDF — serif** — Full transcript as a print-optimised
document using a serif typeface (Georgia, Times New Roman).
Suited to formal, legal, and archival use. Opens print
dialog — select printer or Save as PDF.

**PDF — serif (clean)** — Human-readable conversation only,
serif typeface. Opens print dialog.

**PDF — sans-serif** — Full transcript as a print-optimised
document using a sans-serif typeface (system-ui, Helvetica,
Arial). Suited to general professional use. Opens print
dialog.

**PDF — sans-serif (clean)** — Human-readable conversation
only, sans-serif typeface. Opens print dialog.

## File naming

Downloaded file should be named after the conversation title,
with spaces replaced by underscores, special characters
removed, and the appropriate extension appended.

Example: `my_conversation_about_x.md`

PDF formats open a print dialog rather than downloading a
file directly. The suggested filename is displayed in the
print dialog.

## Keyboard accessibility

Button should be reachable via Tab. Dropdown should be
navigable via arrow keys. Escape should close the dropdown.
Each format option should be selectable via Enter.

## Implementation note

The export function calls the same internal API endpoint
already used by the claude.ai interface to load
conversations:

/api/organizations/{orgId}/chat_conversations/{conversationId}
  ?tree=true&rendering_mode=messages&render_all_tools=true

A working reference implementation is available at:
https://github.com/filteredwaterdev/true-ai-export

The complete transcript is returned in a single API response
in under one second. No new infrastructure is required.

PDF formats build a print-optimised HTML document from the
API response and open it in a new window, triggering the
browser's native print dialog. No external PDF library is
required.
