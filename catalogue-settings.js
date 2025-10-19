import { NIGHT_MODE_STORAGE_KEY } from './astro-core.js';
import { parseCataloguePayload } from './catalogue-data.js';
import {
  getCatalogueModes,
  getDefaultCatalogueSelections,
  loadCataloguePreferences,
  persistCataloguePreferences,
  resetCataloguePreferences
} from './catalogue-preferences.js';

const MODE_METADATA = {
  visual: {
    icon: '🌙',
    title: 'Observation visuelle directe',
    description: 'Messier, Caldwell et NGC lumineux adaptés au ciel urbain.'
  },
  research: {
    icon: '🛰️',
    title: 'Visuel assisté (EAA)',
    description: 'Messier, Caldwell, NGC et nébuleuses Sharpless pour le live stacking.'
  },
  astrophoto: {
    icon: '📸',
    title: 'Astrophotographie',
    description: 'Messier, Caldwell, NGC/IC et catalogues étendus pour la longue pose.'
  }
};

const tabsContainer = document.getElementById('cataloguePreferenceTabs');
const modeShell = document.getElementById('cataloguePreferenceModeShell');
if (modeShell) {
  modeShell.setAttribute('role', 'tabpanel');
}
if (tabsContainer) {
  tabsContainer.addEventListener('keydown', (event) => {
    const targetTab = event.target.closest('.catalogue-settings__tab');
    if (!targetTab) return;
    if (!availableModes.length) return;
    const currentIndex = availableModes.indexOf(targetTab.dataset.mode);
    if (currentIndex === -1) return;
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % availableModes.length;
      event.preventDefault();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + availableModes.length) % availableModes.length;
      event.preventDefault();
    } else if (event.key === 'Home') {
      nextIndex = 0;
      event.preventDefault();
    } else if (event.key === 'End') {
      nextIndex = availableModes.length - 1;
      event.preventDefault();
    } else {
      return;
    }
    const nextMode = availableModes[nextIndex];
    if (nextMode) {
      setActiveMode(nextMode);
    }
  });
}
const resetButton = document.getElementById('resetCataloguePreferences');
const nightModeToggle = document.getElementById('nightModeToggle');

const defaultSelections = getDefaultCatalogueSelections();
let preferenceState = loadCataloguePreferences();
const availableModes = getCatalogueModes();
let activeMode = availableModes[0] || null;
let loadedCatalogues = [];
const catalogueMeta = new Map();

availableModes.forEach((mode) => {
  if (!Array.isArray(preferenceState[mode])) {
    preferenceState[mode] = [...(defaultSelections[mode] || [])];
  }
});

function applyNightMode(enabled, { persist = true } = {}) {
  document.body.classList.toggle('night-mode', enabled);
  if (nightModeToggle) {
    nightModeToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    nightModeToggle.classList.toggle('is-active', enabled);
    nightModeToggle.textContent = enabled ? '🌅 Mode jour' : '🔦 Mode nuit';
  }
  if (persist) {
    try {
      localStorage.setItem(NIGHT_MODE_STORAGE_KEY, enabled ? '1' : '0');
    } catch (error) {
      console.warn('Impossible de sauvegarder le mode nuit :', error);
    }
  }
}

function initNightMode() {
  let stored = null;
  try {
    stored = localStorage.getItem(NIGHT_MODE_STORAGE_KEY);
  } catch (error) {
    stored = null;
  }
  const enabled = stored === '1' || stored === 'true';
  applyNightMode(enabled, { persist: false });
}

function formatCatalogueLabel(catalogue) {
  if (!catalogue) return '';
  const prefix = catalogue.abbreviation ? `${catalogue.abbreviation} — ` : '';
  return `${prefix}${catalogue.name}`;
}

function formatCatalogueMeta(catalogue) {
  if (!catalogue) return '';
  const details = [];
  if (catalogue.focus) {
    details.push(catalogue.focus);
  }
  if (catalogue.coverage) {
    details.push(catalogue.coverage);
  }
  return details.join(' · ');
}

function handleCatalogueToggle(modeId, catalogueId, checked) {
  const current = new Set(Array.isArray(preferenceState[modeId]) ? preferenceState[modeId] : []);
  if (checked) {
    current.add(catalogueId);
  } else {
    current.delete(catalogueId);
  }
  preferenceState[modeId] = Array.from(current);
  persistCataloguePreferences(preferenceState);
}

