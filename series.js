// series.js - Handles Series/Anime Selection and Player

(function () {
  'use strict';

  // 1. Override window.open
  window.open = function (...args) {
    console.warn('[PopupBlocker] window.open blocked:', args[0]);
    return null;
  };

  // 2. Prevent location reassignment (redirect-style popups)
  try {
    const locDesc = Object.getOwnPropertyDescriptor(window, 'location');
    if (locDesc && locDesc.configurable) {
      let _currentHref = window.location.href;
      Object.defineProperty(window, 'location', {
        get() {
          return { href: _currentHref, toString: () => _currentHref };
        },
        set(val) {
          console.warn('[PopupBlocker] location assignment blocked:', val);
        },
        configurable: true
      });
    }
  } catch (e) {}

  // 3. Block <a target="_blank"> clicks (biggest mobile popup vector)
  document.addEventListener('click', function (e) {
    const anchor = e.target.closest('a');
    if (anchor && anchor.target === '_blank') {
      e.preventDefault();
      e.stopPropagation();
      console.warn('[PopupBlocker] _blank link blocked:', anchor.href);
      return false;
    }
  }, true);

  // 4. Block middle-click / ctrl+click on any link
  document.addEventListener('mousedown', function (e) {
    const anchor = e.target.closest('a');
    if (anchor && (e.button === 1 || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      console.warn('[PopupBlocker] middle/ctrl click blocked on:', anchor.href);
      return false;
    }
  }, true);

  // 5. MutationObserver: remove dynamically injected iframes & _blank links
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const iframes = node.tagName === 'IFRAME'
          ? [node]
          : node.querySelectorAll?.('iframe') || [];

        iframes.forEach(function (iframe) {
          // Skip your own movie player iframe
          if (iframe.id === 'movie-player') return;

          const style = window.getComputedStyle(iframe);
          const rect = iframe.getBoundingClientRect();
          const isHidden =
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0' ||
            rect.width === 0 ||
            rect.height === 0 ||
            rect.top < -9999 ||
            rect.left < -9999;

          if (isHidden || !iframe.src || iframe.src === 'about:blank') {
            console.warn('[PopupBlocker] Removed suspicious iframe:', iframe.src);
            iframe.remove();
          }
        });

        const blankLinks = node.tagName === 'A' && node.target === '_blank'
          ? [node]
          : node.querySelectorAll?.('a[target="_blank"]') || [];

        blankLinks.forEach(function (link) {
          link.removeAttribute('target');
          console.warn('[PopupBlocker] Neutralized _blank link:', link.href);
        });
      });
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // 6. Touch-specific: block touchend popups (mobile Chrome)
  document.addEventListener('touchend', function (e) {
    const anchor = e.target.closest('a');
    if (anchor && (anchor.target === '_blank' || anchor.hasAttribute('data-popup'))) {
      e.preventDefault();
      e.stopPropagation();
      console.warn('[PopupBlocker] touchend popup blocked:', anchor.href);
      return false;
    }
  }, true);

  // 7. Block programmatic .click() on _blank anchors
  const _origAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.target === '_blank') {
      console.warn('[PopupBlocker] programmatic click() on _blank blocked:', this.href);
      return;
    }
    return _origAnchorClick.apply(this, arguments);
  };

  console.log('[PopupBlocker] Initialized.');
})();

// Configuration
const VIDSRC_API = 'https://vidsrc-embed.ru'; // Fixed trailing space
const TMDB_API_KEY = 'f58480d08cca99974e0bc1f09ae7e581';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w300'; // Fixed trailing space

// DOM Elements
const seasonSelect = document.getElementById('seasonSelect');
const episodeSelect = document.getElementById('episodeSelect');
const playerContainer = document.getElementById('playerContainer');
const playerFrame = document.getElementById('playerFrame');
const showTitleElement = document.getElementById('showTitle');
const loadingPlaceholder = document.getElementById('loadingPlaceholder');
const configDisplay = document.getElementById('configDisplay');
const episodeTitleElement = document.getElementById('episodeTitle');
const currentSeasonElement = document.getElementById('currentSeason');
const currentEpisodeElement = document.getElementById('currentEpisode');
const changeEpisodeBtn = document.getElementById('changeEpisodeBtn');
const selectionArea = document.getElementById('selectionArea');
const loadEpisodeBtn = document.getElementById('loadEpisodeBtn'); // Get the button element
const backToPlayerBtn = document.getElementById('backToPlayerBtn');

