/**
 * true-ai-export — id resolution, validation, fetch, error mapping.
 *
 * The request, the validation order, and the thrown Error messages are
 * copied from the console scripts in claude/v1.2.0/. The fetch runs in
 * the content script on claude.ai, so the page's own session cookies
 * attach exactly as they do for claude.ai itself. No other origin is
 * ever contacted.
 *
 * Each error also carries a `uxMessage`: the plain-language sentence
 * the widget shows. The console script's own message is kept on
 * `error.message` unchanged.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport;
  const { isValidUUID } = ns.walk;

  const UX = {
    SESSION_EXPIRED:
      'Session expired. Reload the page and sign in, then try again.',
    NOT_A_CONVERSATION:
      'Open a conversation first. This works on a conversation page.',
    EMPTY:
      'The conversation came back empty. Nothing was saved.',
    OFFLINE:
      'Could not reach claude.ai. Check your connection and try again.',
    NO_READABLE:
      'No readable messages found. Nothing was saved.'
  };

  function exportError(message, uxMessage, status) {
    const error = new Error(message);
    error.uxMessage = uxMessage;
    if (status !== undefined) error.httpStatus = status;
    return error;
  }

  // Same derivation as the console scripts, so the extension and the
  // console script resolve the same conversation on the same page.
  function readConversationId() {
    return window.location.pathname.split('/').pop();
  }

  function readOrgId() {
    return document.cookie.match(/lastActiveOrg=([^;]+)/)?.[1];
  }

  /**
   * Fetches the conversation and returns
   * { messages, conversationName, rawData }.
   * `rawData` is the untouched API response; only the JSON formatter
   * uses it, the rest ignore it.
   *
   * `onProgress` is called with a short status string so the widget can
   * say what is happening rather than sitting on a bare spinner.
   */
  async function fetchConversation(onProgress) {
    const report = typeof onProgress === 'function' ? onProgress : () => {};

    const conversationId = readConversationId();
    if (!conversationId || !isValidUUID(conversationId)) {
      throw exportError(
        'Could not find a valid conversation ID in the URL. ' +
        'Make sure you are on a Claude conversation page ' +
        '(claude.ai/chat/...).',
        UX.NOT_A_CONVERSATION
      );
    }

    const orgId = readOrgId();
    if (!orgId || !isValidUUID(orgId)) {
      throw exportError(
        'Could not find your organisation ID in session cookies. ' +
        'Try refreshing the page and running the script again.',
        UX.SESSION_EXPIRED
      );
    }

    const url =
      `/api/organizations/${orgId}/chat_conversations/${conversationId}` +
      `?tree=true&rendering_mode=messages&render_all_tools=true`;

    report('Fetching conversation from claude.ai...');

    let response;
    try {
      response = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (networkError) {
      throw exportError(
        `Network request failed: ${networkError.message}`,
        UX.OFFLINE
      );
    }

    if (!response.ok) {
      throw exportError(
        `API returned HTTP ${response.status}. ` +
        (response.status === 403
          ? 'Session may have expired — try refreshing the page ' +
            'and running the script again.'
          : response.status === 404
          ? 'Conversation not found. Make sure you are on a ' +
            'Claude conversation page (claude.ai/chat/...).'
          : 'Unexpected server error — please open a GitHub issue.'),
        response.status === 403
          ? UX.SESSION_EXPIRED
          : response.status === 404
          ? UX.NOT_A_CONVERSATION
          : `Export failed. claude.ai returned HTTP ${response.status}. ` +
            `Try again in a moment.`,
        response.status
      );
    }

    const data = await response.json();

    if (!data.chat_messages || data.chat_messages.length === 0) {
      throw exportError(
        'API returned no messages. The conversation may be empty.',
        UX.EMPTY
      );
    }

    return {
      messages: data.chat_messages,
      conversationName: data.name || null,
      rawData: data
    };
  }

  // Thrown by the orchestrator when a conversation fetched fine but
  // contained no human or assistant message. Message text copied from
  // the console scripts.
  function noReadableMessagesError() {
    return exportError(
      'No readable messages found in this conversation. ' +
      'It may contain only non-text content.',
      UX.NO_READABLE
    );
  }

  // Thrown when the browser blocks the print tab a PDF export needs.
  function printWindowBlockedError() {
    return exportError(
      'Print window was blocked. Please allow pop-ups for ' +
      'claude.ai and run the script again.',
      'The print tab was blocked. Allow pop-ups for claude.ai, ' +
      'then try again.'
    );
  }

  ns.api = {
    UX,
    exportError,
    readConversationId,
    readOrgId,
    fetchConversation,
    noReadableMessagesError,
    printWindowBlockedError
  };
})();