function renderTabs() {
  if (!tabsContainer) return;
  tabsContainer.innerHTML = '';
  tabsContainer.setAttribute('role', 'tablist');
  availableModes.forEach((modeId) => {
    const meta = MODE_METADATA[modeId] || { icon: '⭐', title: modeId };
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'catalogue-settings__tab';
    button.id = `catalogue-tab-${modeId}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', modeId === activeMode ? 'true' : 'false');
    button.setAttribute('aria-controls', 'cataloguePreferenceModeShell');
    button.setAttribute('tabindex', modeId === activeMode ? '0' : '-1');
    button.dataset.mode = modeId;
    const icon = document.createElement('span');
    icon.className = 'catalogue-settings__tab-icon';
    icon.textContent = meta.icon || '⭐';
    button.appendChild(icon);
    const label = document.createElement('span');
    label.textContent = meta.title || modeId;
    button.appendChild(label);
    button.addEventListener('click', () => {
      if (activeMode !== modeId) {
        setActiveMode(modeId);
      }
    });
    tabsContainer.appendChild(button);
  });
  if (modeShell && activeMode) {
    modeShell.setAttribute('aria-labelledby', `catalogue-tab-${activeMode}`);
  }
}

function buildModeSection(modeId, catalogues) {
  const meta = MODE_METADATA[modeId] || { icon: '⭐', title: modeId };
  const container = document.createElement('div');
  container.className = 'catalogue-settings__mode-content';
  container.dataset.mode = modeId;

  const header = document.createElement('div');
  header.className = 'catalogue-settings__mode-header';
  const title = document.createElement('h3');
  title.className = 'catalogue-settings__mode-title';
  title.textContent = `${meta.icon ? `${meta.icon} ` : ''}${meta.title || modeId}`;
  header.appendChild(title);
  if (meta.description) {
    const hint = document.createElement('p');
    hint.className = 'catalogue-settings__mode-hint';
    hint.textContent = meta.description;
    header.appendChild(hint);
  }
  container.appendChild(header);

  const options = document.createElement('div');
  options.className = 'catalogue-settings__options';
  container.appendChild(options);

  const defaults = new Map((defaultSelections[modeId] || []).map((id, index) => [id, index]));
  const orderedCatalogues = [...catalogues].sort((a, b) => {
    const aRank = defaults.has(a.id) ? defaults.get(a.id) : 1000;
    const bRank = defaults.has(b.id) ? defaults.get(b.id) : 1000;
    if (aRank !== bRank) {
      return aRank - bRank;
    }
    return (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
  });

  orderedCatalogues.forEach((catalogue) => {
    const option = document.createElement('label');
    option.className = 'catalogue-settings__option';
    if (defaults.has(catalogue.id)) {
      option.classList.add('catalogue-settings__option--recommended');
    }

    const row = document.createElement('div');
    row.className = 'catalogue-settings__option-row';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = catalogue.id;
    checkbox.checked = (preferenceState[modeId] || []).includes(catalogue.id);
    checkbox.id = `catalogue-option-${modeId}-${catalogue.id}`;
    checkbox.addEventListener('change', (event) => {
      handleCatalogueToggle(modeId, catalogue.id, event.target.checked);
    });
    row.appendChild(checkbox);

    const title = document.createElement('span');
    title.className = 'catalogue-settings__option-title';
    title.textContent = formatCatalogueLabel(catalogue);
    row.appendChild(title);

    if (defaults.has(catalogue.id)) {
      const badge = document.createElement('span');
      badge.className = 'catalogue-settings__option-badge';
      badge.textContent = 'Recommandé';
      row.appendChild(badge);
    }
    option.appendChild(row);

    const metaText = formatCatalogueMeta(catalogue);
    if (metaText) {
      const metaSpan = document.createElement('span');
      metaSpan.className = 'catalogue-settings__option-meta';
      metaSpan.textContent = metaText;
      option.appendChild(metaSpan);
    }

    options.appendChild(option);
  });

  return container;
}

function renderMode(modeId, catalogues) {
  if (!modeShell) return;
  modeShell.innerHTML = '';
  modeShell.dataset.mode = modeId;
  if (!catalogues.length) {
    const empty = document.createElement('p');
    empty.className = 'catalogue-settings__mode-hint';
    empty.textContent = 'Aucun catalogue disponible.';
    modeShell.appendChild(empty);
    return;
  }
  const section = buildModeSection(modeId, catalogues);
  modeShell.appendChild(section);
}

function setActiveMode(modeId) {
  if (!availableModes.includes(modeId)) return;
  activeMode = modeId;
  renderTabs();
  renderMode(modeId, loadedCatalogues);
  if (modeShell) {
    modeShell.setAttribute('aria-labelledby', `catalogue-tab-${modeId}`);
  }
  if (tabsContainer) {
    const activeTab = tabsContainer.querySelector(`.catalogue-settings__tab[data-mode="${modeId}"]`);
    if (activeTab) {
      activeTab.focus();
    }
  }
}

async function loadCatalogues() {
  if (resetButton) {
    resetButton.disabled = true;
  }
  try {
    const response = await fetch('objects.json');
    if (!response.ok) {
      throw new Error('Impossible de charger la base de catalogues.');
    }
    const payload = await response.json();
    const { catalogues } = parseCataloguePayload(payload);
    const validCatalogues = Array.isArray(catalogues) ? catalogues : [];
    catalogueMeta.clear();
    validCatalogues.forEach((catalogue) => {
      catalogueMeta.set(catalogue.id, catalogue);
    });
    loadedCatalogues = validCatalogues;
    if (!activeMode) {
      activeMode = availableModes[0] || null;
    }
    renderTabs();
    if (activeMode) {
      renderMode(activeMode, loadedCatalogues);
    }
    if (resetButton) {
      resetButton.disabled = false;
    }
  } catch (error) {
    console.error(error);
    if (resetButton) {
      resetButton.disabled = true;
    }
  }
}

if (resetButton) {
  resetButton.addEventListener('click', () => {
    preferenceState = resetCataloguePreferences();
    persistCataloguePreferences(preferenceState);
    loadedCatalogues = Array.from(catalogueMeta.values());
    if (activeMode) {
      renderMode(activeMode, loadedCatalogues);
    }
  });
}

if (nightModeToggle) {
  nightModeToggle.addEventListener('click', () => {
    const next = !document.body.classList.contains('night-mode');
    applyNightMode(next);
  });
}

initNightMode();
renderTabs();
loadCatalogues();
