/**
 * true-ai-export — Claude.ai Conversation Exporter (PDF, Clean, Sans-Serif)
 * https://github.com/filteredwaterdev/true-ai-export
 *
 * Part of the true-ai-export project — a collection of scripts
 * that export complete AI conversation transcripts directly from
 * the platform's own backend API, bypassing the virtualized DOM
 * rendering that silently broke the ability to copy conversation
 * transcripts to the OS clipboard.
 *
 * This is the CLEAN SANS-SERIF version. It exports the human-readable
 * conversation only as a print-optimised document using a sans-serif
 * typeface — suited to general professional use. Tool use, tool
 * results, and internal reasoning blocks are omitted. Attachments
 * and images are flagged since they directly affect what was
 * visible in the conversation.
 *
 * For the serif version use export-pdf-clean-serif.js.
 * For the full version that flags every non-text content block
 * explicitly, use export-pdf-sans.js.
 *
 * For full context on why this project exists, what is broken,
 * and what Anthropic should do to fix it natively, see:
 * https://github.com/filteredwaterdev/true-ai-export
 *
 * ─── USAGE ───────────────────────────────────────────────────
 *
 *   1. Open any Claude.ai conversation in your browser
 *
 *   2. Open the browser developer console:
 *
 *      Chromium-based browsers (Chrome, Brave, Edge) on Mac:
 *        Cmd + Option + J
 *        (opens DevTools directly to Console tab)
 *
 *      Firefox and Firefox-based browsers on Mac:
 *        Cmd + Option + K
 *        (opens DevTools directly to Console tab)
 *
 *      Safari on Mac:
 *        First enable: Safari Settings → Advanced → Show Develop menu
 *        Then: Cmd + Option + I → click the Console tab
 *
 *      Chromium-based browsers (Chrome, Brave, Edge) on Windows or Linux:
 *        F12 → click the Console tab
 *
 *      Firefox and Firefox-based browsers on Windows or Linux:
 *        F12 → click the Console tab
 *
 *   3. Click inside the console, paste this entire script,
 *      press Enter
 *
 *   4. The document opens and the print dialog appears:
 *
 *      Chromium-based browsers, Firefox and derivatives:
 *        The print dialog opens automatically.
 *
 *      Safari:
 *        The document opens in a new tab. Press Cmd-P to
 *        open the print dialog manually.
 *
 *      In the print dialog:
 *        - Paper size: A4 or Letter depending on your region
 *        - Margins: Default (the script sets its own margins)
 *        - Background graphics: Off (recommended)
 *        - Headers and footers: On or off — the script
 *          provides its own page numbers, but browser headers
 *          and footers can be left on if preferred
 *        - Select your printer or choose "Save as PDF" to
 *          save a PDF file locally
 *
 * ─── WHAT GETS EXPORTED ──────────────────────────────────────
 *
 *   ✅ Every human message — full text, with timestamps
 *   ✅ Every Claude response — full text, with timestamps
 *   ⚠️  Attachments and images are flagged inline — these
 *       directly affect the visible conversation and should
 *       not be silently omitted
 *   ➖  Tool use, tool results, and extended thinking blocks
 *       are omitted — internal technical operations not part
 *       of the readable conversation
 *   📋  Export summary appended at end of document
 *
 * ─── PRIVACY AND SECURITY ────────────────────────────────────
 *
 *   - All network requests go only to claude.ai — no external
 *     servers are contacted at any point
 *   - Conversation data is sent only to your local print dialog
 *     — nothing is uploaded anywhere
 *   - Conversation ID and org ID validated as UUIDs before use
 *   - All DOM elements created by this script are removed
 *     after the print window is opened
 *   - Full source available for audit — MIT licensed
 *
 * ─── KNOWN LIMITATIONS ───────────────────────────────────────
 *
 *   - Tool use and tool results are intentionally omitted in
 *     this version — use export-pdf-sans.js for full output
 *   - Very long conversations may be subject to API pagination
 *     — if messages appear missing from the start of an export,
 *     please open a GitHub issue
 *   - Uses an undocumented internal API endpoint — may break
 *     if Anthropic changes their infrastructure without notice
 *   - Print output appearance varies slightly between browsers
 *     and operating systems
 *   - Safari does not auto-fire the print dialog — press
 *     Cmd-P after the document opens
 *
 * Version: 1.2.0
 * License: MIT
 */

