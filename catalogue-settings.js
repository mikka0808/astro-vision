import { NIGHT_MODE_STORAGE_KEY } from './src/core/astro.js';
import { parseCataloguePayload } from './catalogue-data.js';
import {
  flattenCataloguePreferences,
  getCatalogueModes,
  getDefaultCatalogueSelections,
  loadCataloguePreferences,
  persistCataloguePreferences,
  resetCataloguePreferences
} from './catalogue-preferences.js';

const MODE_METADATA = {
  visual: {
    icon: '🌙',
    label: 'Observation visuelle',
    shortLabel: 'Visuel',
    description: 'Objets lumineux et contrastés pour le télescope ou les jumelles.'
  },
  research: {
    icon: '🛰️',
    label: 'Visuel assisté (EAA)',
    shortLabel: 'Visuel assisté',
    description: 'Live stacking et visuel assisté avec caméras sensibles.'
  },
  astrophoto: {
    icon: '📸',
    label: 'Astrophotographie',
    shortLabel: 'Astrophotographie',
    description: 'Catalogue adaptés aux poses longues et aux filtres étroits.'
  }
};

const legendContainer = document.getElementById('catalogueUsageLegend');
const listContainer = document.getElementById('cataloguePreferenceList');
const resetButton = document.getElementById('resetCataloguePreferences');
const nightModeToggle = document.getElementById('nightModeToggle');

const defaultSelections = getDefaultCatalogueSelections();
let preferenceState = loadCataloguePreferences();
const availableModes = getCatalogueModes().filter((mode) => MODE_METADATA[mode]);
const recommendedByMode = new Map(
  availableModes.map((mode) => [mode, new Set(defaultSelections[mode] || [])])
);
let selectedCatalogueIds = new Set(flattenCataloguePreferences(preferenceState));
const catalogueMeta = new Map();

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

function describeUsageWeight(weight) {
  if (!Number.isFinite(weight)) {
    return 'Usage limité';
  }
  if (weight >= 1.05) {
    return 'Très favorable';
  }
  if (weight >= 0.75) {
    return 'Favorable';
  }
  if (weight >= 0.45) {
    return 'Utilisable';
  }
  return 'Usage limité';
}

function classifyUsageWeight(weight) {
  if (!Number.isFinite(weight) || weight < 0.35) {
    return 'limited';
  }
  if (weight >= 1.05) {
    return 'strong';
  }
  if (weight >= 0.75) {
    return 'recommended';
  }
  return 'usable';
}

function renderUsageLegend() {
  if (!legendContainer) return;
  legendContainer.innerHTML = '';
  if (!availableModes.length) {
    return;
  }
  availableModes.forEach((mode) => {
    const meta = MODE_METADATA[mode];
    const item = document.createElement('div');
    item.className = 'catalogue-settings__legend-item';

    const icon = document.createElement('span');
    icon.className = 'catalogue-settings__legend-icon';
    icon.textContent = meta.icon;
    item.appendChild(icon);

    const copy = document.createElement('div');
    copy.className = 'catalogue-settings__legend-copy';

    const title = document.createElement('span');
    title.className = 'catalogue-settings__legend-title';
    title.textContent = meta.label;
    copy.appendChild(title);

    if (meta.description) {
      const desc = document.createElement('span');
      desc.className = 'catalogue-settings__legend-desc';
      desc.textContent = meta.description;
      copy.appendChild(desc);
    }

    item.appendChild(copy);
    legendContainer.appendChild(item);
  });
}

function buildUsageTag(modeId, catalogue) {
  const meta = MODE_METADATA[modeId];
  const weights = catalogue?.observationWeights || {};
  const weight = Number.isFinite(weights[modeId]) ? weights[modeId] : Number(weights[modeId]);
  const resolvedWeight = Number.isFinite(weight) ? weight : 0;
  const level = classifyUsageWeight(resolvedWeight);
  const recommended = recommendedByMode.get(modeId)?.has(catalogue.id);

  const tag = document.createElement('span');
  tag.className = 'catalogue-settings__usage-tag';
  tag.dataset.level = level;
  tag.textContent = `${meta.icon} ${meta.shortLabel || meta.label}`;
  tag.title = `${meta.label} — ${describeUsageWeight(resolvedWeight)}`;
  tag.setAttribute('aria-label', `${meta.label} : ${describeUsageWeight(resolvedWeight)}`);
  if (recommended) {
    tag.classList.add('catalogue-settings__usage-tag--recommended');
  }
  if (level === 'limited') {
    tag.classList.add('catalogue-settings__usage-tag--limited');
  }
  return tag;
}

