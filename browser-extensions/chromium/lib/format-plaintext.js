/**
 * true-ai-export — plain text formatters.
 *
 * buildPlaintext is copied from claude/v1.2.0/export-plaintext.js and
 * buildPlaintextClean from claude/v1.2.0/export-plaintext-clean.js.
 * The clean variant buffers into messageContent and only emits the
 * sender header once it knows the message has content, where the full
 * variant writes the header first and flags an empty message inline.
 * That difference is visible in the output, so the two chains stay
 * separate.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport;
  const { formatTimestamp, sanitizeTitle } = ns.walk;

  function buildPlaintext(messages, conversationName) {
    let humanCount = 0;
    let claudeCount = 0;
    let skippedCount = 0;
    let warningCount = 0;

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
      `Exported by true-ai-export — Plain text v1.2.0\n`;
    text +=
      `https://github.com/filteredwaterdev/true-ai-export\n`;
    text += `${heavyDivider}\n\n`;

    for (const msg of messages) {
      const ts = formatTimestamp(msg.created_at);
      const contentBlocks = msg.content ?? [];

      if (msg.sender === 'human') {
        humanCount++;
        text += `HUMAN${ts ? ` (${ts})` : ''}:\n\n`;
      } else if (msg.sender === 'assistant') {
        claudeCount++;
        text += `CLAUDE${ts ? ` (${ts})` : ''}:\n\n`;
      } else {
        skippedCount++;
        continue;
      }

      let hasContent = false;

      for (const block of contentBlocks) {

        if (block.type === 'text') {
          const content = (block.text ?? '').trim();
          if (content) {
            text += `${content}\n\n`;
            hasContent = true;
          }

        } else if (block.type === 'document' || block.type === 'file') {
          warningCount++;
          hasContent = true;
          const name =
            block.name || block.file_name || block.filename || null;
          const mediaType =
            block.media_type || block.file_type || null;

          text += `[WARNING - ATTACHMENT - CONTENT NOT FULLY EXPORTED]\n`;
          text +=
            `This message contained an attached document that could\n` +
            `not be captured as plain text by this export script.\n`;
          if (name) {
            text += `Filename: ${name}\n`;
          }
          if (mediaType) {
            text += `Type: ${mediaType}\n`;
          }
          text +=
            `Possible causes: Large text paste auto-converted to an\n` +
            `attachment by the claude.ai interface (a known concurrent\n` +
            `regression), or a manually uploaded file.\n`;
          text +=
            `Action required: Refer to the original conversation in\n` +
            `Claude to retrieve this content.\n\n`;

        } else if (block.type === 'tool_use') {
          warningCount++;
          hasContent = true;
          const toolName = block.name || 'unknown';
          text += `[WARNING - TOOL USE - NOT FULLY EXPORTED]\n`;
          text +=
            `Claude invoked a tool at this point in the conversation.\n`;
          text += `Tool: ${toolName}\n`;
          text +=
            `Action required: Refer to the original conversation in\n` +
            `Claude to see the full tool interaction.\n\n`;

        } else if (block.type === 'tool_result') {
          warningCount++;
          hasContent = true;
          text += `[WARNING - TOOL RESULT - NOT FULLY EXPORTED]\n`;
          text +=
            `A tool result exists at this point that could not be\n` +
            `captured as plain text.\n`;
          text +=
            `Action required: Refer to the original conversation in\n` +
            `Claude to see the full result.\n\n`;

        } else if (block.type === 'image') {
          warningCount++;
          hasContent = true;
          text += `[WARNING - IMAGE - NOT EXPORTED]\n`;
          text +=
            `An image exists at this point in the conversation and\n` +
            `cannot be exported as plain text.\n`;
          text +=
            `Action required: Refer to the original conversation in\n` +
            `Claude to view this image.\n\n`;

        } else if (
          block.type === 'thinking' ||
          block.type === 'redacted_thinking'
        ) {
          warningCount++;
          hasContent = true;
          text += `[WARNING - EXTENDED THINKING - NOT EXPORTED]\n`;
          text +=
            `Claude's internal reasoning block exists at this point\n` +
            `but cannot be exported as plain text.\n`;
          text +=
            `Action required: Refer to the original conversation in\n` +
            `Claude to view the thinking block.\n\n`;

        } else {
          warningCount++;
          hasContent = true;
          text +=
            `[WARNING - UNKNOWN CONTENT BLOCK - NOT EXPORTED]\n`;
          text +=
            `A content block of unrecognised type ` +
            `"${block.type ?? 'unknown'}" exists at this point.\n`;
          text +=
            `This script does not know how to handle this content ` +
            `type.\n`;
          text +=
            `Action required: Refer to the original conversation in\n` +
            `Claude to see this content.\n`;
          text +=
            `If you see this warning, please open a GitHub issue so\n` +
            `support for this content type can be added.\n\n`;
        }
      }

      if (!hasContent) {
        warningCount++;
        text += `[WARNING - EMPTY OR UNREADABLE MESSAGE]\n`;
        text +=
          `This message exists in the transcript but contained no\n` +
          `exportable content.\n`;
        text +=
          `Action required: Refer to the original conversation in\n` +
          `Claude.\n\n`;
      }

      text += `${divider}\n\n`;
    }

    text += `${heavyDivider}\n`;
    text += `EXPORT SUMMARY\n`;
    text += `${heavyDivider}\n`;
    text += `Human messages:          ${humanCount}\n`;
    text += `Claude messages:         ${claudeCount}\n`;
    text += `Content gaps flagged:    ${warningCount}\n`;
    text += `System messages skipped: ${skippedCount}\n`;
    text += `Exported at:             ${new Date().toISOString()}\n`;
    text += `${heavyDivider}\n\n`;

    if (warningCount > 0) {
      text +=
        `[WARNING: ${warningCount} content gap` +
        `${warningCount === 1 ? '' : 's'} detected in this ` +
        `transcript.]\n`;
      text +=
        `Each gap is marked inline with a [WARNING] block above.\n`;
      text +=
        `Refer to the original conversation in Claude to retrieve\n` +
        `any content that could not be exported as plain text.\n`;
    } else {
      text +=
        `No content gaps detected. All messages exported as plain ` +
        `text.\n`;
    }

    return { text, humanCount, claudeCount, skippedCount, warningCount };
  }

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

  ns.formatPlaintext = { buildPlaintext, buildPlaintextClean };
})();
