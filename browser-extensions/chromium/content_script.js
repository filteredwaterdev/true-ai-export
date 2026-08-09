/**
 * true-ai-export — bootstrap and orchestration.
 *
 * Loaded last. Everything it uses is already on globalThis.TrueAiExport
 * by the time this file runs, because the manifest lists the files in
 * dependency order.
 *
 * Responsibilities:
 *   - the format registry, in the order assets/ui/menu-spec.md gives
 *   - mounting the widget on a conversation page and only there
 *   - running an export: fetch, build, deliver, report
 *
 * Every network request this extension makes goes to claude.ai and is
 * made from here, on the claude.ai page, so the page's own session
 * cookies attach exactly as they do for claude.ai itself. Nothing is
 * sent anywhere else, and nothing is stored.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport;
  const { api, deliver, filename, summary } = ns;
  const { buildMarkdown, buildMarkdownClean } = ns.formatMarkdown;
  const { buildPlaintext, buildPlaintextClean } = ns.formatPlaintext;
  const { buildHtml, buildHtmlClean } = ns.formatHtml;
  const { buildJson } = ns.formatJson;
  const { buildPdf, buildPdfClean } = ns.formatPdf;

  // Only a conversation page gets the widget. A project page, the
  // account pages and the home page all leave it absent, which is why
  // this test is stricter than the console scripts' "last path segment
  // is a UUID": those are pasted by hand, this mounts itself.
  const CONVERSATION_PATH =
    /^\/chat\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // How long a completed status stays on screen before the widget
  // returns to rest. The console scripts use the same 8 seconds.
  const STATUS_LINGER_MS = 8000;

  // If the fetch is still running after this long, say what is
  // happening instead of sitting on a bare spinner.
  const SLOW_FETCH_MS = 2000;

  // Order and labels from assets/ui/menu-spec.md. The names match the
  // repository README so the words in the docs are the words in the UI.
  const FORMATS = [
    {
      id: 'markdown',
      label: 'Markdown',
      kind: 'full',
      delivery: 'download',
      build: (messages, name) => {
        const out = buildMarkdown(messages, name);
        return { content: out.markdown, counts: out };
      }
    },
    {
      id: 'markdown-clean',
      label: 'Markdown (clean)',
      kind: 'clean',
      delivery: 'download',
      build: (messages, name) => {
        const out = buildMarkdownClean(messages, name);
        return { content: out.markdown, counts: out };
      }
    },
    {
      id: 'plaintext',
      label: 'Plain text',
      kind: 'full',
      delivery: 'download',
      build: (messages, name) => {
        const out = buildPlaintext(messages, name);
        return { content: out.text, counts: out };
      }
    },
    {
      id: 'plaintext-clean',
      label: 'Plain text (clean)',
      kind: 'clean',
      delivery: 'download',
      build: (messages, name) => {
        const out = buildPlaintextClean(messages, name);
        return { content: out.text, counts: out };
      }
    },
    {
      id: 'html',
      label: 'HTML',
      kind: 'full',
      delivery: 'download',
      build: (messages, name) => {
        const out = buildHtml(messages, name);
        return { content: out.html, counts: out };
      }
    },
    {
      id: 'html-clean',
      label: 'HTML (clean)',
      kind: 'clean',
      delivery: 'download',
      build: (messages, name) => {
        const out = buildHtmlClean(messages, name);
        return { content: out.html, counts: out };
      }
    },
    {
      id: 'json',
      label: 'JSON',
      kind: 'json',
      delivery: 'download',
      build: (messages, name, rawData) => {
        const out = buildJson(messages, name, rawData);
        return { content: out.json, counts: out };
      }
    },
    {
      id: 'pdf-serif',
      label: 'PDF — serif',
      kind: 'full',
      delivery: 'print',
      build: (messages, name) => {
        const out = buildPdf(messages, name, 'serif');
        return { content: out.html, counts: out };
      }
    },
    {
      id: 'pdf-clean-serif',
      label: 'PDF — serif (clean)',
      kind: 'clean',
      delivery: 'print',
      build: (messages, name) => {
        const out = buildPdfClean(messages, name, 'serif');
        return { content: out.html, counts: out };
      }
    },
    {
      id: 'pdf-sans',
      label: 'PDF — sans-serif',
      kind: 'full',
      delivery: 'print',
      build: (messages, name) => {
        const out = buildPdf(messages, name, 'sans');
        return { content: out.html, counts: out };
      }
    },
    {
      id: 'pdf-clean-sans',
      label: 'PDF — sans-serif (clean)',
      kind: 'clean',
      delivery: 'print',
      build: (messages, name) => {
        const out = buildPdfClean(messages, name, 'sans');
        return { content: out.html, counts: out };
      }
    }
  ];

  // Wording from assets/ui/menu-spec.md, shortened to one line each.
  const ABOUT = [
    {
      term: 'Markdown',
      description:
        'Full transcript with all content flagged. For note-taking ' +
        'apps, Obsidian, Notion, GitHub.'
    },
    {
      term: 'Markdown (clean)',
      description:
        'Human-readable conversation only. Tool use and internal ' +
        'operations omitted.'
    },
    {
      term: 'Plain text',
      description:
        'Full transcript, no formatting syntax. Maximum ' +
        'compatibility. Paste anywhere.'
    },
    {
      term: 'Plain text (clean)',
      description:
        'Human-readable conversation only, no formatting syntax.'
    },
    {
      term: 'HTML',
      description:
        'Full transcript as a styled document. Opens in any browser. ' +
        'Good for archiving and sharing.'
    },
    {
      term: 'HTML (clean)',
      description:
        'Human-readable conversation as a styled document.'
    },
    {
      term: 'JSON',
      description:
        'Complete structured data. For programmatic use, analysis, ' +
        'or building on top of the conversation.'
    },
    {
      term: 'PDF — serif',
      description:
        'Print-optimised document in Georgia or Times New Roman. ' +
        'Suited to formal, legal and archival use. Opens the print ' +
        'dialog — choose your printer or Save as PDF.'
    },
    {
      term: 'PDF — serif (clean)',
      description:
        'Human-readable conversation only, serif typeface. Opens the ' +
        'print dialog.'
    },
    {
      term: 'PDF — sans-serif',
      description:
        'Print-optimised document in system-ui, Helvetica or Arial. ' +
        'Suited to general professional use. Opens the print dialog.'
    },
    {
      term: 'PDF — sans-serif (clean)',
      description:
        'Human-readable conversation only, sans-serif typeface. ' +
        'Opens the print dialog.'
    }
  ];

  const FORMAT_BY_ID = {};
  FORMATS.forEach((format) => { FORMAT_BY_ID[format.id] = format; });

  let widget = null;
  let lingerTimer = null;

  function isConversationPage() {
    return CONVERSATION_PATH.test(window.location.pathname);
  }

  async function runExport(formatId) {
    const format = FORMAT_BY_ID[formatId];
    if (!format || !widget || widget.isBusy()) return;

    // Held locally: a route change part-way through an export unmounts
    // the widget and sets the shared reference to null, and this
    // function still has to finish reporting into the one it started
    // with rather than throwing on the way out.
    const ui = widget;

    // The print tab is opened here, synchronously, while the click that
    // started this is still the current user activation. Opening it
    // after the fetch resolves is what the pop-up blocker stops on a
    // slow connection. The document written into it is unchanged.
    let printWindow = null;
    if (format.delivery === 'print') {
      printWindow = deliver.openPrintWindow();
      if (!printWindow) {
        const blocked = api.printWindowBlockedError();
        ui.setStatus('error', blocked.uxMessage);
        return;
      }
    }

    if (lingerTimer) {
      clearTimeout(lingerTimer);
      lingerTimer = null;
    }

    ui.setBusy(true, 'Starting export...');

    const slowTimer = setTimeout(() => {
      if (widget === ui && ui.isBusy()) {
        ui.setStatus(
          'busy',
          'Still fetching the conversation from claude.ai...'
        );
      }
    }, SLOW_FETCH_MS);

    try {
      const { messages, conversationName, rawData } =
        await api.fetchConversation((message) => {
          ui.setStatus('busy', message);
        });

      ui.setStatus(
        'busy',
        `Got ${messages.length} messages. Building transcript...`
      );

      const { content, counts } =
        format.build(messages, conversationName, rawData);

      if (counts.humanCount === 0 && counts.claudeCount === 0) {
        throw api.noReadableMessagesError();
      }

      if (format.delivery === 'print') {
        deliver.writePrintDocument(printWindow, content);
      } else {
        deliver.downloadFile(
          content,
          filename.forFormat(format.id, conversationName),
          filename.mimeFor(format.id)
        );
      }

      const described =
        summary.describe(format.kind, counts, format.delivery);
      ui.setStatus(described.tone, described.text);

      lingerTimer = setTimeout(() => {
        lingerTimer = null;
        if (widget === ui) ui.clearStatus();
      }, STATUS_LINGER_MS);

    } catch (error) {
      // Nothing has been written at this point: the download only
      // happens after a successful build. A print tab opened for this
      // attempt is closed so no blank tab is left behind.
      deliver.closePrintWindow(printWindow);
      ui.setStatus(
        'error',
        error.uxMessage || 'Export failed. Try again.'
      );

    } finally {
      clearTimeout(slowTimer);
      ui.setBusy(false);
    }
  }

  function mountWidget() {
    if (widget) return;
    widget = ns.button.mount({
      items: FORMATS.map((format) => ({
        id: format.id,
        label: format.label
      })),
      about: ABOUT,
      onSelect: runExport
    });
  }

  function unmountWidget() {
    if (!widget) return;
    if (lingerTimer) {
      clearTimeout(lingerTimer);
      lingerTimer = null;
    }
    widget.destroy();
    widget = null;
  }

  function syncToRoute() {
    if (isConversationPage()) {
      mountWidget();
    } else {
      unmountWidget();
    }
  }

  // Route detection. claude.ai is a single page app, so a conversation
  // change fires no page load.
  //
  // popstate covers back and forward. The pushState / replaceState
  // patches below only see calls made in this isolated world — a
  // content script cannot patch the page's own History methods — so
  // they are not sufficient on their own, and the poll below is what
  // actually catches an in-app navigation. It runs once a second,
  // compares a string, and does nothing else.
  let lastHref = window.location.href;

  function checkForRouteChange() {
    if (window.location.href === lastHref) return;
    lastHref = window.location.href;
    syncToRoute();
  }

  ['pushState', 'replaceState'].forEach((method) => {
    const original = history[method];
    if (typeof original !== 'function') return;
    history[method] = function () {
      const result = original.apply(this, arguments);
      checkForRouteChange();
      return result;
    };
  });

  window.addEventListener('popstate', checkForRouteChange);
  setInterval(checkForRouteChange, 1000);

  syncToRoute();
})();
