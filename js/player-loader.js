// player-loader.js — loads an embed URL into an iframe with an automatic
// fallback chain across providers, starting from whichever one the user
// picked last (manual switcher) or the default otherwise.
//
// Caveat: cross-origin iframes can't be introspected, so "success" here just
// means the provider's document loaded within the timeout, not that playback
// actually works. That's an inherent limit of iframe-based embeds, which is
// why a manual switcher exists alongside the automatic fallback.

(function () {
  'use strict';

  const PREF_KEY = 'streamcinema_preferred_provider';
  const DEFAULT_TIMEOUT_MS = 8000;

  function getPreferredProvider() {
    try {
      return localStorage.getItem(PREF_KEY) || window.StreamCinemaProviders.PROVIDERS[0].id;
    } catch {
      return window.StreamCinemaProviders.PROVIDERS[0].id;
    }
  }

  function setPreferredProvider(id) {
    try {
      localStorage.setItem(PREF_KEY, id);
    } catch (err) {
      console.warn('Could not persist preferred provider:', err);
    }
  }

  function orderedProviders() {
    const { PROVIDERS } = window.StreamCinemaProviders;
    const preferred = getPreferredProvider();
    const first = PROVIDERS.find((p) => p.id === preferred);
    const rest = PROVIDERS.filter((p) => p.id !== preferred);
    return first ? [first, ...rest] : PROVIDERS;
  }

  /**
   * @param {HTMLIFrameElement} iframeEl
   * @param {{type: 'movie'|'tv', tmdbId: string|number, season?: number, episode?: number}} target
   * @param {{onAttempt?: (id:string)=>void, onResolved?: (id:string)=>void, onAllFailed?: ()=>void, timeoutMs?: number}} [opts]
   * @returns {{cancel: () => void}}
   */
  function loadPlayer(iframeEl, target, opts = {}) {
    const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
    const queue = orderedProviders();
    let cancelled = false;
    let index = 0;

    function attemptNext() {
      if (cancelled) return;
      if (index >= queue.length) {
        opts.onAllFailed?.();
        return;
      }
      const provider = queue[index++];
      const url = window.StreamCinemaProviders.buildEmbedUrl(provider, target);
      opts.onAttempt?.(provider.id);

      let settled = false;
      const timer = setTimeout(() => settle(attemptNext), timeoutMs);

      function settle(next) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        iframeEl.removeEventListener('load', onLoad);
        iframeEl.removeEventListener('error', onError);
        next();
      }

      function onLoad() {
        settle(() => opts.onResolved?.(provider.id));
      }

      function onError() {
        settle(attemptNext);
      }

      iframeEl.addEventListener('load', onLoad, { once: true });
      iframeEl.addEventListener('error', onError, { once: true });
      iframeEl.referrerPolicy = 'origin';
      iframeEl.src = url;
    }

    attemptNext();

    return {
      cancel() {
        cancelled = true;
      },
    };
  }

  window.StreamCinemaPlayer = { loadPlayer, getPreferredProvider, setPreferredProvider };
})();
