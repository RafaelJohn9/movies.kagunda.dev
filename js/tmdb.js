// tmdb.js — single consolidated TMDB client, replacing the ~5 copies that used
// to live in api.js, index.html, mylist.html, and series.js.
//
// This is TMDB's public v3 API key, meant to be used client-side (TMDB's own
// docs embed it directly in browser examples) — consolidating it here doesn't
// change its exposure, it was already hardcoded in four separate files.

(function () {
  'use strict';

  const TMDB_API_KEY = 'f58480d08cca99974e0bc1f09ae7e581';
  const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w300';
  const CACHE_DURATION = 3600000; // 1 hour
  const PLACEHOLDER_POSTER = 'https://via.placeholder.com/300x450?text=No+Poster';

  const cache = {
    data: {},
    get(key) {
      const item = this.data[key];
      if (!item) return null;
      if (Date.now() - item.timestamp > CACHE_DURATION) {
        delete this.data[key];
        return null;
      }
      return item.value;
    },
    set(key, value) {
      this.data[key] = { value, timestamp: Date.now() };
    },
    clear() {
      this.data = {};
    },
  };

  async function fetchFromTMDB(path) {
    const cacheKey = `tmdb_${path}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const separator = path.includes('?') ? '&' : '?';
    const url = `https://api.themoviedb.org/3${path}${separator}api_key=${TMDB_API_KEY}`;
    try {
      const res = await fetch(url);
      const data = res.ok ? await res.json() : null;
      if (data) cache.set(cacheKey, data);
      return data;
    } catch (err) {
      console.warn('TMDB fetch failed:', err);
      return null;
    }
  }

  async function getPoster(tmdbId, type) {
    const data = await fetchFromTMDB(`/${type}/${tmdbId}`);
    if (data?.poster_path) {
      return TMDB_IMG_BASE + data.poster_path;
    }
    return PLACEHOLDER_POSTER;
  }

  async function searchMedia(query) {
    if (!query.trim()) return [];
    const cacheKey = `search_${query.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.themoviedb.org/3/search/multi?query=${encodedQuery}&api_key=${TMDB_API_KEY}&include_adult=false`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      const results = data.results
        .filter((item) => (item.media_type === 'movie' || item.media_type === 'tv') && item.id && item.poster_path)
        .map((item) => ({
          tmdb_id: item.id,
          title: item.title || item.name || 'Untitled',
          type: item.media_type,
          poster_path: item.poster_path,
          release_date: item.release_date || item.first_air_date,
        }));
      cache.set(cacheKey, results);
      return results;
    } catch (err) {
      console.error('Search failed:', err);
      return [];
    }
  }

  async function tmdbSearch(title, year, type) {
    const media = type === 'Movie' ? 'movie' : 'tv';
    const q = encodeURIComponent(title);
    const y = year ? `&year=${year}` : '';
    const url = `https://api.themoviedb.org/3/search/${media}?query=${q}${y}&api_key=${TMDB_API_KEY}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      return json.results?.[0] || null;
    } catch {
      return null;
    }
  }

  async function tmdbMultiSearch(title) {
    const q = encodeURIComponent(title);
    const url = `https://api.themoviedb.org/3/search/multi?query=${q}&api_key=${TMDB_API_KEY}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      return json.results?.find((r) => r.media_type === 'movie' || r.media_type === 'tv') || null;
    } catch {
      return null;
    }
  }

  async function resolveTMDBFromAnime(anime) {
    const titles = [anime.title, anime.title_english, anime.title_japanese, ...(anime.titles?.map((t) => t.title) || [])].filter(Boolean);
    const cleaned = titles.map((t) => t.replace(/[[\]():\-–!]/g, '').trim());
    const searchVariants = [...new Set([...titles, ...cleaned])];
    for (const title of searchVariants) {
      let res = await tmdbSearch(title, anime.year, anime.type);
      if (res) return res;
      res = await tmdbSearch(title, null, anime.type);
      if (res) return res;
      res = await tmdbMultiSearch(title);
      if (res) return res;
    }
    return null;
  }

  async function fetchAnimeFromAnidb(limit = 12) {
    try {
      const res = await fetch('https://api.jikan.moe/v4/top/anime');
      const json = await res.json();
      const resolved = [];
      for (const anime of json.data) {
        if (resolved.length >= limit) break;
        const tmdb = await resolveTMDBFromAnime(anime);
        if (tmdb) {
          resolved.push({ tmdb_id: tmdb.id, title: anime.title, type: tmdb.media_type });
        }
      }
      return resolved;
    } catch (e) {
      console.warn('Anime fetch failed', e);
      return [];
    }
  }

  window.StreamCinemaTMDB = {
    TMDB_API_KEY,
    TMDB_IMG_BASE,
    cache,
    fetchFromTMDB,
    getPoster,
    searchMedia,
    tmdbSearch,
    tmdbMultiSearch,
    resolveTMDBFromAnime,
    fetchAnimeFromAnidb,
  };
})();