// Get show info from localStorage
let currentShowId = localStorage.getItem('currentTVShowId');
let currentShowName = localStorage.getItem('currentTVShowName');

// Cache Key for Watch Progress
const WATCH_PROGRESS_CACHE_KEY = 'watchProgressCache';

// State Management
let seasonsData = [];
let episodesForCurrentSeason = [];
let currentSeasonNumber = null;
let currentEpisodeObject = null;

// Extend Window type for TypeScript compatibility
if (!window.watchProgressCache) {
    window.watchProgressCache = {};
}

// Initialize
window.addEventListener('load', init);

function showSelectionArea() {
    document.body.classList.add('selection-mode');
    selectionArea.classList.remove('hidden');
    // Smooth scroll to selection area
    setTimeout(() => {
        selectionArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

function hideSelectionArea() {
    document.body.classList.remove('selection-mode');
    selectionArea.classList.add('hidden');
}

async function init() {
    if (!currentShowId || !currentShowName) {
        alert('No show selected. Please select a show from the main page.');
        window.location.href = 'index.html';
        return;
    }

    showTitleElement.textContent = currentShowName;
    loadWatchProgressFromCache();

    // Disable controls initially while loading first season/episodes
    disableControls();

    await fetchAndPopulateSeasons(currentShowId);
    await loadFirstAvailableEpisode();
}

// Disable the episode selector and load button
function disableControls() {
    episodeSelect.disabled = true;
    loadEpisodeBtn.disabled = true;
    // Show loading indicator if needed (though loadingPlaceholder is used differently)
    // You might want to ensure it's visible here too depending on your UI flow
    // loadingPlaceholder.classList.remove('hidden');
}

// Enable the episode selector and load button
function enableControls() {
    episodeSelect.disabled = false;
    loadEpisodeBtn.disabled = false;
    // Hide loading indicator associated with controls
    // loadingPlaceholder.classList.add('hidden');
}


// Load the first episode of the first available season
async function loadFirstAvailableEpisode() {
    if (seasonsData.length === 0) {
        console.error('No seasons available to load first episode.');
        loadingPlaceholder.innerHTML = '<div class="loading-content"><div class="loading-text">No seasons found for this show.</div></div>';
        return; // Keep controls disabled or handle error state explicitly
    }

    const sortedSeasons = seasonsData.sort((a, b) => a.season_number - b.season_number);
    const firstSeasonNumber = sortedSeasons[0].season_number;

    seasonSelect.value = firstSeasonNumber;

    // Fetch episodes for the first season
    episodesForCurrentSeason = await fetchEpisodesForSeason(currentShowId, firstSeasonNumber);

    // Populate the episode selector *before* enabling controls
    populateEpisodeSelector(episodesForCurrentSeason);

    // Enable controls now that episodes are loaded and selector is populated
    enableControls(); // <-- This is the key call

    if (episodesForCurrentSeason.length === 0) {
        console.error('No episodes found for the first season.');
        // Optionally update loadingPlaceholder or show message in episodeSelect
        // Since controls are enabled but no episodes exist, user will see the empty message in episodeSelect
        // Or you could keep controls disabled if no episodes exist
        // loadEpisodeBtn.disabled = true; // Disable load button if no episodes
        loadingPlaceholder.innerHTML = '<div class="loading-content"><div class="loading-text">No episodes found for the first season.</div></div>';
        return;
    }

    const sortedEpisodes = episodesForCurrentSeason.sort((a, b) => a.episode_number - b.episode_number);
    const firstEpisode = sortedEpisodes[0];

    loadEpisodePlayer(firstEpisode, firstSeasonNumber);
}


// Fetch Seasons from TMDB
async function fetchAndPopulateSeasons(showId) {
    const url = `https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_API_KEY}&append_to_response=seasons`; // Fixed URL format

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`TMDB API error: ${response.status}`);
        }

        const showDetails = await response.json();
        seasonsData = showDetails.seasons.filter(season => season.season_number > 0); // Filter out season 0 (specials)

        seasonSelect.innerHTML = '<option value="">-- Select Season --</option>';
        seasonsData.forEach(season => {
            const option = document.createElement('option');
            option.value = season.season_number;
            option.textContent = `Season ${season.season_number}`;
            seasonSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching seasons:', error);
        seasonSelect.innerHTML = '<option value="">-- Error Loading Seasons --</option>';
        loadingPlaceholder.innerHTML = '<div class="loading-content"><div class="loading-text">Failed to load seasons.</div></div>';
        // Optionally disable episode select/load button permanently on season fetch failure
        // disableControls();
    }
}

// Event Listener for Season Selection
seasonSelect.addEventListener('change', async (e) => {
    const selectedSeasonNumber = parseInt(e.target.value);

    if (isNaN(selectedSeasonNumber)) {
        episodeSelect.innerHTML = '<option value="">-- Select Episode --</option>';
        episodesForCurrentSeason = [];
        loadEpisodeBtn.disabled = true; // Disable button if no valid season selected
        return;
    }

    // Disable controls while fetching episodes for the new season
    disableControls();

    episodesForCurrentSeason = await fetchEpisodesForSeason(currentShowId, selectedSeasonNumber);
    populateEpisodeSelector(episodesForCurrentSeason);

    // Enable controls after episodes are fetched and selector is populated
    enableControls();

    // Disable load button if no episodes were found for the selected season
    if (episodesForCurrentSeason.length === 0) {
         // Optionally show a message in episodeSelect or elsewhere
         // loadEpisodeBtn.disabled = true; // Already disabled by disableControls(), keep it so
         loadingPlaceholder.innerHTML = '<div class="loading-content"><div class="loading-text">No episodes found for this season.</div></div>';
    }
});


// Fetch Episodes for a specific Season from TMDB
async function fetchEpisodesForSeason(showId, seasonNumber) {
    const url = `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`; // Fixed URL format

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`TMDB API error: ${response.status}`);
        }

        const seasonDetails = await response.json();
        return seasonDetails.episodes || [];
    } catch (error) {
        console.error(`Error fetching episodes for Season ${seasonNumber}:`, error);
        return []; // Return empty array on error
    }
}

