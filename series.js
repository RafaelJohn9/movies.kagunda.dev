// series.js - Handles Series/Anime Selection and Player

// Configuration
const VIDSRC_API = 'https://vidsrc-embed.ru';
const TMDB_API_KEY = 'f58480d08cca99974e0bc1f09ae7e581';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w300';

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
const loadEpisodeBtn = document.getElementById('loadEpisodeBtn');
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
    
    await fetchAndPopulateSeasons(currentShowId);
    await loadFirstAvailableEpisode();
}

// Load the first episode of the first available season
async function loadFirstAvailableEpisode() {
    if (seasonsData.length === 0) {
        console.error('No seasons available to load first episode.');
        loadingPlaceholder.innerHTML = '<div class="loading-content"><div class="loading-text">No seasons found for this show.</div></div>';
        return;
    }

    const sortedSeasons = seasonsData.sort((a, b) => a.season_number - b.season_number);
    const firstSeasonNumber = sortedSeasons[0].season_number;

    seasonSelect.value = firstSeasonNumber;
    
    episodesForCurrentSeason = await fetchEpisodesForSeason(currentShowId, firstSeasonNumber);
    populateEpisodeSelector(episodesForCurrentSeason);
    
    if (episodesForCurrentSeason.length === 0) {
        console.error('No episodes found for the first season.');
        loadingPlaceholder.innerHTML = '<div class="loading-content"><div class="loading-text">No episodes found for the first season.</div></div>';
        return;
    }

    const sortedEpisodes = episodesForCurrentSeason.sort((a, b) => a.episode_number - b.episode_number);
    const firstEpisode = sortedEpisodes[0];

    loadEpisodePlayer(firstEpisode, firstSeasonNumber);
}

// Fetch Seasons from TMDB
async function fetchAndPopulateSeasons(showId) {
    const url = `https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_API_KEY}&append_to_response=seasons`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`TMDB API error: ${response.status}`);
        }
        
        const showDetails = await response.json();
        seasonsData = showDetails.seasons.filter(season => season.season_number > 0);
        
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
    }
}

// Event Listener for Season Selection
seasonSelect.addEventListener('change', async (e) => {
    const selectedSeasonNumber = parseInt(e.target.value);
    
    if (isNaN(selectedSeasonNumber)) {
        episodeSelect.innerHTML = '<option value="">-- Select Episode --</option>';
        episodesForCurrentSeason = [];
        return;
    }

    episodesForCurrentSeason = await fetchEpisodesForSeason(currentShowId, selectedSeasonNumber);
    populateEpisodeSelector(episodesForCurrentSeason);
});

// Fetch Episodes for a specific Season from TMDB
async function fetchEpisodesForSeason(showId, seasonNumber) {
    const url = `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`TMDB API error: ${response.status}`);
        }
        
        const seasonDetails = await response.json();
        return seasonDetails.episodes || [];
    } catch (error) {
        console.error(`Error fetching episodes for Season ${seasonNumber}:`, error);
        return [];
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

    if (selectedSeasonNum !== currentSeasonNumber) {
        episodesForCurrentSeason = await fetchEpisodesForSeason(currentShowId, selectedSeasonNum);
    }

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
}