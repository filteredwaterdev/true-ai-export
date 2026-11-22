/**
 * true-ai-export — print document builders.
 *
 * buildPdf is copied from claude/v1.2.0/export-pdf-serif.js and
 * buildPdfClean from claude/v1.2.0/export-pdf-clean-serif.js.
 *
 * The serif and sans-serif scripts are the same document. Diffing
 * export-pdf-serif.js against export-pdf-sans.js shows differences in
 * exactly two font-family stacks, the "Script" summary row, the label
 * in the title block, and the file named in the clean variant's
 * omitted-blocks note — nothing else. So the typeface is a parameter
 * here rather than a second copy of the document, and TYPEFACE holds
 * the substituted strings including their line breaks and indentation.
 *
 * The full and clean chains stay separate, because they differ in
 * which blocks are flagged, which are omitted, and what an empty
 * message does.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport;
  const { formatTimestamp, sanitizeTitle, escapeHtml, textToHtml } = ns.walk;

  const TYPEFACE = {
    serif: {
      label: 'serif',
      fullScript: 'export-pdf-serif.js',
      // Substituted into "        font-family: ${page};" inside @page.
      page: `Georgia, 'Times New Roman', serif`,
      // Substituted into "      font-family: ${body};" inside body.
      body: `Georgia, 'Times New Roman', Times, serif`
    },
    sans: {
      label: 'sans-serif',
      fullScript: 'export-pdf-sans.js',
      page: `system-ui, -apple-system, 'Helvetica Neue',\n          Arial, sans-serif`,
      body: `system-ui, -apple-system, 'Helvetica Neue',\n        Helvetica, Arial, sans-serif`
    }
  };

  function buildPdf(messages, conversationName, typeface) {
    const face = TYPEFACE[typeface] || TYPEFACE.serif;
    const variantLabel = face.label;

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

        } else if (block.type === 'tool_use') {
          warningCount++;
          hasContent = true;
          const toolName = block.name || 'unknown';
          messageContent += `<div class="warning">`;
          messageContent +=
            `<p><strong>⚠️ TOOL USE — NOT FULLY EXPORTED</strong></p>`;
          messageContent +=
            `<p>Claude invoked a tool at this point in the ` +
            `conversation.</p>`;
          messageContent +=
            `<p>Tool: ${escapeHtml(toolName)}</p>`;
          messageContent +=
            `<p>Action required: Refer to the original conversation ` +
            `in Claude to see the full tool interaction.</p>`;
          messageContent += `</div>`;

        } else if (block.type === 'tool_result') {
          warningCount++;
          hasContent = true;
          messageContent += `<div class="warning">`;
          messageContent +=
            `<p><strong>⚠️ TOOL RESULT — NOT FULLY EXPORTED</strong></p>`;
          messageContent +=
            `<p>A tool result exists at this point that could not ` +
            `be captured as plain text.</p>`;
          messageContent +=
            `<p>Action required: Refer to the original conversation ` +
            `in Claude to see the full result.</p>`;
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
          block.type === 'thinking' ||
          block.type === 'redacted_thinking'
        ) {
          warningCount++;
          hasContent = true;
          messageContent += `<div class="warning">`;
          messageContent +=
            `<p><strong>⚠️ EXTENDED THINKING — NOT EXPORTED</strong></p>`;
          messageContent +=
            `<p>Claude's internal reasoning block exists at this ` +
            `point but cannot be exported as plain text.</p>`;
          messageContent +=
            `<p>Action required: Refer to the original conversation ` +
            `in Claude to view the thinking block.</p>`;
          messageContent += `</div>`;

        } else {
          // Catch-all — nothing is ever silently dropped
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
        warningCount++;
        messageContent += `<div class="warning">`;
        messageContent +=
          `<p><strong>⚠️ EMPTY OR UNREADABLE MESSAGE</strong></p>`;
        messageContent +=
          `<p>This message exists in the transcript but contained ` +
          `no exportable content.</p>`;
        messageContent +=
          `<p>Action required: Refer to the original conversation ` +
          `in Claude.</p>`;
        messageContent += `</div>`;
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
      ['Content gaps flagged', warningCount],
      ['System messages skipped', skippedCount],
      ['Exported at', new Date().toISOString()],
      ['Script', `PDF ${variantLabel} v1.2.0`],
      ['Source', 'github.com/filteredwaterdev/true-ai-export']
    ].map(([label, value]) =>
      `<tr><td>${label}</td><td>${value}</td></tr>`
    ).join('\n');

    const warningNote = warningCount > 0
      ? `<p class="warning-note">⚠️ ${warningCount} content gap` +
        `${warningCount === 1 ? '' : 's'} detected — each is flagged ` +
        `inline above. Refer to the original conversation to retrieve ` +
        `any content that could not be exported as plain text.</p>`
      : `<p class="warning-note">✅ No content gaps detected. ` +
        `All messages exported as plain text.</p>`;

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
        font-family: ${face.page};
        font-size: 10pt;
        color: #666;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: ${face.body};
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
      PDF ${variantLabel} v1.2.0
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
  </div>

</body>
</html>`;

    return {
      html,
      humanCount,
      claudeCount,
      skippedCount,
      warningCount
    };
  }

  function buildPdfClean(messages, conversationName, typeface) {
    const face = TYPEFACE[typeface] || TYPEFACE.serif;
    const variantLabel = `clean ${face.label}`;

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
          // Use the matching full PDF entry for full output.
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
      ['Script', `PDF ${variantLabel} v1.2.0`],
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
        `results, extended thinking). Use ${face.fullScript} for ` +
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
        font-family: ${face.page};
        font-size: 10pt;
        color: #666;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: ${face.body};
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
      PDF ${variantLabel} v1.2.0
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

  ns.formatPdf = { TYPEFACE, buildPdf, buildPdfClean };
})();
