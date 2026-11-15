// playback-speed.js — playback speed picker for the embedded player.
//
// The player is a cross-origin iframe, so we can't touch its <video> element.
// All we can do is postMessage speed commands to it, and no provider documents
// a speed API. So this is best-effort: we send the same request in the few
// message shapes embed players commonly accept, and re-send it once the frame
// has loaded and again shortly after (players often build their <video> late).
// A provider that ignores these messages just ignores them; its own built-in
// speed menu (gear icon) still works. The chosen speed is remembered.

(function () {
  'use strict';

  const SPEED_KEY = 'streamcinema_playback_speed';
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const REAPPLY_DELAYS_MS = [0, 1500, 4000, 8000];

  function getSpeed() {
    try {
      const v = parseFloat(localStorage.getItem(SPEED_KEY));
      return SPEEDS.includes(v) ? v : 1;
    } catch {
      return 1;
    }
  }

  function saveSpeed(rate) {
    try {
      localStorage.setItem(SPEED_KEY, String(rate));
    } catch (err) {
      console.warn('Could not persist playback speed:', err);
    }
  }

  function sendSpeed(iframeEl, rate) {
    const win = iframeEl.contentWindow;
    if (!win) return;
    const messages = [
      { type: 'PLAYER_COMMAND', command: 'setPlaybackRate', playbackRate: rate, data: { playbackRate: rate } },
      { type: 'setPlaybackRate', playbackRate: rate, rate },
      { event: 'command', func: 'setPlaybackRate', args: [rate] },
      { command: 'setPlaybackRate', value: rate },
    ];
    for (const m of messages) {
      try {
        win.postMessage(m, '*');
      } catch {
        // Frame navigating or torn down; the next re-apply will catch it.
      }
    }
  }

  /**
   * Fills `selectEl` with the speeds and wires it to the player frame.
   * @param {HTMLIFrameElement} iframeEl
   * @param {HTMLSelectElement} selectEl
   * @returns {{apply: () => void}} call `apply()` after each player load
   */
  function init(iframeEl, selectEl) {
    for (const s of SPEEDS) {
      const option = document.createElement('option');
      option.value = String(s);
      option.textContent = s === 1 ? 'Normal' : `${s}x`;
      selectEl.appendChild(option);
    }
    selectEl.value = String(getSpeed());

    let timers = [];
    function apply() {
      timers.forEach(clearTimeout);
      const rate = parseFloat(selectEl.value) || 1;
      timers = REAPPLY_DELAYS_MS.map((d) => setTimeout(() => sendSpeed(iframeEl, rate), d));
    }

    selectEl.addEventListener('change', () => {
      saveSpeed(parseFloat(selectEl.value) || 1);
      apply();
    });

    return { apply };
  }

  window.StreamCinemaSpeed = { SPEEDS, getSpeed, init };
})();
