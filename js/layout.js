// layout.js — single source of truth for header/nav/footer markup.
// Every page keeps only <div id="site-header"></div> / <div id="site-footer"></div>
// placeholders and calls StreamCinemaLayout.renderHeader(activeKey) / renderFooter().

(function () {
  'use strict';

  const NAV_LINKS = [
    { key: 'movies', label: 'Movies', href: 'index.html#movies-section' },
    { key: 'series', label: 'Series', href: 'index.html#series-section' },
    { key: 'mylist', label: 'My List', href: 'mylist.html' },
    { key: 'anime', label: 'New & Popular', href: 'index.html#anime-section' },
  ];

  function brandMarkSvg() {
    return `<svg class="brand__mark" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path clip-rule="evenodd" d="M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z" fill="currentColor" fill-rule="evenodd"></path>
    </svg>`;
  }

  function renderHeader(activeKey) {
    const container = document.getElementById('site-header');
    if (!container) return;

    const navHtml = NAV_LINKS.map((link) => {
      const activeClass = link.key === activeKey ? ' is-active' : '';
      return `<a class="nav-link${activeClass}" href="${link.href}">${link.label}</a>`;
    }).join('');

    container.innerHTML = `
      <header class="site-header">
        <div class="site-header__inner">
          <div class="flex items-center min-w-0">
            <a href="index.html" class="brand">
              ${brandMarkSvg()}
              <span class="brand__name">Stream<span>Cinema</span></span>
            </a>
            <nav class="nav-links">${navHtml}</nav>
          </div>
          <div class="flex flex-1 justify-end items-center gap-2 sm:gap-4 min-w-0">
            <form id="site-search-form" class="relative hidden sm:block w-full max-w-xs lg:max-w-sm">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-lg pointer-events-none">search</span>
              <input id="site-search-input" type="text" placeholder="Search..." autocomplete="off"
                class="w-full h-9 sm:h-10 rounded-full border-none bg-white/10 focus:bg-white/20 focus:ring-1 focus:ring-primary text-white placeholder:text-white/40 pl-9 sm:pl-10 pr-3 sm:pr-4 text-xs sm:text-sm font-normal" />
            </form>
            <button id="site-mobile-search-btn" class="lg:hidden text-white p-2 flex-shrink-0" aria-label="Search" type="button">
              <span class="material-symbols-outlined text-lg sm:text-xl">search</span>
            </button>
          </div>
        </div>
      </header>
    `;

    wireSearch();
  }

  function wireSearch() {
    const form = document.getElementById('site-search-form');
    const input = document.getElementById('site-search-input');
    const mobileBtn = document.getElementById('site-mobile-search-btn');
    if (!form || !input) return;

    const isHome = /(^|\/)index\.html$/.test(window.location.pathname) || window.location.pathname === '/' || window.location.pathname.endsWith('/');

    const submitQuery = (query) => {
      if (!query) return;
      if (isHome) {
        window.dispatchEvent(new CustomEvent('streamcinema:search', { detail: { query } }));
      } else {
        window.location.href = `index.html?q=${encodeURIComponent(query)}`;
      }
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitQuery(input.value.trim());
    });

    mobileBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!form.classList.contains('mobile-visible')) {
        form.classList.add('mobile-visible');
        input.focus();
      } else {
        submitQuery(input.value.trim());
        form.classList.remove('mobile-visible');
      }
    });

    document.addEventListener('click', (e) => {
      if (!form.contains(e.target) && !mobileBtn?.contains(e.target)) {
        form.classList.remove('mobile-visible');
      }
    });

    // If the page was opened as index.html?q=..., run the search once the
    // page signals it's ready to receive it.
    if (isHome) {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q) {
        input.value = q;
        window.dispatchEvent(new CustomEvent('streamcinema:search', { detail: { query: q } }));
      }
    }
  }

  function renderFooter() {
    const container = document.getElementById('site-footer');
    if (!container) return;

    container.innerHTML = `
      <footer class="site-footer">
        <div class="site-footer__grid">
          <div class="site-footer__brand">
            <a href="index.html" class="brand mb-4">
              ${brandMarkSvg()}
              <span class="brand__name" style="font-size:1rem;">Stream<span>Cinema</span></span>
            </a>
            <p class="text-white/50 text-xs sm:text-sm leading-relaxed">Global storytelling. Original series, blockbusters, and documentaries.</p>
          </div>
          <div class="footer-col">
            <h4>Explore</h4>
            <ul>
              <li><a href="index.html#movies-section">Movies</a></li>
              <li><a href="index.html#series-section">TV Series</a></li>
              <li><a href="index.html#anime-section">Anime</a></li>
              <li><a href="mylist.html">My List</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Support</h4>
            <ul>
              <li><a href="#">Help Center</a></li>
              <li><a href="#">Contact Us</a></li>
              <li><a href="#">Devices</a></li>
            </ul>
          </div>
          <div class="footer-col" style="grid-column: span 2 / span 2;">
            <h4>Legal</h4>
            <ul>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Cookie Prefs</a></li>
            </ul>
          </div>
        </div>
        <div class="site-footer__bottom">
          &copy; ${new Date().getFullYear()} StreamCinema. All rights reserved.
        </div>
      </footer>
    `;
  }

  window.StreamCinemaLayout = { renderHeader, renderFooter };
})();
