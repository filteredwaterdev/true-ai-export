/**
 * true-ai-export — toolbar popup.
 *
 * The popup shows the same format menu as the floating button. Choosing
 * a format asks the content script on the current claude.ai tab to run
 * the export, exactly as a click on the floating button does: the fetch
 * and the download both happen on the claude.ai page.
 *
 * PDF formats are the one difference. A print tab can only be opened by
 * a click on the page itself, so for a PDF started here the content
 * script builds the print document and keeps it in memory, and the
 * popup opens the extension's own print page, which collects it once
 * and opens the print dialog.
 *
 * The popup also holds the one setting: whether the floating button is
 * shown on claude.ai. It is stored with chrome.storage.local.
 *
 * No inline script and no inline event handlers: MV3's content security
 * policy forbids both, so this file is loaded with <script src> and
 * everything is attached with addEventListener. Menu labels and
 * descriptions come from the content script and are inserted with
 * textContent, never as HTML.
 */
(function () {
  'use strict';

  const CONVERSATION_URL =
    /^https:\/\/claude\.ai\/chat\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const ELSEWHERE = 'Open a conversation on claude.ai to choose a format.';
  const NOT_READY =
    'Reload this claude.ai tab, then open this menu again. The ' +
    'extension starts on pages loaded after it was installed or updated.';

  let tabId = null;

  function el(id) {
    return document.getElementById(id);
  }

  function setStatus(tone, text) {
    const status = el('status');
    status.dataset.tone = tone;
    status.textContent = text;
    status.hidden = false;
  }

  function setButtonsDisabled(disabled) {
    el('formats').querySelectorAll('button').forEach((b) => {
      b.disabled = disabled;
    });
  }

  function renderMenu(menu) {
    const list = el('formats');
    list.textContent = '';
    menu.items.forEach((item) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label;
      button.addEventListener('click', () => startExport(item.id));
      li.appendChild(button);
      list.appendChild(li);
    });

    const about = el('about');
    about.textContent = '';
    menu.about.forEach((entry) => {
      const dt = document.createElement('dt');
      dt.textContent = entry.term;
      const dd = document.createElement('dd');
      dd.textContent = entry.description;
      about.appendChild(dt);
      about.appendChild(dd);
    });

    el('where').hidden = true;
    list.hidden = false;
    el('about-section').hidden = false;

    if (menu.busy) {
      setButtonsDisabled(true);
      setStatus('busy', 'An export is already running on this page.');
    }
  }

  function startExport(formatId) {
    setButtonsDisabled(true);
    setStatus('busy', 'Exporting...');

    chrome.tabs.sendMessage(tabId, { action: 'export', formatId }, (result) => {
      setButtonsDisabled(false);
      if (chrome.runtime.lastError || !result) {
        setStatus('error', NOT_READY);
        return;
      }
      setStatus(result.tone, result.text);

      if (result.printToken) {
        const url = chrome.runtime.getURL('print/print.html') +
          '?tab=' + encodeURIComponent(tabId) +
          '&token=' + encodeURIComponent(result.printToken);
        chrome.tabs.create({ url });
      }
    });
  }

  function loadSetting() {
    const box = el('show-button');
    chrome.storage.local.get({ showButton: true }, (stored) => {
      box.checked = stored.showButton !== false;
    });
    box.addEventListener('change', () => {
      chrome.storage.local.set({ showButton: box.checked });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadSetting();

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.url || !CONVERSATION_URL.test(tab.url)) {
        el('where').textContent = ELSEWHERE;
        return;
      }
      tabId = tab.id;

      chrome.tabs.sendMessage(tabId, { action: 'menu' }, (menu) => {
        if (chrome.runtime.lastError || !menu || !menu.items) {
          el('where').textContent = NOT_READY;
          return;
        }
        renderMenu(menu);
      });
    });
  });
})();
