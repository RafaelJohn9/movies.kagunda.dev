// movie.js
document.addEventListener('DOMContentLoaded', () => {
  const movieId = localStorage.getItem('currentMovieId');
  const movieName = localStorage.getItem('currentMovieName');
  const titleEl = document.getElementById('movie-title');
  const titleLargeEl = document.getElementById('movie-title-large');
  const iframe = document.getElementById('movie-player');
  const loadingOverlay = document.getElementById('loading-overlay');

  if (!movieId) {
    titleEl.textContent = 'NO MOVIE SELECTED';
    titleLargeEl.textContent = 'NO MOVIE SELECTED';
    loadingOverlay.querySelector('.loading-text').textContent = 'ERROR: NO MOVIE SELECTED';
    return;
  }

  // Set movie title
  titleEl.textContent = movieName || 'Untitled Movie';
  titleLargeEl.textContent = movieName || 'Untitled Movie';
  document.title = `${movieName || 'Movie'} - StreamCinematic`;

  // ✅ Referrer check: embed only if coming from our site
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${movieId}?ref=${window.location.origin}`;

  // Handle iframe load event to hide loading overlay
  iframe.addEventListener('load', () => {
    console.log('Movie iframe loaded successfully');
    loadingOverlay.classList.add('hidden');
  });

  // Handle iframe error
  iframe.addEventListener('error', () => {
    console.error('Failed to load movie iframe');
    loadingOverlay.querySelector('.loading-text').textContent = 'FAILED TO LOAD';
  });

  // Prevent popups from iframe
  window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    console.log('Popup/navigation attempt blocked');
    return false;
  });

  // Set iframe source
  iframe.src = embedUrl;
  iframe.referrerPolicy = 'origin';

  // Fallback: hide loading overlay after 5 seconds if load event doesn't fire
  setTimeout(() => {
    if (!loadingOverlay.classList.contains('hidden')) {
      console.log('Loading overlay timeout - hiding overlay');
      loadingOverlay.classList.add('hidden');
    }
  }, 5000);
});