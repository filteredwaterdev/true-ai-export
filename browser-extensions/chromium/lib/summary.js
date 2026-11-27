/**
 * true-ai-export — the export summary block shown in the widget.
 *
 * This is the widget's status line only. The summary block that goes
 * *inside* an exported file is not built here: Markdown emits a pipe
 * table, plain text emits fixed-width columns, HTML and PDF emit table
 * rows with different label sets, and no byte sequence is shared
 * between them. Each formatter builds its own, copied from its console
 * script.
 *
 * The colour rule is the console scripts' rule:
 *   statusColor = warningCount > 0 ? '#FF9800' : '#4CAF50'
 * unchanged. omittedCount never affects the tone. JSON never flags, so
 * JSON is always the complete tone, the same choice export-json.js
 * makes.
 *
 * Text is written in words rather than symbols because it is read out
 * by the live region. Colour is never the only signal.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport;

  function plural(count, singular, pluralForm) {
    return count === 1 ? singular : (pluralForm || singular + 's');
  }

  /**
   * kind      'full' | 'clean' | 'json'
   * counts    the counters the matching builder returned
   * delivery  'download' | 'print'
   *
   * Returns { text, tone } where tone is 'complete' or 'flagged'.
   */
  function describe(kind, counts, delivery) {
    const humanCount = counts.humanCount || 0;
    const claudeCount = counts.claudeCount || 0;
    const skippedCount = counts.skippedCount || 0;
    const warningCount = counts.warningCount || 0;
    const omittedCount = counts.omittedCount || 0;
    const nonTextCount = counts.nonTextCount || 0;

    const parts = [
      delivery === 'print' ? 'Print dialog opened.' : 'Saved.',
      `${humanCount} human and ${claudeCount} Claude ` +
      `${plural(humanCount + claudeCount, 'message')}.`
    ];

    if (kind === 'full' && warningCount > 0) {
      parts.push(
        `${warningCount} content ${plural(warningCount, 'gap')} flagged.`
      );
    }

    if (kind === 'clean') {
      if (warningCount > 0) {
        parts.push(
          `${warningCount} ${plural(warningCount, 'attachment or image',
            'attachments or images')} flagged.`
        );
      }
      if (omittedCount > 0) {
        parts.push(
          `${omittedCount} technical ${plural(omittedCount, 'block')} ` +
          `omitted.`
        );
      }
    }

    if (kind === 'json' && nonTextCount > 0) {
      parts.push(
        `${nonTextCount} non-text ${plural(nonTextCount, 'block')} ` +
        `included as structured data.`
      );
    }

    if (skippedCount > 0) {
      parts.push(
        kind === 'clean'
          ? `${skippedCount} ${plural(skippedCount, 'message')} skipped.`
          : `${skippedCount} system ${plural(skippedCount, 'message')} ` +
            `skipped.`
      );
    }

    // The console scripts' rule, unchanged: only warningCount flags.
    // Omitted technical blocks are reported in the text above, not by
    // the tone.
    const flagged = kind !== 'json' && warningCount > 0;

    return {
      text: parts.join(' '),
      tone: flagged ? 'flagged' : 'complete'
    };
  }

  ns.summary = { plural, describe };
})();
