// player-loader.js — picks a provider and loads its embed into an iframe.
//
// Cross-origin iframes can't be introspected: the `load` event fires for a
// working player, for a provider's own "no sources found" page, for a
// Cloudflare challenge, and even for Chrome's built-in error page. So there
// is no honest way to detect "playback didn't work" from out here. An
// earlier version pretended there was — it treated an 8s timeout as failure
// and `load` as success — which switched away from slow-but-fine providers
// and never away from broken ones. That pseudo-fallback is gone.
//
// What *can* be detected is a host that doesn't answer at all (NXDOMAIN, bad
// TLS certificate, connection refused): a `no-cors` fetch resolves (opaquely)
// for any HTTP status but rejects on network-level failure. So the loader:
//   1. starts from the user's preferred provider (or the first in the list),
//   2. skips providers whose host is unreachable,
//   3. loads the first reachable one and stops.
// Anything beyond that is the user's call via the source switcher / Next.

(function () {
  'use strict';

  const PREF_KEY = 'streamcinema_preferred_provider';
  const PROBE_TIMEOUT_MS = 4000;
  // If a reachable host never fires `load` (hung Cloudflare challenge, etc.)
  // we still report resolved after this so the loading overlay doesn't sit
  // on top of the frame forever.
  const LOAD_GRACE_MS = 12000;

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

  /** The provider after `currentId` in list order, wrapping around. */
  function getNextProvider(currentId) {
    const { PROVIDERS } = window.StreamCinemaProviders;
    const i = PROVIDERS.findIndex((p) => p.id === currentId);
    return PROVIDERS[(i + 1) % PROVIDERS.length];
  }

  function orderedProviders() {
    const { PROVIDERS } = window.StreamCinemaProviders;
    const preferred = getPreferredProvider();
    const first = PROVIDERS.find((p) => p.id === preferred);
    const rest = PROVIDERS.filter((p) => p.id !== preferred);
    return first ? [first, ...rest] : PROVIDERS;
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

  /**
   * @param {HTMLIFrameElement} iframeEl
   * @param {{type: 'movie'|'tv', tmdbId: string|number, season?: number, episode?: number, resumeAt?: number}} target
   * @param {{onAttempt?: (id:string)=>void, onSkipped?: (id:string)=>void, onResolved?: (id:string)=>void, onAllFailed?: ()=>void}} [opts]
   * @returns {{cancel: () => void}}
   */
  function loadPlayer(iframeEl, target, opts = {}) {
    const queue = orderedProviders();
    let cancelled = false;
    let cleanup = null;
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
          opts.onSkipped?.(provider.id);
          attemptNext();
          return;
        }
        loadIntoFrame(provider, url);
      });
    }

    function loadIntoFrame(provider, url) {
      let done = false;
      function resolved() {
        if (done || cancelled) return;
        done = true;
        cleanup?.();
        opts.onResolved?.(provider.id);
      }
      const grace = setTimeout(resolved, LOAD_GRACE_MS);
      cleanup = () => {
        clearTimeout(grace);
        iframeEl.removeEventListener('load', resolved);
      };
      iframeEl.addEventListener('load', resolved, { once: true });
      iframeEl.referrerPolicy = 'origin';
      iframeEl.src = url;
    }

    attemptNext();

    return {
      cancel() {
        cancelled = true;
        cleanup?.();
      },
    };
  }

  window.StreamCinemaPlayer = { loadPlayer, getPreferredProvider, setPreferredProvider, getNextProvider };
})();
