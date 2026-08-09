/**
 * true-ai-export — HTML formatters.
 *
 * buildHtml is copied from claude/v1.2.0/export-html.js and
 * buildHtmlClean from claude/v1.2.0/export-html-clean.js, including the
 * stylesheets, the banner markup, and the whitespace inside the message
 * template literal. The clean document carries an extra .notice rule
 * set and an omitted-blocks banner that the full document does not.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport;
  const { formatTimestamp, sanitizeTitle, escapeHtml, textToHtml } = ns.walk;

  function buildHtml(messages, conversationName) {
    let humanCount = 0;
    let claudeCount = 0;
    let skippedCount = 0;
    let warningCount = 0;

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

        } else if (block.type === 'tool_use') {
          warningCount++;
          hasContent = true;
          const toolName = block.name || 'unknown';
          messageContent += `<div class="warning">`;
          messageContent +=
            `<div class="warning-title">` +
            `⚠️ TOOL USE — NOT FULLY EXPORTED</div>`;
          messageContent +=
            `<p>Claude invoked a tool at this point.</p>`;
          messageContent +=
            `<p><strong>Tool:</strong> ` +
            `<code>${escapeHtml(toolName)}</code></p>`;
          messageContent +=
            `<p><strong>Action required:</strong> Refer to the ` +
            `original conversation in Claude to see the full ` +
            `tool interaction.</p>`;
          messageContent += `</div>`;

        } else if (block.type === 'tool_result') {
          warningCount++;
          hasContent = true;
          messageContent += `<div class="warning">`;
          messageContent +=
            `<div class="warning-title">` +
            `⚠️ TOOL RESULT — NOT FULLY EXPORTED</div>`;
          messageContent +=
            `<p>A tool result exists at this point that could not ` +
            `be captured as plain text.</p>`;
          messageContent +=
            `<p><strong>Action required:</strong> Refer to the ` +
            `original conversation in Claude to see the full ` +
            `result.</p>`;
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
          block.type === 'thinking' ||
          block.type === 'redacted_thinking'
        ) {
          warningCount++;
          hasContent = true;
          messageContent += `<div class="warning">`;
          messageContent +=
            `<div class="warning-title">` +
            `⚠️ EXTENDED THINKING — NOT EXPORTED</div>`;
          messageContent +=
            `<p>Claude's internal reasoning block exists at this ` +
            `point but cannot be exported as plain text.</p>`;
          messageContent +=
            `<p><strong>Action required:</strong> Refer to the ` +
            `original conversation in Claude to view the thinking ` +
            `block.</p>`;
          messageContent += `</div>`;

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
        warningCount++;
        messageContent += `<div class="warning">`;
        messageContent +=
          `<div class="warning-title">` +
          `⚠️ EMPTY OR UNREADABLE MESSAGE</div>`;
        messageContent +=
          `<p>This message exists in the transcript but contained ` +
          `no exportable content.</p>`;
        messageContent +=
          `<p><strong>Action required:</strong> Refer to the ` +
          `original conversation in Claude.</p>`;
        messageContent += `</div>`;
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
      ['Content gaps flagged', warningCount],
      ['System messages skipped', skippedCount],
      ['Exported at', new Date().toISOString()]
    ].map(([label, value]) =>
      `<tr><td>${label}</td><td>${value}</td></tr>`
    ).join('\n');

    const warningBanner = warningCount > 0
      ? `<div class="warning">
           <div class="warning-title">
             ⚠️ ${warningCount} content gap${warningCount === 1
               ? '' : 's'} detected in this transcript.
           </div>
           <p>Each gap is marked inline above. Refer to the original
           conversation in Claude to retrieve any content that could
           not be exported as plain text.</p>
         </div>`
      : `<p class="all-clear">✅ No content gaps detected.
         All messages exported as plain text.</p>`;

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
        &nbsp;·&nbsp; HTML v1.2.0
      </div>
    </header>
    ${body}
    <div class="summary">
      <h2>Export Summary</h2>
      <table><tbody>${summaryRows}</tbody></table>
      ${warningBanner}
    </div>
    <footer>
      Generated by
      <a href="https://github.com/filteredwaterdev/true-ai-export"
         target="_blank">true-ai-export</a>
      &nbsp;·&nbsp; HTML v1.2.0 &nbsp;·&nbsp; MIT licensed
    </footer>
  </div>
</body>
</html>`;

    return { html, humanCount, claudeCount, skippedCount, warningCount };
  }

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

  ns.formatHtml = { buildHtml, buildHtmlClean };
})();
