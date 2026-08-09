/**
 * true-ai-export — conversation traversal and shared helpers.
 *
 * Every helper in this file is copied verbatim from the console
 * scripts in claude/v1.2.0/, where each one is byte-identical across
 * all eleven scripts. They decide what the exported file looks like,
 * so they are not reformatted, simplified, or replaced with an
 * equivalent implementation. If output ever differs from a console
 * script, this file is wrong, not the console script.
 *
 * This file is loaded first and creates globalThis.TrueAiExport.
 * Every other file in the extension attaches to that one namespace.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport || (globalThis.TrueAiExport = {});

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

  /**
   * The one traversal step every console script performs identically:
   * human and assistant messages are transcribed, anything else is
   * counted as skipped and dropped. Returns null for a skipped sender.
   *
   * The per-block dispatch chain is deliberately NOT shared. The full
   * and clean variants of each format diverge in which block types
   * they flag, which they omit, and which counter an empty message
   * increments. Those chains stay copied inside each formatter.
   */
  function classifySender(msg) {
    if (msg.sender === 'human') return 'human';
    if (msg.sender === 'assistant') return 'assistant';
    return null;
  }

  ns.walk = {
    UUID_REGEX,
    isValidUUID,
    formatTimestamp,
    sanitizeFilename,
    sanitizeTitle,
    escapeHtml,
    textToHtml,
    classifySender
  };
})();
