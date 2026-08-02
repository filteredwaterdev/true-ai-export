/**
 * true-ai-export — Claude.ai Conversation Exporter (HTML, Clean)
 * https://github.com/filteredwaterdev/true-ai-export
 *
 * Part of the true-ai-export project — a collection of scripts
 * that export complete AI conversation transcripts directly from
 * the platform's own backend API, bypassing the virtualized DOM
 * rendering that silently broke the ability to copy conversation
 * transcripts to the OS clipboard.
 *
 * This is the CLEAN version. It exports the human-readable
 * conversation only as a styled HTML document. Tool use, tool
 * results, and internal reasoning blocks are omitted. Attachments
 * and images are flagged since they directly affect what was
 * visible in the conversation.
 *
 * For the full version that flags every non-text content block
 * explicitly, use export-html.js instead.
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
 *   4. Chromium-based browsers, Firefox and derivatives: a .html
 *      file downloads automatically to your Downloads folder
 *
 *      Safari: a "Copy transcript" button appears in the top-right
 *      corner of the page. Click it once. Then open any text editor,
 *      paste, and save with the .html extension. The suggested
 *      filename is printed to the console.
 *      If the button disappears before you click, run this in the
 *      console instead:
 *        copy(window._trueAiLastExport.content)
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
 *   📋  Export summary table at the end of every file
 *
 * ─── PRIVACY AND SECURITY ────────────────────────────────────
 *
 *   - All network requests go only to claude.ai — no external
 *     servers are contacted at any point
 *   - Conversation data is saved locally only — nothing is
 *     uploaded anywhere
 *   - On Safari, content is written to the OS clipboard only
 *     on explicit user click — the clipboard is not accessed
 *     on other browsers
 *   - Conversation ID and org ID validated as UUIDs before use
 *   - All DOM elements created by this script are removed
 *     after export completes
 *   - Full source available for audit — MIT licensed
 *
 * ─── KNOWN LIMITATIONS ───────────────────────────────────────
 *
 *   - Tool use and tool results are intentionally omitted in
 *     this version — use export-html.js for full output
 *   - Very long conversations may be subject to API pagination
 *     — if messages appear missing from the start of an export,
 *     please open a GitHub issue
 *   - Uses an undocumented internal API endpoint — may break
 *     if Anthropic changes their infrastructure without notice
 *   - Safari blocks programmatic blob downloads and clipboard
 *     writes from the DevTools console context — a one-click
 *     button is shown instead; clipboard is written on that click
 *
 * Version: 1.2.0
 * License: MIT
 */

