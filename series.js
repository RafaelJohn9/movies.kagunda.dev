// series.js — series detail page: season/episode selection + player.
// Popup blocking lives in popup-blocker.js; TMDB calls in tmdb.js; provider
// fallback/switching in providers.js + player-loader.js. Playback resume
// (actual elapsed time, sourced from the provider's postMessage events) is
// in watch-progress.js; "what was watched" is the separate Continue
// Watching stack in storage.js.

const { fetchFromTMDB, TMDB_IMG_BASE } = window.StreamCinemaTMDB;
const { continueWatchingStore } = window.StreamCinemaStorage;
const { PROVIDERS, getProvider } = window.StreamCinemaProviders;
const { loadPlayer, getPreferredProvider, setPreferredProvider } = window.StreamCinemaPlayer;
const { watch: watchProgress, getResumeSeconds } = window.StreamCinemaProgress;

// DOM Elements
const playerContainer = document.getElementById('playerContainer');
const playerFrame = document.getElementById('playerFrame');
const showTitleElement = document.getElementById('showTitle');
const showTitleLargeElement = document.getElementById('showTitleLarge');
const loadingPlaceholder = document.getElementById('loadingPlaceholder');
const loadingText = document.getElementById('loadingText');
const loadingPlaceholderStandalone = document.getElementById('loadingPlaceholderStandalone');
const configDisplay = document.getElementById('configDisplay');
const episodeTitleElement = document.getElementById('episodeTitle');
const currentSeasonElement = document.getElementById('currentSeason');
const currentEpisodeElement = document.getElementById('currentEpisode');
const prevEpisodeBtn = document.getElementById('prevEpisodeBtn');
const nextEpisodeBtn = document.getElementById('nextEpisodeBtn');
const changeEpisodeBtn = document.getElementById('changeEpisodeBtn');
const selectionArea = document.getElementById('selectionArea');
const seasonTabsEl = document.getElementById('seasonTabs');
const episodeListEl = document.getElementById('episodeList');
const backToPlayerBtn = document.getElementById('backToPlayerBtn');
const sourceSelect = document.getElementById('source-select');
const sourceStatus = document.getElementById('source-status');
const shareLinkBtn = document.getElementById('share-link-btn');

// The URL is the source of truth (so a link to this page is shareable);
// localStorage is only a fallback for in-app navigation and gets kept in
// sync with whatever the URL resolves to.
const urlParams = new URLSearchParams(window.location.search);
const currentShowId = urlParams.get('id') || localStorage.getItem('currentTVShowId');
const currentShowName = urlParams.get('title') || localStorage.getItem('currentTVShowName');

// A shared link or a Continue Watching card can specify season/episode so
// the show resumes at that episode instead of always S1E1.
const resumeSeason = urlParams.get('season') || localStorage.getItem('resumeTVShowSeason');
const resumeEpisode = urlParams.get('episode') || localStorage.getItem('resumeTVShowEpisode');
localStorage.removeItem('resumeTVShowSeason');
localStorage.removeItem('resumeTVShowEpisode');

if (currentShowId) {
  localStorage.setItem('currentTVShowId', currentShowId);
  localStorage.setItem('currentTVShowName', currentShowName || 'Untitled');
}

function syncShareUrl(seasonNum, episodeNum) {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set('id', currentShowId);
  url.searchParams.set('title', currentShowName || 'Untitled');
  if (seasonNum != null) url.searchParams.set('season', seasonNum);
  if (episodeNum != null) url.searchParams.set('episode', episodeNum);
  if (window.location.href !== url.toString()) {
    window.history.replaceState(null, '', url.toString());
  }
}

shareLinkBtn?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    window.StreamCinemaCards.showNotification('Link copied to clipboard');
  } catch (err) {
    console.error('Could not copy link:', err);
    window.StreamCinemaCards.showNotification('Could not copy link', 'info');
  }
});

