/**
 * true-ai-export — service worker.
 *
 * There is deliberately almost nothing here. The export runs entirely
 * in the content script on claude.ai, where the page's own session
 * cookies attach to the request without any help. The worker holds no
 * state, opens no connection, stores nothing, and contacts no server.
 *
 * MV3 suspends this worker after roughly 30 seconds idle and restarts
 * it on demand, so the one listener is registered synchronously at the
 * top level. A listener registered inside an async callback would be
 * missed after a restart.
 */

chrome.runtime.onInstalled.addListener((details) => {
  // Nothing to migrate: the extension keeps no stored state and has no
  // options. The listener exists so the worker has a registration point
  // and so an install or update is a no-op rather than undefined
  // behaviour.
  void details;
});
