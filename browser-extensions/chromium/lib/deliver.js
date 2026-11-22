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
 * document written into the tab is unchanged.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport;

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
    printWindow.document.write(html);
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
    closePrintWindow
  };
})();
