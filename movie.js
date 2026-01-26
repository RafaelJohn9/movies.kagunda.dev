// movie.js
document.addEventListener('DOMContentLoaded', () => {
  const movieId = localStorage.getItem('currentMovieId');
  const movieName = localStorage.getItem('currentMovieName');
  const titleEl = document.getElementById('movie-title');
  const iframe = document.getElementById('movie-player');

  if (!movieId) {
    titleEl.textContent = 'No movie selected';
    return;
  }

  titleEl.textContent = movieName;

  // ✅ Referrer check: embed only if coming from our site
  const allowedReferrer = window.location.origin;
    const embedUrl = `https://vidsrc-embed.ru/embed/movie/${movieId}?ref=${window.location.origin}`;

  iframe.src = embedUrl;
  iframe.referrerPolicy = 'no-referrer-when-downgrade'; // optional security
});
