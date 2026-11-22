/**
 * true-ai-export — the floating button, status indicator and live
 * region.
 *
 * The widget is a fixed-position host element carrying `all: initial`
 * with a shadow root attached, so claude.ai's CSS cannot reach in and
 * this stylesheet cannot leak out. Nothing here is anchored to a
 * claude.ai class name, id, or DOM path: the widget is positioned
 * against the viewport, not against the host application, so a
 * claude.ai redesign cannot move or break it.
 *
 * Two status surfaces exist on purpose. `.status` is what is seen;
 * `.live` is a visually hidden aria-live="polite" region that is
 * always rendered, so a state change is announced reliably rather than
 * depending on whether a display:none element was visible at the
 * moment it changed.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport;
  const { CSS, ICON } = ns.styles;

  const HOST_ID = 'true-ai-export-widget';
  const TRIGGER_ID = 'true-ai-export-trigger';
  const MENU_ID = 'true-ai-export-menu';

  // Bottom-right, lifted clear of the message column and of the
  // composer. Fixed to the viewport, never to a claude.ai element.
  const HOST_POSITION =
    'position: fixed;' +
    'right: 16px;' +
    'bottom: 84px;' +
    'z-index: 2147483000;' +
    'display: block;' +
    'width: auto;' +
    'height: auto;' +
    'margin: 0;' +
    'padding: 0;' +
    'pointer-events: auto;' +
    'color-scheme: light dark;';

  /**
   * options:
   *   items     [{ id, label }] format entries for the menu
   *   about     [{ term, description }] for the About panel
   *   onSelect  called with a format id when one is chosen
   */
  function mount(options) {
    const host = document.createElement('div');
    host.id = HOST_ID;
    // `all: initial` first, then the layout the widget needs. Later
    // declarations in the same inline style win, so the reset cannot
    // undo the positioning.
    host.style.cssText = 'all: initial;' + HOST_POSITION;

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    const root = document.createElement('div');
    root.className = 'root';
    shadow.appendChild(root);

    // ── Live region ──────────────────────────────────────────────
    const live = document.createElement('div');
    live.className = 'sr-only';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    root.appendChild(live);

    // ── Visible status ───────────────────────────────────────────
    const status = document.createElement('div');
    status.className = 'status';
    status.setAttribute('data-state', '');

    const statusIcon = document.createElement('span');
    statusIcon.className = 'icon';
    status.appendChild(statusIcon);

    const statusText = document.createElement('span');
    statusText.className = 'text';
    status.appendChild(statusText);

    root.appendChild(status);

    // ── Trigger and menu ─────────────────────────────────────────
    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    root.appendChild(wrap);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'trigger';
    trigger.id = TRIGGER_ID;
    // The name says what it does, not what it is.
    trigger.setAttribute('aria-label', 'Save conversation to file');
    trigger.title = 'Save conversation to file';
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', MENU_ID);

    const triggerIcon = document.createElement('span');
    triggerIcon.className = 'icon';
    triggerIcon.innerHTML = ICON.export;
    trigger.appendChild(triggerIcon);

    const triggerLabel = document.createElement('span');
    triggerLabel.className = 'label';
    triggerLabel.textContent = 'Save to file';
    trigger.appendChild(triggerLabel);

    const triggerChevron = document.createElement('span');
    triggerChevron.className = 'chevron';
    triggerChevron.innerHTML = ICON.chevron;
    trigger.appendChild(triggerChevron);

    let busy = false;

    const menu = ns.menu.create({
      doc: document,
      menuId: MENU_ID,
      labelledBy: TRIGGER_ID,
      title: 'Save to file',
      items: options.items,
      about: options.about,
      onSelect: (formatId) => options.onSelect(formatId),
      onClose: (returnFocus) => {
        trigger.setAttribute('aria-expanded', 'false');
        if (returnFocus) trigger.focus();
      }
    });

    wrap.appendChild(menu.element);
    wrap.appendChild(trigger);

    function openMenu(focusTarget) {
      if (busy) return;
      trigger.setAttribute('aria-expanded', 'true');
      menu.open(focusTarget);
    }

    function closeMenu(returnFocus) {
      menu.close(returnFocus);
    }

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      if (busy) return;
      if (menu.isOpen()) {
        closeMenu(true);
      } else {
        openMenu('first');
      }
    });

    trigger.addEventListener('keydown', (event) => {
      if (busy) return;
      if (event.key === 'ArrowDown' || event.key === 'Enter' ||
          event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        openMenu('first');
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        openMenu('last');
      } else if (event.key === 'Escape') {
        event.preventDefault();
        clearStatus();
      }
    });

    // Outside click closes the menu and activates nothing. composedPath
    // is what lets a click inside the shadow root be recognised as
    // inside the widget.
    function onDocumentPointerDown(event) {
      if (!menu.isOpen()) return;
      if (event.composedPath().indexOf(host) !== -1) return;
      closeMenu(false);
    }

    // Focus leaving the widget entirely closes the menu. This is also
    // what stops the menu sitting on top of a claude.ai dialog: a
    // dialog takes focus, and the menu closes rather than floating over
    // it. No claude.ai selector is involved.
    function onFocusIn(event) {
      if (!menu.isOpen()) return;
      if (event.composedPath().indexOf(host) !== -1) return;
      closeMenu(false);
    }

    // An error is dismissible with Escape from anywhere on the page.
    function onDocumentKeydown(event) {
      if (event.key !== 'Escape') return;
      if (status.getAttribute('data-state') === 'error') clearStatus();
    }

    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('keydown', onDocumentKeydown, true);

    // ── Status API ───────────────────────────────────────────────

    function announce(message) {
      // Cleared first so the same message twice in a row is still read.
      live.textContent = '';
      live.textContent = message;
    }

    function setStatus(state, message) {
      status.setAttribute('data-state', state);
      statusIcon.innerHTML = ICON[state] || ICON.info;
      statusText.textContent = message;
      announce(message);
    }

    function clearStatus() {
      status.setAttribute('data-state', '');
      statusIcon.innerHTML = '';
      statusText.textContent = '';
    }

    function setBusy(isBusy, message) {
      busy = isBusy;
      trigger.setAttribute('aria-disabled', String(isBusy));
      if (isBusy) {
        setStatus('busy', message);
      }
    }

    function destroy() {
      document.removeEventListener(
        'pointerdown', onDocumentPointerDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('keydown', onDocumentKeydown, true);
      if (host.parentNode) host.parentNode.removeChild(host);
    }

    document.body.appendChild(host);

    return {
      host,
      trigger,
      menu,
      setStatus,
      clearStatus,
      setBusy,
      isBusy: () => busy,
      closeMenu,
      destroy
    };
  }

  ns.button = { mount, HOST_ID, TRIGGER_ID, MENU_ID };
})();
