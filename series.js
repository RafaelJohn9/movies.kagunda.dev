// series.js — series detail page: season/episode selection + player.
// Popup blocking lives in popup-blocker.js; TMDB calls in tmdb.js; provider
// fallback/switching in providers.js + player-loader.js. The old fake
// watch-progress simulator (a setInterval incrementing a counter against a
// hardcoded 24-minute guess, never read back anywhere) has been removed in
// favor of the real Continue Watching stack in storage.js.

const { fetchFromTMDB } = window.StreamCinemaTMDB;
const { continueWatchingStore } = window.StreamCinemaStorage;
const { PROVIDERS, getProvider } = window.StreamCinemaProviders;
const { loadPlayer, getPreferredProvider, setPreferredProvider } = window.StreamCinemaPlayer;

// DOM Elements
const seasonSelect = document.getElementById('seasonSelect');
const episodeSelect = document.getElementById('episodeSelect');
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
const changeEpisodeBtn = document.getElementById('changeEpisodeBtn');
const selectionArea = document.getElementById('selectionArea');
const loadEpisodeBtn = document.getElementById('loadEpisodeBtn');
const backToPlayerBtn = document.getElementById('backToPlayerBtn');
const sourceSelect = document.getElementById('source-select');
const sourceStatus = document.getElementById('source-status');

// Get show info from localStorage
const currentShowId = localStorage.getItem('currentTVShowId');
const currentShowName = localStorage.getItem('currentTVShowName');

// A Continue Watching card sets these before navigating here so the show
// resumes at the last-watched episode instead of always S1E1.
const resumeSeason = localStorage.getItem('resumeTVShowSeason');
const resumeEpisode = localStorage.getItem('resumeTVShowEpisode');
localStorage.removeItem('resumeTVShowSeason');
localStorage.removeItem('resumeTVShowEpisode');

// State
let seasonsData = [];
let episodesForCurrentSeason = [];
let currentSeasonNumber = null;
let activeLoad = null;

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

function showSelectionArea() {
  selectionArea.classList.remove('hidden');
  setTimeout(() => selectionArea.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

function hideSelectionArea() {
  selectionArea.classList.add('hidden');
}

function disableControls() {
  episodeSelect.disabled = true;
  loadEpisodeBtn.disabled = true;
}

function enableControls() {
  episodeSelect.disabled = false;
  loadEpisodeBtn.disabled = false;
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

  const sortedSeasons = [...seasonsData].sort((a, b) => a.season_number - b.season_number);
  const requestedSeason = resumeSeason ? Number(resumeSeason) : sortedSeasons[0].season_number;
  const seasonExists = sortedSeasons.some((s) => s.season_number === requestedSeason);
  const seasonNumber = seasonExists ? requestedSeason : sortedSeasons[0].season_number;

  seasonSelect.value = seasonNumber;
  episodesForCurrentSeason = await fetchEpisodesForSeason(currentShowId, seasonNumber);
  populateEpisodeSelector(episodesForCurrentSeason);
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
    seasonSelect.innerHTML = '<option value="">-- Error Loading Seasons --</option>';
    loadingPlaceholderStandalone.textContent = 'Failed to load seasons.';
    return;
  }

  seasonsData = (showDetails.seasons || []).filter((season) => season.season_number > 0);
  seasonSelect.innerHTML = '<option value="">-- Select Season --</option>';
  seasonsData.forEach((season) => {
    const option = document.createElement('option');
    option.value = season.season_number;
    option.textContent = `Season ${season.season_number}`;
    seasonSelect.appendChild(option);
  });
}

async function fetchEpisodesForSeason(showId, seasonNumber) {
  const seasonDetails = await fetchFromTMDB(`/tv/${showId}/season/${seasonNumber}`);
  return seasonDetails?.episodes || [];
}

function populateEpisodeSelector(episodes) {
  episodeSelect.innerHTML = '<option value="">-- Select Episode --</option>';
  episodes.forEach((episode) => {
    const option = document.createElement('option');
    option.value = episode.episode_number;
    option.textContent = `E${episode.episode_number}: ${episode.name}`;
    episodeSelect.appendChild(option);
  });
  if (episodes.length === 0) {
    loadEpisodeBtn.disabled = true;
  }
}

seasonSelect.addEventListener('change', async (e) => {
  const selectedSeasonNumber = parseInt(e.target.value, 10);
  if (isNaN(selectedSeasonNumber)) {
    episodeSelect.innerHTML = '<option value="">-- Select Episode --</option>';
    episodesForCurrentSeason = [];
    loadEpisodeBtn.disabled = true;
    return;
  }
  disableControls();
  episodesForCurrentSeason = await fetchEpisodesForSeason(currentShowId, selectedSeasonNumber);
  populateEpisodeSelector(episodesForCurrentSeason);
  enableControls();
});

function loadEpisodePlayer(episode, seasonNum) {
  if (!episode) return;

  currentSeasonNumber = seasonNum;
  activeLoad?.cancel();

  playerContainer.classList.remove('hidden');
  configDisplay.classList.add('hidden');
  loadingPlaceholder.classList.remove('is-hidden');
  loadingText.textContent = 'Loading Episode';

  activeLoad = loadPlayer(
    playerFrame,
    { type: 'tv', tmdbId: currentShowId, season: seasonNum, episode: episode.episode_number },
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

        continueWatchingStore.push({
          type: 'tv',
          tmdbId: currentShowId,
          title: currentShowName,
          season: seasonNum,
          episode: episode.episode_number,
          episodeTitle: episode.name,
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

loadEpisodeBtn.addEventListener('click', () => {
  const selectedSeasonNum = parseInt(seasonSelect.value, 10);
  const selectedEpisodeNum = parseInt(episodeSelect.value, 10);

  if (isNaN(selectedSeasonNum) || isNaN(selectedEpisodeNum)) {
    alert('Please select both a season and an episode.');
    return;
  }

  const selectedEpisode = episodesForCurrentSeason.find((ep) => ep.episode_number === selectedEpisodeNum);
  if (selectedEpisode) {
    loadEpisodePlayer(selectedEpisode, selectedSeasonNum);
    hideSelectionArea();
  } else {
    alert('Selected episode not found.');
  }
});

backToPlayerBtn.addEventListener('click', () => {
  hideSelectionArea();
});