// State
let seasonsData = [];
let episodesForCurrentSeason = [];
let currentSeasonNumber = null;
let currentEpisodeNumber = null;
let activeLoad = null;
let activeProgressWatch = null;

// Separate from currentSeasonNumber: which season's episodes are shown in the
// "Episodes" browser panel. Browsing seasons there shouldn't change what's
// playing until the user actually clicks an episode.
let browseSeasonNumber = null;
let browseEpisodes = [];

document.addEventListener('DOMContentLoaded', () => {
  window.StreamCinemaLayout.renderHeader('series');
  window.StreamCinemaLayout.renderFooter();

  PROVIDERS.forEach((provider) => {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = provider.name;
    sourceSelect.appendChild(option);
  });
  sourceSelect.value = getPreferredProvider();
  sourceSelect.addEventListener('change', () => {
    setPreferredProvider(sourceSelect.value);
    if (currentSeasonNumber != null && episodesForCurrentSeason.length) {
      const episode = episodesForCurrentSeason.find((ep) => ep.episode_number === Number(currentEpisodeElement.textContent));
      if (episode) loadEpisodePlayer(episode, currentSeasonNumber);
    }
  });

  init();
});

async function showSelectionArea() {
  selectionArea.classList.remove('hidden');
  setTimeout(() => selectionArea.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  await selectBrowseSeason(currentSeasonNumber);
}

function hideSelectionArea() {
  selectionArea.classList.add('hidden');
}

function disableControls() {
  prevEpisodeBtn.disabled = true;
  nextEpisodeBtn.disabled = true;
  changeEpisodeBtn.disabled = true;
}

function enableControls() {
  changeEpisodeBtn.disabled = false;
  updateNavButtons();
}

function getSortedSeasons() {
  return [...seasonsData].sort((a, b) => a.season_number - b.season_number);
}

function updateNavButtons() {
  const sortedSeasons = getSortedSeasons();
  const sortedEpisodes = [...episodesForCurrentSeason].sort((a, b) => a.episode_number - b.episode_number);
  const seasonIdx = sortedSeasons.findIndex((s) => s.season_number === currentSeasonNumber);
  const episodeIdx = sortedEpisodes.findIndex((ep) => ep.episode_number === currentEpisodeNumber);

  prevEpisodeBtn.disabled = seasonIdx <= 0 && episodeIdx <= 0;
  nextEpisodeBtn.disabled = seasonIdx === sortedSeasons.length - 1 && episodeIdx === sortedEpisodes.length - 1;
}

async function selectBrowseSeason(seasonNumber) {
  browseSeasonNumber = seasonNumber;
  renderSeasonTabs();
  episodeListEl.innerHTML = '<div class="episode-list__empty">Loading episodes...</div>';

  browseEpisodes =
    seasonNumber === currentSeasonNumber
      ? episodesForCurrentSeason
      : await fetchEpisodesForSeason(currentShowId, seasonNumber);

  renderEpisodeList();
}

function renderSeasonTabs() {
  seasonTabsEl.innerHTML = '';
  getSortedSeasons().forEach((season) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'season-tab' + (season.season_number === browseSeasonNumber ? ' is-active' : '');
    tab.textContent = `Season ${season.season_number}`;
    tab.addEventListener('click', () => {
      if (season.season_number !== browseSeasonNumber) selectBrowseSeason(season.season_number);
    });
    seasonTabsEl.appendChild(tab);
  });
}

