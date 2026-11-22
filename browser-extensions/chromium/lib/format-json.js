/**
 * true-ai-export — JSON formatter.
 *
 * Copied from claude/v1.2.0/export-json.js. JSON has no clean variant.
 * It is the only formatter that needs the untouched API response, for
 * the conversation uuid and the conversation created_at / updated_at
 * timestamps, so it takes rawData as a third argument.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport;

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

  ns.formatJson = { buildJson };
})();
