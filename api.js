// api.js — Robust, clean, and fetches up to 12 items per category with caching

// 🔧 CONFIG (no trailing spaces!)
const VIDSRC_API = 'https://vidsrc-embed.ru';
const TMDB_API_KEY = 'f58480d08cca99974e0bc1f09ae7e581';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w300';
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

// 💾 Simple cache manager
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
  }
};

// 📡 Fetch from TMDB safely with caching
async function fetchFromTMDB(path) {
  const cacheKey = `tmdb_${path}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = `https://api.themoviedb.org/3${path}?api_key=${TMDB_API_KEY}`;
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

// 🖼️ Get poster URL
async function getPoster(tmdbId, type) {
  const data = await fetchFromTMDB(`/${type}/${tmdbId}`);
  if (data?.poster_path) {
    return TMDB_IMG_BASE + data.poster_path;
  }
  return 'https://via.placeholder.com/160x240?text=No+Poster';
}

// 🎬 Fetch latest movies until we have 12 valid items
async function fetchItemsUntilLimit(endpoint, limit = 12) {
  let items = [];
  let page = 1;

  while (items.length < limit && page <= 5) {
    try {
      const res = await fetch(`${VIDSRC_API}${endpoint}/page-${page}.json`);
      if (!res.ok) break;

      const json = await res.json();
      const results = json.result || [];

      if (results.length === 0) break;

      const validItems = results.filter(item => item.tmdb_id);
      items = [...items, ...validItems];

      page++;
    } catch (err) {
      console.warn(`Fetch failed at page ${page}:`, err);
      break;
    }
  }

  return items.slice(0, limit);
}

function createCard(item, type) {
  const card = document.createElement('div');
  card.className = 'media-card';
  card.tabIndex = 0;

 
const handleClick = () => {
    if (type === 'movie') {
        // Store movie info for iframe page
        localStorage.setItem('currentMovieId', item.tmdb_id);
        localStorage.setItem('currentMovieName', item.title || 'Untitled');
        window.location.href = 'movie.html'; // go to movie page with iframe
    } else if (type === 'tv') {
        localStorage.setItem('currentTVShowId', item.tmdb_id);
        localStorage.setItem('currentTVShowName', item.title || 'Untitled');
        window.location.href = 'series.html';
    }
};




  const img = document.createElement('img');
  img.className = 'media-poster';
  img.alt = item.title || 'Untitled';
  img.loading = 'lazy';
  img.src = 'https://via.placeholder.com/160x240?text=Loading...';

  getPoster(item.tmdb_id, type === 'movie' ? 'movie' : 'tv')
    .then(posterUrl => {
      if (posterUrl) img.src = posterUrl;
    })
    .catch(err => {
      console.error('Poster error:', err);
      img.src = 'https://via.placeholder.com/160x240?text=Error';
    });

  const titleEl = document.createElement('div');
  titleEl.className = 'media-title';
  titleEl.textContent = (item.title || 'Untitled').substring(0, 30);

  card.addEventListener('click', handleClick);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  });

  card.appendChild(img);
  card.appendChild(titleEl);
  return card;
}

// Search movies & TV shows by query with caching
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
      .filter(item =>
        (item.media_type === 'movie' || item.media_type === 'tv') &&
        item.id &&
        item.poster_path
      )
      .map(item => ({
        tmdb_id: item.id,
        title: item.title || item.name || 'Untitled',
        type: item.media_type,
        poster_path: item.poster_path,
        release_date: item.release_date || item.first_air_date
      }));
    
    cache.set(cacheKey, results);
    return results;
  } catch (err) {
    console.error('Search failed:', err);
    return [];
  }
}

function createSearchSection() {
  const section = document.createElement('section');
  section.id = 'search-results-section';
  section.className = 'media-section';

  const title = document.createElement('h3');
  title.className = 'subsection-title';
  title.textContent = 'Search Results';

  const container = document.createElement('div');
  container.id = 'search-results';
  container.className = 'media-grid';
  container.role = 'list';

  section.appendChild(title);
  section.appendChild(container);

  const mainContent = document.querySelector('.content');
  if (mainContent) {
    const previousSearchSection = document.getElementById('search-results-section');
    if (previousSearchSection) {
      previousSearchSection.remove();
    }
    const heroSection = document.querySelector('.hero');
    if (heroSection) {
      mainContent.insertBefore(section, heroSection.nextSibling);
    } else {
      mainContent.prepend(section);
    }
  } else {
    document.body.appendChild(section);
  }

  return container;
}

function displaySearchResults(results) {
  let container = document.getElementById('search-results');

  if (!container) {
    container = createSearchSection();
  } else {
    container.innerHTML = '';
  }

  results.slice(0, 12).forEach(item => {
    const card = createCard({
      tmdb_id: item.tmdb_id,
      title: item.title
    }, item.type);
    container.appendChild(card);
  });
}

document.getElementById('searchForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = e.target.querySelector('.search-input').value.trim();
  if (!query) return;

  const results = await searchMedia(query);
  displaySearchResults(results);
});

// 🚀 Initialize app
async function init() {
  const moviesGrid = document.getElementById('movies-grid');
  const seriesGrid = document.getElementById('series-grid');
  const animeGrid = document.getElementById('anime-grid');

  if (!moviesGrid || !seriesGrid || !animeGrid) {
    console.error('DOM containers missing');
    return;
  }

  try {
    const movies = await fetchItemsUntilLimit('/movies/latest', 12);
    const tvShows = await fetchItemsUntilLimit('/tvshows/latest', 12);

    const series = tvShows.slice(0, 6);
    const anime = tvShows.slice(6, 12);

    movies.forEach(m => moviesGrid.appendChild(createCard(m, 'movie')));
    series.forEach(s => seriesGrid.appendChild(createCard(s, 'tv')));
    anime.forEach(a => animeGrid.appendChild(createCard(a, 'tv')));

  } catch (err) {
    console.error('App init failed:', err);
  }
}

// 🧠 Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}