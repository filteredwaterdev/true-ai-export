/**
 * true-ai-export — Markdown formatters.
 *
 * buildMarkdown is copied from claude/v1.2.0/export-markdown.js and
 * buildMarkdownClean from claude/v1.2.0/export-markdown-clean.js.
 * The two block-dispatch chains are kept separate on purpose: the
 * clean variant flags attachments and images, omits tool and thinking
 * blocks, and removes the header it already wrote when a message turns
 * out to be empty. Merging them would change output.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport;
  const { formatTimestamp, sanitizeTitle } = ns.walk;

  function buildMarkdown(messages, conversationName) {
    let humanCount = 0;
    let claudeCount = 0;
    let skippedCount = 0;
    let warningCount = 0;

    const title = sanitizeTitle(
      conversationName || 'Conversation with Claude'
    );

    let markdown = `# ${title}\n\n`;
    markdown +=
      `*Exported on ${new Date().toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
      })}*\n\n`;
    markdown +=
      `*Exported by [true-ai-export](https://github.com/` +
      `filteredwaterdev/true-ai-export) — Markdown v1.2.0*\n\n`;
    markdown += `---\n\n`;

    for (const msg of messages) {
      const ts = formatTimestamp(msg.created_at);
      const contentBlocks = msg.content ?? [];

      if (msg.sender === 'human') {
        humanCount++;
        markdown += `## Human${ts ? ` (${ts})` : ''}:\n\n`;
      } else if (msg.sender === 'assistant') {
        claudeCount++;
        markdown += `## Claude${ts ? ` (${ts})` : ''}:\n\n`;
      } else {
        skippedCount++;
        continue;
      }

      let hasContent = false;

      for (const block of contentBlocks) {

        if (block.type === 'text') {
          const text = (block.text ?? '').trim();
          if (text) {
            markdown += `${text}\n\n`;
            hasContent = true;
          }

        } else if (block.type === 'document' || block.type === 'file') {
          warningCount++;
          hasContent = true;
          const name =
            block.name || block.file_name || block.filename || null;
          const mediaType =
            block.media_type || block.file_type || null;

          markdown += `> ⚠️ **ATTACHMENT — CONTENT NOT FULLY EXPORTED**\n`;
          markdown +=
            `> This message contained an attached document that ` +
            `could not be captured as plain text by this export ` +
            `script.\n`;
          if (name) {
            markdown += `> **Filename:** \`${name}\`\n`;
          }
          if (mediaType) {
            markdown += `> **Type:** \`${mediaType}\`\n`;
          }
          markdown +=
            `> **Possible causes:** Large text paste auto-converted ` +
            `to an attachment by the claude.ai interface (a known ` +
            `concurrent regression), or a manually uploaded file.\n`;
          markdown +=
            `> **Action required:** Refer to the original ` +
            `conversation in Claude to retrieve this content.\n\n`;

        } else if (block.type === 'tool_use') {
          warningCount++;
          hasContent = true;
          const toolName = block.name || 'unknown';
          markdown += `> ⚠️ **TOOL USE — NOT FULLY EXPORTED**\n`;
          markdown +=
            `> Claude invoked a tool at this point in the ` +
            `conversation.\n`;
          markdown += `> **Tool:** \`${toolName}\`\n`;
          markdown +=
            `> **Action required:** Refer to the original ` +
            `conversation in Claude to see the full tool ` +
            `interaction.\n\n`;

        } else if (block.type === 'tool_result') {
          warningCount++;
          hasContent = true;
          markdown += `> ⚠️ **TOOL RESULT — NOT FULLY EXPORTED**\n`;
          markdown +=
            `> A tool result exists at this point that could not ` +
            `be captured as plain text.\n`;
          markdown +=
            `> **Action required:** Refer to the original ` +
            `conversation in Claude to see the full result.\n\n`;

        } else if (block.type === 'image') {
          warningCount++;
          hasContent = true;
          markdown += `> ⚠️ **IMAGE — NOT EXPORTED**\n`;
          markdown +=
            `> An image exists at this point in the conversation ` +
            `and cannot be exported as plain text.\n`;
          markdown +=
            `> **Action required:** Refer to the original ` +
            `conversation in Claude to view this image.\n\n`;

        } else if (
          block.type === 'thinking' ||
          block.type === 'redacted_thinking'
        ) {
          warningCount++;
          hasContent = true;
          markdown += `> ⚠️ **EXTENDED THINKING — NOT EXPORTED**\n`;
          markdown +=
            `> Claude's internal reasoning block exists at this ` +
            `point but cannot be exported as plain text.\n`;
          markdown +=
            `> **Action required:** Refer to the original ` +
            `conversation in Claude to view the thinking block.\n\n`;

        } else {
          warningCount++;
          hasContent = true;
          markdown += `> ⚠️ **UNKNOWN CONTENT BLOCK — NOT EXPORTED**\n`;
          markdown +=
            `> A content block of unrecognised type ` +
            `\`${block.type ?? 'unknown'}\` exists at this point.\n`;
          markdown +=
            `> This script does not know how to handle this ` +
            `content type.\n`;
          markdown +=
            `> **Action required:** Refer to the original ` +
            `conversation in Claude to see this content.\n`;
          markdown +=
            `> *If you see this warning, please open a GitHub ` +
            `issue so support for this content type can be ` +
            `added.*\n\n`;
        }
      }

      if (!hasContent) {
        warningCount++;
        markdown += `> ⚠️ **EMPTY OR UNREADABLE MESSAGE**\n`;
        markdown +=
          `> This message exists in the transcript but contained ` +
          `no exportable content.\n`;
        markdown +=
          `> **Action required:** Refer to the original ` +
          `conversation in Claude.\n\n`;
      }

      markdown += `---\n\n`;
    }

    markdown += `\n---\n\n`;
    markdown += `## Export Summary\n\n`;
    markdown += `| | |\n|---|---|\n`;
    markdown += `| Human messages | ${humanCount} |\n`;
    markdown += `| Claude messages | ${claudeCount} |\n`;
    markdown += `| Content gaps flagged | ${warningCount} |\n`;
    markdown += `| System messages skipped | ${skippedCount} |\n`;
    markdown +=
      `| Exported at | ${new Date().toISOString()} |\n\n`;

    if (warningCount > 0) {
      markdown +=
        `> ⚠️ **${warningCount} content gap` +
        `${warningCount === 1 ? '' : 's'} detected in this ` +
        `transcript.**\n`;
      markdown +=
        `> Each gap is marked inline with a ⚠️ warning above.\n`;
      markdown +=
        `> Refer to the original conversation in Claude to ` +
        `retrieve any content that could not be exported as ` +
        `plain text.\n\n`;
    } else {
      markdown +=
        `> ✅ No content gaps detected. ` +
        `All messages exported as plain text.\n\n`;
    }

    return { markdown, humanCount, claudeCount, skippedCount, warningCount };
  }

  function buildMarkdownClean(messages, conversationName) {
    let humanCount = 0;
    let claudeCount = 0;
    let skippedCount = 0;
    let warningCount = 0;
    let omittedCount = 0;

    const title = sanitizeTitle(
      conversationName || 'Conversation with Claude'
    );

    let markdown = `# ${title}\n\n`;
    markdown +=
      `*Exported on ${new Date().toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
      })}*\n\n`;
    markdown +=
      `*Exported by [true-ai-export](https://github.com/` +
      `filteredwaterdev/true-ai-export) — Markdown clean v1.2.0*\n\n`;
    markdown += `---\n\n`;

    for (const msg of messages) {
      const ts = formatTimestamp(msg.created_at);
      const contentBlocks = msg.content ?? [];

      if (msg.sender === 'human') {
        humanCount++;
        markdown += `## Human${ts ? ` (${ts})` : ''}:\n\n`;
      } else if (msg.sender === 'assistant') {
        claudeCount++;
        markdown += `## Claude${ts ? ` (${ts})` : ''}:\n\n`;
      } else {
        skippedCount++;
        continue;
      }

      let hasContent = false;

      for (const block of contentBlocks) {

        if (block.type === 'text') {
          const text = (block.text ?? '').trim();
          if (text) {
            markdown += `${text}\n\n`;
            hasContent = true;
          }

        } else if (block.type === 'document' || block.type === 'file') {
          warningCount++;
          hasContent = true;
          const name =
            block.name || block.file_name || block.filename || null;
          const mediaType =
            block.media_type || block.file_type || null;

          markdown += `> ⚠️ **ATTACHMENT — CONTENT NOT FULLY EXPORTED**\n`;
          markdown +=
            `> This message contained an attached document that ` +
            `could not be captured as plain text.\n`;
          if (name) {
            markdown += `> **Filename:** \`${name}\`\n`;
          }
          if (mediaType) {
            markdown += `> **Type:** \`${mediaType}\`\n`;
          }
          markdown +=
            `> **Possible causes:** Large text paste auto-converted ` +
            `to an attachment by the claude.ai interface (a known ` +
            `concurrent regression), or a manually uploaded file.\n`;
          markdown +=
            `> **Action required:** Refer to the original ` +
            `conversation in Claude to retrieve this content.\n\n`;

        } else if (block.type === 'image') {
          warningCount++;
          hasContent = true;
          markdown += `> ⚠️ **IMAGE — NOT EXPORTED**\n`;
          markdown +=
            `> An image exists at this point in the conversation ` +
            `and cannot be exported as plain text.\n`;
          markdown +=
            `> **Action required:** Refer to the original ` +
            `conversation in Claude to view this image.\n\n`;

        } else if (
          block.type === 'tool_use' ||
          block.type === 'tool_result' ||
          block.type === 'thinking' ||
          block.type === 'redacted_thinking'
        ) {
          omittedCount++;

        } else {
          warningCount++;
          hasContent = true;
          markdown += `> ⚠️ **UNKNOWN CONTENT BLOCK — NOT EXPORTED**\n`;
          markdown +=
            `> A content block of unrecognised type ` +
            `\`${block.type ?? 'unknown'}\` exists at this point.\n`;
          markdown +=
            `> **Action required:** Refer to the original ` +
            `conversation in Claude to see this content.\n`;
          markdown +=
            `> *If you see this warning, please open a GitHub ` +
            `issue so support for this content type can be ` +
            `added.*\n\n`;
        }
      }

      if (!hasContent) {
        skippedCount++;
        markdown = markdown.replace(
          /## (Human|Claude)[^\n]*:\n\n$/,
          ''
        );
        continue;
      }

      markdown += `---\n\n`;
    }

    // Export summary
    markdown += `\n---\n\n`;
    markdown += `## Export Summary\n\n`;
    markdown += `| | |\n|---|---|\n`;
    markdown += `| Human messages | ${humanCount} |\n`;
    markdown += `| Claude messages | ${claudeCount} |\n`;
    markdown += `| Attachments / images flagged | ${warningCount} |\n`;
    markdown +=
      `| Technical blocks omitted | ${omittedCount} |\n`;
    markdown +=
      `| System messages skipped | ${skippedCount} |\n`;
    markdown +=
      `| Exported at | ${new Date().toISOString()} |\n\n`;

    if (warningCount > 0) {
      markdown +=
        `> ⚠️ **${warningCount} attachment or image` +
        `${warningCount === 1 ? '' : 's'} flagged in this ` +
        `transcript.**\n`;
      markdown +=
        `> Refer to the original conversation in Claude to ` +
        `retrieve any content that could not be exported.\n\n`;
    }

    if (omittedCount > 0) {
      markdown +=
        `> ℹ️ **${omittedCount} technical block` +
        `${omittedCount === 1 ? '' : 's'} omitted** ` +
        `(tool use, tool results, extended thinking).\n`;
      markdown +=
        `> Use \`export-markdown.js\` for the full version ` +
        `with all blocks flagged.\n\n`;
    }

    if (warningCount === 0 && omittedCount === 0) {
      markdown +=
        `> ✅ Clean export complete. All messages exported ` +
        `as plain text with no omissions.\n\n`;
    }

    return {
      markdown,
      humanCount,
      claudeCount,
      skippedCount,
      warningCount,
      omittedCount
    };
  }

  ns.formatMarkdown = { buildMarkdown, buildMarkdownClean };
})();
