/**
 * true-ai-export — Claude.ai Conversation Exporter (JSON)
 * https://github.com/filteredwaterdev/true-ai-export
 *
 * Part of the true-ai-export project — a collection of scripts
 * that export complete AI conversation transcripts directly from
 * the platform's own backend API, bypassing the virtualized DOM
 * rendering that silently broke the ability to copy conversation
 * transcripts to the OS clipboard.
 *
 * This version exports to JSON (.json) — structured data with
 * every field preserved. For analysis, programmatic use, or
 * building on top of the conversation data.
 *
 * For full context on why this project exists, what is broken,
 * and what Anthropic should do to fix it natively, see:
 * https://github.com/filteredwaterdev/true-ai-export
 *
 * ─── WHY THIS VERSION EXISTS ─────────────────────────────────
 *
 * Anthropic provides a JSON export — but only as a bulk dump
 * of your entire account history, initiated through Settings
 * → Privacy → Export Data, delivered via an emailed download
 * link that expires after 24 hours, covering everything at
 * once with no option to export a single conversation.
 *
 * There is no technical reason for this. Every time you open
 * a Claude conversation, the complete transcript is retrieved
 * from Anthropic's servers in under a second — instantly,
 * automatically, using the same API endpoint this script calls.
 * That infrastructure has existed since the product launched.
 * Immediate per-conversation export has always been trivial.
 *
 * This script provides what Anthropic's own export does not:
 * a single conversation as JSON, immediately, on demand, no
 * email, no expiry link, no bulk dump, no wait.
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
 *   4. Chromium-based browsers, Firefox and derivatives: a .json
 *      file downloads automatically to your Downloads folder
 *
 *      Safari: a "Copy JSON" button appears in the top-right
 *      corner of the page. Click it once. Then open any text editor,
 *      paste, and save with the .json extension. The suggested
 *      filename is printed to the console.
 *      If the button disappears before you click, run this in the
 *      console instead:
 *        copy(window._trueAiLastExport.content)
 *
 * ─── WHAT GETS EXPORTED ──────────────────────────────────────
 *
 *   ✅ Every human message — full text, with timestamps
 *      and all metadata
 *   ✅ Every Claude response — full text, with timestamps
 *      and all metadata
 *   ✅ Non-text content blocks included in full as structured
 *      data — nothing dropped, nothing replaced with warnings
 *   📋 Export metadata included at top level
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
 *   - Binary content of file attachments and images is not
 *     included — the API does not return it at this endpoint
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

async function trueAiExportJson() {

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

  function sanitizeFilename(str) {
    return (str || 'claude_conversation')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase()
      .substring(0, 100) || 'claude_conversation';
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
      conversationName: data.name || null,
      rawData: data
    };
  }

  // ─── JSON Builder ────────────────────────────────────────────────────────

  function buildJson(messages, conversationName, rawData) {
    let humanCount = 0;
    let claudeCount = 0;
    let skippedCount = 0;
    let nonTextCount = 0;

    const processedMessages = [];

    for (const msg of messages) {
      if (msg.sender === 'human') {
        humanCount++;
      } else if (msg.sender === 'assistant') {
        claudeCount++;
      } else {
        skippedCount++;
        continue;
      }

      const nonTextBlocks = (msg.content ?? [])
        .filter(b => b.type !== 'text');
      nonTextCount += nonTextBlocks.length;

      processedMessages.push({
        sender: msg.sender,
        created_at: msg.created_at || null,
        updated_at: msg.updated_at || null,
        uuid: msg.uuid || null,
        content: msg.content ?? []
      });
    }

    const output = {
      export_metadata: {
        exported_at: new Date().toISOString(),
        exported_by: 'true-ai-export',
        version: '1.2.0',
        source:
          'https://github.com/filteredwaterdev/true-ai-export',
        note:
          'Per-conversation JSON export — JSON v1.2.0. ' +
          'Anthropic\'s own export provides only a bulk ' +
          'account-wide JSON dump delivered via an emailed link ' +
          'with a 24-hour expiry. This file was generated ' +
          'instantly from the same API endpoint Anthropic\'s own ' +
          'interface uses on every page load.',
        conversation_id: rawData.uuid || null,
        conversation_name: conversationName || null,
        summary: {
          human_messages: humanCount,
          claude_messages: claudeCount,
          system_messages_skipped: skippedCount,
          non_text_content_blocks: nonTextCount
        }
      },
      conversation: {
        name: conversationName || null,
        created_at: rawData.created_at || null,
        updated_at: rawData.updated_at || null,
        messages: processedMessages
      }
    };

    return {
      json: JSON.stringify(output, null, 2),
      humanCount,
      claudeCount,
      skippedCount,
      nonTextCount
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

    const { messages, conversationName, rawData } =
      await fetchAllMessages(orgId, conversationId);

    setStatus(
      `Got ${messages.length} messages. Building JSON...`
    );

    const {
      json,
      humanCount,
      claudeCount,
      skippedCount,
      nonTextCount
    } = buildJson(messages, conversationName, rawData);

    if (humanCount === 0 && claudeCount === 0) {
      throw new Error(
        'No readable messages found in this conversation. ' +
        'It may contain only non-text content.'
      );
    }

    const filename = sanitizeFilename(conversationName) + '.json';

    window._trueAiLastExport = { content: json, filename };

    const summaryText =
      `✅ ${humanCount} human + ${claudeCount} Claude messages` +
      (nonTextCount > 0
        ? ` — ${nonTextCount} non-text block` +
          `${nonTextCount === 1 ? '' : 's'} included as ` +
          `structured data`
        : '') +
      (skippedCount > 0
        ? ` (${skippedCount} system messages skipped)`
        : '');

    console.log(`[true-ai-export] ${summaryText}`);

    if (isSafari) {
      // Safari blocks both programmatic blob downloads and
      // navigator.clipboard.writeText() from the DevTools console
      // context. A real DOM button click is a genuine user gesture
      // and satisfies Safari's clipboard permission requirement.
      setStatus(summaryText, '#4CAF50');

      const btn = document.createElement('button');
      btn.textContent = '📋 Click to copy JSON';
      btn.style.cssText = `
        display: block; margin-top: 8px; padding: 8px 12px;
        cursor: pointer; background: white; color: #1B5E20;
        border: none; border-radius: 4px;
        font-family: monospace; font-size: 12px;
        font-weight: bold; width: 100%;
      `;

      btn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(json);
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
        'top-right corner of the page to copy the JSON.'
      );
      setTimeout(cleanup, 60000);

    } else {
      // Chromium-based browsers, Firefox and derivatives
      downloadFile(
        json,
        filename,
        'application/json;charset=utf-8'
      );
      setStatus(summaryText, '#4CAF50');
      console.log(`[true-ai-export] Downloaded: ${filename}`);
      setTimeout(cleanup, 8000);
    }

  } catch (error) {
    setStatus(`❌ ${error.message}`, '#f44336');
    console.error('[true-ai-export] Export failed:', error);
    setTimeout(cleanup, 8000);
  }
}

trueAiExportJson();