function syncPreferenceState() {
  const next = Array.from(selectedCatalogueIds);
  availableModes.forEach((mode) => {
    preferenceState[mode] = [...next];
  });
  persistCataloguePreferences(preferenceState);
}

function handleCatalogueToggle(catalogueId, checked, optionNode) {
  if (!catalogueId) return;
  const next = new Set(selectedCatalogueIds);
  if (checked) {
    next.add(catalogueId);
  } else {
    next.delete(catalogueId);
  }
  selectedCatalogueIds = next;
  if (optionNode) {
    optionNode.classList.toggle('catalogue-settings__option--active', checked);
  }
  syncPreferenceState();
}

function renderCatalogueList(catalogues) {
  if (!listContainer) return;
  listContainer.innerHTML = '';
  if (!Array.isArray(catalogues) || catalogues.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'catalogue-settings__empty';
    empty.textContent = 'Aucun catalogue disponible pour le moment.';
    listContainer.appendChild(empty);
    return;
  }

  const ordered = [...catalogues].sort((a, b) => {
    return (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
  });

  ordered.forEach((catalogue) => {
    const option = document.createElement('label');
    option.className = 'catalogue-settings__option';
    option.dataset.catalogueId = catalogue.id;

    const selected = selectedCatalogueIds.has(catalogue.id);
    if (selected) {
      option.classList.add('catalogue-settings__option--active');
    }
    const isRecommended = availableModes.some((mode) => recommendedByMode.get(mode)?.has(catalogue.id));
    if (isRecommended) {
      option.classList.add('catalogue-settings__option--recommended');
    }

    const row = document.createElement('div');
    row.className = 'catalogue-settings__option-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = catalogue.id;
    checkbox.checked = selected;
    checkbox.id = `catalogue-option-${catalogue.id}`;
    checkbox.addEventListener('change', (event) => {
      handleCatalogueToggle(catalogue.id, event.target.checked, option);
    });
    row.appendChild(checkbox);

    const info = document.createElement('div');
    info.className = 'catalogue-settings__option-info';

    const title = document.createElement('span');
    title.className = 'catalogue-settings__option-title';
    title.textContent = formatCatalogueLabel(catalogue);
    info.appendChild(title);

    const metaText = formatCatalogueMeta(catalogue);
    if (metaText) {
      const meta = document.createElement('span');
      meta.className = 'catalogue-settings__option-meta';
      meta.textContent = metaText;
      info.appendChild(meta);
    }

    if (catalogue.description) {
      const desc = document.createElement('span');
      desc.className = 'catalogue-settings__option-desc';
      desc.textContent = catalogue.description;
      info.appendChild(desc);
    }

    row.appendChild(info);
    option.appendChild(row);

    if (availableModes.length) {
      const usageRow = document.createElement('div');
      usageRow.className = 'catalogue-settings__usage';
      availableModes.forEach((mode) => {
        usageRow.appendChild(buildUsageTag(mode, catalogue));
      });
      option.appendChild(usageRow);
    }

    listContainer.appendChild(option);
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
    renderCatalogueList(validCatalogues);
    if (resetButton) {
      resetButton.disabled = false;
    }
  } catch (error) {
    console.error(error);
    if (resetButton) {
      resetButton.disabled = true;
    }
    if (listContainer) {
      listContainer.innerHTML = '';
      const errorNode = document.createElement('p');
      errorNode.className = 'catalogue-settings__empty';
      errorNode.textContent = 'Erreur lors du chargement des catalogues.';
      listContainer.appendChild(errorNode);
    }
  }
}

if (resetButton) {
  resetButton.addEventListener('click', () => {
    resetCataloguePreferences();
    preferenceState = getDefaultCatalogueSelections();
    selectedCatalogueIds = new Set(flattenCataloguePreferences(preferenceState));
    syncPreferenceState();
    renderCatalogueList(Array.from(catalogueMeta.values()));
  });
}

if (nightModeToggle) {
  nightModeToggle.addEventListener('click', () => {
    const next = !document.body.classList.contains('night-mode');
    applyNightMode(next);
  });
}

initNightMode();
syncPreferenceState();
renderUsageLegend();
loadCatalogues();
