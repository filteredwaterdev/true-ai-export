/**
 * true-ai-export — the format picker.
 *
 * WAI-ARIA menu button pattern. The trigger lives in button.js and
 * carries aria-haspopup="menu", aria-expanded and aria-controls; this
 * file owns the menu itself, its roving focus, and the key handling:
 *
 *   ArrowDown / ArrowUp   move focus, wrapping at both ends
 *   Home / End            first and last item
 *   Enter / Space         activate the item, close the menu
 *   Escape                close, return focus to the trigger
 *   Tab                   close, let focus continue past the widget
 *   Outside click         close, activate nothing
 *
 * Menu items are reached with the arrow keys, never with Tab: every
 * item is tabindex="-1", so the trigger is the only thing in the tab
 * order while the widget is at rest.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport;

  /**
   * options:
   *   doc          document used to create elements
   *   menuId       id the trigger's aria-controls points at
   *   labelledBy   id of the trigger, for the menu's accessible name
   *   title        heading shown at the top of the menu
   *   items        [{ id, label }], the format entries
   *   about        [{ term, description }] for the About panel
   *   onSelect     called with the chosen item id
   *   onClose      called with (returnFocus: boolean)
   */
  function create(options) {
    const doc = options.doc;

    const menu = doc.createElement('div');
    menu.className = 'menu';
    menu.id = options.menuId;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-labelledby', options.labelledBy);
    menu.setAttribute('data-open', 'false');

    const heading = doc.createElement('div');
    heading.className = 'menu-title';
    heading.textContent = options.title;
    menu.appendChild(heading);

    const formatItems = options.items.map((item) => {
      const el = doc.createElement('button');
      el.type = 'button';
      el.className = 'menuitem';
      el.setAttribute('role', 'menuitem');
      el.setAttribute('tabindex', '-1');
      el.dataset.format = item.id;
      el.textContent = item.label;
      menu.appendChild(el);
      return el;
    });

    const separator = doc.createElement('div');
    separator.className = 'separator';
    separator.setAttribute('role', 'separator');
    menu.appendChild(separator);

    const aboutPanelId = options.menuId + '-about';

    const aboutItem = doc.createElement('button');
    aboutItem.type = 'button';
    aboutItem.className = 'menuitem';
    aboutItem.setAttribute('role', 'menuitem');
    aboutItem.setAttribute('tabindex', '-1');
    aboutItem.setAttribute('aria-expanded', 'false');
    aboutItem.setAttribute('aria-controls', aboutPanelId);
    aboutItem.dataset.action = 'about';
    aboutItem.textContent = 'About these formats';
    menu.appendChild(aboutItem);

    // role="group" keeps the menu's children to roles a menu accepts
    // while still allowing prose inside the panel.
    const aboutGroup = doc.createElement('div');
    aboutGroup.setAttribute('role', 'group');
    aboutGroup.setAttribute('aria-label', 'About these formats');

    const aboutPanel = doc.createElement('div');
    aboutPanel.className = 'about';
    aboutPanel.id = aboutPanelId;
    aboutPanel.setAttribute('data-open', 'false');

    options.about.forEach((entry) => {
      const p = doc.createElement('p');
      const term = doc.createElement('strong');
      term.textContent = entry.term;
      p.appendChild(term);
      p.appendChild(doc.createTextNode(' — ' + entry.description));
      aboutPanel.appendChild(p);
    });

    aboutGroup.appendChild(aboutPanel);
    menu.appendChild(aboutGroup);

    // Every item that takes arrow-key focus, in visual order.
    const focusable = formatItems.concat([aboutItem]);

    let open = false;

    function isOpen() {
      return open;
    }

    function focusAt(index) {
      const wrapped =
        ((index % focusable.length) + focusable.length) % focusable.length;
      focusable[wrapped].focus();
    }

    function currentIndex() {
      const active = menu.getRootNode().activeElement;
      return focusable.indexOf(active);
    }

    // Menu sits above the trigger by default because the widget is
    // anchored to the bottom of the viewport. It flips below when there
    // is not enough room above, and switches side when it would run off
    // the left edge. It never scrolls the page.
    function place() {
      menu.setAttribute('data-placement', 'above');
      menu.setAttribute('data-align', 'right');

      const anchor = menu.parentElement.getBoundingClientRect();
      const size = menu.getBoundingClientRect();
      const margin = 8;

      if (anchor.top - size.height - margin < 0 &&
          window.innerHeight - anchor.bottom > anchor.top) {
        menu.setAttribute('data-placement', 'below');
      }

      if (anchor.right - size.width < 0) {
        menu.setAttribute('data-align', 'left');
      }
    }

    function openMenu(focusTarget) {
      open = true;
      menu.setAttribute('data-open', 'true');
      place();
      if (focusTarget === 'last') {
        focusAt(focusable.length - 1);
      } else {
        focusAt(0);
      }
    }

    function closeMenu(returnFocus) {
      if (!open) return;
      open = false;
      menu.setAttribute('data-open', 'false');
      collapseAbout();
      options.onClose(returnFocus !== false);
    }

    function collapseAbout() {
      aboutItem.setAttribute('aria-expanded', 'false');
      aboutPanel.setAttribute('data-open', 'false');
    }

    function toggleAbout() {
      const nowOpen = aboutItem.getAttribute('aria-expanded') !== 'true';
      aboutItem.setAttribute('aria-expanded', String(nowOpen));
      aboutPanel.setAttribute('data-open', String(nowOpen));
    }

    function activate(item) {
      if (item === aboutItem) {
        // The About panel expands in place. The menu stays open so the
        // person can read it and then pick a format.
        toggleAbout();
        return;
      }
      closeMenu(true);
      options.onSelect(item.dataset.format);
    }

    menu.addEventListener('click', (event) => {
      const item = event.target.closest('.menuitem');
      if (!item) return;
      event.preventDefault();
      activate(item);
    });

    menu.addEventListener('keydown', (event) => {
      const index = currentIndex();

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          focusAt(index + 1);
          break;

        case 'ArrowUp':
          event.preventDefault();
          focusAt(index - 1);
          break;

        case 'Home':
          event.preventDefault();
          focusAt(0);
          break;

        case 'End':
          event.preventDefault();
          focusAt(focusable.length - 1);
          break;

        case 'Enter':
        case ' ':
        case 'Spacebar':
          event.preventDefault();
          if (index >= 0) activate(focusable[index]);
          break;

        case 'Escape':
          event.preventDefault();
          closeMenu(true);
          break;

        case 'Tab':
          // Focus is not sent back to the trigger to rest there. It is
          // put on the trigger synchronously so the browser's own
          // sequential navigation carries on from the widget to the
          // next element on the page, which is what "continue
          // naturally" means here. Default is deliberately not
          // prevented.
          closeMenu(true);
          break;

        default:
          break;
      }
    });

    return {
      element: menu,
      isOpen,
      open: openMenu,
      close: closeMenu,
      itemCount: formatItems.length
    };
  }

  ns.menu = { create };
})();