// Populate Episode Selector Dropdown
function populateEpisodeSelector(episodes) {
    episodeSelect.innerHTML = '<option value="">-- Select Episode --</option>';

    episodes.forEach(episode => {
        const option = document.createElement('option');
        option.value = episode.episode_number;
        option.textContent = `E${episode.episode_number}: ${episode.name}`;
        episodeSelect.appendChild(option);
    });

    // Explicitly disable the load button if no episodes were added to the list
    // (This handles the case where episodes array was empty)
    if (episodes.length === 0) {
        loadEpisodeBtn.disabled = true;
    }
    // Otherwise, controls should be enabled by the calling function (fetchAndPopulateSeasons or seasonSelect change handler)
}


// Load Player for Selected Episode
function loadEpisodePlayer(episode, seasonNum) {
    if (!episode) return;

    currentSeasonNumber = seasonNum;
    currentEpisodeObject = episode;

    loadingPlaceholder.classList.remove('hidden');
    playerContainer.classList.add('hidden');
    configDisplay.classList.add('hidden');

    const embedUrl = `${VIDSRC_API}/embed/tv/${currentShowId}/${currentSeasonNumber}/${episode.episode_number}`;

    playerFrame.src = '';

    playerFrame.onload = function() {
        console.log('Iframe loaded:', embedUrl);
        loadingPlaceholder.classList.add('hidden');
        playerContainer.classList.remove('hidden');
        configDisplay.classList.remove('hidden');

        episodeTitleElement.textContent = episode.name || `Episode ${episode.episode_number}`;
        currentSeasonElement.textContent = currentSeasonNumber;
        currentEpisodeElement.textContent = episode.episode_number;
    };

    playerFrame.src = embedUrl;
    setupPlayerProgressTracking(episode);
}

// Setup Player Progress Tracking
let progressIntervalId = null;
let lastSavedTime = 0;
let totalDurationEstimate = 24 * 60; // 24 minutes in seconds

