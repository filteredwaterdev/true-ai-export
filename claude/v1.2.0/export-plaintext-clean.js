/**
 * true-ai-export — Claude.ai Conversation Exporter (Plain Text, Clean)
 * https://github.com/filteredwaterdev/true-ai-export
 *
 * Part of the true-ai-export project — a collection of scripts
 * that export complete AI conversation transcripts directly from
 * the platform's own backend API, bypassing the virtualized DOM
 * rendering that silently broke the ability to copy conversation
 * transcripts to the OS clipboard.
 *
 * This is the CLEAN version. It exports the human-readable
 * conversation only. Tool use, tool results, and internal
 * reasoning blocks are omitted. Attachments and images are
 * flagged since they directly affect what was visible in the
 * conversation.
 *
 * For the full version that flags every non-text content block
 * explicitly, use export-plaintext.js instead.
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
 *   4. Chromium-based browsers, Firefox and derivatives: a .txt
 *      file downloads automatically to your Downloads folder,
 *      named after your conversation
 *
 *      Safari: a "Copy transcript" button appears in the top-right
 *      corner of the page. Click it once. Then open any text editor,
 *      paste, and save with the .txt extension. The suggested
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
 *   📋  Export summary appended to end of file
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
 *     this version — use export-plaintext.js for full output
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

async function trueAiExportPlaintextClean() {

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

  // ─── Clean Plain Text Builder ────────────────────────────────────────────

  function buildPlaintextClean(messages, conversationName) {
    let humanCount = 0;
    let claudeCount = 0;
    let skippedCount = 0;
    let warningCount = 0;
    let omittedCount = 0;

    const title = sanitizeTitle(
      conversationName || 'Conversation with Claude'
    );

    const divider =
      '----------------------------------------';
    const heavyDivider =
      '========================================';

    let text = `${title}\n`;
    text += `${heavyDivider}\n`;
    text +=
      `Exported on ${new Date().toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
      })}\n`;
    text +=
      `Exported by true-ai-export — Plain text clean v1.2.0\n`;
    text +=
      `https://github.com/filteredwaterdev/true-ai-export\n`;
    text += `${heavyDivider}\n\n`;

    for (const msg of messages) {
      const ts = formatTimestamp(msg.created_at);
      const contentBlocks = msg.content ?? [];
      let senderLabel = '';

      if (msg.sender === 'human') {
        humanCount++;
        senderLabel = 'HUMAN';
      } else if (msg.sender === 'assistant') {
        claudeCount++;
        senderLabel = 'CLAUDE';
      } else {
        skippedCount++;
        continue;
      }

      let messageContent = '';
      let hasContent = false;

      for (const block of contentBlocks) {

        if (block.type === 'text') {
          const content = (block.text ?? '').trim();
          if (content) {
            messageContent += `${content}\n\n`;
            hasContent = true;
          }

        } else if (block.type === 'document' || block.type === 'file') {
          warningCount++;
          hasContent = true;
          const name =
            block.name || block.file_name || block.filename || null;
          const mediaType =
            block.media_type || block.file_type || null;

          messageContent +=
            `[WARNING - ATTACHMENT - CONTENT NOT FULLY EXPORTED]\n`;
          messageContent +=
            `This message contained an attached document that could\n` +
            `not be captured as plain text by this export script.\n`;
          if (name) {
            messageContent += `Filename: ${name}\n`;
          }
          if (mediaType) {
            messageContent += `Type: ${mediaType}\n`;
          }
          messageContent +=
            `Possible causes: Large text paste auto-converted to an\n` +
            `attachment by the claude.ai interface (a known concurrent\n` +
            `regression), or a manually uploaded file.\n`;
          messageContent +=
            `Action required: Refer to the original conversation in\n` +
            `Claude to retrieve this content.\n\n`;

        } else if (block.type === 'image') {
          warningCount++;
          hasContent = true;
          messageContent += `[WARNING - IMAGE - NOT EXPORTED]\n`;
          messageContent +=
            `An image exists at this point in the conversation and\n` +
            `cannot be exported as plain text.\n`;
          messageContent +=
            `Action required: Refer to the original conversation in\n` +
            `Claude to view this image.\n\n`;

        } else if (
          block.type === 'tool_use' ||
          block.type === 'tool_result' ||
          block.type === 'thinking' ||
          block.type === 'redacted_thinking'
        ) {
          // Tool use, tool results, and thinking blocks are
          // intentionally omitted in the clean version.
          // Use export-plaintext.js for full output.
          omittedCount++;

        } else {
          warningCount++;
          hasContent = true;
          messageContent +=
            `[WARNING - UNKNOWN CONTENT BLOCK - NOT EXPORTED]\n`;
          messageContent +=
            `A content block of unrecognised type ` +
            `"${block.type ?? 'unknown'}" exists at this point.\n`;
          messageContent +=
            `Action required: Refer to the original conversation in\n` +
            `Claude to see this content.\n`;
          messageContent +=
            `If you see this warning, please open a GitHub issue so\n` +
            `support for this content type can be added.\n\n`;
        }
      }

      if (!hasContent) {
        skippedCount++;
        continue;
      }

      text += `${senderLabel}${ts ? ` (${ts})` : ''}:\n\n`;
      text += messageContent;
      text += `${divider}\n\n`;
    }

    text += `${heavyDivider}\n`;
    text += `EXPORT SUMMARY\n`;
    text += `${heavyDivider}\n`;
    text += `Human messages:               ${humanCount}\n`;
    text += `Claude messages:              ${claudeCount}\n`;
    text += `Attachments / images flagged: ${warningCount}\n`;
    text += `Technical blocks omitted:     ${omittedCount}\n`;
    text += `Messages skipped:             ${skippedCount}\n`;
    text += `Exported at:                  ${new Date().toISOString()}\n`;
    text += `${heavyDivider}\n\n`;

    if (warningCount > 0) {
      text +=
        `[WARNING: ${warningCount} attachment or image` +
        `${warningCount === 1 ? '' : 's'} flagged in this ` +
        `transcript.]\n`;
      text +=
        `Refer to the original conversation in Claude to retrieve\n` +
        `any content that could not be exported as plain text.\n\n`;
    }

    if (omittedCount > 0) {
      text +=
        `[NOTE: ${omittedCount} technical block` +
        `${omittedCount === 1 ? '' : 's'} omitted ` +
        `(tool use, tool results, extended thinking).]\n`;
      text +=
        `Use export-plaintext.js for the full version with all\n` +
        `blocks flagged.\n\n`;
    }

    if (warningCount === 0 && omittedCount === 0) {
      text +=
        `Clean export complete. All messages exported as plain\n` +
        `text with no omissions.\n`;
    }

    return {
      text,
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
      text,
      humanCount,
      claudeCount,
      skippedCount,
      warningCount,
      omittedCount
    } = buildPlaintextClean(messages, conversationName);

    if (humanCount === 0 && claudeCount === 0) {
      throw new Error(
        'No readable messages found in this conversation. ' +
        'It may contain only non-text content.'
      );
    }

    const filename =
      sanitizeFilename(conversationName) + '-clean.txt';

    window._trueAiLastExport = { content: text, filename };

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
          await navigator.clipboard.writeText(text);
          btn.textContent =
            `✅ Copied — paste into TextEdit, save as "${filename}"`;
          btn.style.color = '#1B5E20';
          btn.disabled = true;
          console.log(`[true-ai-export] Clipboard copy successful.`);
          console.log(
            `[true-ai-export] Paste into any text editor and save ` +
            `as: ${filename}`
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
      downloadFile(text, filename, 'text/plain;charset=utf-8');
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

trueAiExportPlaintextClean();
