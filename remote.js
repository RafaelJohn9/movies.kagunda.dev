// api.js
const API_BASE = 'https://vidsrc-embed.ru';

async function fetchLatestMovies(page = 1) {
  const res = await fetch(`${API_BASE}/movies/latest/page-${page}.json`);
  const data = await res.json();
  return data.result || [];
}

async function fetchLatestTV(page = 1) {
  const res = await fetch(`${API_BASE}/tvshows/latest/page-${page}.json`);
  const data = await res.json();
  return data.result || [];
}

function createCard(item, type) {
  const card = document.createElement('div');
  card.className = 'media-card';
  card.tabIndex = 0;

  const img = document.createElement('img');
  img.className = 'media-poster';
  img.alt = item.title || item.name;
  img.src = item.poster || 'https://via.placeholder.com/160x240?text=No+Poster';
  img.loading = 'lazy';

  const titleEl = document.createElement('div');
  titleEl.className = 'media-title';
  titleEl.textContent = (item.title || item.name).substring(0, 30);

  // Build embed URL
  const id = item.imdb_id || item.tmdb_id;
  if (id) {
    const embedUrl = type === 'movie'
      ? `${API_BASE}/embed/movie/${id}`
      : `${API_BASE}/embed/tv/${id}`;
    
    card.addEventListener('click', () => {
      window.open(embedUrl, '_blank'); // or load in modal
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.open(embedUrl, '_blank');
      }
    });
  }

  card.appendChild(img);
  card.appendChild(titleEl);
  return card;
}

async function init() {
  const moviesGrid = document.getElementById('movies-grid');
  const tvGrid = document.getElementById('tv-grid');

  try {
    const movies = await fetchLatestMovies(1);
    const tvShows = await fetchLatestTV(1);

    movies.slice(0, 12).forEach(movie => {
      moviesGrid.appendChild(createCard(movie, 'movie'));
    });

    tvShows.slice(0, 12).forEach(show => {
      tvGrid.appendChild(createCard(show, 'tv'));
    });
  } catch (err) {
    console.error('Failed to load content:', err);
  }
}

init();