async function trueAiExportHtmlClean() {

  // ─── Browser detection ────────────────────────────────────────────────────
  // Safari blocks both programmatic blob downloads and clipboard writes
  // when triggered from the DevTools console context. A real DOM button
  // click satisfies Safari's user gesture requirement for clipboard access.
  const isSafari =
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // ─── Status UI ───────────────────────────────────────────────────────────
  // statusMsg is a child span so we can appendChild a button on Safari
  // without wiping the status text via textContent assignment.

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

  function sanitizeFilename(str) {
    return (str || 'claude_conversation')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase()
      .substring(0, 100) || 'claude_conversation';
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

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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

  // ─── Clean HTML Builder ──────────────────────────────────────────────────

  function buildHtmlClean(messages, conversationName) {
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
      let senderClass = '';
      let senderLabel = '';

      if (msg.sender === 'human') {
        humanCount++;
        senderClass = 'human';
        senderLabel = 'Human';
      } else if (msg.sender === 'assistant') {
        claudeCount++;
        senderClass = 'claude';
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
            `<div class="warning-title">` +
            `⚠️ ATTACHMENT — CONTENT NOT FULLY EXPORTED</div>`;
          messageContent +=
            `<p>This message contained an attached document that ` +
            `could not be captured as plain text.</p>`;
          if (name) {
            messageContent +=
              `<p><strong>Filename:</strong> ` +
              `<code>${escapeHtml(name)}</code></p>`;
          }
          if (mediaType) {
            messageContent +=
              `<p><strong>Type:</strong> ` +
              `<code>${escapeHtml(mediaType)}</code></p>`;
          }
          messageContent +=
            `<p><strong>Possible causes:</strong> Large text paste ` +
            `auto-converted to an attachment by the claude.ai ` +
            `interface (a known concurrent regression), or a ` +
            `manually uploaded file.</p>`;
          messageContent +=
            `<p><strong>Action required:</strong> Refer to the ` +
            `original conversation in Claude to retrieve this ` +
            `content.</p>`;
          messageContent += `</div>`;

        } else if (block.type === 'image') {
          warningCount++;
          hasContent = true;
          messageContent += `<div class="warning">`;
          messageContent +=
            `<div class="warning-title">` +
            `⚠️ IMAGE — NOT EXPORTED</div>`;
          messageContent +=
            `<p>An image exists at this point and cannot be ` +
            `exported as plain text.</p>`;
          messageContent +=
            `<p><strong>Action required:</strong> Refer to the ` +
            `original conversation in Claude to view this ` +
            `image.</p>`;
          messageContent += `</div>`;

        } else if (
          block.type === 'tool_use' ||
          block.type === 'tool_result' ||
          block.type === 'thinking' ||
          block.type === 'redacted_thinking'
        ) {
          // Tool use, tool results, and thinking blocks are
          // intentionally omitted in the clean version.
          // Use export-html.js for full output.
          omittedCount++;

        } else {
          warningCount++;
          hasContent = true;
          messageContent += `<div class="warning">`;
          messageContent +=
            `<div class="warning-title">` +
            `⚠️ UNKNOWN CONTENT BLOCK — NOT EXPORTED</div>`;
          messageContent +=
            `<p>A content block of unrecognised type ` +
            `<code>${escapeHtml(block.type ?? 'unknown')}</code> ` +
            `exists at this point.</p>`;
          messageContent +=
            `<p><strong>Action required:</strong> Refer to the ` +
            `original conversation in Claude to see this ` +
            `content.</p>`;
          messageContent +=
            `<p><em>If you see this warning, please open a GitHub ` +
            `issue so support for this content type can be ` +
            `added.</em></p>`;
          messageContent += `</div>`;
        }
      }

      if (!hasContent) {
        skippedCount++;
        continue;
      }

      body += `
        <div class="message ${senderClass}">
          <div class="message-header">
            <span class="sender">${senderLabel}</span>
            ${ts
              ? `<span class="timestamp">${escapeHtml(ts)}</span>`
              : ''}
          </div>
          <div class="message-body">${messageContent}</div>
        </div>`;
    }

    const summaryRows = [
      ['Human messages', humanCount],
      ['Claude messages', claudeCount],
      ['Attachments / images flagged', warningCount],
      ['Technical blocks omitted', omittedCount],
      ['Messages skipped', skippedCount],
      ['Exported at', new Date().toISOString()]
    ].map(([label, value]) =>
      `<tr><td>${label}</td><td>${value}</td></tr>`
    ).join('\n');

    const warningBanner = warningCount > 0
      ? `<div class="warning">
           <div class="warning-title">
             ⚠️ ${warningCount} attachment or image
             ${warningCount === 1 ? '' : 's'} flagged.
           </div>
           <p>Refer to the original conversation in Claude to
           retrieve any content that could not be exported.</p>
         </div>`
      : '';

    const omittedBanner = omittedCount > 0
      ? `<div class="notice">
           <div class="notice-title">
             ℹ️ ${omittedCount} technical block
             ${omittedCount === 1 ? '' : 's'} omitted
           </div>
           <p>Tool use, tool results, and extended thinking blocks
           are not shown in the clean version. Use
           <code>export-html.js</code> for the full version.</p>
         </div>`
      : '';

    const allClear = warningCount === 0 && omittedCount === 0
      ? `<p class="all-clear">✅ Clean export complete.
         All messages exported as plain text.</p>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
        Roboto, Helvetica, Arial, sans-serif;
      font-size: 16px; line-height: 1.6; color: #1a1a1a;
      background: #f5f5f5; padding: 24px 16px;
    }
    .container { max-width: 820px; margin: 0 auto; }
    header {
      margin-bottom: 32px; padding-bottom: 20px;
      border-bottom: 2px solid #ddd;
    }
    header h1 {
      font-size: 24px; font-weight: 700;
      margin-bottom: 8px; color: #111;
    }
    header .meta { font-size: 13px; color: #666; }
    header .meta a { color: #666; text-decoration: underline; }
    .message {
      margin-bottom: 16px; border-radius: 8px;
      overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .message-header {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 16px; font-size: 13px; font-weight: 600;
    }
    .human .message-header { background: #e8f0fe; color: #1a56db; }
    .claude .message-header { background: #f0fdf4; color: #166534; }
    .sender { text-transform: uppercase; letter-spacing: 0.05em; }
    .timestamp { font-weight: 400; color: #888; font-size: 12px; }
    .message-body { padding: 16px; background: #fff; }
    .message-body p { margin-bottom: 12px; }
    .message-body p:last-child { margin-bottom: 0; }
    .message-body code {
      background: #f4f4f4; padding: 2px 6px;
      border-radius: 3px; font-family: monospace; font-size: 13px;
    }
    .warning {
      background: #fffbeb; border: 1px solid #f59e0b;
      border-radius: 6px; padding: 12px 16px; margin: 12px 0;
    }
    .warning-title {
      font-weight: 700; font-size: 13px; color: #92400e;
      margin-bottom: 8px; text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .warning p { font-size: 13px; color: #78350f; margin-bottom: 6px; }
    .warning p:last-child { margin-bottom: 0; }
    .warning code {
      background: #fef3c7; padding: 1px 4px;
      border-radius: 3px; font-size: 12px;
    }
    .notice {
      background: #eff6ff; border: 1px solid #93c5fd;
      border-radius: 6px; padding: 12px 16px; margin: 12px 0;
    }
    .notice-title {
      font-weight: 700; font-size: 13px; color: #1e40af;
      margin-bottom: 8px; text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .notice p { font-size: 13px; color: #1e3a8a; margin-bottom: 6px; }
    .notice p:last-child { margin-bottom: 0; }
    .notice code {
      background: #dbeafe; padding: 1px 4px;
      border-radius: 3px; font-size: 12px;
    }
    .summary {
      margin-top: 40px; padding-top: 24px;
      border-top: 2px solid #ddd;
    }
    .summary h2 {
      font-size: 18px; font-weight: 700;
      margin-bottom: 16px; color: #111;
    }
    .summary table {
      width: 100%; border-collapse: collapse;
      font-size: 14px; margin-bottom: 16px;
    }
    .summary table td {
      padding: 8px 12px; border: 1px solid #e5e5e5;
    }
    .summary table tr:nth-child(even) td { background: #f9f9f9; }
    .all-clear {
      color: #166534; font-weight: 600; padding: 12px;
      background: #f0fdf4; border-radius: 6px;
      border: 1px solid #bbf7d0;
    }
    footer {
      margin-top: 24px; font-size: 12px;
      color: #999; text-align: center;
    }
    footer a { color: #999; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">
        Exported on ${escapeHtml(exportDate)} &nbsp;·&nbsp;
        <a href="https://github.com/filteredwaterdev/true-ai-export"
           target="_blank">true-ai-export</a>
        &nbsp;·&nbsp; HTML clean v1.2.0
      </div>
    </header>
    ${body}
    <div class="summary">
      <h2>Export Summary</h2>
      <table><tbody>${summaryRows}</tbody></table>
      ${warningBanner}
      ${omittedBanner}
      ${allClear}
    </div>
    <footer>
      Generated by
      <a href="https://github.com/filteredwaterdev/true-ai-export"
         target="_blank">true-ai-export</a>
      &nbsp;·&nbsp; HTML clean v1.2.0 &nbsp;·&nbsp; MIT licensed
    </footer>
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
      `Got ${messages.length} messages. Building transcript...`
    );

    const {
      html,
      humanCount,
      claudeCount,
      skippedCount,
      warningCount,
      omittedCount
    } = buildHtmlClean(messages, conversationName);

    if (humanCount === 0 && claudeCount === 0) {
      throw new Error(
        'No readable messages found in this conversation. ' +
        'It may contain only non-text content.'
      );
    }

    const filename =
      sanitizeFilename(conversationName) + '-clean.html';

    window._trueAiLastExport = { content: html, filename };

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

    const statusColor = warningCount > 0 ? '#FF9800' : '#4CAF50';

    console.log(`[true-ai-export] ${summaryText}`);

    if (isSafari) {
      // Safari blocks both programmatic blob downloads and
      // navigator.clipboard.writeText() from the DevTools console
      // context. A real DOM button click is a genuine user gesture
      // and satisfies Safari's clipboard permission requirement.
      setStatus(summaryText, statusColor);

      const btn = document.createElement('button');
      btn.textContent = '📋 Click to copy transcript';
      btn.style.cssText = `
        display: block; margin-top: 8px; padding: 8px 12px;
        cursor: pointer; background: white;
        color: ${warningCount > 0 ? '#E65100' : '#1B5E20'};
        border: none; border-radius: 4px;
        font-family: monospace; font-size: 12px;
        font-weight: bold; width: 100%;
      `;

      btn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(html);
          btn.textContent =
            `✅ Copied — paste into TextEdit, save as "${filename}"`;
          btn.style.color = '#1B5E20';
          btn.disabled = true;
          console.log(`[true-ai-export] Clipboard copy successful.`);
          console.log(
            `[true-ai-export] Paste into TextEdit or VS Code and ` +
            `save as: ${filename}`
          );
          setTimeout(cleanup, 15000);
        } catch (e) {
          btn.textContent =
            '❌ Run in console: copy(window._trueAiLastExport.content)';
          btn.style.color = '#B71C1C';
          console.error(
            '[true-ai-export] Clipboard write failed even on user gesture:',
            e
          );
          console.log(
            '[true-ai-export] Run this in the console:\n' +
            '  copy(window._trueAiLastExport.content)'
          );
          console.log(
            `[true-ai-export] Then paste and save as: ${filename}`
          );
          setTimeout(cleanup, 15000);
        }
      };

      statusDiv.appendChild(btn);
      console.log(
        '[true-ai-export] Safari: click the button in the ' +
        'top-right corner of the page to copy the transcript.'
      );
      setTimeout(cleanup, 60000);

    } else {
      // Chromium-based browsers, Firefox and derivatives
      downloadFile(html, filename, 'text/html;charset=utf-8');
      setStatus(summaryText, statusColor);
      console.log(`[true-ai-export] Downloaded: ${filename}`);
      setTimeout(cleanup, 8000);
    }

  } catch (error) {
    setStatus(`❌ ${error.message}`, '#f44336');
    console.error('[true-ai-export] Export failed:', error);
    setTimeout(cleanup, 8000);
  }
}

trueAiExportHtmlClean();
