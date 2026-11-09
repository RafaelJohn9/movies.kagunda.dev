// player-loader.js — loads an embed URL into an iframe with an automatic
// fallback chain across providers, starting from whichever one the user
// picked last (manual switcher) or the default otherwise.
//
// Caveat: cross-origin iframes can't be introspected, so "success" here just
// means the provider's document loaded within the timeout, not that playback
// actually works. That's an inherent limit of iframe-based embeds, which is
// why a manual switcher exists alongside the automatic fallback.
//
// Worse, Chrome fires `load` on an iframe even when navigation fails (it
// loads its own error page), so a dead domain (NXDOMAIN, bad TLS cert,
// connection refused) used to look like a success. To catch exactly those
// cases we first issue a `no-cors` fetch to the embed URL: the opaque
// response resolves for *any* HTTP status (even 4xx/5xx) but rejects on
// network-level failure. A reject skips the provider instantly; a resolve or
// a probe timeout hands over to the iframe as before.

(function () {
  'use strict';

  const PREF_KEY = 'streamcinema_preferred_provider';
  const DEFAULT_TIMEOUT_MS = 8000;
  const PROBE_TIMEOUT_MS = 4000;

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

  /**
   * Resolves `true` if the host answered at all (any HTTP status), `false` if
   * the request failed at the network level. A timeout resolves `true` so a
   * slow-but-alive provider still gets its chance in the iframe.
   * @param {string} url
   * @returns {Promise<boolean>}
   */
  function probeHost(url) {
    if (typeof fetch !== 'function' || typeof AbortController !== 'function') {
      return Promise.resolve(true);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    return fetch(url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: controller.signal })
      .then(() => true, (err) => err?.name === 'AbortError')
      .finally(() => clearTimeout(timer));
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

      probeHost(url).then((reachable) => {
        if (cancelled) return;
        if (!reachable) {
          console.warn(`[Player] ${provider.id} unreachable, skipping`);
          attemptNext();
          return;
        }
        loadIntoFrame(provider, url);
      });
    }

    function loadIntoFrame(provider, url) {
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
