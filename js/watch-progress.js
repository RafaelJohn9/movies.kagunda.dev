// watch-progress.js — best-effort playback resume.
//
// Embeds are cross-origin iframes, so we can't read a <video> element
// directly. Some providers (the vidsrc/vidapi family, vidcore) instead
// broadcast a `PLAYER_EVENT` message to the parent window with playback
// progress. We listen for that, persist it via watchProgressStore, and feed
// it back in as a start-time query param on the next load (see
// providers.js). Providers that never send the message simply never update
// the stored position — resume silently degrades to "start from the top"
// instead of breaking anything.

(function () {
  'use strict';

  const { watchProgressStore } = window.StreamCinemaStorage;
  const SAVE_THROTTLE_MS = 4000;

  function extractProgress(payload) {
    if (!payload) return null;
    const time = payload.player_progress ?? payload.currentTime ?? payload.progress;
    const duration = payload.player_duration ?? payload.duration;
    return typeof time === 'number' ? { time, duration } : null;
  }

  /**
   * Starts listening for progress events from one iframe's current
   * document. Call `.stop()` before loading a new title/episode into the
   * same iframe to avoid attributing its progress to the wrong target.
   * @param {HTMLIFrameElement} iframeEl
   * @param {{type: 'movie'|'tv', tmdbId: string|number, season?: number, episode?: number}} target
   * @returns {{stop: () => void}}
   */
  function watch(iframeEl, target) {
    let lastSaved = 0;

    function onMessage(event) {
      // contentWindow stays the same object across src changes on the same
      // iframe, so this check is safe to set up once per load.
      if (event.source !== iframeEl.contentWindow) return;
      const data = event.data;
      if (!data || data.type !== 'PLAYER_EVENT') return;

      const progress = extractProgress(data.data || data);
      if (!progress) return;

      const now = Date.now();
      if (now - lastSaved < SAVE_THROTTLE_MS) return;
      lastSaved = now;
      watchProgressStore.save(target, progress.time, progress.duration);
    }

    window.addEventListener('message', onMessage);
    return {
      stop() {
        window.removeEventListener('message', onMessage);
      },
    };
  }

  function getResumeSeconds(target) {
    const entry = watchProgressStore.get(target);
    return entry ? Math.floor(entry.time) : null;
  }

  window.StreamCinemaProgress = { watch, getResumeSeconds };
})();
