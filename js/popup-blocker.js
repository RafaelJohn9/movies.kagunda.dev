// popup-blocker.js — single shared copy (previously duplicated verbatim in
// movie.js and series.js). Real player iframes must carry
// data-player-frame="true" so the MutationObserver below leaves them alone;
// the old version hardcoded id === 'movie-player', which was simply wrong on
// series.html (its player iframe is #playerFrame).

(function () {
  'use strict';

  // 1. Override window.open
  window.open = function (...args) {
    console.warn('[PopupBlocker] window.open blocked:', args[0]);
    return null;
  };

  // 2. Prevent location reassignment (redirect-style popups)
  try {
    const locDesc = Object.getOwnPropertyDescriptor(window, 'location');
    if (locDesc && locDesc.configurable) {
      let _currentHref = window.location.href;
      Object.defineProperty(window, 'location', {
        get() {
          return { href: _currentHref, toString: () => _currentHref };
        },
        set(val) {
          console.warn('[PopupBlocker] location assignment blocked:', val);
        },
        configurable: true,
      });
    }
  } catch (e) {}

  // 3. Block <a target="_blank"> clicks (biggest mobile popup vector)
  document.addEventListener(
    'click',
    function (e) {
      const anchor = e.target.closest('a');
      if (anchor && anchor.target === '_blank') {
        e.preventDefault();
        e.stopPropagation();
        console.warn('[PopupBlocker] _blank link blocked:', anchor.href);
        return false;
      }
    },
    true
  );

  // 4. Block middle-click / ctrl+click on any link
  document.addEventListener(
    'mousedown',
    function (e) {
      const anchor = e.target.closest('a');
      if (anchor && (e.button === 1 || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        console.warn('[PopupBlocker] middle/ctrl click blocked on:', anchor.href);
        return false;
      }
    },
    true
  );

  // 5. MutationObserver: remove dynamically injected iframes & _blank links
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const iframes = node.tagName === 'IFRAME' ? [node] : node.querySelectorAll?.('iframe') || [];

        iframes.forEach(function (iframe) {
          // Skip our own player iframe (movie.html / series.html)
          if (iframe.dataset.playerFrame === 'true') return;

          const style = window.getComputedStyle(iframe);
          const rect = iframe.getBoundingClientRect();
          const isHidden =
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0' ||
            rect.width === 0 ||
            rect.height === 0 ||
            rect.top < -9999 ||
            rect.left < -9999;

          if (isHidden || !iframe.src || iframe.src === 'about:blank') {
            console.warn('[PopupBlocker] Removed suspicious iframe:', iframe.src);
            iframe.remove();
          }
        });

        const blankLinks = node.tagName === 'A' && node.target === '_blank' ? [node] : node.querySelectorAll?.('a[target="_blank"]') || [];

        blankLinks.forEach(function (link) {
          link.removeAttribute('target');
          console.warn('[PopupBlocker] Neutralized _blank link:', link.href);
        });
      });
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // 6. Touch-specific: block touchend popups (mobile Chrome)
  document.addEventListener(
    'touchend',
    function (e) {
      const anchor = e.target.closest('a');
      if (anchor && (anchor.target === '_blank' || anchor.hasAttribute('data-popup'))) {
        e.preventDefault();
        e.stopPropagation();
        console.warn('[PopupBlocker] touchend popup blocked:', anchor.href);
        return false;
      }
    },
    true
  );

  // 7. Block programmatic .click() on _blank anchors
  const _origAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.target === '_blank') {
      console.warn('[PopupBlocker] programmatic click() on _blank blocked:', this.href);
      return;
    }
    return _origAnchorClick.apply(this, arguments);
  };

  console.log('[PopupBlocker] Initialized.');
})();
