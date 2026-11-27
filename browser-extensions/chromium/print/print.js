/**
 * true-ai-export — print page for PDF exports started from the toolbar
 * popup.
 *
 * A PDF started from the floating button opens its print tab directly
 * from the click on the page. A PDF started from the popup cannot,
 * because there was no click on the page, so the content script keeps
 * the finished print document in memory and the popup opens this page
 * with the claude.ai tab's id and a one-time random token.
 *
 * This page asks that tab for the document once, shows it in an
 * iframe (the document contains no scripts, only markup and styles),
 * and opens the print dialog for it — the same document the floating
 * button would have printed.
 */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const tabId = Number(params.get('tab'));
  const token = params.get('token') || '';
  const message = document.getElementById('message');

  function fail(text) {
    message.textContent = text;
    message.hidden = false;
  }

  if (!Number.isInteger(tabId) || !/^[0-9a-f]{32}$/.test(token)) {
    fail('This print page was opened without a document. Start the PDF ' +
         'export again from the true-ai-export menu.');
    return;
  }

  chrome.tabs.sendMessage(tabId, { action: 'takePrint', token }, (reply) => {
    if (chrome.runtime.lastError || !reply || typeof reply.html !== 'string') {
      fail('The print document is no longer available. Start the PDF ' +
           'export again from the true-ai-export menu.');
      return;
    }

    const title = new DOMParser()
      .parseFromString(reply.html, 'text/html').title;
    if (title) document.title = title;

    const frame = document.createElement('iframe');
    frame.title = title || 'Conversation transcript';
    frame.addEventListener('load', () => {
      message.hidden = true;
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }, { once: true });
    frame.srcdoc = reply.html;
    document.body.appendChild(frame);
  });
})();