function setupPlayerProgressTracking(episode) {
    const progressKey = `${currentShowId}_${currentSeasonNumber}_${episode.episode_number}`;

    if (progressIntervalId) {
        clearInterval(progressIntervalId);
    }

    progressIntervalId = setInterval(() => {
        lastSavedTime += 10;

        if (lastSavedTime >= totalDurationEstimate) {
            lastSavedTime = totalDurationEstimate;
            saveWatchProgress(progressKey, 100);
            clearInterval(progressIntervalId);
        } else {
            const progressPercentage = Math.floor((lastSavedTime / totalDurationEstimate) * 100);
            saveWatchProgress(progressKey, progressPercentage);
        }
    }, 10000);

    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            const currentProgress = getWatchProgress(progressKey) || 0;
            saveWatchProgress(progressKey, currentProgress);
            console.log(`Saved progress for S${currentSeasonNumber}E${episode.episode_number}: ${currentProgress}%`);
        }
    });
}

// Event Listeners for buttons
changeEpisodeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showSelectionArea();
});

loadEpisodeBtn.addEventListener('click', async () => {
    const selectedSeasonNum = parseInt(seasonSelect.value);
    const selectedEpisodeNum = parseInt(episodeSelect.value);

    if (isNaN(selectedSeasonNum) || isNaN(selectedEpisodeNum)) {
        alert('Please select both a season and an episode.');
        return;
    }

    // Note: episodesForCurrentSeason should already contain the correct episodes
    // for the selectedSeasonNum because the change event handler for seasonSelect
    // fetches them and enables the controls *after* populating the list.
    // So, fetching again here might be redundant unless you need to refresh.
    // Assuming episodesForCurrentSeason is up-to-date based on the currently selected season.

    // if (selectedSeasonNum !== currentSeasonNumber) { // This check might be redundant now
    //     episodesForCurrentSeason = await fetchEpisodesForSeason(currentShowId, selectedSeasonNum);
    // }

    const selectedEpisode = episodesForCurrentSeason.find(ep => ep.episode_number === selectedEpisodeNum);

    if (selectedEpisode) {
        loadEpisodePlayer(selectedEpisode, selectedSeasonNum);
        hideSelectionArea();
    } else {
        console.error('Selected episode number not found in current season data.');
        alert('Selected episode not found.');
    }
});

backToPlayerBtn.addEventListener('click', () => {
    hideSelectionArea();
});

// Cache Functions
function loadWatchProgressFromCache() {
    const cacheString = localStorage.getItem(WATCH_PROGRESS_CACHE_KEY);

    if (cacheString) {
        try {
            window.watchProgressCache = JSON.parse(cacheString);
            console.log('Loaded watch progress cache:', window.watchProgressCache);
        } catch (e) {
            console.error('Error parsing watch progress cache:', e);
            window.watchProgressCache = {};
        }
    } else {
        window.watchProgressCache = {};
    }
}

function saveWatchProgressToCache() {
    try {
        localStorage.setItem(WATCH_PROGRESS_CACHE_KEY, JSON.stringify(window.watchProgressCache));
        console.log('Saved watch progress cache:', window.watchProgressCache);
    } catch (e) {
        console.error('Error saving watch progress cache:', e);
    }
}

function getWatchProgress(key) {
    return window.watchProgressCache[key] || null;
}

function saveWatchProgress(key, percentage) {
    if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
        console.warn(`Invalid progress percentage: ${percentage} for key: ${key}`);
        return;
    }

    window.watchProgressCache[key] = percentage;
    saveWatchProgressToCache();
}

function resetSelections() {
    seasonSelect.value = '';
    episodeSelect.innerHTML = '<option value="">-- Select Episode --</option>';
    playerContainer.classList.add('hidden');
    configDisplay.classList.add('hidden');
    loadingPlaceholder.classList.add('hidden');
    selectionArea.classList.add('hidden');
    episodesForCurrentSeason = [];
    seasonsData = [];
    currentSeasonNumber = null;
    currentEpisodeObject = null;
    // Reset button states on reset
    disableControls();
}

// Block popups from iframe
window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = '';
    return false;
});

// Alternative: Block window.open calls
const originalOpen = window.open;
window.open = function() {
    console.log('Popup blocked');
    return null;
};