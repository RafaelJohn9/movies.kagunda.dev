// series.js - Handles Series/Anime Selection and Player

// Configuration - REMOVED TRAILING SPACES
const VIDSRC_API = 'https://vidsrc-embed.ru'; // Or the new domains provided: vidsrc-embed.su, vidsrcme.su, vsrc.su
const TMDB_API_KEY = 'f58480d08cca99974e0bc1f09ae7e581';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w300';

// DOM Elements
const seasonSelect = document.getElementById('seasonSelect');
const episodeSelect = document.getElementById('episodeSelect');
// const episodeGrid = document.getElementById('episodeGrid'); // Commented out as it seems unused in the current HTML
const playerContainer = document.getElementById('playerContainer');
const playerFrame = document.getElementById('playerFrame');
// const backToSelectionBtn = document.getElementById('backToSelectionBtn'); // Commented out as per new HTML
const showTitleElement = document.getElementById('showTitle');
const loadingPlaceholder = document.getElementById('loadingPlaceholder'); // Added reference
const configDisplay = document.getElementById('configDisplay'); // Added reference
const episodeTitleElement = document.getElementById('episodeTitle');
const currentSeasonElement = document.getElementById('currentSeason');
const currentEpisodeElement = document.getElementById('currentEpisode');
const changeEpisodeBtn = document.getElementById('changeEpisodeBtn');
const selectionArea = document.getElementById('selectionArea');
const loadEpisodeBtn = document.getElementById('loadEpisodeBtn');
const backToPlayerBtn = document.getElementById('backToPlayerBtn');


// Note: Assuming you pass the show ID somehow, e.g., via URL parameter or localStorage from the main page
// Let's assume it comes from localStorage for now, set by the main page when clicking a TV card.
let currentShowId = localStorage.getItem('currentTVShowId');
let currentShowName = localStorage.getItem('currentTVShowName'); // Also store the name

// Cache Key for Watch Progress
const WATCH_PROGRESS_CACHE_KEY = 'watchProgressCache';

// State Management
let seasonsData = []; // Store fetched season info
let episodesForCurrentSeason = []; // Store episodes for the selected season
let currentSeasonNumber = null; // Track current season
let currentEpisodeObject = null; // Track current episode object

// Initialize
window.addEventListener('load', init);

function showSelectionArea() {
    document.body.classList.add('selection-mode'); // Optional: add body class for styling
    // The dropdowns are already in the HTML, just make the area visible
    document.getElementById('selectionArea').classList.remove('hidden');
    playerContainer.classList.add('hidden');
    configDisplay.classList.add('hidden');
    loadingPlaceholder.classList.add('hidden'); // Hide placeholder when showing selection
}

function hideSelectionArea() {
    document.body.classList.remove('selection-mode'); // Optional: remove body class
    document.getElementById('selectionArea').classList.add('hidden');
    // Don't immediately show player - let the state determine visibility
    // The player visibility is managed by loadEpisodePlayer
}

async function init() {
  if (!currentShowId || !currentShowName) {
     // If no show ID is found, redirect back or show an error message
     alert('No show selected. Please select a show from the main page.');
     window.location.href = 'index.html'; // Redirect back to main page
     return;
  }
  showTitleElement.textContent = currentShowName; // Update the page title
  loadWatchProgressFromCache(); // Load existing progress from cache

  // Fetch seasons and immediately load the first episode of the first season
  await fetchAndPopulateSeasons(currentShowId);
  await loadFirstAvailableEpisode(); // NEW FUNCTION CALL
}

