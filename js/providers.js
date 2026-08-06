// providers.js — registry of streaming embed sources. Each provider is a pair
// of URL builders (movie / tv) keyed off a TMDB id, no API key required.
//
// TV episode URL patterns for videasy, vidify, and peachify are inferred from
// the `/tv/{id}/{season}/{episode}` convention shared by vidsrc/vidcore/vidgod
// (their own docs were behind a verification wall / 403 when checked) — a
// wrong pattern here just means player-loader.js falls through to the next
// provider, so this is a safe default rather than a hard requirement.
//
// `resumeParam` is the query param each provider reads to start playback at
// a given second. Confirmed for vidcore (`startAt`) and the vidsrc/vidapi
// family (`resumeAt`); the rest are inferred from that same `resumeAt`
// convention. Same reasoning as above: an unrecognized param is just
// ignored by the provider, so a wrong guess only costs the resume feature,
// not playback itself.

(function () {
  'use strict';

  const PROVIDERS = [
    {
      id: 'vidsrc',
      name: 'VidSrc',
      movie: (tmdbId) => `https://vidsrc-embed.ru/embed/movie/${tmdbId}?ref=${encodeURIComponent(window.location.origin)}`,
      tv: (tmdbId, season, episode) => `https://vidsrc-embed.ru/embed/tv/${tmdbId}/${season}/${episode}`,
    },
    {
      id: 'vidcore',
      name: 'VidCore',
      movie: (tmdbId) => `https://www.vidcore.org/embed/movie/${tmdbId}?autoPlay=true`,
      tv: (tmdbId, season, episode) => `https://www.vidcore.org/embed/tv/${tmdbId}/${season}/${episode}?autoPlay=true`,
      resumeParam: 'startAt',
    },
    {
      id: 'videasy',
      name: 'Videasy',
      movie: (tmdbId) => `https://player.videasy.net/movie/${tmdbId}`,
      tv: (tmdbId, season, episode) => `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`,
    },
    {
      id: 'vidgod',
      name: 'VidGod',
      movie: (tmdbId) => `https://vidgod.net/movie/${tmdbId}`,
      tv: (tmdbId, season, episode) => `https://vidgod.net/tv/${tmdbId}/${season}/${episode}`,
    },
    {
      id: 'vidify',
      name: 'Vidify',
      movie: (tmdbId) => `https://player.vidify.top/embed/movie/${tmdbId}`,
      tv: (tmdbId, season, episode) => `https://player.vidify.top/embed/tv/${tmdbId}/${season}/${episode}`,
    },
    {
      id: 'peachify',
      name: 'Peachify',
      movie: (tmdbId) => `https://peachify.top/embed/movie/${tmdbId}`,
      tv: (tmdbId, season, episode) => `https://peachify.top/embed/tv/${tmdbId}/${season}/${episode}`,
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
