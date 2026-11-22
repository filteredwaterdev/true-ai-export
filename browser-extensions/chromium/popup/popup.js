/**
 * true-ai-export — toolbar popup.
 *
 * The popup explains what the extension does and where the button is.
 * It is not a settings page and it is not a second format picker: the
 * export happens from the button on the conversation page.
 *
 * The one thing it does is adjust its second line to say whether the
 * current tab is a conversation. That needs no permission beyond the
 * claude.ai host permission the extension already has — a tab's url is
 * readable only for tabs the extension may access, which is exactly the
 * distinction being made here.
 *
 * No inline script and no inline event handlers: MV3's content security
 * policy forbids both, so this file is loaded with <script src> and
 * everything is attached with addEventListener.
 */
(function () {
  'use strict';

  const CONVERSATION_URL =
    /^https:\/\/claude\.ai\/chat\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const ON_CONVERSATION =
    'This is a conversation page. Use the “Save to file” button in ' +
    'the bottom-right corner to choose a format.';

  const ELSEWHERE =
    'Open a conversation on claude.ai and use the “Save to file” ' +
    'button in the bottom-right corner of the page.';

  document.addEventListener('DOMContentLoaded', () => {
    const where = document.getElementById('where');
    if (!where) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs && tabs[0] ? tabs[0].url : undefined;
      where.textContent =
        url && CONVERSATION_URL.test(url) ? ON_CONVERSATION : ELSEWHERE;
    });
  });
})();
