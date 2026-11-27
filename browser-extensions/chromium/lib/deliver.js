/**
 * true-ai-export — delivery.
 *
 * downloadFile is copied from the console scripts: a Blob object URL,
 * a temporary anchor carrying the download attribute, a click, then
 * removal and URL.revokeObjectURL. chrome.downloads is unavailable to
 * a content script and this pattern needs no "downloads" permission,
 * so the extension does not request one.
 *
 * The print path differs from the console scripts in one respect, and
 * only one: the tab is opened synchronously inside the click handler
 * rather than after the fetch resolves. Chrome's transient user
 * activation expires while a fetch is in flight, and opening the tab
 * afterwards is what the popup blocker stops on a slow connection. The
 * document written into the tab is unchanged apart from one
 * Content-Security-Policy meta, inserted as the first child of <head>.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport;

  // The print tab is about:blank and shares claude.ai's origin, so this
  // policy is a floor that does not depend on claude.ai's own headers:
  // no script, no remote load of any kind, no form, no <base>. The only
  // thing the document needs is its one static <style> element, allowed
  // by hash. One hash per PDF variant, in this order: serif, serif
  // (clean), sans, sans (clean). If the PDF stylesheet ever changes,
  // these hashes have to be recomputed.
  const PRINT_POLICY =
    "default-src 'none'; " +
    "style-src " +
    "'sha256-IvYJPhe0L8ZZJNausLHiAk6mgh6KmXeaAGoDhmTkgJA=' " +
    "'sha256-te74yhrs+Eu85ssI2xir0MV5+KiubjUaBkAYbVtpRYQ=' " +
    "'sha256-CcOFKI05dVzbUtsEpcxOlxnBH8LKlhyActQbHWg1Bf8=' " +
    "'sha256-6MkB99UZC6B2mSbYNsvyo0V5belaS3ePQxMIYIa9Y4Y='; " +
    "base-uri 'none'; " +
    "form-action 'none'";

  const PRINT_POLICY_META =
    '<meta http-equiv="Content-Security-Policy" content="' +
    PRINT_POLICY + '">';

  // Inserts the policy meta immediately after the first <head>, so it is
  // parsed before anything else in the document. Throws if there is no
  // <head>, so the export fails rather than printing without the policy.
  function withPrintPolicy(html) {
    const marker = '<head>';
    const at = html.indexOf(marker);
    if (at === -1) {
      throw new Error('print document has no <head>');
    }
    const end = at + marker.length;
    return html.slice(0, end) + '\n  ' + PRINT_POLICY_META + html.slice(end);
  }

  // content may be a string or a Blob (the Word formatter returns a
  // Blob); new Blob([...]) accepts either as a part.
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

  // Call this while the click that started the export is still the
  // current user activation. Returns null if the browser blocked it.
  function openPrintWindow() {
    return window.open('', '_blank');
  }

  function writePrintDocument(printWindow, html) {
    printWindow.document.write(withPrintPolicy(html));
    printWindow.document.close();

    // Chromium-based browsers and Firefox fire onload reliably.
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  // Used when an export fails after the print tab was already opened,
  // so a blank tab is never left behind.
  function closePrintWindow(printWindow) {
    if (printWindow && !printWindow.closed) {
      printWindow.close();
    }
  }

  ns.deliver = {
    downloadFile,
    openPrintWindow,
    writePrintDocument,
    withPrintPolicy,
    closePrintWindow
  };
})();