// NEW: Load the first episode of the first available season
async function loadFirstAvailableEpisode() {
  if (seasonsData.length === 0) {
    console.error('No seasons available to load first episode.');
    loadingPlaceholder.innerHTML = '<p style="color: #ef4444;">No seasons found for this show.</p>';
    return;
  }

  // Sort seasons by number to ensure we get the true first season (e.g., handle mini-seasons)
  const sortedSeasons = seasonsData.sort((a, b) => a.season_number - b.season_number);
  const firstSeasonNumber = sortedSeasons[0].season_number;

  // Select the first season in the dropdown
  seasonSelect.value = firstSeasonNumber;

  // Fetch episodes for the first season
  episodesForCurrentSeason = await fetchEpisodesForSeason(currentShowId, firstSeasonNumber);

  if (episodesForCurrentSeason.length === 0) {
    console.error('No episodes found for the first season.');
    loadingPlaceholder.innerHTML = '<p style="color: #ef4444;">No episodes found for the first season.</p>';
    return;
  }

  // Sort episodes by number to ensure we get the true first episode
  const sortedEpisodes = episodesForCurrentSeason.sort((a, b) => a.episode_number - b.episode_number);
  const firstEpisode = sortedEpisodes[0];

  // Select the first episode in the dropdown (if using dropdown)
  // episodeSelect.value = firstEpisode.episode_number; // Not needed if loading directly

  // Load the first episode directly
  loadEpisodePlayer(firstEpisode, firstSeasonNumber); // Pass season number explicitly
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
    seasonsData = showDetails.seasons.filter(season => season.season_number > 0); // Exclude special seasons (0)

    seasonSelect.innerHTML = '<option value="">-- Select Season --</option>';
    seasonsData.forEach(season => {
      const option = document.createElement('option');
      option.value = season.season_number;
      option.textContent = `Season ${season.season_number}`;
      seasonSelect.appendChild(option);
    });

  } catch (error) {
    console.error('Error fetching seasons:', error);
    // Display error message to user
    seasonSelect.innerHTML = '<option value="">-- Error Loading Seasons --</option>';
    loadingPlaceholder.innerHTML = '<p style="color: #ef4444;">Failed to load seasons.</p>';
  }
}

