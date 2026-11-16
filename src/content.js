(() => {
  'use strict';

  const DEFAULT_SETTINGS = {
    enabled: true,
    companies: [],
    scopes: {
      feed: true,
      jobs: true,
      people: true,
      connectionsHelper: true
    },
    wholeWord: true,
    isolateConnections: false
  };

  let settings = structuredClone(DEFAULT_SETTINGS);
  let compiledMatchers = [];
  let lastUrl = location.href;
  let scanScheduled = false;
  let pendingTotalIncrement = 0;
  let storageFlushTimer = null;

  const sessionStats = {
    feed: 0,
    jobs: 0,
    people: 0,
    connectionsMatched: 0
  };

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function compileMatchers(companies, wholeWord) {
    return (companies || [])
      .map((c) => c.trim())
      .filter(Boolean)
      .map((name) => {
        const escaped = escapeRegex(name);
        const pattern = wholeWord
          ? `(?:^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`
          : escaped;
        return {
          name,
          regex: new RegExp(pattern, 'iu')
        };
      });
  }

  function matchCompany(text) {
    if (!text || compiledMatchers.length === 0) return null;
    for (const matcher of compiledMatchers) {
      if (matcher.regex.test(text)) {
        return matcher.name;
      }
    }
    return null;
  }

  function isConnectionsPage() {
    return location.pathname.startsWith('/mynetwork/invite-connect/connections');
  }

  function isJobsPage() {
    return location.pathname.startsWith('/jobs');
  }

  function isSearchPage() {
    return location.pathname.startsWith('/search');
  }

  function isNetworkPage() {
    return location.pathname.startsWith('/mynetwork') && !isConnectionsPage();
  }

  function isFeedPage() {
    return location.pathname === '/' || location.pathname.startsWith('/feed');
  }

  function queueTotalIncrement(delta) {
    if (delta <= 0) return;
    pendingTotalIncrement += delta;
    if (storageFlushTimer) return;
    storageFlushTimer = setTimeout(() => {
      const toAdd = pendingTotalIncrement;
      pendingTotalIncrement = 0;
      storageFlushTimer = null;
      chrome.storage.local.get({ totalHidden: 0 }, (res) => {
        chrome.storage.local.set({ totalHidden: (res.totalHidden || 0) + toAdd });
      });
    }, 800);
  }

  function setCardHidden(el, shouldHide, scopeKey) {
    if (!el) return;
    const alreadyHidden = el.classList.contains('lcf-hidden');
    if (shouldHide && !alreadyHidden) {
      el.classList.add('lcf-hidden');
      el.setAttribute('data-lcf-scope', scopeKey);
      if (!el.dataset.lcfCounted) {
        el.dataset.lcfCounted = '1';
        sessionStats[scopeKey] = (sessionStats[scopeKey] || 0) + 1;
        queueTotalIncrement(1);
      }
    } else if (!shouldHide && alreadyHidden) {
      el.classList.remove('lcf-hidden');
      el.removeAttribute('data-lcf-scope');
    }
  }

  function clearAllHidden() {
    document.querySelectorAll('.lcf-hidden').forEach((el) => {
      el.classList.remove('lcf-hidden');
      el.removeAttribute('data-lcf-scope');
    });
  }

  function clearConnectionsUI() {
    document.querySelectorAll('.lcf-conn-match').forEach((el) => {
      el.classList.remove('lcf-conn-match');
    });
    document.querySelectorAll('.lcf-conn-nonmatch-hidden').forEach((el) => {
      el.classList.remove('lcf-conn-nonmatch-hidden');
    });
    document.querySelectorAll('.lcf-badge').forEach((el) => el.remove());
    document.querySelectorAll('[data-lcf-badged]').forEach((el) => {
      delete el.dataset.lcfBadged;
    });
    const toolbar = document.getElementById('lcf-conn-toolbar');
    if (toolbar) toolbar.remove();
  }

  function processFeed() {
    if (!settings.enabled || !settings.scopes.feed) return;
    const selectors = [
      '.feed-shared-update-v2',
      '[data-urn^="urn:li:activity:"]',
      '[data-id^="urn:li:activity:"]',
      '[data-view-name="feed-full-update"]',
      '[role="article"]'
    ];
    const candidates = document.querySelectorAll(selectors.join(','));
    candidates.forEach((card) => {
      // Skip nested matches if an ancestor is already handled
      const parentCard = card.parentElement?.closest(selectors.join(','));
      if (parentCard) return;

      const text = card.innerText || card.textContent || '';
      const matched = matchCompany(text);
      setCardHidden(card, Boolean(matched), 'feed');
    });
  }

  function findSingleCardContainer(startEl, itemSelectorForUniqueness) {
    let node = startEl;
    let steps = 0;
    while (node && node.parentElement && steps < 8) {
      const parent = node.parentElement;
      const tag = parent.tagName;
      if (tag === 'MAIN' || tag === 'BODY' || tag === 'SECTION' || parent.getAttribute('role') === 'main') {
        break;
      }
      if (parent.querySelectorAll(itemSelectorForUniqueness).length > 1) {
        break;
      }
      node = parent;
      steps += 1;
    }
    return node;
  }

  function processJobs() {
    if (!settings.enabled || !settings.scopes.jobs) return;
    const itemSelectors = [
      'li[data-occludable-job-id]',
      '[data-job-id]',
      '[data-view-name="job-card"]',
      '.job-card-job-posting-card-wrapper',
      '.jobs-search-results__list-item',
      '.scaffold-layout__list-item',
      '.job-card-container',
      '.discovery-templates-entity-item'
    ];
    const seen = new Set();

    const collectContainer = (el) => {
      if (!el) return;
      if (
        el.closest(
          '.jobs-search__job-details, .jobs-details, .job-details-jobs-unified-top-card__container'
        )
      ) {
        return;
      }
      if (seen.has(el)) return;
      seen.add(el);

      const text = el.innerText || el.textContent || '';
      const matched = matchCompany(text);
      setCardHidden(el, Boolean(matched), 'jobs');
    };

    document.querySelectorAll(itemSelectors.join(',')).forEach((el) => {
      const container =
        el.closest(
          'li[data-occludable-job-id], .jobs-search-results__list-item, .scaffold-layout__list-item, li'
        ) || el;
      collectContainer(container);
    });

    // Semantic fallback for hashed-CSS or div-based LinkedIn job lists
    const jobLinkSelector = 'a[href*="/jobs/view/"], a[href*="currentJobId="]';
    document.querySelectorAll(jobLinkSelector).forEach((link) => {
      const container =
        link.closest('li[data-occludable-job-id], [data-job-id], [data-view-name="job-card"], li, [role="listitem"]') ||
        findSingleCardContainer(link, jobLinkSelector);
      collectContainer(container);
    });

    const dismissSelector = 'button[aria-label*="Dismiss"], button[aria-label*="Descartar"]';
    document.querySelectorAll(dismissSelector).forEach((btn) => {
      const container =
        btn.closest('li, [role="listitem"], [data-view-name="job-card"]') ||
        findSingleCardContainer(btn, dismissSelector);
      collectContainer(container);
    });
  }

  function processPeopleAndSearch() {
    if (!settings.enabled || !settings.scopes.people) return;
    const selectors = [
      'li.reusable-search__result-container',
      '[data-chameleon-result-urn]',
      '[data-view-name="search-entity-result-universal-template"]',
      '.discover-entity-type-card',
      'li.discover-fluid-entity-list--item',
      '[data-view-name="cohort-card"]'
    ];
    const seen = new Set();

    const collectContainer = (el) => {
      if (!el || isJobsPage()) return;
      const container =
        el.closest(
          'li.reusable-search__result-container, li.discover-fluid-entity-list--item, li[role="listitem"], li'
        ) || el;
      if (seen.has(container)) return;
      seen.add(container);

      const text = container.innerText || container.textContent || '';
      const matched = matchCompany(text);
      setCardHidden(container, Boolean(matched), 'people');
    };

    document.querySelectorAll(selectors.join(',')).forEach(collectContainer);

    // Semantic fallback for search/network people cards
    if (isSearchPage() || isNetworkPage()) {
      document
        .querySelectorAll('main li a[href*="/in/"]')
        .forEach((link) => collectContainer(link.closest('li')));
    }
  }

  function ensureConnectionsToolbar(matchedCount, totalCount) {
    let toolbar = document.getElementById('lcf-conn-toolbar');
    if (!settings.enabled || !settings.scopes.connectionsHelper || !isConnectionsPage()) {
      if (toolbar) toolbar.remove();
      return;
    }

    const host =
      document.querySelector('.mn-connections__header')?.parentElement ||
      document.querySelector('.mn-connections') ||
      document.querySelector('main');

    if (!host) return;

    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'lcf-conn-toolbar';
      toolbar.className = 'lcf-conn-toolbar';
      toolbar.innerHTML = `
        <div class="lcf-conn-toolbar__info">
          <span class="lcf-conn-toolbar__dot"></span>
          <span id="lcf-conn-summary"></span>
        </div>
        <div class="lcf-conn-toolbar__actions">
          <button type="button" id="lcf-toggle-isolate" class="lcf-conn-btn"></button>
        </div>
      `;
      host.prepend(toolbar);

      toolbar.querySelector('#lcf-toggle-isolate').addEventListener('click', () => {
        const nextVal = !settings.isolateConnections;
        settings.isolateConnections = nextVal;
        chrome.storage.local.set({ isolateConnections: nextVal });
        scheduleScan();
      });
    }

    const summaryEl = toolbar.querySelector('#lcf-conn-summary');
    const toggleBtn = toolbar.querySelector('#lcf-toggle-isolate');
    const companyList = settings.companies.join(', ') || 'none';

    summaryEl.textContent = `LinkedIn Company Filter: ${matchedCount} of ${totalCount} loaded connections match (${companyList})`;
    toggleBtn.textContent = settings.isolateConnections
      ? 'Show all connections'
      : 'Show only matching';
    toggleBtn.classList.toggle('lcf-conn-btn--active', settings.isolateConnections);
  }

  function processConnections() {
    if (!isConnectionsPage()) {
      const toolbar = document.getElementById('lcf-conn-toolbar');
      if (toolbar) toolbar.remove();
      return;
    }

    if (!settings.enabled || !settings.scopes.connectionsHelper) {
      clearConnectionsUI();
      return;
    }

    const cards = document.querySelectorAll('li.mn-connection-card, .mn-connection-card');
    let matchedCount = 0;

    cards.forEach((card) => {
      const text = card.innerText || '';
      const matched = matchCompany(text);

      if (matched) {
        matchedCount += 1;
        card.classList.add('lcf-conn-match');
        card.classList.remove('lcf-conn-nonmatch-hidden');

        if (!card.dataset.lcfBadged) {
          const nameEl =
            card.querySelector('.mn-connection-card__name') ||
            card.querySelector('a[href*="/in/"] span') ||
            card.querySelector('a[href*="/in/"]');
          if (nameEl) {
            const badge = document.createElement('span');
            badge.className = 'lcf-badge';
            badge.textContent = matched;
            nameEl.insertAdjacentElement('afterend', badge);
            card.dataset.lcfBadged = '1';
          }
        }
      } else {
        card.classList.remove('lcf-conn-match');
        card.querySelectorAll('.lcf-badge').forEach((b) => b.remove());
        delete card.dataset.lcfBadged;
        card.classList.toggle('lcf-conn-nonmatch-hidden', Boolean(settings.isolateConnections));
      }
    });

    sessionStats.connectionsMatched = matchedCount;
    ensureConnectionsToolbar(matchedCount, cards.length);
  }

  function runScan() {
    scanScheduled = false;

    if (!settings.enabled || compiledMatchers.length === 0) {
      clearAllHidden();
      clearConnectionsUI();
      return;
    }

    // Re-evaluate hidden elements when scopes or companies change
    if (isFeedPage()) {
      processFeed();
    } else if (isJobsPage()) {
      processJobs();
    } else if (isConnectionsPage()) {
      processConnections();
    } else if (isSearchPage() || isNetworkPage()) {
      processPeopleAndSearch();
      processJobs();
    } else {
      // Fallback: check feed/people/jobs in case of profile/company pages
      processFeed();
      processPeopleAndSearch();
    }
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      setTimeout(runScan, 120);
    });
  }

  function applySettings(raw) {
    settings = {
      ...DEFAULT_SETTINGS,
      ...raw,
      scopes: {
        ...DEFAULT_SETTINGS.scopes,
        ...(raw?.scopes || {})
      }
    };
    compiledMatchers = compileMatchers(settings.companies, settings.wholeWord);
    clearAllHidden();
    clearConnectionsUI();
    scheduleScan();
  }

  function init() {
    chrome.storage.local.get(DEFAULT_SETTINGS, (stored) => {
      applySettings(stored);
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      const relevantKeys = ['enabled', 'companies', 'scopes', 'wholeWord', 'isolateConnections'];
      if (relevantKeys.some((k) => k in changes)) {
        chrome.storage.local.get(DEFAULT_SETTINGS, (stored) => {
          applySettings(stored);
        });
      }
    });

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === 'LCF_GET_STATS') {
        sendResponse({
          sessionStats,
          isConnectionsPage: isConnectionsPage(),
          url: location.href
        });
      }
    });

    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        sessionStats.feed = 0;
        sessionStats.jobs = 0;
        sessionStats.people = 0;
        sessionStats.connectionsMatched = 0;
      }
      scheduleScan();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener('popstate', scheduleScan);
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