function renderEpisodeList() {
  episodeListEl.innerHTML = '';

  if (browseEpisodes.length === 0) {
    episodeListEl.innerHTML = '<div class="episode-list__empty">No episodes found for this season.</div>';
    return;
  }

  const sorted = [...browseEpisodes].sort((a, b) => a.episode_number - b.episode_number);
  sorted.forEach((episode) => {
    const isCurrent = browseSeasonNumber === currentSeasonNumber && episode.episode_number === currentEpisodeNumber;

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'episode-row' + (isCurrent ? ' is-current' : '');

    const thumb = document.createElement('div');
    thumb.className = 'episode-row__thumb';
    if (episode.still_path) {
      const img = document.createElement('img');
      img.src = TMDB_IMG_BASE + episode.still_path;
      img.alt = '';
      img.loading = 'lazy';
      thumb.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'episode-row__body';

    const titleLine = document.createElement('div');
    titleLine.className = 'episode-row__title-line';
    const title = document.createElement('span');
    title.className = 'episode-row__title';
    title.textContent = episode.name || `Episode ${episode.episode_number}`;
    titleLine.appendChild(title);
    if (isCurrent) {
      const badge = document.createElement('span');
      badge.className = 'episode-row__playing-badge';
      badge.textContent = 'Playing';
      titleLine.appendChild(badge);
    }

    const overview = document.createElement('div');
    overview.className = 'episode-row__overview';
    overview.textContent = episode.overview || '';

    body.appendChild(titleLine);
    body.appendChild(overview);

    const number = document.createElement('div');
    number.className = 'episode-row__number';
    number.textContent = episode.episode_number;

    row.appendChild(number);
    row.appendChild(thumb);
    row.appendChild(body);

    row.addEventListener('click', () => {
      episodesForCurrentSeason = browseEpisodes;
      loadEpisodePlayer(episode, browseSeasonNumber);
      hideSelectionArea();
    });

    episodeListEl.appendChild(row);
  });
}

async function init() {
  if (!currentShowId || !currentShowName) {
    alert('No show selected. Please select a show from the main page.');
    window.location.href = 'index.html';
    return;
  }

  showTitleElement.textContent = currentShowName;
  showTitleLargeElement.textContent = currentShowName;
  document.title = `${currentShowName} - StreamCinema`;

  disableControls();
  await fetchAndPopulateSeasons(currentShowId);
  await loadInitialEpisode();
}

async function loadInitialEpisode() {
  if (seasonsData.length === 0) {
    loadingPlaceholderStandalone.textContent = 'No seasons found for this show.';
    return;
  }

  const sortedSeasons = getSortedSeasons();
  const requestedSeason = resumeSeason ? Number(resumeSeason) : sortedSeasons[0].season_number;
  const seasonExists = sortedSeasons.some((s) => s.season_number === requestedSeason);
  const seasonNumber = seasonExists ? requestedSeason : sortedSeasons[0].season_number;

  episodesForCurrentSeason = await fetchEpisodesForSeason(currentShowId, seasonNumber);
  enableControls();

  if (episodesForCurrentSeason.length === 0) {
    loadingPlaceholderStandalone.textContent = 'No episodes found for this season.';
    return;
  }

  const sortedEpisodes = [...episodesForCurrentSeason].sort((a, b) => a.episode_number - b.episode_number);
  const requestedEpisode = resumeEpisode ? Number(resumeEpisode) : sortedEpisodes[0].episode_number;
  const episode = sortedEpisodes.find((ep) => ep.episode_number === requestedEpisode) || sortedEpisodes[0];

  loadingPlaceholderStandalone.classList.add('hidden');
  loadEpisodePlayer(episode, seasonNumber);
}

async function fetchAndPopulateSeasons(showId) {
  const showDetails = await fetchFromTMDB(`/tv/${showId}?append_to_response=seasons`);
  if (!showDetails) {
    loadingPlaceholderStandalone.textContent = 'Failed to load seasons.';
    return;
  }

  seasonsData = (showDetails.seasons || []).filter((season) => season.season_number > 0);
}

async function fetchEpisodesForSeason(showId, seasonNumber) {
  const seasonDetails = await fetchFromTMDB(`/tv/${showId}/season/${seasonNumber}`);
  return seasonDetails?.episodes || [];
}

async function goToAdjacentEpisode(direction) {
  const sortedEpisodes = [...episodesForCurrentSeason].sort((a, b) => a.episode_number - b.episode_number);
  const episodeIdx = sortedEpisodes.findIndex((ep) => ep.episode_number === currentEpisodeNumber);
  const targetIdx = episodeIdx + direction;

  if (episodeIdx !== -1 && targetIdx >= 0 && targetIdx < sortedEpisodes.length) {
    loadEpisodePlayer(sortedEpisodes[targetIdx], currentSeasonNumber);
    return;
  }

  const sortedSeasons = getSortedSeasons();
  const seasonIdx = sortedSeasons.findIndex((s) => s.season_number === currentSeasonNumber);
  const targetSeasonIdx = seasonIdx + direction;
  if (targetSeasonIdx < 0 || targetSeasonIdx >= sortedSeasons.length) return;

  const targetSeason = sortedSeasons[targetSeasonIdx];
  disableControls();
  const episodes = await fetchEpisodesForSeason(currentShowId, targetSeason.season_number);
  enableControls();
  if (episodes.length === 0) return;

  const sortedTargetEpisodes = [...episodes].sort((a, b) => a.episode_number - b.episode_number);
  const targetEpisode = direction > 0 ? sortedTargetEpisodes[0] : sortedTargetEpisodes[sortedTargetEpisodes.length - 1];

  episodesForCurrentSeason = episodes;
  loadEpisodePlayer(targetEpisode, targetSeason.season_number);
}

function loadEpisodePlayer(episode, seasonNum) {
  if (!episode) return;

  currentSeasonNumber = seasonNum;
  activeLoad?.cancel();
  activeProgressWatch?.stop();

  playerContainer.classList.remove('hidden');
  configDisplay.classList.add('hidden');
  loadingPlaceholder.classList.remove('is-hidden');
  loadingText.textContent = 'Loading Episode';

  const target = {
    type: 'tv',
    tmdbId: currentShowId,
    season: seasonNum,
    episode: episode.episode_number,
    resumeAt: getResumeSeconds({ type: 'tv', tmdbId: currentShowId, season: seasonNum, episode: episode.episode_number }),
  };

  activeLoad = loadPlayer(
    playerFrame,
    target,
    {
      onAttempt(providerId) {
        sourceSelect.value = providerId;
        sourceStatus.textContent = `Trying ${getProvider(providerId).name}...`;
      },
      onResolved(providerId) {
        loadingPlaceholder.classList.add('is-hidden');
        configDisplay.classList.remove('hidden');
        sourceSelect.value = providerId;
        sourceStatus.textContent = `Playing via ${getProvider(providerId).name}`;

        episodeTitleElement.textContent = episode.name || `Episode ${episode.episode_number}`;
        currentSeasonElement.textContent = seasonNum;
        currentEpisodeElement.textContent = episode.episode_number;
        currentEpisodeNumber = episode.episode_number;
        updateNavButtons();
        syncShareUrl(seasonNum, episode.episode_number);

        continueWatchingStore.push({
          type: 'tv',
          tmdbId: currentShowId,
          title: currentShowName,
          season: seasonNum,
          episode: episode.episode_number,
          episodeTitle: episode.name,
        });

        activeProgressWatch = watchProgress(playerFrame, {
          type: 'tv',
          tmdbId: currentShowId,
          season: seasonNum,
          episode: episode.episode_number,
        });
      },
      onAllFailed() {
        loadingText.textContent = 'ALL SOURCES FAILED — TRY ANOTHER';
        sourceStatus.textContent = 'No source could load this episode.';
      },
    }
  );
}

changeEpisodeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  showSelectionArea();
});

prevEpisodeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  goToAdjacentEpisode(-1);
});

nextEpisodeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  goToAdjacentEpisode(1);
});

backToPlayerBtn.addEventListener('click', () => {
  hideSelectionArea();
});
