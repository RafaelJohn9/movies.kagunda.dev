 // [Script remains the same - update createCard function card sizes]
const VIDSRC_API = 'https://vidsrc.net';
const TMDB_API_KEY = 'f58480d08cca99974e0bc1f09ae7e581';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w300';
const CACHE_DURATION = 3600000;

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

async function getPoster(tmdbId, type) {
  const data = await fetchFromTMDB(`/${type}/${tmdbId}`);
  if (data?.poster_path) {
    return TMDB_IMG_BASE + data.poster_path;
  }
  return 'https://via.placeholder.com/160x240?text=No+Poster';
}

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
  card.className = 'group flex flex-col gap-2 min-w-[120px] sm:min-w-[140px] md:min-w-[160px] lg:min-w-[200px] cursor-pointer transition-all duration-300';

  const handleClick = () => {
    if (type === 'movie') {
        localStorage.setItem('currentMovieId', item.tmdb_id);
        localStorage.setItem('currentMovieName', item.title || 'Untitled');
        window.location.href = 'movie.html';
    } else if (type === 'tv') {
        localStorage.setItem('currentTVShowId', item.tmdb_id);
        localStorage.setItem('currentTVShowName', item.title || 'Untitled');
        window.location.href = 'series.html';
    }
  };

  const imgContainer = document.createElement('div');
  imgContainer.className = 'relative w-full aspect-[2/3] overflow-hidden rounded-lg sm:rounded-xl';

  const img = document.createElement('img');
  img.className = 'w-full h-full object-cover transition-transform duration-500 group-hover:scale-110';
  img.alt = item.title || 'Untitled';
  img.loading = 'lazy';
  img.src = 'https://via.placeholder.com/160x240?text=Loading...';

  setTimeout(async () => {
    const posterUrl = await getPoster(item.tmdb_id, type);
    img.src = posterUrl;
  }, 100);

  const overlay = document.createElement('div');
  overlay.className = 'absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 sm:p-4';
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'flex gap-2';
  const playButton = document.createElement('button');
  playButton.className = 'bg-primary rounded-full p-1.5 sm:p-2 text-white';
  playButton.innerHTML = '<span class="material-symbols-outlined text-xs sm:text-sm">play_arrow</span>';
  playButton.onclick = (e) => { e.stopPropagation(); handleClick(); };
  const listButton = document.createElement('button');
  listButton.className = 'bg-white/20 backdrop-blur-sm rounded-full p-1.5 sm:p-2 text-white';
  listButton.innerHTML = '<span class="material-symbols-outlined text-xs sm:text-sm">add</span>';
  buttonGroup.appendChild(playButton);
  buttonGroup.appendChild(listButton);
  overlay.appendChild(buttonGroup);

  imgContainer.appendChild(img);
  imgContainer.appendChild(overlay);

  const titleEl = document.createElement('div');
  titleEl.className = 'flex flex-col gap-1';
  const titleText = document.createElement('p');
  titleText.className = 'text-white text-xs sm:text-sm font-bold leading-none truncate';
  titleText.textContent = (item.title || 'Untitled').substring(0, 25);
  const metaInfo = document.createElement('p');
  metaInfo.className = 'text-white/50 text-[10px] sm:text-xs';
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

function displaySearchResults(results) {
    const searchSection = document.getElementById('search-results-section');
    const container = document.getElementById('search-results');
    if (!searchSection || !container) {
        console.error("Search result containers not found in HTML.");
        return;
    }

    searchSection.classList.remove('hidden');
    document.getElementById('movies-section').classList.add('hidden');
    document.getElementById('series-section').classList.add('hidden');
    document.getElementById('anime-section').classList.add('hidden');

    container.innerHTML = '';
    container.appendChild(document.createElement('div')).className = 'flex items-stretch gap-3 sm:gap-4 md:gap-6';

    results.slice(0, 12).forEach(item => {
        const card = createCard({
            tmdb_id: item.tmdb_id,
            title: item.title
        }, item.type);
        
        const parentDiv = container.firstChild;
        parentDiv.appendChild(card);
    });
}

document.getElementById('searchForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = e.target.querySelector('input').value.trim();
  if (!query) return;

  const results = await searchMedia(query);
  displaySearchResults(results);
});

document.getElementById('searchInputNavbar')?.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const query = e.target.value.trim();
        if (!query) return;

        const results = await searchMedia(query);
        displaySearchResults(results);
    }
});

document.getElementById('mobileSearchBtn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const searchForm = document.getElementById('searchForm');
    const queryInput = document.getElementById('searchInputNavbar');
    
    if (!searchForm.classList.contains('mobile-visible')) {
        searchForm.classList.add('mobile-visible');
        queryInput?.focus();
    } else {
        const query = queryInput?.value.trim();
        if (query) {
            const results = await searchMedia(query);
            displaySearchResults(results);
        }
        searchForm.classList.remove('mobile-visible');
    }
});

document.addEventListener('click', (e) => {
    const searchForm = document.getElementById('searchForm');
    const mobileSearchBtn = document.getElementById('mobileSearchBtn');
    if (!searchForm.contains(e.target) && !mobileSearchBtn.contains(e.target)) {
        searchForm.classList.remove('mobile-visible');
    }
});

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

    moviesGrid.innerHTML = '<div class="flex items-stretch gap-3 sm:gap-4 md:gap-6"></div>';
    const moviesParent = moviesGrid.firstChild;
    movies.forEach(m => moviesParent.appendChild(createCard(m, 'movie')));

    seriesGrid.innerHTML = '<div class="flex items-stretch gap-3 sm:gap-4 md:gap-6"></div>';
    const seriesParent = seriesGrid.firstChild;
    series.forEach(s => seriesParent.appendChild(createCard(s, 'tv')));

    animeGrid.innerHTML = '<div class="flex items-stretch gap-3 sm:gap-4 md:gap-6"></div>';
    const animeParent = animeGrid.firstChild;
    anime.forEach(a => animeParent.appendChild(createCard(a, 'tv')));

  } catch (err) {
    console.error('App init failed:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