async function trueAiExportPdfCleanSans() {

  // ─── Status UI ───────────────────────────────────────────────────────────
  // statusMsg is a child span so we can appendChild elements without
  // wiping the status text via textContent assignment.

  const statusDiv = document.createElement('div');
  statusDiv.style.cssText = `
    position: fixed; top: 10px; right: 10px; z-index: 10000;
    background: #2196F3; color: white; padding: 12px 16px;
    border-radius: 6px; font-family: monospace; font-size: 12px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3); max-width: 320px;
    line-height: 1.5;
  `;

  const statusMsg = document.createElement('span');
  statusMsg.textContent = 'Starting export...';
  statusDiv.appendChild(statusMsg);
  document.body.appendChild(statusDiv);

  const setStatus = (msg, color = '#2196F3') => {
    statusMsg.textContent = msg;
    statusDiv.style.background = color;
  };

  const cleanup = () => {
    if (document.body.contains(statusDiv)) {
      document.body.removeChild(statusDiv);
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function isValidUUID(str) {
    return UUID_REGEX.test(str);
  }

  function formatTimestamp(isoString) {
    if (!isoString) return null;
    try {
      return new Date(isoString).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
      });
    } catch {
      return null;
    }
  }

  function sanitizeTitle(str) {
    return (str || 'Conversation with Claude')
      .replace(/[\r\n]+/g, ' ')
      .trim();
  }

  function escapeHtml(str) {
    return (str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function textToHtml(str) {
    return escapeHtml(str)
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  // ─── API Fetch ───────────────────────────────────────────────────────────

  async function fetchAllMessages(orgId, conversationId) {
    const url =
      `/api/organizations/${orgId}/chat_conversations/${conversationId}` +
      `?tree=true&rendering_mode=messages&render_all_tools=true`;

    setStatus('Fetching full conversation from API...');

    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(
        `API returned HTTP ${response.status}. ` +
        (response.status === 403
          ? 'Session may have expired — try refreshing the page ' +
            'and running the script again.'
          : response.status === 404
          ? 'Conversation not found. Make sure you are on a ' +
            'Claude conversation page (claude.ai/chat/...).'
          : 'Unexpected server error — please open a GitHub issue.')
      );
    }

    const data = await response.json();

    if (!data.chat_messages || data.chat_messages.length === 0) {
      throw new Error(
        'API returned no messages. The conversation may be empty.'
      );
    }

    return {
      messages: data.chat_messages,
      conversationName: data.name || null
    };
  }

  // ─── Clean PDF Builder (Sans-Serif) ──────────────────────────────────────

  function buildPdfCleanSans(messages, conversationName) {
    let humanCount = 0;
    let claudeCount = 0;
    let skippedCount = 0;
    let warningCount = 0;
    let omittedCount = 0;

    const title = sanitizeTitle(
      conversationName || 'Conversation with Claude'
    );

    const exportDate = new Date().toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });

    let body = '';

    for (const msg of messages) {
      const ts = formatTimestamp(msg.created_at);
      const contentBlocks = msg.content ?? [];
      let senderLabel = '';

      if (msg.sender === 'human') {
        humanCount++;
        senderLabel = 'Human';
      } else if (msg.sender === 'assistant') {
        claudeCount++;
        senderLabel = 'Claude';
      } else {
        skippedCount++;
        continue;
      }

      let messageContent = '';
      let hasContent = false;

      for (const block of contentBlocks) {

        if (block.type === 'text') {
          const text = (block.text ?? '').trim();
          if (text) {
            messageContent += `<p>${textToHtml(text)}</p>`;
            hasContent = true;
          }

        } else if (block.type === 'document' || block.type === 'file') {
          warningCount++;
          hasContent = true;
          const name =
            block.name || block.file_name || block.filename || null;
          const mediaType =
            block.media_type || block.file_type || null;

          messageContent += `<div class="warning">`;
          messageContent +=
            `<p><strong>⚠️ ATTACHMENT — CONTENT NOT FULLY EXPORTED</strong></p>`;
          messageContent +=
            `<p>This message contained an attached document that ` +
            `could not be captured as plain text.</p>`;
          if (name) {
            messageContent +=
              `<p>Filename: ${escapeHtml(name)}</p>`;
          }
          if (mediaType) {
            messageContent +=
              `<p>Type: ${escapeHtml(mediaType)}</p>`;
          }
          messageContent +=
            `<p>Possible causes: Large text paste auto-converted ` +
            `to an attachment by the claude.ai interface (a known ` +
            `concurrent regression), or a manually uploaded file.</p>`;
          messageContent +=
            `<p>Action required: Refer to the original conversation ` +
            `in Claude to retrieve this content.</p>`;
          messageContent += `</div>`;

        } else if (block.type === 'image') {
          warningCount++;
          hasContent = true;
          messageContent += `<div class="warning">`;
          messageContent +=
            `<p><strong>⚠️ IMAGE — NOT EXPORTED</strong></p>`;
          messageContent +=
            `<p>An image exists at this point and cannot be ` +
            `exported as plain text.</p>`;
          messageContent +=
            `<p>Action required: Refer to the original conversation ` +
            `in Claude to view this image.</p>`;
          messageContent += `</div>`;

        } else if (
          block.type === 'tool_use' ||
          block.type === 'tool_result' ||
          block.type === 'thinking' ||
          block.type === 'redacted_thinking'
        ) {
          // Tool use, tool results, and thinking blocks are
          // intentionally omitted in the clean version.
          // Use export-pdf-sans.js for full output.
          omittedCount++;

        } else {
          warningCount++;
          hasContent = true;
          messageContent += `<div class="warning">`;
          messageContent +=
            `<p><strong>⚠️ UNKNOWN CONTENT — NOT EXPORTED</strong></p>`;
          messageContent +=
            `<p>A content block of unrecognised type ` +
            `"${escapeHtml(block.type ?? 'unknown')}" exists ` +
            `at this point.</p>`;
          messageContent +=
            `<p>Action required: Refer to the original conversation ` +
            `in Claude to see this content.</p>`;
          messageContent += `</div>`;
        }
      }

      if (!hasContent) {
        skippedCount++;
        continue;
      }

      body += `
        <div class="message">
          <p class="speaker">
            <strong>${escapeHtml(senderLabel)}</strong>
            ${ts
              ? `<span class="timestamp">&nbsp;(${escapeHtml(ts)})</span>`
              : ''}
          </p>
          <div class="content">${messageContent}</div>
        </div>
        <hr class="separator">`;
    }

    // Export summary
    const summaryRows = [
      ['Human messages', humanCount],
      ['Claude messages', claudeCount],
      ['Attachments / images flagged', warningCount],
      ['Technical blocks omitted', omittedCount],
      ['Messages skipped', skippedCount],
      ['Exported at', new Date().toISOString()],
      ['Script', 'PDF clean sans-serif v1.2.0'],
      ['Source', 'github.com/filteredwaterdev/true-ai-export']
    ].map(([label, value]) =>
      `<tr><td>${label}</td><td>${value}</td></tr>`
    ).join('\n');

    const warningNote = warningCount > 0
      ? `<p class="warning-note">⚠️ ${warningCount} attachment or ` +
        `image${warningCount === 1 ? '' : 's'} flagged — refer to ` +
        `original conversation to retrieve missing content.</p>`
      : '';

    const omittedNote = omittedCount > 0
      ? `<p class="omitted-note">ℹ️ ${omittedCount} technical block` +
        `${omittedCount === 1 ? '' : 's'} omitted (tool use, tool ` +
        `results, extended thinking). Use export-pdf-sans.js for ` +
        `full output.</p>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    /* ── Page setup ── */
    @page {
      size: A4;
      margin: 2cm;
      @bottom-center {
        content: counter(page);
        font-family: system-ui, -apple-system, 'Helvetica Neue',
          Arial, sans-serif;
        font-size: 10pt;
        color: #666;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, -apple-system, 'Helvetica Neue',
        Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #111;
      background: #fff;
    }

    /* ── Title block ── */
    .title-block {
      margin-bottom: 2em;
      padding-bottom: 1em;
      border-bottom: 1pt solid #333;
    }

    .title-block h1 {
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 0.3em;
    }

    .title-block .meta {
      font-size: 9pt;
      color: #555;
    }

    /* ── Messages ── */
    .message {
      margin-bottom: 1em;
      page-break-inside: avoid;
    }

    .speaker {
      font-size: 10pt;
      margin-bottom: 0.3em;
    }

    .timestamp {
      font-weight: normal;
      color: #666;
      font-size: 9pt;
    }

    .content p {
      margin-bottom: 0.6em;
      font-size: 11pt;
    }

    .content p:last-child {
      margin-bottom: 0;
    }

    /* ── Warnings ── */
    .warning {
      border-left: 2pt solid #999;
      padding-left: 0.8em;
      margin: 0.5em 0;
      color: #444;
    }

    .warning p {
      font-size: 9pt;
      margin-bottom: 0.3em;
    }

    .warning p:last-child {
      margin-bottom: 0;
    }

    /* ── Separator ── */
    .separator {
      border: none;
      border-top: 0.5pt solid #ccc;
      margin: 0.8em 0;
    }

    /* ── Summary ── */
    .summary {
      margin-top: 2em;
      padding-top: 1em;
      border-top: 1pt solid #333;
      page-break-before: auto;
    }

    .summary h2 {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 0.8em;
    }

    .summary table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }

    .summary table td {
      padding: 4pt 6pt;
      border: 0.5pt solid #ccc;
      vertical-align: top;
    }

    .summary table tr:nth-child(even) td {
      background: #f9f9f9;
    }

    .warning-note {
      margin-top: 0.8em;
      font-size: 9pt;
      color: #555;
    }

    .omitted-note {
      margin-top: 0.5em;
      font-size: 9pt;
      color: #555;
    }

    /* ── Print-specific ── */
    @media print {
      body { background: #fff; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>

  <div class="title-block">
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">
      Exported on ${escapeHtml(exportDate)}
      &nbsp;·&nbsp;
      PDF clean sans-serif v1.2.0
      &nbsp;·&nbsp;
      github.com/filteredwaterdev/true-ai-export
    </p>
  </div>

  ${body}

  <div class="summary">
    <h2>Export Summary</h2>
    <table>
      <tbody>
        ${summaryRows}
      </tbody>
    </table>
    ${warningNote}
    ${omittedNote}
  </div>

</body>
</html>`;

    return {
      html,
      humanCount,
      claudeCount,
      skippedCount,
      warningCount,
      omittedCount
    };
  }

  // ─── Main ────────────────────────────────────────────────────────────────

  try {
    const conversationId = window.location.pathname.split('/').pop();
    if (!conversationId || !isValidUUID(conversationId)) {
      throw new Error(
        'Could not find a valid conversation ID in the URL. ' +
        'Make sure you are on a Claude conversation page ' +
        '(claude.ai/chat/...).'
      );
    }

    const orgId = document.cookie.match(/lastActiveOrg=([^;]+)/)?.[1];
    if (!orgId || !isValidUUID(orgId)) {
      throw new Error(
        'Could not find your organisation ID in session cookies. ' +
        'Try refreshing the page and running the script again.'
      );
    }

    const { messages, conversationName } =
      await fetchAllMessages(orgId, conversationId);

    setStatus(
      `Got ${messages.length} messages. Building document...`
    );

    const {
      html,
      humanCount,
      claudeCount,
      skippedCount,
      warningCount,
      omittedCount
    } = buildPdfCleanSans(messages, conversationName);

    if (humanCount === 0 && claudeCount === 0) {
      throw new Error(
        'No readable messages found in this conversation. ' +
        'It may contain only non-text content.'
      );
    }

    const summaryText =
      `✅ ${humanCount} human + ${claudeCount} Claude messages` +
      (warningCount > 0
        ? ` — ⚠️ ${warningCount} attachment` +
          `${warningCount === 1 ? '' : 's'} flagged`
        : '') +
      (omittedCount > 0
        ? ` — ${omittedCount} technical block` +
          `${omittedCount === 1 ? '' : 's'} omitted`
        : '') +
      (skippedCount > 0
        ? ` (${skippedCount} skipped)`
        : '');

    setStatus(
      `${summaryText} — opening print dialog...`,
      warningCount > 0 ? '#FF9800' : '#4CAF50'
    );

    console.log(`[true-ai-export] ${summaryText}`);
    console.log(
      `[true-ai-export] PDF clean sans-serif v1.2.0 — ` +
      `opening print dialog. Select "Save as PDF" to save locally.`
    );
    console.log(
      `[true-ai-export] Safari: if the dialog does not open ` +
      `automatically, press Cmd-P in the new tab.`
    );

    // Open print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error(
        'Print window was blocked. Please allow pop-ups for ' +
        'claude.ai and run the script again.'
      );
    }

    printWindow.document.write(html);
    printWindow.document.close();

    // Chromium-based browsers and Firefox fire onload reliably.
    // Safari opens the tab but may not auto-fire print —
    // the console message above instructs the user to press Cmd-P.
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };

    setTimeout(cleanup, 8000);

  } catch (error) {
    setStatus(`❌ ${error.message}`, '#f44336');
    console.error('[true-ai-export] Export failed:', error);
    setTimeout(cleanup, 8000);
  }
}

trueAiExportPdfCleanSans();
