// movie.js — movie detail/player page logic.
// Popup blocking now lives in popup-blocker.js; provider fallback/switching
// lives in providers.js + player-loader.js. This file just wires them up.

document.addEventListener('DOMContentLoaded', () => {
  window.StreamCinemaLayout.renderHeader('movies');
  window.StreamCinemaLayout.renderFooter();

  const movieId = localStorage.getItem('currentMovieId');
  const movieName = localStorage.getItem('currentMovieName');
  const titleLargeEl = document.getElementById('movie-title-large');
  const iframe = document.getElementById('movie-player');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');
  const sourceSelect = document.getElementById('source-select');
  const sourceStatus = document.getElementById('source-status');

  if (!movieId) {
    document.title = 'No Movie Selected';
    titleLargeEl.textContent = 'No Movie Selected';
    loadingText.textContent = 'ERROR: NO MOVIE SELECTED';
    return;
  }

  titleLargeEl.textContent = movieName || 'Untitled Movie';
  document.title = `${movieName || 'Movie'} - StreamCinema`;

  const { PROVIDERS, getProvider } = window.StreamCinemaProviders;
  const { loadPlayer, getPreferredProvider, setPreferredProvider } = window.StreamCinemaPlayer;
  const { continueWatchingStore } = window.StreamCinemaStorage;

  PROVIDERS.forEach((provider) => {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = provider.name;
    sourceSelect.appendChild(option);
  });
  sourceSelect.value = getPreferredProvider();

  let activeLoad = null;

  function startPlayback() {
    activeLoad?.cancel();
    loadingOverlay.classList.remove('is-hidden');
    loadingText.textContent = 'Loading Film';

    activeLoad = loadPlayer(
      iframe,
      { type: 'movie', tmdbId: movieId },
      {
        onAttempt(providerId) {
          sourceSelect.value = providerId;
          sourceStatus.textContent = `Trying ${getProvider(providerId).name}...`;
        },
        onResolved(providerId) {
          loadingOverlay.classList.add('is-hidden');
          sourceSelect.value = providerId;
          sourceStatus.textContent = `Playing via ${getProvider(providerId).name}`;
          continueWatchingStore.push({ type: 'movie', tmdbId: movieId, title: movieName });
        },
        onAllFailed() {
          loadingText.textContent = 'ALL SOURCES FAILED — TRY ANOTHER';
          sourceStatus.textContent = 'No source could load this title.';
        },
      }
    );
  }

  sourceSelect.addEventListener('change', () => {
    setPreferredProvider(sourceSelect.value);
    startPlayback();
  });

  startPlayback();
});
