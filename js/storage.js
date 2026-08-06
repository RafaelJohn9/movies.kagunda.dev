// storage.js — localStorage-backed stores shared by every page.

(function () {
  'use strict';

  const MYLIST_KEY = 'streamcinema_mylist';
  const CONTINUE_WATCHING_KEY = 'streamcinema_continue_watching';
  const CONTINUE_WATCHING_MAX = 20;
  const WATCH_PROGRESS_KEY = 'streamcinema_watch_progress';
  // Below this, resuming isn't worth it (title barely started); above the
  // fraction, treat it as finished rather than parking a stale near-the-end marker.
  const WATCH_PROGRESS_MIN_SECONDS = 15;
  const WATCH_PROGRESS_DONE_FRACTION = 0.95;

  const myListStore = {
    getAll() {
      try {
        const items = localStorage.getItem(MYLIST_KEY);
        return items ? JSON.parse(items) : [];
      } catch (err) {
        console.error('Error reading My List:', err);
        return [];
      }
    },
    add(tmdbId, title, type) {
      try {
        const items = this.getAll();
        const exists = items.some((item) => item.tmdb_id === tmdbId);
        if (!exists) {
          items.push({ tmdb_id: tmdbId, title, type, added: Date.now() });
          localStorage.setItem(MYLIST_KEY, JSON.stringify(items));
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error writing to My List:', err);
        return false;
      }
    },
    remove(tmdbId) {
      try {
        const filtered = this.getAll().filter((item) => item.tmdb_id !== tmdbId);
        localStorage.setItem(MYLIST_KEY, JSON.stringify(filtered));
      } catch (err) {
        console.error('Error removing from My List:', err);
      }
    },
    clear() {
      try {
        localStorage.removeItem(MYLIST_KEY);
      } catch (err) {
        console.error('Error clearing My List:', err);
      }
    },
  };

  // A finite stack of the last N things watched (movies and individual
  // episodes). Most-recently-watched first; re-watching something already in
  // the stack moves it back to the front instead of creating a duplicate.
  const continueWatchingStore = {
    getAll() {
      try {
        const items = localStorage.getItem(CONTINUE_WATCHING_KEY);
        return items ? JSON.parse(items) : [];
      } catch (err) {
        console.error('Error reading Continue Watching:', err);
        return [];
      }
    },
    push(entry) {
      if (!entry || !entry.tmdbId || !entry.type) return;
      try {
        const id = `${entry.type}-${entry.tmdbId}`;
        const items = this.getAll().filter((item) => item.id !== id);
        items.unshift({
          id,
          type: entry.type,
          tmdbId: entry.tmdbId,
          title: entry.title || 'Untitled',
          season: entry.season ?? null,
          episode: entry.episode ?? null,
          episodeTitle: entry.episodeTitle ?? null,
          updatedAt: entry.updatedAt || Date.now(),
        });
        localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(items.slice(0, CONTINUE_WATCHING_MAX)));
      } catch (err) {
        console.error('Error saving Continue Watching entry:', err);
      }
    },
    getById(type, tmdbId) {
      const id = `${type}-${tmdbId}`;
      return this.getAll().find((item) => item.id === id) || null;
    },
    remove(id) {
      try {
        const filtered = this.getAll().filter((item) => item.id !== id);
        localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(filtered));
      } catch (err) {
        console.error('Error removing Continue Watching entry:', err);
      }
    },
    clear() {
      try {
        localStorage.removeItem(CONTINUE_WATCHING_KEY);
      } catch (err) {
        console.error('Error clearing Continue Watching:', err);
      }
    },
  };

  // Playback position within a single title/episode, separate from
  // continueWatchingStore (which tracks *what* was watched, not *how far*).
  // Keyed per-episode for TV so resuming an earlier episode doesn't get
  // clobbered by progress made on a later one.
  const watchProgressStore = {
    _key(target) {
      return target.type === 'movie'
        ? `movie-${target.tmdbId}`
        : `tv-${target.tmdbId}-${target.season}-${target.episode}`;
    },
    getAll() {
      try {
        const items = localStorage.getItem(WATCH_PROGRESS_KEY);
        return items ? JSON.parse(items) : {};
      } catch (err) {
        console.error('Error reading watch progress:', err);
        return {};
      }
    },
    get(target) {
      if (!target || !target.tmdbId) return null;
      return this.getAll()[this._key(target)] || null;
    },
    save(target, time, duration) {
      if (!target || !target.tmdbId) return;
      if (!Number.isFinite(time) || time < WATCH_PROGRESS_MIN_SECONDS) return;
      if (Number.isFinite(duration) && duration > 0 && time / duration >= WATCH_PROGRESS_DONE_FRACTION) {
        this.remove(target);
        return;
      }
      try {
        const all = this.getAll();
        all[this._key(target)] = {
          time,
          duration: Number.isFinite(duration) ? duration : null,
          updatedAt: Date.now(),
        };
        localStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(all));
      } catch (err) {
        console.error('Error saving watch progress:', err);
      }
    },
    remove(target) {
      if (!target || !target.tmdbId) return;
      try {
        const all = this.getAll();
        delete all[this._key(target)];
        localStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(all));
      } catch (err) {
        console.error('Error removing watch progress:', err);
      }
    },
  };

  window.StreamCinemaStorage = { myListStore, continueWatchingStore, watchProgressStore };
})();
