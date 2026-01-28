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

// 1. Updated createCard function to match new design
function createCard(item, type) {
  const card = document.createElement('div');
  card.className = 'group flex flex-col gap-3 min-w-[140px] sm:min-w-[160px] md:min-w-[200px] cursor-pointer transition-all duration-300'; // Match StreamCinema card sizes

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

  const imgContainer = document.createElement('div');
  imgContainer.className = 'relative w-full aspect-[2/3] overflow-hidden rounded-xl'; // Maintain aspect ratio

  const img = document.createElement('img');
  img.className = 'w-full h-full object-cover transition-transform duration-500 group-hover:scale-110'; // Smooth zoom effect
  img.alt = item.title || 'Untitled';
  img.loading = 'lazy';
  img.src = 'https://via.placeholder.com/160x240?text=Loading...';

  // Overlay buttons container (appears on hover)
  const overlay = document.createElement('div');
  overlay.className = 'absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4';
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'flex gap-2';
  const playButton = document.createElement('button');
  playButton.className = 'bg-primary rounded-full p-2 text-white';
  playButton.innerHTML = '<span class="material-symbols-outlined text-sm">play_arrow</span>';
  playButton.onclick = (e) => { e.stopPropagation(); handleClick(); }; // Prevent card click propagation
  const listButton = document.createElement('button');
  listButton.className = 'bg-white/20 backdrop-blur-sm rounded-full p-2 text-white';
  listButton.innerHTML = '<span class="material-symbols-outlined text-sm">add</span>';
  buttonGroup.appendChild(playButton);
  buttonGroup.appendChild(listButton);
  overlay.appendChild(buttonGroup);

  imgContainer.appendChild(img);
  imgContainer.appendChild(overlay);

  const titleEl = document.createElement('div');
  titleEl.className = 'flex flex-col';
  const titleText = document.createElement('p');
  titleText.className = 'text-white text-sm md:text-base font-bold leading-none truncate'; // Smaller base font size
  titleText.textContent = (item.title || 'Untitled').substring(0, 30);
  const metaInfo = document.createElement('p');
  metaInfo.className = 'text-white/50 text-xs mt-1';
  // Basic meta-info placeholder - could be enhanced with release date
  metaInfo.textContent = `${type === 'movie' ? 'Movie' : 'TV'} • 2024`; 
  titleEl.appendChild(titleText);
  titleEl.appendChild(metaInfo);

  card.addEventListener('click', handleClick);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  });

  card.appendChild(imgContainer);
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

// 2. Updated displaySearchResults function to work with new layout
function displaySearchResults(results) {
    const searchSection = document.getElementById('search-results-section');
    const container = document.getElementById('search-results');
    if (!searchSection || !container) {
        console.error("Search result containers not found in HTML.");
        return;
    }

    // Show the search section
    searchSection.classList.remove('hidden');
    // Hide other sections
    document.getElementById('movies-section').classList.add('hidden');
    document.getElementById('series-section').classList.add('hidden');
    document.getElementById('anime-section').classList.add('hidden');

    // Clear previous results
    container.innerHTML = '';

    results.slice(0, 12).forEach(item => {
        const card = createCard({
            tmdb_id: item.tmdb_id,
            title: item.title
        }, item.type);
        container.appendChild(card);
    });
}

// 3. Updated search form handling for new inputs
document.getElementById('searchForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = e.target.querySelector('.search-input').value.trim();
  if (!query) return;

  const results = await searchMedia(query);
  displaySearchResults(results);
});

// Handle new search inputs from the header
document.getElementById('searchInputNavbar')?.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const query = e.target.value.trim();
        if (!query) return;

        const results = await searchMedia(query);
        displaySearchResults(results);
    }
});
// Optional: Add search button click handler if needed
document.getElementById('mobileSearchBtn')?.addEventListener('click', async () => {
    const queryInput = document.getElementById('searchInputNavbar');
    const query = queryInput?.value.trim();
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