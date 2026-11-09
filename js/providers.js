// providers.js — registry of streaming embed sources. Each provider is a pair
// of URL builders (movie / tv) keyed off a TMDB id, no API key required.
//
// Every host here was verified to render a working player inside an iframe
// (headless Chrome, movie + TV) on 2026-11-09. Dropped on that date because
// they were dead: vidsrc-embed.ru (NXDOMAIN), vidgod.net (NXDOMAIN),
// vidify.top (origin down), peachify.top (Cloudflare 523), and videasy
// (player.videasy.net 301s to player.videasy.to, which serves an invalid
// TLS certificate, so browsers refuse the frame).
//
// `resumeParam` is the query param each provider reads to start playback at
// a given second. Documented for vidlink and vidcore (both `startAt`); the
// others have no documented resume param, so buildEmbedUrl falls back to a
// generic `resumeAt` that they simply ignore — a wrong guess only costs the
// resume feature, not playback itself.
//
// VidLink and VidCore also postMessage `PLAYER_EVENT` progress updates to the
// parent, which watch-progress.js consumes, so they're the only two providers
// where "continue watching" is fully round-tripped. VidLink goes first for
// that reason.

(function () {
  'use strict';

  const PROVIDERS = [
    {
      id: 'vidlink',
      name: 'VidLink',
      movie: (tmdbId) => `https://vidlink.pro/movie/${tmdbId}?autoplay=true`,
      tv: (tmdbId, season, episode) => `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?autoplay=true&nextbutton=true`,
      resumeParam: 'startAt',
    },
    {
      id: 'vidsrc',
      name: 'VidSrc',
      // vidsrc.me is the long-lived alias; it 301s to whatever the current
      // player domain is (vidsrc.sh at time of writing).
      movie: (tmdbId) => `https://vidsrc.me/embed/movie/${tmdbId}`,
      tv: (tmdbId, season, episode) => `https://vidsrc.me/embed/tv/${tmdbId}/${season}/${episode}`,
    },
    {
      id: 'vidcore',
      name: 'VidCore',
      movie: (tmdbId) => `https://www.vidcore.org/embed/movie/${tmdbId}?autoPlay=true`,
      tv: (tmdbId, season, episode) => `https://www.vidcore.org/embed/tv/${tmdbId}/${season}/${episode}?autoPlay=true`,
      resumeParam: 'startAt',
    },
    {
      id: 'vidrock',
      name: 'VidRock',
      movie: (tmdbId) => `https://vidrock.net/movie/${tmdbId}`,
      tv: (tmdbId, season, episode) => `https://vidrock.net/tv/${tmdbId}/${season}/${episode}`,
    },
    {
      id: '2embed',
      name: '2Embed',
      // Note the non-standard TV path: `embedtv/{id}&s={s}&e={e}` (that's a
      // literal `&` in the path, not a query string).
      movie: (tmdbId) => `https://www.2embed.cc/embed/${tmdbId}`,
      tv: (tmdbId, season, episode) => `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`,
    },
  ];

  function getProvider(id) {
    return PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];
  }

  function buildEmbedUrl(provider, target) {
    const base = target.type === 'movie'
      ? provider.movie(target.tmdbId)
      : provider.tv(target.tmdbId, target.season, target.episode);

    if (!target.resumeAt || target.resumeAt < 1) return base;

    const url = new URL(base);
    url.searchParams.set(provider.resumeParam || 'resumeAt', Math.floor(target.resumeAt));
    return url.toString();
  }

  window.StreamCinemaProviders = { PROVIDERS, getProvider, buildEmbedUrl };
})();