// Event Listener for Season Selection
seasonSelect.addEventListener('change', async (e) => {
  const selectedSeasonNumber = parseInt(e.target.value);
  if (isNaN(selectedSeasonNumber)) {
    episodeSelect.innerHTML = '<option value="">-- Select Episode --</option>';
    // episodeGrid.style.display = 'none'; // Commented out
    episodesForCurrentSeason = [];
    return;
  }

  // Fetch episodes for the selected season
  episodesForCurrentSeason = await fetchEpisodesForSeason(currentShowId, selectedSeasonNumber);
  populateEpisodeSelector(episodesForCurrentSeason);
  // populateEpisodeGrid(episodesForCurrentSeason); // Commented out
  // episodeGrid.style.display = 'grid'; // Commented out
  // episodeSelect.style.display = 'none'; // Commented out
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

// Populate Episode Selector Dropdown (Alternative view, kept for potential toggle)
function populateEpisodeSelector(episodes) {
  episodeSelect.innerHTML = '<option value="">-- Select Episode --</option>';
  episodes.forEach(episode => {
    const option = document.createElement('option');
    option.value = episode.episode_number;
    option.textContent = `E${episode.episode_number}: ${episode.name}`; // Include name if available
    episodeSelect.appendChild(option);
  });
}

// Populate Episode Grid (Thumbnail View) - COMMENTED OUT AS PER NEW HTML
// function populateEpisodeGrid(episodes) {
//     episodeGrid.innerHTML = ''; // Clear existing cards
//     episodes.forEach(episode => {
//         const card = document.createElement('div');
//         card.className = 'episode-card';
//         card.dataset.season = seasonSelect.value; // Store season number
//         card.dataset.episode = episode.episode_number; // Store episode number
//
//         // Add progress bar element
//         const progressBar = document.createElement('div');
//         progressBar.className = 'progress-bar';
//         // Calculate progress percentage from cache
//         const progressKey = `${currentShowId}_${seasonSelect.value}_${episode.episode_number}`;
//         const cachedProgress = getWatchProgress(progressKey);
//         if (cachedProgress !== null) {
//             progressBar.style.width = `${Math.min(cachedProgress, 100)}%`; // Cap at 100%
//         }
//
//         const numberDiv = document.createElement('div');
//         numberDiv.className = 'episode-number';
//         numberDiv.textContent = `S${card.dataset.season} E${card.dataset.episode}`;
//
//         const titleDiv = document.createElement('div');
//         titleDiv.className = 'episode-title';
//         titleDiv.textContent = episode.name || `Episode ${episode.episode_number}`; // Fallback to number
//
//         card.appendChild(progressBar);
//         card.appendChild(numberDiv);
//         card.appendChild(titleDiv);
//
//         // Use arrow function to capture 'episode' variable
//         card.addEventListener('click', () => loadEpisodePlayer(episode, parseInt(card.dataset.season)));
//
//         episodeGrid.appendChild(card);
//     });
// }


// Event Listener for Episode Selection (Dropdown - if used instead of grid)
// episodeSelect.addEventListener('change', (e) => {
//   const selectedEpisodeNumber = parseInt(e.target.value);
//   if (isNaN(selectedEpisodeNumber)) return;
//
//   const selectedEpisode = episodesForCurrentSeason.find(ep => ep.episode_number === selectedEpisodeNumber);
//   if (selectedEpisode) {
//     loadEpisodePlayer(selectedEpisode);
//   }
// });

// Load Player for Selected Episode
function loadEpisodePlayer(episode, seasonNum) { // Accept season number as argument
  if (!episode) return;

  // Update state variables
  currentSeasonNumber = seasonNum;
  currentEpisodeObject = episode;

  // Show loading placeholder BEFORE setting the new src
  loadingPlaceholder.classList.remove('hidden');
  playerContainer.classList.add('hidden'); // Hide player container while loading
  configDisplay.classList.add('hidden'); // Hide config display while loading

  const embedUrl = `${VIDSRC_API}/embed/tv/${currentShowId}/${currentSeasonNumber}/${episode.episode_number}`;

  // Clear the iframe source first (optional, helps ensure event fires)
  playerFrame.src = '';

  // Set up the load event listener BEFORE setting the src
  playerFrame.onload = function() {
    console.log('Iframe loaded:', embedUrl);
    // Hide loading placeholder AFTER the iframe reports it has loaded
    // This ensures the placeholder is only visible while the iframe is actually loading
    loadingPlaceholder.classList.add('hidden');
    // Show the player container and config display after loading
    playerContainer.classList.remove('hidden');
    configDisplay.classList.remove('hidden');

    // Update the config display with episode info
    episodeTitleElement.textContent = episode.name || `Episode ${episode.episode_number}`;
    currentSeasonElement.textContent = currentSeasonNumber;
    currentEpisodeElement.textContent = episode.episode_number;
  };

  // Set the new source to trigger loading
  playerFrame.src = embedUrl;

  setupPlayerProgressTracking(episode); // Start tracking progress
}

// Setup Player Progress Tracking (using postMessage or timeupdate events if possible with iframe)
// Since direct access to the iframe content is limited due to CORS,
// we rely on timeupdate events *within* the player if supported by the provider,
// or use a timer to periodically save progress based on video state (if accessible).
// However, a simpler approach often used is to save progress on 'pause' or 'unload'.
// For now, let's simulate saving progress using a timer based on the player's perceived state
// (This is a limitation without direct player control).
// A more robust solution requires the embedded player to send messages or have accessible controls.
// For this example, we'll use a basic timer and assume the user watches until the end or pauses frequently.

let progressIntervalId = null;
let lastSavedTime = 0;
let totalDurationEstimate = 24 * 60 * 60; // Estimate 24 minutes in seconds (typical episode length)

function setupPlayerProgressTracking(episode) {
  const progressKey = `${currentShowId}_${currentSeasonNumber}_${episode.episode_number}`; // Use state vars

  // Clear any existing interval
  if (progressIntervalId) {
    clearInterval(progressIntervalId);
  }

  // Attempt to track progress (simulated)
  progressIntervalId = setInterval(() => {
    // In a real scenario, you'd get the current time from the player IF POSSIBLE.
    // For simulation, we'll just increment the time.
    // This is a placeholder - actual tracking needs cooperation from the embed provider.
    // Let's say the user progresses linearly while playing.
    // We'll update the progress bar visually and save the percentage.
    lastSavedTime += 10; // Simulate 10 seconds passing

    if (lastSavedTime >= totalDurationEstimate) {
        lastSavedTime = totalDurationEstimate; // Cap at duration
        saveWatchProgress(progressKey, 100); // Mark as 100% complete
        clearInterval(progressIntervalId); // Stop tracking if complete
    } else {
         const progressPercentage = Math.floor((lastSavedTime / totalDurationEstimate) * 100);
         saveWatchProgress(progressKey, progressPercentage);

         // Update the corresponding progress bar in the grid if visible (currently not applicable)
         // const cards = episodeGrid.querySelectorAll('.episode-card');
         // cards.forEach(card => {
         //     if (parseInt(card.dataset.season) === currentSeasonNumber && // Use state var
         //         parseInt(card.dataset.episode) === episode.episode_number) {
         //             card.querySelector('.progress-bar').style.width = `${progressPercentage}%`;
         //         }
         // });
    }
  }, 10000); // Update every 10 seconds (simulation)

  // Listen for visibility change to potentially pause/resume tracking or save on exit
  window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
          // Save progress when tab is hidden/paused
          const currentProgress = getWatchProgress(progressKey) || 0;
          saveWatchProgress(progressKey, currentProgress);
          console.log(`Saved progress for S${currentSeasonNumber}E${episode.episode_number}: ${currentProgress}%`); // Use state var
      }
  });

  // OLD: Save progress when navigating away from the player view (button commented out)
  // backToSelectionBtn?.addEventListener('click', () => { // Use optional chaining if button exists
  //     const currentProgress = getWatchProgress(progressKey) || 0;
  //     saveWatchProgress(progressKey, currentProgress);
  //     console.log(`Saved progress on back click for S${currentSeasonNumber}E${episode.episode_number}: ${currentProgress}%`); // Use state var
  //     clearInterval(progressIntervalId); // Stop tracking
  //     playerContainer.classList.add('hidden'); // Hide player
  //     // episodeGrid.style.display = 'grid'; // Show grid again (if grid was used) - Commented out
  //     // backToSelectionBtn.style.display = 'none'; // Hide back button - Commented out
  // });

  // NEW: Button to show selection area
  changeEpisodeBtn.addEventListener('click', () => {
      selectionArea.classList.remove('hidden'); // Show selection area
      playerContainer.classList.add('hidden'); // Hide player
      configDisplay.classList.add('hidden'); // Hide config display
      // When selection area is shown, the loading placeholder should also be hidden
      // as neither the player nor the loading state is the primary UI element anymore.
      loadingPlaceholder.classList.add('hidden');
  });

  // NEW: Button to load selected episode from dropdowns
  loadEpisodeBtn.addEventListener('click', () => {
      const selectedSeason = parseInt(seasonSelect.value);
      const selectedEpisodeNum = parseInt(episodeSelect.value);

      if (isNaN(selectedSeason) || isNaN(selectedEpisodeNum)) {
          alert('Please select both a season and an episode.');
          return;
      }

      // Find the episode object based on selected numbers
      const selectedEpisode = episodesForCurrentSeason.find(ep => ep.episode_number === selectedEpisodeNum);
      if (selectedEpisode) {
          loadEpisodePlayer(selectedEpisode, selectedSeason); // Load the selected episode
          selectionArea.classList.add('hidden'); // Hide selection area
          // Player and config display will be handled by loadEpisodePlayer
          // Loading placeholder will be managed by loadEpisodePlayer when the new iframe starts/stops loading
      } else {
          console.error('Selected episode number not found in current season data.');
          alert('Selected episode not found.');
      }
  });

  // NEW: Button to go back to player from selection area
  backToPlayerBtn.addEventListener('click', () => {
      selectionArea.classList.add('hidden'); // Hide selection area
      // When going back to the player, the visibility depends on what was happening before.
      // If an episode was loaded, the player should be visible, and the placeholder hidden.
      // If an episode was loading, the placeholder should be visible, and the player hidden.
      // Since we hide both player/config/placeholder when the selection area opens,
      // we need to decide what to show here. The safest bet is to show the player and config
      // if an episode *should* be loaded (i.e., if state variables are set).
      // However, the most accurate state is maintained by the iframe's onload handler.
      // So, just hide the selection area. The player and placeholder states are handled by
      // loadEpisodePlayer when an episode is actively loaded or requested.
      // If an episode is already loaded, the player will remain visible, and the placeholder stays hidden.
      // If the user clicked 'Change Episode', went to selection, then clicked 'Back to Player'
      // *before* the next episode started loading, the player would still be visible.
      // If they clicked 'Back to Player' *after* requesting a new episode but *before* it loaded,
      // the placeholder might flicker if the iframe hasn't loaded yet.
      // To avoid flickering when returning from selection *without* loading a new episode,
      // we could explicitly show the player if we know an episode *is* loaded.
      // But determining "is loaded" reliably from outside the iframe is tricky without messages.
      // For now, just hiding the selection area relies on the iframe's onload logic.
      // If the last requested episode finished loading, the player is shown and placeholder is hidden.
      // If the user quickly goes back after requesting a new episode, the placeholder might show briefly
      // until the iframe fires its onload event. This is the trade-off of relying on onload.
  });

  // Attempt to listen for messages from the player (if supported by embed provider)
  // window.addEventListener('message', (event) => {
  //     // Check origin if necessary for security
  //     // if (event.origin !== VIDSRC_API) return; // Be careful with origin check
  //
  //     // Example message structure (depends on provider):
  //     // { type: 'video_time_update', currentTime: 120, duration: 1440 }
  //     if (event.data && event.data.type === 'video_time_update') {
  //         const { currentTime, duration } = event.data;
  //         if (duration) {
  //             const progress = Math.floor((currentTime / duration) * 100);
  //             saveWatchProgress(progressKey, progress);
  //         }
  //     }
  // });
}


