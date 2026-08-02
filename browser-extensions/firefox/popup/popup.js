/**
 * true-ai-export — Firefox Extension Popup
 * https://github.com/filteredwaterdev/true-ai-export
 *
 * Handles format selection and communicates with the content
 * script to trigger exports. All export logic lives in
 * content_script.js — this file only handles the popup UI.
 *
 * Version: 1.2.0
 * License: MIT
 */

// ─── Helpers ───────────────────────────────────────────────────────────────

function setStatus(msg, type = '') {
  const status = document.getElementById('status');
  status.textContent = msg;
  status.className = 'status visible' + (type ? ` ${type}` : '');
}

function clearStatus() {
  const status = document.getElementById('status');
  status.textContent = '';
  status.className = 'status';
}

// ─── Check if we are on a Claude conversation page ─────────────────────────

async function checkPage() {
  const tabs = await browser.tabs.query({
    active: true,
    currentWindow: true
  });

  const tab = tabs[0];
  const url = tab?.url ?? '';

  const isClaudeConversation =
    url.startsWith('https://claude.ai/chat/') ||
    url.startsWith('https://claude.ai/project/');

  document.getElementById('main-content').style.display =
    isClaudeConversation ? 'block' : 'none';
  document.getElementById('not-claude').style.display =
    isClaudeConversation ? 'none' : 'block';

  return isClaudeConversation;
}

// ─── Handle format button clicks ───────────────────────────────────────────

async function handleExport(format) {
  clearStatus();
  setStatus('Starting export…');

  const tabs = await browser.tabs.query({
    active: true,
    currentWindow: true
  });

  const tab = tabs[0];
  if (!tab?.id) {
    setStatus('Could not find active tab.', 'error');
    return;
  }

  try {
    // Send message to content script to trigger the export
    const response = await browser.tabs.sendMessage(tab.id, {
      action: 'export',
      format: format
    });

    if (response?.success) {
      if (format.startsWith('pdf')) {
        setStatus(
          '✅ Print dialog opened.' +
          (response.safari ? ' Press Cmd-P if needed.' : ''),
          'success'
        );
      } else {
        setStatus(
          `✅ Downloaded: ${response.filename}`,
          'success'
        );
      }
    } else {
      setStatus(
        `❌ ${response?.error ?? 'Export failed.'}`,
        'error'
      );
    }

  } catch (err) {
    // Content script may not be injected yet on this tab
    setStatus(
      '❌ Could not connect to page. Try refreshing claude.ai.',
      'error'
    );
    console.error('[true-ai-export] popup error:', err);
  }
}

// ─── Initialise ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await checkPage();

  // Attach click handlers to all format buttons
  document.querySelectorAll('[data-format]').forEach(btn => {
    btn.addEventListener('click', () => {
      handleExport(btn.dataset.format);
    });
  });
});
