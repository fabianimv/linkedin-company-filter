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
    isolateConnections: false,
    totalHidden: 0
  };

  const els = {
    enabledToggle: document.getElementById('enabledToggle'),
    pageHiddenCount: document.getElementById('pageHiddenCount'),
    totalHiddenCount: document.getElementById('totalHiddenCount'),
    addCompanyForm: document.getElementById('addCompanyForm'),
    companyInput: document.getElementById('companyInput'),
    companyList: document.getElementById('companyList'),
    scopeFeed: document.getElementById('scopeFeed'),
    scopeJobs: document.getElementById('scopeJobs'),
    scopePeople: document.getElementById('scopePeople'),
    scopeConnections: document.getElementById('scopeConnections'),
    wholeWordToggle: document.getElementById('wholeWordToggle'),
    openConnectionsBtn: document.getElementById('openConnectionsBtn'),
    resetBtn: document.getElementById('resetBtn')
  };

  let state = structuredClone(DEFAULT_SETTINGS);

  function renderCompanies() {
    els.companyList.innerHTML = '';
    if (!state.companies.length) {
      const empty = document.createElement('span');
      empty.className = 'empty-msg';
      empty.textContent = 'No companies blocked yet.';
      els.companyList.appendChild(empty);
      return;
    }

    state.companies.forEach((company) => {
      const chip = document.createElement('span');
      chip.className = 'chip';

      const label = document.createElement('span');
      label.textContent = company;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.title = `Remove ${company}`;
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        state.companies = state.companies.filter((c) => c !== company);
        chrome.storage.local.set({ companies: state.companies });
        renderCompanies();
      });

      chip.appendChild(label);
      chip.appendChild(removeBtn);
      els.companyList.appendChild(chip);
    });
  }

  function renderUI() {
    els.enabledToggle.checked = Boolean(state.enabled);
    els.totalHiddenCount.textContent = String(state.totalHidden || 0);
    els.scopeFeed.checked = Boolean(state.scopes?.feed);
    els.scopeJobs.checked = Boolean(state.scopes?.jobs);
    els.scopePeople.checked = Boolean(state.scopes?.people);
    els.scopeConnections.checked = Boolean(state.scopes?.connectionsHelper);
    els.wholeWordToggle.checked = Boolean(state.wholeWord);
    renderCompanies();
  }

  function fetchActiveTabStats() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      if (!tab?.id || !tab.url?.includes('linkedin.com')) {
        els.pageHiddenCount.textContent = '0';
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: 'LCF_GET_STATS' }, (res) => {
        if (chrome.runtime.lastError || !res?.sessionStats) {
          els.pageHiddenCount.textContent = '0';
          return;
        }
        const s = res.sessionStats;
        const pageTotal = (s.feed || 0) + (s.jobs || 0) + (s.people || 0);
        els.pageHiddenCount.textContent = String(pageTotal);
      });
    });
  }

  function bindEvents() {
    els.enabledToggle.addEventListener('change', () => {
      state.enabled = els.enabledToggle.checked;
      chrome.storage.local.set({ enabled: state.enabled });
    });

    els.addCompanyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = els.companyInput.value.trim();
      if (!raw) return;

      const exists = state.companies.some(
        (c) => c.toLowerCase() === raw.toLowerCase()
      );
      if (!exists) {
        state.companies.push(raw);
        chrome.storage.local.set({ companies: state.companies });
        renderCompanies();
      }
      els.companyInput.value = '';
    });

    const saveScopes = () => {
      state.scopes = {
        feed: els.scopeFeed.checked,
        jobs: els.scopeJobs.checked,
        people: els.scopePeople.checked,
        connectionsHelper: els.scopeConnections.checked
      };
      chrome.storage.local.set({ scopes: state.scopes });
    };

    els.scopeFeed.addEventListener('change', saveScopes);
    els.scopeJobs.addEventListener('change', saveScopes);
    els.scopePeople.addEventListener('change', saveScopes);
    els.scopeConnections.addEventListener('change', saveScopes);

    els.wholeWordToggle.addEventListener('change', () => {
      state.wholeWord = els.wholeWordToggle.checked;
      chrome.storage.local.set({ wholeWord: state.wholeWord });
    });

    els.openConnectionsBtn.addEventListener('click', () => {
      chrome.tabs.create({
        url: 'https://www.linkedin.com/mynetwork/invite-connect/connections/'
      });
    });

    els.resetBtn.addEventListener('click', () => {
      const keepTotal = state.totalHidden || 0;
      state = {
        ...structuredClone(DEFAULT_SETTINGS),
        totalHidden: keepTotal
      };
      chrome.storage.local.set(state, renderUI);
    });
  }

  chrome.storage.local.get(DEFAULT_SETTINGS, (stored) => {
    state = {
      ...structuredClone(DEFAULT_SETTINGS),
      ...stored,
      scopes: {
        ...DEFAULT_SETTINGS.scopes,
        ...(stored?.scopes || {})
      }
    };
    renderUI();
    fetchActiveTabStats();
  });

  bindEvents();
})();