// --- Caching Functions ---

// Load entire cache object from localStorage
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
    window.watchProgressCache = {}; // Initialize if no cache exists
  }
}

// Save entire cache object to localStorage
function saveWatchProgressToCache() {
  try {
    localStorage.setItem(WATCH_PROGRESS_CACHE_KEY, JSON.stringify(window.watchProgressCache));
    console.log('Saved watch progress cache:', window.watchProgressCache);
  } catch (e) {
    console.error('Error saving watch progress cache:', e);
  }
}

// Get progress percentage for a specific episode key
function getWatchProgress(key) {
  return window.watchProgressCache[key] || null;
}

// Save progress percentage for a specific episode key
function saveWatchProgress(key, percentage) {
  if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
    console.warn(`Invalid progress percentage: ${percentage} for key: ${key}`);
    return;
  }
  window.watchProgressCache[key] = percentage;
  saveWatchProgressToCache();
}


changeEpisodeBtn.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent any default anchor behavior if it was a link
    showSelectionArea();
});

document.getElementById('loadEpisodeBtn').addEventListener('click', async () => {
    const selectedSeasonNum = parseInt(seasonSelect.value);
    const selectedEpisodeNum = parseInt(episodeSelect.value);

    if (isNaN(selectedSeasonNum) || isNaN(selectedEpisodeNum)) {
        alert('Please select both a season and an episode.');
        return;
    }

    // Fetch episodes for the selected season if not already loaded
    if (selectedSeasonNum !== currentSeasonNumber) {
        episodesForCurrentSeason = await fetchEpisodesForSeason(currentShowId, selectedSeasonNum);
    }

    const selectedEpisode = episodesForCurrentSeason.find(ep => ep.episode_number === selectedEpisodeNum);
    if (selectedEpisode) {
        loadEpisodePlayer(selectedEpisode, selectedSeasonNum);
        hideSelectionArea(); // Hide selection after loading
    } else {
        console.error('Selected episode number not found in current season data.');
        alert('Selected episode not found.');
    }
});

