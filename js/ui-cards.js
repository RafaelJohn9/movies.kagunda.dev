// ui-cards.js — one card renderer shared by the browse grids (index.html),
// My List (mylist.html), and the Continue Watching row (index.html), instead
// of three near-identical copies.

(function () {
  'use strict';

  const PLACEHOLDER_POSTER = 'https://via.placeholder.com/300x450?text=Loading...';

  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed bottom-6 right-6 ${type === 'success' ? 'bg-primary' : 'bg-red-500'} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-up flex items-center gap-2`;
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined text-sm';
    icon.textContent = type === 'success' ? 'check_circle' : 'info';
    const text = document.createElement('span');
    text.textContent = message;
    notification.appendChild(icon);
    notification.appendChild(text);
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      setTimeout(() => notification.remove(), 300);
    }, 2500);
  }

  function addToMyList(tmdbId, title, type) {
    const added = window.StreamCinemaStorage.myListStore.add(tmdbId, title, type);
    if (added) {
      showNotification(`Added "${title}" to My List`);
    } else {
      showNotification(`"${title}" is already in your list`, 'info');
    }
  }

  // id/title live in the query string (not just localStorage) so the
  // resulting URL is shareable — anyone opening it lands on the same title.
  function goToPlayer(item, type) {
    const title = item.title || 'Untitled';
    if (type === 'movie') {
      const params = new URLSearchParams({ id: item.tmdb_id, title });
      window.location.href = `movie.html?${params.toString()}`;
      return;
    }
    const params = new URLSearchParams({ id: item.tmdb_id, title });
    if (item.season != null && item.episode != null) {
      params.set('season', item.season);
      params.set('episode', item.episode);
    }
    window.location.href = `series.html?${params.toString()}`;
  }

  /**
   * @param {object} item - { tmdb_id|tmdbId, title, season?, episode?, episodeTitle? }
   * @param {'movie'|'tv'} type
   * @param {'browse'|'list'|'continue'} [variant]
   * @param {{ onRemoved?: () => void }} [options]
   */
  function createCard(item, type, variant = 'browse', options = {}) {
    const normalized = { ...item, tmdb_id: item.tmdb_id ?? item.tmdbId };

    const card = document.createElement('div');
    card.className = 'media-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const handleClick = () => goToPlayer(normalized, type);

    const posterWrap = document.createElement('div');
    posterWrap.className = 'media-card__poster-wrap';

    if (normalized.season != null && normalized.episode != null) {
      const badge = document.createElement('span');
      badge.className = 'media-card__badge';
      badge.textContent = `S${normalized.season} · E${normalized.episode}`;
      posterWrap.appendChild(badge);
    }

    const img = document.createElement('img');
    img.className = 'media-card__poster';
    img.alt = normalized.title || 'Untitled';
    img.loading = 'lazy';
    img.src = PLACEHOLDER_POSTER;
    setTimeout(async () => {
      img.src = await window.StreamCinemaTMDB.getPoster(normalized.tmdb_id, type);
    }, 100);

    const overlay = document.createElement('div');
    overlay.className = 'media-card__overlay';

    const actions = document.createElement('div');
    actions.className = 'media-card__actions';

    const playButton = document.createElement('button');
    playButton.className = 'media-card__btn';
    playButton.type = 'button';
    playButton.setAttribute('aria-label', 'Play');
    playButton.innerHTML = '<span class="material-symbols-outlined text-sm">play_arrow</span>';
    playButton.onclick = (e) => {
      e.stopPropagation();
      handleClick();
    };
    actions.appendChild(playButton);

    if (variant === 'browse') {
      const listButton = document.createElement('button');
      listButton.className = 'media-card__btn media-card__btn--secondary';
      listButton.type = 'button';
      listButton.setAttribute('aria-label', 'Add to My List');
      listButton.innerHTML = '<span class="material-symbols-outlined text-sm">add</span>';
      listButton.onclick = (e) => {
        e.stopPropagation();
        addToMyList(normalized.tmdb_id, normalized.title, type);
      };
      actions.appendChild(listButton);
    } else if (variant === 'list' || variant === 'continue') {
      const removeButton = document.createElement('button');
      removeButton.className = 'media-card__btn media-card__btn--secondary media-card__btn--danger';
      removeButton.type = 'button';
      removeButton.setAttribute('aria-label', 'Remove');
      removeButton.innerHTML = '<span class="material-symbols-outlined text-sm">close</span>';
      removeButton.onclick = (e) => {
        e.stopPropagation();
        if (variant === 'list') {
          window.StreamCinemaStorage.myListStore.remove(normalized.tmdb_id);
        } else {
          window.StreamCinemaStorage.continueWatchingStore.remove(normalized.id);
        }
        options.onRemoved?.();
      };
      actions.appendChild(removeButton);
    }

    overlay.appendChild(actions);
    posterWrap.appendChild(img);
    posterWrap.appendChild(overlay);

    if (variant === 'continue') {
      const progressEntry = window.StreamCinemaStorage.watchProgressStore.get({
        type,
        tmdbId: normalized.tmdb_id,
        season: normalized.season,
        episode: normalized.episode,
      });
      if (progressEntry && progressEntry.duration) {
        const fraction = Math.min(1, progressEntry.time / progressEntry.duration);
        const track = document.createElement('div');
        track.className = 'media-card__progress';
        const fill = document.createElement('div');
        fill.className = 'media-card__progress-fill';
        fill.style.width = `${Math.round(fraction * 100)}%`;
        track.appendChild(fill);
        posterWrap.appendChild(track);
      }
    }

    const meta = document.createElement('div');
    meta.className = 'flex flex-col gap-1';
    const titleEl = document.createElement('p');
    titleEl.className = 'media-card__title';
    titleEl.textContent = (normalized.title || 'Untitled').substring(0, 25);
    const metaEl = document.createElement('p');
    metaEl.className = 'media-card__meta';
    metaEl.textContent =
      variant === 'continue' && normalized.episodeTitle
        ? normalized.episodeTitle
        : `${type === 'movie' ? 'Movie' : 'TV'}${variant === 'list' ? ' • Saved' : ''}`;
    meta.appendChild(titleEl);
    meta.appendChild(metaEl);

    card.addEventListener('click', handleClick);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    });

    card.appendChild(posterWrap);
    card.appendChild(meta);
    return card;
  }

  window.StreamCinemaCards = { createCard, showNotification, addToMyList };
})();
