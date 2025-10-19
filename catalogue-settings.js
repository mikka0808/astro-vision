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

const modesContainer = document.getElementById('cataloguePreferenceModes');
const resetButton = document.getElementById('resetCataloguePreferences');
const nightModeToggle = document.getElementById('nightModeToggle');

const defaultSelections = getDefaultCatalogueSelections();
let preferenceState = loadCataloguePreferences();
const catalogueMeta = new Map();

getCatalogueModes().forEach((mode) => {
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

function buildModeFieldset(modeId, catalogues) {
  const meta = MODE_METADATA[modeId] || { icon: '⭐', title: modeId };
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'catalogue-settings__mode';
  fieldset.dataset.mode = modeId;

  const legend = document.createElement('legend');
  legend.className = 'catalogue-settings__legend';
  const titleSpan = document.createElement('span');
  titleSpan.className = 'catalogue-settings__mode-title';
  titleSpan.textContent = `${meta.icon ? `${meta.icon} ` : ''}${meta.title}`;
  legend.appendChild(titleSpan);
  if (meta.description) {
    const hint = document.createElement('span');
    hint.className = 'catalogue-settings__mode-hint';
    hint.textContent = meta.description;
    legend.appendChild(hint);
  }
  fieldset.appendChild(legend);

  const options = document.createElement('div');
  options.className = 'catalogue-settings__options';
  fieldset.appendChild(options);

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
    const label = document.createElement('label');
    label.className = 'catalogue-settings__option';
    if (defaults.has(catalogue.id)) {
      label.classList.add('catalogue-settings__option--recommended');
    }
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = catalogue.id;
    checkbox.checked = (preferenceState[modeId] || []).includes(catalogue.id);
    checkbox.addEventListener('change', (event) => {
      handleCatalogueToggle(modeId, catalogue.id, event.target.checked);
    });
    label.appendChild(checkbox);

    const content = document.createElement('div');
    content.className = 'catalogue-settings__option-content';
    const title = document.createElement('span');
    title.className = 'catalogue-settings__option-title';
    title.textContent = formatCatalogueLabel(catalogue);
    content.appendChild(title);
    const metaText = formatCatalogueMeta(catalogue);
    if (metaText) {
      const metaSpan = document.createElement('span');
      metaSpan.className = 'catalogue-settings__option-meta';
      metaSpan.textContent = metaText;
      content.appendChild(metaSpan);
    }
    label.appendChild(content);
    options.appendChild(label);
  });

  return fieldset;
}

function renderModes(catalogues) {
  if (!modesContainer) return;
  modesContainer.innerHTML = '';
  const orderedModes = getCatalogueModes();
  orderedModes.forEach((modeId) => {
    const fieldset = buildModeFieldset(modeId, catalogues);
    modesContainer.appendChild(fieldset);
  });
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
    renderModes(validCatalogues);
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
    renderModes(Array.from(catalogueMeta.values()));
  });
}

if (nightModeToggle) {
  nightModeToggle.addEventListener('click', () => {
    const next = !document.body.classList.contains('night-mode');
    applyNightMode(next);
  });
}

initNightMode();
loadCatalogues();
