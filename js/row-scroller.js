// row-scroller.js — wires left/right arrow buttons onto horizontally
// scrolling rows. Markup contract: a `.row-scroller` wrapper containing one
// `.row-scroller__track` (the overflow-x-auto grid) and two
// `.row-scroller__arrow` buttons with `data-dir="-1"` / `data-dir="1"`.
//
// Rows are populated asynchronously after this runs, so a MutationObserver
// (not a one-off call after render) keeps arrow disabled-state in sync as
// cards get added.

(function () {
  'use strict';

  function initRowScroller(wrapper) {
    const track = wrapper.querySelector('.row-scroller__track');
    const arrows = wrapper.querySelectorAll('.row-scroller__arrow');
    if (!track || arrows.length === 0) return;

    function update() {
      const maxScroll = track.scrollWidth - track.clientWidth;
      const hasOverflow = maxScroll > 8;
      wrapper.classList.toggle('has-overflow', hasOverflow);
      arrows.forEach((btn) => {
        const dir = Number(btn.dataset.dir);
        const atStart = track.scrollLeft <= 4;
        const atEnd = track.scrollLeft >= maxScroll - 4;
        btn.disabled = !hasOverflow || (dir < 0 ? atStart : atEnd);
      });
    }

    arrows.forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = Number(btn.dataset.dir);
        track.scrollBy({ left: dir * track.clientWidth * 0.9, behavior: 'smooth' });
      });
    });

    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    new MutationObserver(update).observe(track, { childList: true, subtree: true });
    update();
  }

  function initAllRowScrollers(root = document) {
    root.querySelectorAll('.row-scroller').forEach(initRowScroller);
  }

  window.StreamCinemaRowScroller = { initRowScroller, initAllRowScrollers };
})();
