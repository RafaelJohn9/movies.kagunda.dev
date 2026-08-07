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
  const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';
  const CACHE_DURATION = 3600000; // 1 hour
  const PLACEHOLDER_POSTER = 'https://via.placeholder.com/300x450?text=No+Poster';

  const GENRE_IDS = { action: 28, comedy: 35, scifi: 878 };

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

  // TMDB list endpoints (popular/top_rated/discover) already embed poster_path,
  // vote_average, release_date etc. in each result, so cards built from these
  // never need the extra per-item getPoster() round trip.
  async function fetchMovieList(path, limit = 20) {
    const data = await fetchFromTMDB(path);
    const results = data?.results || [];
    return results
      .filter((r) => r.poster_path)
      .slice(0, limit)
      .map((r) => ({
        tmdb_id: r.id,
        title: r.title || r.name || 'Untitled',
        poster_path: r.poster_path,
        release_date: r.release_date || r.first_air_date,
        vote_average: r.vote_average,
      }));
  }

  async function fetchPopularMovies(limit = 20) {
    return fetchMovieList('/movie/popular', limit);
  }

  async function fetchTopRatedMovies(limit = 20) {
    return fetchMovieList('/movie/top_rated', limit);
  }

  async function fetchMoviesByGenre(genreId, limit = 20) {
    return fetchMovieList(`/discover/movie?with_genres=${genreId}&sort_by=popularity.desc`, limit);
  }

  async function fetchTrendingForHero(limit = 5) {
    const data = await fetchFromTMDB('/trending/movie/week');
    const results = data?.results || [];
    return results
      .filter((r) => r.backdrop_path)
      .slice(0, limit)
      .map((r) => ({
        tmdb_id: r.id,
        title: r.title || r.name || 'Untitled',
        overview: r.overview || '',
        backdrop: TMDB_BACKDROP_BASE + r.backdrop_path,
      }));
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
      // Resolve candidates in parallel (each is a handful of TMDB lookups) and
      // take the first `limit` that succeed, instead of resolving one at a
      // time and stopping — much faster for a bigger row.
      const candidates = json.data.slice(0, limit * 2);
      const settled = await Promise.all(
        candidates.map(async (anime) => {
          const tmdb = await resolveTMDBFromAnime(anime);
          if (!tmdb) return null;
          return {
            tmdb_id: tmdb.id,
            title: anime.title,
            type: tmdb.media_type,
            poster_path: tmdb.poster_path,
            vote_average: tmdb.vote_average,
          };
        })
      );
      return settled.filter(Boolean).slice(0, limit);
    } catch (e) {
      console.warn('Anime fetch failed', e);
      return [];
    }
  }

  window.StreamCinemaTMDB = {
    TMDB_API_KEY,
    TMDB_IMG_BASE,
    TMDB_BACKDROP_BASE,
    GENRE_IDS,
    cache,
    fetchFromTMDB,
    getPoster,
    searchMedia,
    tmdbSearch,
    tmdbMultiSearch,
    resolveTMDBFromAnime,
    fetchAnimeFromAnidb,
    fetchPopularMovies,
    fetchTopRatedMovies,
    fetchMoviesByGenre,
    fetchTrendingForHero,
  };
})();