document.getElementById('backToPlayerBtn').addEventListener('click', () => {
    hideSelectionArea();
});

// --- Helper Functions ---

// Helper to reset selections when changing shows (if implemented)
function resetSelections() {
    seasonSelect.value = '';
    episodeSelect.innerHTML = '<option value="">-- Select Episode --</option>';
    // episodeGrid.innerHTML = ''; // Commented out
    // episodeGrid.style.display = 'none'; // Commented out
    playerContainer.classList.add('hidden');
    configDisplay.classList.add('hidden');
    loadingPlaceholder.classList.add('hidden'); // Also hide placeholder on reset
    selectionArea.classList.add('hidden');
    // backToSelectionBtn.style.display = 'none'; // Commented out
    episodesForCurrentSeason = [];
    seasonsData = [];
    currentSeasonNumber = null;
    currentEpisodeObject = null;
}

// --- Main Page Integration ---

// When a user clicks a TV/Movie card on the main page (index.html/api.js),
// you need to store the show ID and name before navigating.
// Example modification in your main api.js's createCard function:
/*
// Inside createCard(item, type) in api.js
const handleClick = () => {
    if (type === 'tv') {
        // Store show details in localStorage
        localStorage.setItem('currentTVShowId', item.tmdb_id);
        localStorage.setItem('currentTVShowName', item.title || 'Untitled');
        // Navigate to series page
        window.location.href = 'series.html';
    } else {
        // Handle movie embedding differently, maybe open in a modal or same way?
        // For now, just open the embed URL
        window.open(`${VIDSRC_API}/embed/${type}/${item.tmdb_id}`, '_blank');
    }
};
*/ // End of commented helper code

// Initialization happens on window load
// init(); // Already called via event listener above