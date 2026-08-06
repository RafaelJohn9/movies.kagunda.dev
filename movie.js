// movie.js — movie detail/player page logic.
// Popup blocking now lives in popup-blocker.js; provider fallback/switching
// lives in providers.js + player-loader.js. This file just wires them up.

document.addEventListener('DOMContentLoaded', () => {
  window.StreamCinemaLayout.renderHeader('movies');
  window.StreamCinemaLayout.renderFooter();

  // The URL is the source of truth (so a link to this page is shareable);
  // localStorage is only a fallback for in-app navigation and gets kept in
  // sync with whatever the URL resolves to.
  const params = new URLSearchParams(window.location.search);
  const movieId = params.get('id') || localStorage.getItem('currentMovieId');
  const movieName = params.get('title') || localStorage.getItem('currentMovieName');
  const titleLargeEl = document.getElementById('movie-title-large');
  const iframe = document.getElementById('movie-player');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');
  const sourceSelect = document.getElementById('source-select');
  const sourceStatus = document.getElementById('source-status');
  const shareLinkBtn = document.getElementById('share-link-btn');

  if (!movieId) {
    document.title = 'No Movie Selected';
    titleLargeEl.textContent = 'No Movie Selected';
    loadingText.textContent = 'ERROR: NO MOVIE SELECTED';
    return;
  }

  localStorage.setItem('currentMovieId', movieId);
  localStorage.setItem('currentMovieName', movieName || 'Untitled Movie');

  const shareUrl = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(movieId)}&title=${encodeURIComponent(movieName || 'Untitled Movie')}`;
  if (window.location.href !== shareUrl) {
    window.history.replaceState(null, '', shareUrl);
  }

  titleLargeEl.textContent = movieName || 'Untitled Movie';
  document.title = `${movieName || 'Movie'} - StreamCinema`;

  const { PROVIDERS, getProvider } = window.StreamCinemaProviders;
  const { loadPlayer, getPreferredProvider, setPreferredProvider } = window.StreamCinemaPlayer;
  const { continueWatchingStore } = window.StreamCinemaStorage;
  const { watch: watchProgress, getResumeSeconds } = window.StreamCinemaProgress;

  shareLinkBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      window.StreamCinemaCards.showNotification('Link copied to clipboard');
    } catch (err) {
      console.error('Could not copy link:', err);
      window.StreamCinemaCards.showNotification('Could not copy link', 'info');
    }
  });

  PROVIDERS.forEach((provider) => {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = provider.name;
    sourceSelect.appendChild(option);
  });
  sourceSelect.value = getPreferredProvider();

  let activeLoad = null;
  let activeProgressWatch = null;

  function startPlayback() {
    activeLoad?.cancel();
    activeProgressWatch?.stop();
    loadingOverlay.classList.remove('is-hidden');
    loadingText.textContent = 'Loading Film';

    const target = { type: 'movie', tmdbId: movieId, resumeAt: getResumeSeconds({ type: 'movie', tmdbId: movieId }) };

    activeLoad = loadPlayer(
      iframe,
      target,
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
          activeProgressWatch = watchProgress(iframe, { type: 'movie', tmdbId: movieId });
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
