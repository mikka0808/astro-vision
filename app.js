import {
  SESSION_STORAGE_KEY,
  NIGHT_MODE_STORAGE_KEY,
  applyWeather,
  buildObservationDate,
  buildWeatherSummary,
  bortleDescriptions,
  computeMoonPhase,
  describeAzimuth,
  describeAerosolLoad,
  describeDewRisk,
  describeSeeingQuality,
  describeTransparencyQuality,
  enrichCatalogueData,
  evaluateTargets,
  formatAltitude,
  formatArcseconds,
  formatIllumination,
  formatLocalDateTime,
  formatLocalTime,
  formatCoordinate,
  localSiderealTime,
  getUpcomingEvents,
  parseCoordinate,
  selectTopTargets,
  computeDecisionInsights,
  resolveScoreTone,
  getAstrophotoProfile
} from './src/core/astro.js';
import { computeMoonSession } from './src/core/lune.js';
import { focaleEffective, fovDeg, echantillonnage } from './src/utils/optique.js';
import { readStorage, writeStorage } from './src/utils/storage.js';
import {
  parseCataloguePayload,
  fetchCatalogueObjectsFromSource,
  getCatalogueSourceSummary
} from './catalogue-data.js';
import { loadScorePreferencesFromCookie } from './score-preferences.js';
import {
  filterCataloguesForPreferences,
  filterObjectsForPreferences,
  flattenCataloguePreferences,
  getCatalogueModes,
  getDefaultCatalogueSelections,
  loadCataloguePreferences
} from './catalogue-preferences.js';

loadScorePreferencesFromCookie();

const defaultCatalogueSelections = getDefaultCatalogueSelections();
const storedCataloguePreferences = loadCataloguePreferences();
const catalogueModeOrder = getCatalogueModes();
const allowedCatalogueIds = flattenCataloguePreferences(storedCataloguePreferences);
const allowedCatalogueSet = new Set(allowedCatalogueIds);
const catalogueAvailability = new Map();

function isCatalogueAllowed(catalogueId) {
  if (allowedCatalogueSet.size === 0) {
    return false;
  }
  if (typeof catalogueId !== 'string') {
    return false;
  }
  const normalized = catalogueId.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return allowedCatalogueSet.has(normalized);
}

const sessionForm = document.getElementById('sessionForm');
const addressInput = document.getElementById('addressLookup');
const addressSuggestionList = document.getElementById('addressSuggestions');
const resolveAddressBtn = document.getElementById('resolveAddress');
const useGeolocBtn = document.getElementById('useGeoloc');
const latitudeInput = document.getElementById('latitude');
const longitudeInput = document.getElementById('longitude');
const dateInput = document.getElementById('sessionDate');
const timeInput = document.getElementById('sessionTime');
const durationSelect = document.getElementById('sessionDuration');
const useSunsetBtn = document.getElementById('useSunset');
const sunsetHint = document.getElementById('sunsetHint');
const bortleInput = document.getElementById('bortle');
const bortleValue = document.getElementById('bortleValue');
const refreshBortleBtn = document.getElementById('refreshBortle');
const bortleHint = document.getElementById('bortleHint');
const observationModeInputs = document.querySelectorAll('input[name="observationMode"]');
const catalogueSelection = document.getElementById('catalogueSelection');
const catalogueSelectionSummary = document.getElementById('catalogueSelectionSummary');
const catalogueSelectionBadge = document.getElementById('catalogueSelectionBadge');
const catalogueSelectionDetails = document.getElementById('catalogueSelectionDetails')
  || (catalogueSelection ? catalogueSelection.closest('details') : null);
const selectAllCataloguesButton = document.getElementById('selectAllCatalogues');
const clearCatalogueSelectionButton = document.getElementById('clearCatalogueSelection');
const catalogueHint = document.getElementById('catalogueHint');
const weatherPanel = document.getElementById('weatherPanel');
const weatherSummary = document.getElementById('weatherSummary');
const weatherHighlights = document.getElementById('weatherHighlights');
const weatherDetails = document.getElementById('weatherDetails');
const moonPanel = document.getElementById('moonPanel');
const moonSummary = document.getElementById('moonSummary');
const moonVisual = document.getElementById('moonVisual');
const moonEmoji = document.getElementById('moonEmoji');
const moonPhaseLabel = document.getElementById('moonPhaseLabel');
const moonIllumination = document.getElementById('moonIllumination');
const moonDetails = document.getElementById('moonDetails');
const eventsPanel = document.getElementById('eventsPanel');
const eventsList = document.getElementById('eventsList');
const eventsHint = document.getElementById('eventsHint');
const resultsPanel = document.getElementById('resultsPanel');
const resultsHint = document.getElementById('resultsHint');
const targetsList = document.getElementById('targets');
const filterSummary = document.getElementById('filterSummary');
const typeFilterOptions = document.getElementById('typeFilterOptions');
const spinnerButtons = document.querySelectorAll('.spinner-btn');
const decisionPanel = document.getElementById('decisionPanel');
const decisionSummary = document.getElementById('decisionSummary');
const globalScoreValue = document.getElementById('globalScoreValue');
const globalScoreGauge = document.getElementById('globalScoreGauge');
const globalScoreDetails = document.getElementById('globalScoreDetails');
const decisionGlobalCard = document.getElementById('decisionGlobal');
const globalScoreMeter = decisionGlobalCard ? decisionGlobalCard.querySelector('.score-meter') : null;
const decisionCalendarList = document.getElementById('decisionCalendarList');
const decisionAlertsList = document.getElementById('decisionAlertsList');
const decisionAstrophotoList = document.getElementById('decisionAstrophotoList');
const astrophotoSummary = document.getElementById('astrophotoSummary');
const enableAstrophotoInput = document.getElementById('enableAstrophoto');
const equipmentSelect = document.getElementById('equipmentProfile');
const astrophotoGuidancePanel = document.getElementById('astrophotoGuidance');
const astrophotoGuidanceSummary = document.getElementById('astrophotoGuidanceSummary');
const astrophotoGuidanceFacts = document.getElementById('astrophotoGuidanceFacts');
const astrophotoGuidanceChecklist = document.getElementById('astrophotoGuidanceChecklist');
const astrophotoGuidanceActions = document.getElementById('astrophotoGuidanceActions');
const astrophotoChecklistExportBtn = document.getElementById('exportAstroChecklist');
const panelToggleButtons = document.querySelectorAll('[data-panel-toggle]');
const nightModeToggle = document.getElementById('nightModeToggle');
const skyMapPanel = document.getElementById('skyMapPanel');
const skyMapSummary = document.getElementById('skyMapSummary');
const skyMapBody = document.getElementById('skyMapBody');
const skyMapContainer = document.getElementById('skyMapContainer');
const skyMapTimeInput = document.getElementById('skyMapTime');
const skyMapLocationHint = document.getElementById('skyMapLocationHint');

const contextPanels = new Map();

const defaultDurationOptions = durationSelect
  ? Array.from(durationSelect.options).map((option) => ({ value: option.value, label: option.textContent }))
  : [];
const defaultDurationValue = durationSelect ? durationSelect.value : '2';

const SESSION_SNAPSHOT_VERSION = 8;
const ASTROPHOTO_STORAGE_KEY = 'astro:photo-mode';
const FULL_FRAME_DIAGONAL_MM = 43.26661530799898;
let objectsCatalog = [];
let catalogueDefinitions = [];
let cachedNightStartTime = null;
let sunsetDebounce = null;
let cachedResults = [];
let cachedWeather = null;
let cachedMoon = null;
let cachedEvents = [];
let cachedContext = null;
let cachedDecision = null;
let cachedSourceObjects = [];
let astrophotoSettings = { enabled: false, profileId: 'visual' };
let bortleDebounce = null;
let lastBortleSummary = '';
let skyMapLoaderPromise = null;
let skyMapInstance = null;
let skyMapOverlay = null;
let autoGeolocAttempted = false;
const skyMapState = { context: null, targets: [], selectedISO: null, ready: false };
const catalogueCheckboxMap = new Map();
const catalogueSelectionByMode = new Map();
catalogueAvailability.forEach((selection, mode) => {
  catalogueSelectionByMode.set(mode, [...selection]);
});
const catalogueMetaMap = new Map();
let catalogueSources = new Map();
const catalogueLoadPromises = new Map();
const loadedCatalogueIds = new Set();
const objectSlugIndex = new Map();
let objectsCatalogRaw = [];
let computedNightDurationHours = null;
let computedNightSessionSlots = null;
let computedNightStartDate = null;
let computedNightEndDate = null;
let addressSuggestionFetchTimeout = null;
let addressSuggestionAbortController = null;
let addressSuggestionsData = [];
let chartsModulePromise = null;

function loadChartsModule() {
  if (!chartsModulePromise) {
    chartsModulePromise = import('./charts.js').catch((error) => {
      chartsModulePromise = null;
      throw error;
    });
  }
  return chartsModulePromise;
}

function loadAstrophotoPreferences() {
  const stored = readStorage(ASTROPHOTO_STORAGE_KEY, { fallback: null });
  if (!stored || typeof stored !== 'object') {
    return null;
  }
  const profileId = typeof stored.profileId === 'string' && stored.profileId.trim() ? stored.profileId.trim() : 'visual';
  return { enabled: Boolean(stored.enabled), profileId };
}

function persistAstrophotoPreferences(settings) {
  if (!settings || typeof settings !== 'object') {
    writeStorage(ASTROPHOTO_STORAGE_KEY, null, { removeOnNull: true });
    return;
  }
  const payload = {
    enabled: Boolean(settings.enabled),
    profileId: typeof settings.profileId === 'string' && settings.profileId.trim() ? settings.profileId.trim() : 'visual'
  };
  writeStorage(ASTROPHOTO_STORAGE_KEY, payload);
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatArcminutes(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  if (value >= 120) {
    return `${(value / 60).toFixed(1)}°`;
  }
  if (value >= 10) {
    return `${value.toFixed(0)}′`;
  }
  return `${value.toFixed(1)}′`;
}

function formatFieldArcminutes(width, height) {
  const widthText = formatArcminutes(width);
  const heightText = formatArcminutes(height);
  if (!widthText || !heightText) {
    return null;
  }
  return `${widthText} × ${heightText}`;
}

function formatSamplingArcsec(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  if (value >= 1) {
    return `${value.toFixed(2)}″/px`;
  }
  return `${value.toFixed(3)}″/px`;
}

function formatExposureSeconds(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  if (seconds >= 120) {
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.round(seconds % 60);
    if (remainder === 0) {
      return `${minutes} min`;
    }
    return `${minutes} min ${remainder} s`;
  }
  if (seconds >= 10) {
    return `${Math.round(seconds)} s`;
  }
  if (seconds >= 1) {
    return `${seconds.toFixed(1)} s`;
  }
  return `${seconds.toFixed(2)} s`;
}

function computeAstrophotoMetrics(profile) {
  const setup = profile?.setup;
  if (!setup || !setup.sensor) {
    return null;
  }
  const focaleMm = Number(setup.focaleMm);
  const apertureMm = Number(setup.apertureMm);
  const reducteur = Number(setup.reducteur);
  const bin = Number.isFinite(setup.bin) && setup.bin > 0 ? setup.bin : 1;
  const widthMm = Number(setup.sensor.widthMm);
  const heightMm = Number(setup.sensor.heightMm);
  const pixelUm = Number(setup.sensor.pixelUm);
  if (!Number.isFinite(focaleMm) || focaleMm <= 0) {
    return null;
  }
  if (!Number.isFinite(widthMm) || widthMm <= 0 || !Number.isFinite(heightMm) || heightMm <= 0) {
    return null;
  }
  if (!Number.isFinite(pixelUm) || pixelUm <= 0) {
    return null;
  }
  const ratio = Number.isFinite(reducteur) && reducteur > 0 ? reducteur : 1;
  const focaleEff = focaleEffective(focaleMm, ratio);
  const sampling = echantillonnage(pixelUm, focaleEff, bin);
  const widthArcmin = fovDeg(widthMm, focaleEff) * 60;
  const heightArcmin = fovDeg(heightMm, focaleEff) * 60;
  const diagonal = Math.sqrt(widthMm * widthMm + heightMm * heightMm);
  const cropFactor = diagonal > 0 ? FULL_FRAME_DIAGONAL_MM / diagonal : 1;
  const allowUnguided = setup.allowUnguidedEstimates !== false;
  const exposure500 = allowUnguided && focaleEff > 0 && cropFactor > 0 ? 500 / (focaleEff * cropFactor) : null;
  let exposureNPF = null;
  if (allowUnguided && focaleEff > 0 && cropFactor > 0 && Number.isFinite(apertureMm) && apertureMm > 0) {
    exposureNPF = ((35 * apertureMm) + (30 * pixelUm)) / (focaleEff * cropFactor);
  }
  return {
    sampling,
    widthArcmin,
    heightArcmin,
    exposure500,
    exposureNPF,
    allowUnguided,
    focalEff: focaleEff,
    cropFactor,
    fNumber: Number.isFinite(apertureMm) && apertureMm > 0 ? focaleEff / apertureMm : null
  };
}

function buildUnguidedExposureLabel(metrics) {
  if (!metrics) {
    return null;
  }
  const parts = [];
  if (Number.isFinite(metrics.exposure500) && metrics.exposure500 > 0) {
    const formatted = formatExposureSeconds(metrics.exposure500);
    if (formatted) {
      parts.push(`500 : ${formatted}`);
    }
  }
  if (Number.isFinite(metrics.exposureNPF) && metrics.exposureNPF > 0) {
    const formatted = formatExposureSeconds(metrics.exposureNPF);
    if (formatted) {
      parts.push(`NPF : ${formatted}`);
    }
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join(' • ');
}

function applyGlobalScoreTone(scoreValue) {
  const tone = resolveScoreTone(scoreValue, { scale: 100 });
  if (decisionGlobalCard) {
    if (tone === 'neutral') {
      delete decisionGlobalCard.dataset.level;
    } else {
      decisionGlobalCard.dataset.level = tone;
    }
  }
  if (globalScoreMeter) {
    if (tone === 'neutral') {
      delete globalScoreMeter.dataset.level;
    } else {
      globalScoreMeter.dataset.level = tone;
    }
  }
  if (globalScoreGauge) {
    if (tone === 'neutral') {
      delete globalScoreGauge.dataset.level;
    } else {
      globalScoreGauge.dataset.level = tone;
    }
  }
}

function toneToIcon(tone) {
  switch (tone) {
    case 'good':
      return '🟢';
    case 'warn':
      return '🟡';
    case 'bad':
      return '🔴';
    default:
      return '🔭';
  }
}

function createDecisionItem({ tone = 'neutral', icon }) {
  const item = document.createElement('li');
  if (tone !== 'neutral') {
    item.dataset.tone = tone;
  }
  const badge = document.createElement('span');
  badge.className = 'decision-icon';
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = icon ?? toneToIcon(tone);
  const content = document.createElement('div');
  content.className = 'decision-content';
  item.appendChild(badge);
  item.appendChild(content);
  return { item, content, badge };
}
const OBSERVATION_MODES = {
  visual: {
    id: 'visual',
    icon: '🌙',
    label: 'Observation visuelle',
    recommended: defaultCatalogueSelections.visual
  },
  astrophoto: {
    id: 'astrophoto',
    icon: '📸',
    label: 'Astrophotographie',
    recommended: defaultCatalogueSelections.astrophoto
  },
  research: {
    id: 'research',
    icon: '🛰️',
    label: 'Visuel assisté (EAA)',
    recommended: defaultCatalogueSelections.research
  }
};

function resolveObservationMode(preferredMode = 'visual') {
  const normalized = typeof preferredMode === 'string' ? preferredMode.trim().toLowerCase() : '';
  const isKnownMode = (mode) => typeof mode === 'string' && OBSERVATION_MODES[mode];
  const modes = catalogueModeOrder.filter((mode) => isKnownMode(mode));
  const hasCatalogues = (mode) => (catalogueAvailability.get(mode) || []).length > 0;

  if (isKnownMode(normalized) && hasCatalogues(normalized)) {
    return normalized;
  }

  const firstWithCatalogues = modes.find((mode) => hasCatalogues(mode));
  if (firstWithCatalogues) {
    return firstWithCatalogues;
  }

  if (isKnownMode(normalized)) {
    return normalized;
  }

  if (modes.length > 0) {
    return modes[0];
  }

  return 'visual';
}

catalogueModeOrder.forEach((mode) => {
  const selection = Array.isArray(storedCataloguePreferences[mode])
    ? [...storedCataloguePreferences[mode]]
    : [];
  catalogueAvailability.set(mode, selection);
  if (OBSERVATION_MODES[mode]) {
    OBSERVATION_MODES[mode].recommended = [...selection];
  }
});
let activeObservationMode = resolveObservationMode('visual');

const sunTimesCache = new Map();

function registerCatalogueData(objects = []) {
  objectSlugIndex.clear();
  objectsCatalogRaw = [];
  objectsCatalog = [];
  loadedCatalogueIds.clear();
  catalogueLoadPromises.clear();
  const filtered = filterObjectsForPreferences(objects, storedCataloguePreferences);
  appendCatalogueData(filtered);
}

function appendCatalogueData(objects = []) {
  if (!Array.isArray(objects) || objects.length === 0) {
    return [];
  }
  const scoped = filterObjectsForPreferences(objects, storedCataloguePreferences);
  const added = [];
  scoped.forEach((object) => {
    if (!object || !object.slug) {
      return;
    }
    if (objectSlugIndex.has(object.slug)) {
      return;
    }
    objectSlugIndex.set(object.slug, object);
    objectsCatalogRaw.push(object);
    added.push(object);
  });
  if (added.length > 0) {
    objectsCatalog = enrichCatalogueData(objectsCatalogRaw);
  }
  return added;
}

function refreshCatalogueSelectionUI({ preserveSelection = true } = {}) {
  if (!catalogueSelection) return;
  const mode = getActiveObservationMode();
  const allowedList = catalogueAvailability.get(mode) || [];
  const allowedSet = new Set(allowedList);
  const currentSelection = preserveSelection ? getSelectedCatalogueIds() : [];
  const availableCatalogues = allowedSet.size > 0
    ? catalogueDefinitions.filter((catalogue) => allowedSet.has(catalogue.id))
    : [];
  populateCatalogueSelection(availableCatalogues, objectsCatalog, { mode });
  if (preserveSelection && currentSelection.length > 0) {
    const filteredSelection = currentSelection.filter((id) => allowedSet.has(id));
    const applied = setSelectedCatalogueIds(filteredSelection);
    catalogueSelectionByMode.set(mode, applied);
  }
  updateRecommendedStyles(mode);
  updateCatalogueHint(mode);
}

function buildCatalogueSourceHint(ids = []) {
  const details = ids
    .map((id) => getCatalogueSourceSummary(id, catalogueSources))
    .filter((info) => info && info.description)
    .map((info) => {
      const license = info.license ? ` (${info.license})` : '';
      return `${info.description}${license}`;
    });
  return details.length > 0 ? `Sources : ${details.join(' • ')}` : '';
}

async function ensureCatalogueData(ids = [], { refreshUI = true } = {}) {
  const requested = Array.isArray(ids)
    ? ids
        .map((id) => (typeof id === 'string' ? id.trim().toLowerCase() : ''))
        .filter((id) => id && isCatalogueAllowed(id))
    : [];
  const toLoad = requested.filter((id) => {
    if (loadedCatalogueIds.has(id)) return false;
    if (catalogueLoadPromises.has(id)) return true;
    const source = catalogueSources.get(id);
    return source && source.url;
  });
  if (toLoad.length === 0) {
    if (refreshUI) {
      updateCatalogueHint(getActiveObservationMode());
    }
    return [];
  }
  const tasks = toLoad.map((id) => {
    if (catalogueLoadPromises.has(id)) {
      return catalogueLoadPromises.get(id);
    }
    const loadPromise = (async () => {
      try {
        const objects = await fetchCatalogueObjectsFromSource(id, catalogueSources);
        if (Array.isArray(objects) && objects.length > 0) {
          const added = appendCatalogueData(objects);
          loadedCatalogueIds.add(id);
          return added;
        }
        loadedCatalogueIds.add(id);
        return [];
      } catch (error) {
        console.error(`Impossible de charger le catalogue ${id} :`, error);
        throw error;
      } finally {
        catalogueLoadPromises.delete(id);
      }
    })();
    catalogueLoadPromises.set(id, loadPromise);
    return loadPromise;
  });
  const settled = await Promise.allSettled(tasks);
  const collected = [];
  let encounteredError = false;
  settled.forEach((result) => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      collected.push(...result.value);
    } else if (result.status === 'rejected') {
      encounteredError = true;
    }
  });
  if (collected.length > 0) {
    if (refreshUI) {
      populateTypeFilter();
      refreshCatalogueSelectionUI();
    }
  } else if (refreshUI) {
    updateCatalogueHint(getActiveObservationMode());
  }
  if (encounteredError && catalogueHint) {
    catalogueHint.textContent =
      'Certains catalogues distants n’ont pas pu être chargés. Réessaie plus tard ou vérifie ta connexion.';
  }
  return collected;
}

function prefetchRemainingCatalogueData() {
  if (!Array.isArray(catalogueDefinitions) || catalogueDefinitions.length === 0) {
    return;
  }
  const remainingIds = catalogueDefinitions
    .map((catalogue) => catalogue.id)
    .filter((id) => id && !loadedCatalogueIds.has(id));
  if (remainingIds.length === 0) {
    return;
  }
  ensureCatalogueData(remainingIds, { refreshUI: false })
    .then((added) => {
      if (!Array.isArray(added) || added.length === 0) {
        return;
      }
      populateTypeFilter();
      refreshCatalogueSelectionUI();
      updateCatalogueHint(getActiveObservationMode());
    })
    .catch((error) => {
      console.error('Préchargement des catalogues incomplet :', error);
    });
}

async function loadCatalog() {
  const response = await fetch('objects.json');
  if (!response.ok) {
    throw new Error('Impossible de charger la base de cibles.');
  }
  const payload = await response.json();
  return parseCataloguePayload(payload);
}

function setupContextPanels() {
  panelToggleButtons.forEach((button) => {
    const targetId = button.getAttribute('aria-controls');
    if (!targetId) return;
    const body = document.getElementById(targetId);
    if (!body) return;
    const section = button.closest('.panel');
    const showLabel = button.dataset.labelShow || 'Afficher les détails';
    const hideLabel = button.dataset.labelHide || 'Masquer les détails';
    const entry = { button, body, section, showLabel, hideLabel, expanded: false };
    contextPanels.set(targetId, entry);
    button.setAttribute('aria-expanded', 'false');
    button.textContent = showLabel;
    button.disabled = true;
    body.hidden = true;
    if (section) {
      section.classList.remove('panel--expanded');
      section.classList.remove('panel--ready');
      section.classList.add('panel--collapsed');
    }
    button.addEventListener('click', () => {
      setContextPanelState(entry, !entry.expanded);
    });
  });
}

function setContextPanelState(entry, expanded) {
  if (!entry) return;
  entry.expanded = expanded;
  entry.button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  entry.button.textContent = expanded ? entry.hideLabel : entry.showLabel;
  if (typeof entry.body.toggleAttribute === 'function') {
    entry.body.toggleAttribute('hidden', !expanded);
  } else {
    entry.body.hidden = !expanded;
  }
  if (entry.section) {
    entry.section.classList.toggle('panel--expanded', expanded);
    entry.section.classList.toggle('panel--collapsed', !expanded);
  }
}

function setContextPanelReady(panelId, ready) {
  const entry = contextPanels.get(panelId);
  if (!entry) return;
  entry.button.disabled = !ready;
  if (!ready) {
    setContextPanelState(entry, false);
  }
  if (entry.section) {
    entry.section.classList.toggle('panel--ready', ready);
  }
}

function collapseContextPanel(panelId) {
  const entry = contextPanels.get(panelId);
  if (!entry) return;
  setContextPanelState(entry, false);
}

setupContextPanels();

renderAstrophotoGuidance();

function clampWeight(value, fallback = 1) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1.5, value));
}


function getActiveObservationMode() {
  const inputs = Array.from(observationModeInputs ?? []);
  const checked = inputs.find((input) => input.checked);
  return checked ? checked.value : activeObservationMode;
}

function getObservationWeight(catalogueId, mode) {
  if (!catalogueId) return 1;
  const catalogue = catalogueMetaMap.get(catalogueId);
  if (!catalogue) return 1;
  const weights = catalogue.observationWeights || {};
  const value = clampWeight(weights[mode], 1);
  return value || 0.1;
}

function getObservationWeights(mode) {
  const weights = new Map();
  catalogueMetaMap.forEach((catalogue, id) => {
    weights.set(id, getObservationWeight(id, mode));
  });
  return weights;
}

function formatCatalogueList(ids = []) {
  if (!ids || ids.length === 0) {
    return '—';
  }
  return ids
    .map((id) => {
      const catalogue = catalogueMetaMap.get(id);
      if (!catalogue) return id.toUpperCase();
      if (catalogue.abbreviation) {
        return `${catalogue.abbreviation}`;
      }
      return catalogue.name;
    })
    .join(' • ');
}

function getCatalogueDefinitionCount() {
  const mode = getActiveObservationMode();
  const available = catalogueAvailability.get(mode);
  if (Array.isArray(available)) {
    return available.length;
  }
  return catalogueCheckboxMap.size;
}

function syncCatalogueSelectionDetailState(selectedCount, total) {
  if (!catalogueSelectionDetails) return;
  if (!Number.isFinite(total) || total <= 0) {
    delete catalogueSelectionDetails.dataset.active;
    return;
  }
  if (selectedCount > 0 && selectedCount < total) {
    catalogueSelectionDetails.dataset.active = 'true';
  } else {
    delete catalogueSelectionDetails.dataset.active;
  }
}

function updateCatalogueSelectionBadgeUI(total, selectedIds = []) {
  if (!catalogueSelectionBadge) return;
  if (!Number.isFinite(total) || total <= 0) {
    catalogueSelectionBadge.textContent = '';
    catalogueSelectionBadge.hidden = true;
    catalogueSelectionBadge.removeAttribute('aria-label');
    catalogueSelectionBadge.removeAttribute('title');
    return;
  }
  const count = Array.isArray(selectedIds) ? selectedIds.length : 0;
  let label = '';
  let description = '';
  if (count === 0) {
    label = 'Aucun';
    description = 'Aucun catalogue sélectionné';
  } else if (count >= total) {
    label = 'Tous';
    description = `Tous les ${total} catalogues sont sélectionnés`;
  } else {
    label = `${count}/${total}`;
    const plural = count > 1 ? 's' : '';
    description = `${count} catalogue${plural} sélectionné${plural} sur ${total}`;
  }
  if (!label) {
    catalogueSelectionBadge.textContent = '';
    catalogueSelectionBadge.hidden = true;
    catalogueSelectionBadge.removeAttribute('aria-label');
    catalogueSelectionBadge.removeAttribute('title');
    return;
  }
  catalogueSelectionBadge.textContent = label;
  catalogueSelectionBadge.hidden = false;
  if (description) {
    catalogueSelectionBadge.setAttribute('aria-label', description);
    catalogueSelectionBadge.setAttribute('title', description);
  } else {
    catalogueSelectionBadge.removeAttribute('aria-label');
    catalogueSelectionBadge.removeAttribute('title');
  }
}

function updateCatalogueSelectionSummary() {
  if (!catalogueSelectionSummary) return;
  const total = getCatalogueDefinitionCount();
  const selected = getSelectedCatalogueIds();
  updateCatalogueSelectionBadgeUI(total, selected);
  syncCatalogueSelectionDetailState(selected.length, total);
  if (selectAllCataloguesButton) {
    selectAllCataloguesButton.disabled = total === 0;
  }
  if (clearCatalogueSelectionButton) {
    clearCatalogueSelectionButton.disabled = total === 0;
  }
  if (total === 0) {
    const mode = getActiveObservationMode();
    if ((catalogueAvailability.get(mode) || []).length === 0) {
      catalogueSelectionSummary.textContent =
        'Aucun catalogue activé pour ce mode. Utilise la page Préférences pour en sélectionner.';
    } else {
      catalogueSelectionSummary.textContent = 'Aucun catalogue disponible pour le moment.';
    }
    return;
  }
  if (selected.length === 0) {
    catalogueSelectionSummary.textContent =
      'Aucun catalogue sélectionné. Active au moins une case pour générer des recommandations.';
    return;
  }
  const list = formatCatalogueList(selected);
  if (selected.length >= total) {
    catalogueSelectionSummary.textContent =
      list && list !== '—'
        ? `Tous les ${total} catalogues sont activés (${list}).`
        : `Tous les ${total} catalogues sont activés.`;
    return;
  }
  const plural = selected.length > 1;
  const label = list && list !== '—' ? list : selected.join(', ');
  catalogueSelectionSummary.textContent = `${selected.length} catalogue${plural ? 's' : ''} sélectionné${
    plural ? 's' : ''
  } : ${label}.`;
}

function updateRecommendedStyles(mode) {
  const recommended = new Set(OBSERVATION_MODES[mode]?.recommended ?? []);
  catalogueCheckboxMap.forEach(({ label }, id) => {
    label.classList.toggle('filter-option--recommended', recommended.has(id));
  });
}

function updateCatalogueHint(mode = getActiveObservationMode()) {
  if (!catalogueHint) return;
  const profile = OBSERVATION_MODES[mode] || OBSERVATION_MODES.visual;
  const available = catalogueAvailability.get(mode) || [];
  if (available.length === 0) {
    const icon = profile?.icon ? `${profile.icon} ` : '';
    catalogueHint.textContent = `${icon}${profile?.label ?? 'Mode'} — aucun catalogue activé dans les préférences.`;
    return;
  }
  const selected = getSelectedCatalogueIds();
  const weights = getObservationWeights(mode);
  const counts = new Map();
  objectsCatalog.forEach((object) => {
    const refs = Array.isArray(object.catalogueRefs) ? object.catalogueRefs : [];
    refs.forEach((id) => {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
  });
  const selectionText =
    selected.length === 0
      ? 'Sélectionne au moins un catalogue.'
      : selected
          .map((id) => {
            const catalogue = catalogueMetaMap.get(id);
            const label = catalogue?.abbreviation || catalogue?.name || id.toUpperCase();
            const weight = weights.get(id);
            const weightText = Number.isFinite(weight) ? `${Math.round(weight * 100)} %` : '—';
            const count = counts.get(id) ?? 0;
            const countLabel = count === 0 ? '0 objet' : `${count} objet${count > 1 ? 's' : ''}`;
            return `${label} (${weightText}) — ${countLabel}`;
          })
          .join(' · ');
  const recommendedText = (profile?.recommended || [])
    .map((id) => catalogueMetaMap.get(id)?.abbreviation || catalogueMetaMap.get(id)?.name || id.toUpperCase())
    .join(', ');
  const icon = profile?.icon ? `${profile.icon} ` : '';
  const sourceText = buildCatalogueSourceHint(selected);
  const baseText = `${icon}${profile?.label ?? 'Mode'} — priorité : ${recommendedText || '—'}. Sélection actuelle : ${selectionText}`;
  catalogueHint.textContent = sourceText ? `${baseText}. ${sourceText}` : baseText;
}

function getSelectedCatalogueIds() {
  if (!catalogueSelection) return [];
  return Array.from(catalogueSelection.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
}

function setSelectedCatalogueIds(ids = []) {
  const selectAll = ids === null;
  const values = selectAll
    ? new Set(Array.from(catalogueCheckboxMap.keys()))
    : new Set((Array.isArray(ids) ? ids : []).filter(Boolean));
  const applied = [];
  catalogueCheckboxMap.forEach(({ checkbox }) => {
    const shouldSelect = selectAll ? true : values.has(checkbox.value);
    checkbox.checked = shouldSelect;
    if (shouldSelect) {
      applied.push(checkbox.value);
    }
  });
  updateCatalogueSelectionSummary();
  return applied;
}

function applyObservationModeContext(mode, options = {}) {
  if (!catalogueSelection || catalogueCheckboxMap.size === 0) return;
  const { selectionOverride = null } = options;
  updateRecommendedStyles(mode);
  const allowedList = catalogueAvailability.get(mode) || [];
  const allowedSet = new Set(allowedList);
  if (allowedSet.size === 0) {
    setSelectedCatalogueIds([]);
    catalogueSelectionByMode.set(mode, []);
    updateCatalogueHint(mode);
    return;
  }
  let selection = Array.isArray(selectionOverride) ? selectionOverride.map((id) => id && id.toLowerCase()) : null;
  if (Array.isArray(selection)) {
    selection = selection.filter((id) => allowedSet.has(id));
  }
  if (!selection || selection.length === 0) {
    selection = (catalogueSelectionByMode.get(mode) || []).filter((id) => allowedSet.has(id));
  }
  if (!selection || selection.length === 0) {
    selection = [...allowedList];
  }
  const applied = setSelectedCatalogueIds(selection);
  catalogueSelectionByMode.set(mode, applied);
  updateCatalogueHint(mode);
  if (applied.length > 0) {
    if (catalogueHint) {
      catalogueHint.textContent = 'Chargement des catalogues sélectionnés…';
    }
    ensureCatalogueData(applied).catch((error) => console.error('Chargement de catalogue recommandé impossible :', error));
  }
}

function filterObjectsByCatalogue(objects = [], catalogueIds = []) {
  const active = Array.isArray(catalogueIds) ? catalogueIds.filter(Boolean) : [];
  if (active.length === 0) return objects;
  const allowed = new Set(active);
  return objects.filter((object) => {
    const refs = Array.isArray(object.catalogueRefs) ? object.catalogueRefs : [];
    if (refs.length === 0) return false;
    return refs.some((id) => allowed.has(id));
  });
}

function applyObservationWeights(entries = [], mode) {
  if (!Array.isArray(entries)) return [];
  const weights = getObservationWeights(mode);
  return entries.map((entry) => {
    const refs = Array.isArray(entry.object?.catalogueRefs) ? entry.object.catalogueRefs : [];
    const fallbackId = entry.object?.primaryCatalogueId;
    const identifiers = refs.length > 0 ? refs : fallbackId ? [fallbackId] : [];
    let factor = 0;
    identifiers.forEach((id) => {
      const weight = weights.get(id);
      if (Number.isFinite(weight)) {
        factor = Math.max(factor, weight);
      }
    });
    if (!Number.isFinite(factor) || factor <= 0) {
      factor = 1;
    }
    const rawBaseScore = Number.isFinite(entry.rawBaseScore) ? entry.rawBaseScore : Number(entry.baseScore) || 0;
    const rawScore = Number.isFinite(entry.rawScore) ? entry.rawScore : Number(entry.score) || 0;
    const weightedBase = rawBaseScore * factor;
    const weightedScore = rawScore * factor;
    return {
      ...entry,
      rawBaseScore,
      rawScore,
      baseScore: weightedBase,
      score: weightedScore,
      weightFactor: factor,
      weightMode: mode,
      weightCatalogueRefs: identifiers
    };
  });
}

function buildCatalogueWeightSnapshot(ids = [], mode) {
  const snapshot = {};
  if (!Array.isArray(ids)) return snapshot;
  ids.forEach((id) => {
    if (!id) return;
    const weight = getObservationWeight(id, mode);
    if (Number.isFinite(weight)) {
      snapshot[id] = weight;
    }
  });
  return snapshot;
}


function populateCatalogueSelection(catalogues = [], objects = [], { mode } = {}) {
  if (!catalogueSelection) return;
  catalogueSelection.innerHTML = '';
  catalogueCheckboxMap.clear();
  if (!Array.isArray(catalogues) || catalogues.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'help-text';
    if (mode && (catalogueAvailability.get(mode)?.length ?? 0) === 0) {
      empty.textContent =
        'Aucun catalogue n’est activé pour ce mode. Ouvre les préférences pour ajouter des catalogues disponibles.';
    } else {
      empty.textContent = 'Aucun catalogue disponible.';
    }
    catalogueSelection.appendChild(empty);
    updateCatalogueSelectionSummary();
    return;
  }
  const counts = new Map();
  objects.forEach((object) => {
    const refs = Array.isArray(object.catalogueRefs) ? object.catalogueRefs : [];
    refs.forEach((id) => {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
  });
  catalogues.forEach((catalogue) => {
    const label = document.createElement('label');
    label.className = 'filter-option filter-option--catalogue';
    label.dataset.catalogue = catalogue.id;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = catalogue.id;
    checkbox.name = 'catalogueIds';
    const content = document.createElement('div');
    content.className = 'filter-option__content';
    const title = document.createElement('span');
    title.className = 'filter-option__label';
    const abbrev = catalogue.abbreviation ? `${catalogue.abbreviation} — ` : '';
    title.textContent = `${abbrev}${catalogue.name}`;
    const meta = document.createElement('span');
    meta.className = 'filter-option__meta';
    const count = counts.get(catalogue.id) ?? 0;
    const countLabel = count === 0 ? 'Aucun objet' : `${count} objet${count > 1 ? 's' : ''}`;
    const typeLabel = catalogue.type ? catalogue.type : '';
    meta.textContent = typeLabel ? `${countLabel} • ${typeLabel}` : countLabel;
    content.appendChild(title);
    content.appendChild(meta);
    label.appendChild(checkbox);
    label.appendChild(content);
    catalogueSelection.appendChild(label);
    catalogueCheckboxMap.set(catalogue.id, { checkbox, label });
    checkbox.addEventListener('change', async () => {
      const mode = getActiveObservationMode();
      const selectedIds = getSelectedCatalogueIds();
      catalogueSelectionByMode.set(mode, selectedIds);
      updateCatalogueSelectionSummary();
      if (catalogueHint) {
        catalogueHint.textContent = 'Chargement des catalogues sélectionnés…';
      }
      try {
        await ensureCatalogueData(selectedIds);
      } catch (error) {
        console.error('Chargement de catalogue interrompu :', error);
      } finally {
        updateCatalogueHint(mode);
      }
    });
  });
  updateCatalogueSelectionSummary();
}

function shiftDateValue(dateValue, offsetDays) {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split('-').map(Number);
  if (![year, month, day].every((part) => Number.isFinite(part))) return null;
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

function formatHourDuration(hours) {
  if (!Number.isFinite(hours)) return '';
  const rounded = Math.round(hours * 10) / 10;
  const minimumFractionDigits = Number.isInteger(rounded) ? 0 : 1;
  return rounded.toLocaleString('fr-FR', { minimumFractionDigits, maximumFractionDigits: 1 });
}

function formatMinutesDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '';
  }
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  const hours = Math.floor(rounded / 60);
  const mins = rounded - hours * 60;
  const parts = [];
  if (hours > 0) {
    parts.push(`${hours} h`);
  }
  if (mins > 0) {
    parts.push(`${mins} min`);
  }
  if (parts.length === 0) {
    return '0 min';
  }
  return parts.join(' ');
}

function describeNightSessions(count) {
  if (!Number.isFinite(count) || count <= 0) return '';
  const rounded = Math.max(1, Math.floor(count));
  const plural = rounded > 1 ? 's' : '';
  const possible = rounded > 1 ? ' possibles' : ' possible';
  return `${rounded} session${plural} d'1 h${possible}`;
}

function getSessionStartDate() {
  if (!dateInput || !timeInput) return null;
  const dateValue = dateInput.value;
  const timeValue = timeInput.value;
  if (!dateValue || !timeValue) return null;
  const normalizedTime = timeValue.length === 5 ? `${timeValue}:00` : timeValue;
  const iso = `${dateValue}T${normalizedTime}`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function updateSessionDurationOptions(maxHours) {
  if (!durationSelect) return;
  const previousValue = durationSelect.value;
  let optionSpecs = [];
  let effectiveMaxHours = Number.isFinite(maxHours) ? maxHours : null;

  const sessionStartDate = getSessionStartDate();
  if (computedNightEndDate instanceof Date && sessionStartDate instanceof Date) {
    const diffMs = computedNightEndDate.getTime() - sessionStartDate.getTime();
    const diffHours = diffMs / (60 * 60 * 1000);
    if (Number.isFinite(diffHours) && diffHours > 0.25) {
      effectiveMaxHours = Number.isFinite(effectiveMaxHours)
        ? Math.min(effectiveMaxHours, diffHours)
        : diffHours;
    } else if (Number.isFinite(diffHours) && diffHours <= 0.25) {
      effectiveMaxHours = null;
    }
  }

  if (Number.isFinite(effectiveMaxHours) && effectiveMaxHours >= 0.25) {
    const wholeHoursRaw = Math.floor(effectiveMaxHours);
    const wholeHours = Math.max(0, wholeHoursRaw);
    if (wholeHours >= 1) {
      optionSpecs = Array.from({ length: wholeHours }, (_, index) => {
        const hourValue = index + 1;
        return { value: String(hourValue), label: `${hourValue} h` };
      });
    }
    const remainder = effectiveMaxHours - wholeHoursRaw;
    if (remainder > 0.05 || optionSpecs.length === 0) {
      const totalHours = Math.round(effectiveMaxHours * 10) / 10;
      optionSpecs.push({
        value: totalHours.toFixed(1),
        label: `Jusqu'à l'aube (~${formatHourDuration(totalHours)} h restantes)`,
        fullNight: true
      });
    }
  } else if (defaultDurationOptions.length > 0) {
    optionSpecs = defaultDurationOptions.map((option) => ({ ...option }));
  }

  if (optionSpecs.length === 0) {
    optionSpecs = [{ value: '1', label: '1 h' }, { value: '2', label: '2 h' }, { value: '3', label: '3 h' }];
  }

  durationSelect.innerHTML = '';
  optionSpecs.forEach((spec) => {
    const option = document.createElement('option');
    option.value = spec.value;
    option.textContent = spec.label;
    if (spec.fullNight) {
      option.dataset.fullNight = 'true';
    }
    durationSelect.appendChild(option);
  });

  const fallbackValue = optionSpecs.some((spec) => spec.value === previousValue)
    ? previousValue
    : optionSpecs.find((spec) => spec.value === defaultDurationValue)?.value || optionSpecs[0].value;

  durationSelect.value = fallbackValue;
}

async function requestSunTimes(lat, lon, dateValue) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !dateValue) return null;
  const key = `${lat.toFixed(4)}|${lon.toFixed(4)}|${dateValue}`;
  if (sunTimesCache.has(key)) {
    return sunTimesCache.get(key);
  }
  const response = await fetch(
    `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=${dateValue}&formatted=0`
  );
  if (!response.ok) throw new Error('sunset');
  const data = await response.json();
  const results = data?.results;
  if (!results) throw new Error('sunset');
  const record = {
    key,
    sunset: results.sunset,
    astronomicalDusk: results.astronomical_twilight_end,
    astronomicalDawn: results.astronomical_twilight_begin
  };
  sunTimesCache.set(key, record);
  return record;
}

function updateCoordinateInput(input, delta) {
  const numeric = parseCoordinate(input.value);
  const base = Number.isFinite(numeric) ? numeric : 0;
  const next = base + delta;
  input.value = formatCoordinate(next);
  triggerCoordinateUpdates();
}

function handleCoordinateBlur(event) {
  const numeric = parseCoordinate(event.target.value);
  if (Number.isFinite(numeric)) {
    event.target.value = formatCoordinate(numeric);
    triggerCoordinateUpdates();
  }
}

function triggerCoordinateUpdates() {
  if (sunsetDebounce) {
    clearTimeout(sunsetDebounce);
  }
  sunsetDebounce = setTimeout(updateSunsetFromInputs, 400);
  scheduleBortleRefresh();
}

function scheduleBortleRefresh() {
  if (bortleDebounce) {
    clearTimeout(bortleDebounce);
  }
  bortleDebounce = setTimeout(autoFetchBortle, 450);
}

function listCategories() {
  return Array.from(new Set(objectsCatalog.map((obj) => obj.category))).sort((a, b) =>
    a.localeCompare(b, 'fr', { sensitivity: 'base' })
  );
}

function populateTypeFilter() {
  if (!typeFilterOptions) return;
  typeFilterOptions.innerHTML = '';
  const categories = listCategories();
  if (categories.length === 0) {
    const info = document.createElement('p');
    info.className = 'help-text';
    info.textContent = 'Catalogue en cours de chargement…';
    typeFilterOptions.appendChild(info);
    return;
  }
  categories.forEach((category) => {
    const optionId = `type-${category.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
    const label = document.createElement('label');
    label.className = 'filter-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = category;
    checkbox.id = optionId;
    checkbox.addEventListener('change', () => {
      updateFilteredTargets();
    });
    const span = document.createElement('span');
    span.textContent = category;
    label.appendChild(checkbox);
    label.appendChild(span);
    typeFilterOptions.appendChild(label);
  });
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'link-button';
  resetBtn.textContent = 'Réinitialiser';
  resetBtn.addEventListener('click', () => {
    typeFilterOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
    updateFilteredTargets();
  });
  typeFilterOptions.appendChild(resetBtn);
  updateFilterSummary();
}

function readLastSessionSnapshot() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Impossible de relire la dernière session :', error);
    return null;
  }
}

function renderAstrophotoGuidance() {
  if (!astrophotoGuidancePanel || !astrophotoGuidanceSummary) return;
  const enabled = enableAstrophotoInput?.checked;
  if (!enabled) {
    astrophotoGuidancePanel.hidden = false;
    astrophotoGuidancePanel.setAttribute('data-state', 'inactive');
    astrophotoGuidancePanel.setAttribute('aria-hidden', 'false');
    astrophotoGuidanceSummary.textContent =
      'Active le mode photo pour afficher des conseils de capture adaptés à ton équipement.';
    if (astrophotoGuidanceFacts) {
      astrophotoGuidanceFacts.innerHTML = '';
      astrophotoGuidanceFacts.hidden = true;
    }
    if (astrophotoGuidanceChecklist) {
      astrophotoGuidanceChecklist.innerHTML = '';
      astrophotoGuidanceChecklist.hidden = true;
    }
    if (astrophotoGuidanceActions) {
      astrophotoGuidanceActions.hidden = true;
    }
    if (astrophotoChecklistExportBtn) {
      astrophotoChecklistExportBtn.disabled = true;
      astrophotoChecklistExportBtn.setAttribute('aria-disabled', 'true');
    }
    return;
  }

  const profile = getAstrophotoProfile(equipmentSelect?.value || 'visual');
  const guidance = profile?.guidance ?? null;
  const metrics = computeAstrophotoMetrics(profile);
  const capture = profile?.setup?.capture ?? null;
  const decisionAstro = cachedDecision?.astrophoto || null;
  const hasMatchingPlan =
    decisionAstro &&
    decisionAstro.active &&
    decisionAstro.profileId === profile.id &&
    Array.isArray(decisionAstro.recommendations) &&
    decisionAstro.recommendations.length > 0;
  const planSummary = hasMatchingPlan ? decisionAstro.planSummary : null;
  const dynamicChecklist = hasMatchingPlan ? decisionAstro.checklist || [] : [];

  astrophotoGuidancePanel.hidden = false;
  astrophotoGuidancePanel.setAttribute('aria-hidden', 'false');
  if (hasMatchingPlan) {
    astrophotoGuidancePanel.removeAttribute('data-state');
  } else {
    astrophotoGuidancePanel.setAttribute('data-state', 'inactive');
  }

  const summaryParts = [];
  if (guidance?.summary) {
    summaryParts.push(guidance.summary);
  } else if (profile?.description) {
    summaryParts.push(profile.description);
  } else {
    summaryParts.push('Optimise ton setup photo avant la prise de vue.');
  }
  const exposureLabel = Number.isFinite(planSummary?.exposureSeconds)
    ? formatExposureSeconds(planSummary.exposureSeconds)
    : null;
  const integrationLabel = Number.isFinite(planSummary?.integrationMinutes)
    ? formatMinutesDuration(planSummary.integrationMinutes)
    : null;
  if (exposureLabel) {
    summaryParts.push(`Pose ${exposureLabel}`);
  } else if (guidance?.exposure && !hasMatchingPlan) {
    summaryParts.push(guidance.exposure);
  }
  if (integrationLabel) {
    summaryParts.push(`Intégration ${integrationLabel}`);
  } else if (guidance?.integration && !hasMatchingPlan) {
    summaryParts.push(guidance.integration);
  }
  const sensitivityParts = [];
  if (planSummary?.isoText) {
    sensitivityParts.push(planSummary.isoText);
  }
  if (planSummary?.gainText) {
    sensitivityParts.push(planSummary.gainText);
  }
  if (sensitivityParts.length === 0 && !hasMatchingPlan && capture) {
    if (capture.iso) sensitivityParts.push(capture.iso);
    if (capture.gain) sensitivityParts.push(capture.gain);
  }
  if (sensitivityParts.length > 0) {
    summaryParts.push(sensitivityParts.join(' • '));
  }
  if (planSummary?.filter) {
    summaryParts.push(planSummary.filter);
  } else if (guidance?.filters && !hasMatchingPlan) {
    summaryParts.push(guidance.filters);
  }
  astrophotoGuidanceSummary.textContent = summaryParts.join(' • ');

  if (astrophotoGuidanceFacts) {
    astrophotoGuidanceFacts.innerHTML = '';
    const facts = [];
    if (metrics) {
      const fieldText = formatFieldArcminutes(metrics.widthArcmin, metrics.heightArcmin);
      const samplingText = formatSamplingArcsec(metrics.sampling);
      const unguidedText = buildUnguidedExposureLabel(metrics);
      if (fieldText) {
        facts.push({ label: 'Champ', value: fieldText });
      }
      if (samplingText) {
        facts.push({ label: 'Échantillonnage', value: samplingText });
      }
      if (unguidedText) {
        facts.push({ label: 'Pose max sans suivi', value: unguidedText });
      }
    }
    if (exposureLabel) {
      facts.push({ label: 'Pose recommandée', value: exposureLabel });
    } else if (guidance?.exposure) {
      facts.push({ label: 'Pose unitaire', value: guidance.exposure });
    }
    if (integrationLabel) {
      facts.push({ label: 'Intégration cible', value: integrationLabel });
    } else if (guidance?.integration) {
      facts.push({ label: 'Intégration cible', value: guidance.integration });
    }
    if (sensitivityParts.length > 0) {
      facts.push({ label: 'Sensibilité', value: sensitivityParts.join(' • ') });
    } else if (capture) {
      const sensitivity = [];
      if (capture.iso) sensitivity.push(capture.iso);
      if (capture.gain) sensitivity.push(capture.gain);
      if (sensitivity.length > 0) {
        facts.push({ label: 'Sensibilité', value: sensitivity.join(' • ') });
      }
    }
    if (planSummary?.filter) {
      facts.push({ label: 'Filtre recommandé', value: planSummary.filter });
    } else if (guidance?.filters) {
      facts.push({ label: 'Filtres', value: guidance.filters });
    }
    if (capture?.cadence) {
      facts.push({ label: 'Cadence recommandée', value: capture.cadence });
    }
    if (planSummary?.calibration) {
      const calParts = [];
      if (Number.isFinite(planSummary.calibration.darkCount)) {
        calParts.push(`${planSummary.calibration.darkCount} darks`);
      }
      if (Number.isFinite(planSummary.calibration.flatCount)) {
        calParts.push(`${planSummary.calibration.flatCount} flats`);
      }
      if (Number.isFinite(planSummary.calibration.biasCount) && planSummary.calibration.biasCount > 0) {
        calParts.push(`${planSummary.calibration.biasCount} offsets`);
      }
      if (calParts.length > 0) {
        facts.push({ label: 'Calibrations', value: calParts.join(' • ') });
      }
    }
    if (Array.isArray(planSummary?.warnings) && planSummary.warnings.length > 0) {
      facts.push({ label: 'À surveiller', value: planSummary.warnings.join(' • ') });
    }
    facts.forEach((fact) => {
      const item = document.createElement('div');
      item.className = 'astrophoto-guidance__fact';
      const term = document.createElement('span');
      term.className = 'astrophoto-guidance__term';
      term.textContent = fact.label;
      const desc = document.createElement('span');
      desc.className = 'astrophoto-guidance__description';
      desc.textContent = fact.value;
      item.appendChild(term);
      item.appendChild(desc);
      astrophotoGuidanceFacts.appendChild(item);
    });
    astrophotoGuidanceFacts.hidden = facts.length === 0;
  }

  if (astrophotoGuidanceChecklist) {
    astrophotoGuidanceChecklist.innerHTML = '';
    const combined = [];
    const seen = new Set();
    const pushItem = (value) => {
      if (typeof value !== 'string') return;
      const normalized = value.trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      combined.push(normalized);
    };
    if (Array.isArray(guidance?.checklist)) {
      guidance.checklist.forEach(pushItem);
    }
    if (Array.isArray(dynamicChecklist)) {
      dynamicChecklist.forEach(pushItem);
    }
    if (!hasMatchingPlan) {
      pushItem('Lance une analyse pour générer les réglages recommandés.');
    }
    combined.forEach((entry) => {
      const li = document.createElement('li');
      li.textContent = entry;
      astrophotoGuidanceChecklist.appendChild(li);
    });
    astrophotoGuidanceChecklist.hidden = combined.length === 0;
  }

  if (astrophotoGuidanceActions) {
    astrophotoGuidanceActions.hidden = !hasMatchingPlan;
  }
  if (astrophotoChecklistExportBtn) {
    astrophotoChecklistExportBtn.disabled = !hasMatchingPlan;
    astrophotoChecklistExportBtn.setAttribute('aria-disabled', hasMatchingPlan ? 'false' : 'true');
  }
}

function exportAstrophotoChecklist() {
  const enabled = enableAstrophotoInput?.checked;
  const astro = cachedDecision?.astrophoto || null;
  const hasRecommendations =
    enabled &&
    astro &&
    astro.active &&
    Array.isArray(astro.recommendations) &&
    astro.recommendations.length > 0;
  if (!hasRecommendations) {
    alert('Aucune check-list photo disponible. Active le mode photo et relance une analyse.');
    return;
  }

  const profileLabel = astro.profileLabel ?? 'Profil photo';
  const localDate = cachedContext?.localDate || '';
  const localTime = cachedContext?.localTime || '';
  const sessionLabel = [localDate, localTime].filter(Boolean).join(' à ');
  const bortleLabel = Number.isFinite(cachedContext?.bortle) ? `Bortle ${cachedContext.bortle}` : 'Bortle inconnu';
  const durationLabel = Number.isFinite(cachedContext?.durationHours)
    ? `${formatHourDuration(cachedContext.durationHours)} h`
    : '';
  const locationLabel = Number.isFinite(cachedContext?.latitude) && Number.isFinite(cachedContext?.longitude)
    ? `${formatCoordinate(cachedContext.latitude)}, ${formatCoordinate(cachedContext.longitude)}`
    : 'Coordonnées indisponibles';
  const planSummary = astro.planSummary || null;
  const guidanceChecklist = Array.isArray(astro.guidance?.checklist) ? astro.guidance.checklist : [];
  const dynamicChecklist = Array.isArray(astro.checklist) ? astro.checklist : [];
  const checklistItems = [];
  const checklistSeen = new Set();
  const pushChecklist = (value) => {
    if (typeof value !== 'string') return;
    const normalized = value.trim();
    if (!normalized || checklistSeen.has(normalized)) return;
    checklistSeen.add(normalized);
    checklistItems.push(normalized);
  };
  guidanceChecklist.forEach(pushChecklist);
  dynamicChecklist.forEach(pushChecklist);

  const planExposure = Number.isFinite(planSummary?.exposureSeconds)
    ? formatExposureSeconds(planSummary.exposureSeconds)
    : null;
  const planIntegration = Number.isFinite(planSummary?.integrationMinutes)
    ? formatMinutesDuration(planSummary.integrationMinutes)
    : null;
  const sensitivitySummary = [];
  if (planSummary?.isoText) sensitivitySummary.push(planSummary.isoText);
  if (planSummary?.gainText) sensitivitySummary.push(planSummary.gainText);
  const filterSummary = planSummary?.filter || null;
  const calibrationSummaryParts = [];
  if (Number.isFinite(planSummary?.calibration?.darkCount)) {
    calibrationSummaryParts.push(`${planSummary.calibration.darkCount} darks`);
  }
  if (Number.isFinite(planSummary?.calibration?.flatCount)) {
    calibrationSummaryParts.push(`${planSummary.calibration.flatCount} flats`);
  }
  if (Number.isFinite(planSummary?.calibration?.biasCount) && planSummary.calibration.biasCount > 0) {
    calibrationSummaryParts.push(`${planSummary.calibration.biasCount} offsets`);
  }
  const planWarnings = Array.isArray(planSummary?.warnings) ? planSummary.warnings : [];

  const exportWindow = window.open('', '_blank');
  if (!exportWindow || !exportWindow.document) {
    alert('Impossible d’ouvrir la fenêtre pour exporter la check-list.');
    return;
  }

  const checklistHtml =
    checklistItems.length > 0
      ? `<section><h2>Checklist générale</h2><ul>${checklistItems
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join('')}</ul></section>`
      : '';

  const summaryList = [];
  if (planExposure) summaryList.push(`<li><strong>Pose unitaire :</strong> ${escapeHtml(planExposure)}</li>`);
  if (planIntegration) summaryList.push(`<li><strong>Intégration cible :</strong> ${escapeHtml(planIntegration)}</li>`);
  if (sensitivitySummary.length > 0) {
    summaryList.push(`<li><strong>Sensibilité :</strong> ${escapeHtml(sensitivitySummary.join(' • '))}</li>`);
  }
  if (filterSummary) {
    summaryList.push(`<li><strong>Filtre recommandé :</strong> ${escapeHtml(filterSummary)}</li>`);
  }
  if (calibrationSummaryParts.length > 0) {
    summaryList.push(
      `<li><strong>Calibrations :</strong> ${escapeHtml(calibrationSummaryParts.join(' • '))}</li>`
    );
  }
  if (planWarnings.length > 0) {
    summaryList.push(`<li><strong>À surveiller :</strong> ${escapeHtml(planWarnings.join(' • '))}</li>`);
  }

  const recommendationsHtml = astro.recommendations
    .map((entry) => {
      const plan = entry.capturePlan || {};
      const scoreLabel = Number.isFinite(entry.astroScore) ? `${Math.round(entry.astroScore * 100)}/100` : '—';
      const baseScore = Number.isFinite(entry.score ?? entry.baseScore)
        ? `${Math.round((entry.score ?? entry.baseScore) * 100)}/100`
        : '—';
      const directionLabel = entry.direction || describeAzimuth(entry.azimuth);
      const exposureLine = Number.isFinite(plan.exposureSeconds)
        ? formatExposureSeconds(plan.exposureSeconds)
        : null;
      const integrationLine = Number.isFinite(plan.integrationMinutes)
        ? formatMinutesDuration(plan.integrationMinutes)
        : null;
      const sensitivityParts = [];
      if (plan.isoText) sensitivityParts.push(plan.isoText);
      if (plan.gainText) sensitivityParts.push(plan.gainText);
      const calibrationLines = (plan.calibrationFiles || []).map(
        (file) => `<li>${escapeHtml(file.type)} : ${file.count}× <code>${escapeHtml(file.filename)}</code></li>`
      );
      const warningsLines = Array.isArray(plan.warnings) && plan.warnings.length > 0
        ? `<p class="warn">${plan.warnings.map((warn) => `⚠️ ${escapeHtml(warn)}`).join('<br>')}</p>`
        : '';
      return `
        <article class="target">
          <h3>${escapeHtml(entry.object?.name ?? 'Cible photo')}</h3>
          <ul class="target-meta">
            <li><strong>Moment idéal :</strong> ${escapeHtml(formatLocalTime(entry.bestTime))}</li>
            <li><strong>Altitude :</strong> ${escapeHtml(formatAltitude(entry.altitude))}</li>
            <li><strong>Direction :</strong> ${escapeHtml(directionLabel)}</li>
            <li><strong>Score photo :</strong> ${escapeHtml(scoreLabel)} (visuel ${escapeHtml(baseScore)})</li>
          </ul>
          <ul class="target-settings">
            ${exposureLine ? `<li>Pose : ${escapeHtml(exposureLine)}</li>` : ''}
            ${integrationLine ? `<li>Intégration : ${escapeHtml(integrationLine)}</li>` : ''}
            ${sensitivityParts.length > 0 ? `<li>Sensibilité : ${escapeHtml(sensitivityParts.join(' • '))}</li>` : ''}
            ${plan.filter ? `<li>Filtre : ${escapeHtml(plan.filter)}</li>` : ''}
          </ul>
          ${calibrationLines.length > 0 ? `<ul class="target-calibration">${calibrationLines.join('')}</ul>` : ''}
          ${warningsLines}
        </article>
      `;
    })
    .join('');

  const htmlContent = `<!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8">
        <title>Check-list de prise de vue</title>
        <style>
          :root { color-scheme: light; }
          body { font-family: 'Inter', 'Segoe UI', Roboto, sans-serif; margin: 1.5cm; color: #0f172a; }
          header { border-bottom: 2px solid #2563eb; margin-bottom: 1rem; padding-bottom: 0.5rem; }
          h1 { margin: 0; font-size: 1.75rem; }
          h2 { margin-top: 1.5rem; font-size: 1.2rem; color: #1d4ed8; }
          h3 { margin: 0 0 0.35rem; font-size: 1.05rem; color: #0b1d3a; }
          section { margin-bottom: 1rem; }
          ul { margin: 0.4rem 0 0.2rem; padding-left: 1.1rem; }
          ul li { margin-bottom: 0.25rem; }
          .target { border: 1px solid rgba(37, 99, 235, 0.25); border-radius: 8px; padding: 0.75rem; margin-bottom: 0.8rem; }
          .target-meta, .target-settings, .target-calibration { list-style: none; padding-left: 0; margin: 0.2rem 0; }
          .target-meta li, .target-settings li, .target-calibration li { margin-bottom: 0.25rem; }
          .target-calibration code { background: rgba(37, 99, 235, 0.12); padding: 0 0.25rem; border-radius: 4px; font-family: 'Fira Code', 'SFMono-Regular', Menlo, monospace; }
          .warn { color: #b91c1c; font-weight: 600; margin-top: 0.4rem; }
          @media print {
            body { margin: 1cm; }
            header { border-color: #1d4ed8; }
          }
        </style>
      </head>
      <body>
        <header>
          <h1>Check-list de prise de vue</h1>
          <p><strong>Profil :</strong> ${escapeHtml(profileLabel)}</p>
          <p><strong>Session :</strong> ${escapeHtml(sessionLabel || 'Date/heure à préciser')} • ${escapeHtml(bortleLabel)}${
            durationLabel ? ` • ${escapeHtml(durationLabel)}` : ''
          }</p>
          <p><strong>Coordonnées :</strong> ${escapeHtml(locationLabel)}</p>
        </header>
        <section>
          <h2>Réglages synthétiques</h2>
          <ul>
            ${summaryList.length > 0 ? summaryList.join('') : '<li>Aucun réglage synthétique disponible.</li>'}
          </ul>
        </section>
        ${checklistHtml}
        <section>
          <h2>Détails par cible</h2>
          ${recommendationsHtml}
        </section>
      </body>
    </html>`;

  exportWindow.document.open();
  exportWindow.document.write(htmlContent);
  exportWindow.document.close();
  exportWindow.focus();
  const triggerPrint = () => {
    try {
      exportWindow.print();
    } catch (error) {
      console.warn('Impossible de lancer automatiquement l’impression :', error);
    }
  };
  if ('addEventListener' in exportWindow) {
    exportWindow.addEventListener('load', () => setTimeout(triggerPrint, 200), { once: true });
  } else {
    setTimeout(triggerPrint, 300);
  }
}

function applyAstrophotoToggle() {
  if (!enableAstrophotoInput || !equipmentSelect) return;
  const enabled = enableAstrophotoInput.checked;
  equipmentSelect.disabled = !enabled;
  if (!enabled) {
    equipmentSelect.value = 'visual';
  }
  renderAstrophotoGuidance();
  persistAstrophotoPreferences(readAstrophotoSettings());
}

function readAstrophotoSettings() {
  if (!enableAstrophotoInput || !equipmentSelect) {
    return { enabled: false, profileId: 'visual' };
  }
  return {
    enabled: enableAstrophotoInput.checked,
    profileId: equipmentSelect.value || 'visual'
  };
}

function hydrateAstrophotoSettings(snapshot) {
  if (!enableAstrophotoInput || !equipmentSelect) return;
  const decision = snapshot?.decisionSupport?.astrophoto || null;
  const stored = snapshot?.astroSettings || loadAstrophotoPreferences() ||
    (decision
      ? { enabled: decision.active, profileId: decision.profileId }
      : null);
  if (stored) {
    enableAstrophotoInput.checked = Boolean(stored.enabled);
    const desiredId = typeof stored.profileId === 'string' && stored.profileId ? stored.profileId : 'visual';
    const hasOption = Array.from(equipmentSelect.options || []).some((option) => option.value === desiredId);
    equipmentSelect.value = hasOption ? desiredId : 'visual';
  }
  applyAstrophotoToggle();
}

function getActiveTypeFilters() {
  if (!typeFilterOptions) return [];
  return Array.from(typeFilterOptions.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
}

function updateFilterSummary() {
  if (!filterSummary) return;
  const selected = getActiveTypeFilters();
  if (selected.length === 0) {
    filterSummary.textContent = 'Tous les types sont affichés.';
  } else {
    filterSummary.textContent = `Filtre actif : ${selected.join(', ')}.`;
  }
}

function renderResultsView(results = []) {
  const list = Array.isArray(results) ? results : [];
  updateFilterSummary();
  const selected = getActiveTypeFilters();
  const matches = selectTopTargets(list, { limit: list.length, typeFilter: selected });
  const display = matches.slice(0, 8);
  renderTargets(display, { total: list.length, matchCount: matches.length });
  return { matches, display };
}

function updateFilteredTargets() {
  if (!cachedResults || cachedResults.length === 0) {
    updateFilterSummary();
    return;
  }
  const { display } = renderResultsView(cachedResults);
  if (cachedContext) {
    prepareSkyMap(cachedContext, display);
  }
}

function refreshScoresAfterBortle(value, summary) {
  if (!cachedContext) return;
  const lat = Number(cachedContext.latitude);
  const lon = Number(cachedContext.longitude);
  const duration = Number(cachedContext.durationHours);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(duration)) {
    cachedContext = {
      ...cachedContext,
      bortle: value,
      bortleSummary: summary ?? cachedContext.bortleSummary ?? ''
    };
    return;
  }
  let observationDate = null;
  if (cachedContext.date instanceof Date && !Number.isNaN(cachedContext.date.getTime())) {
    observationDate = cachedContext.date;
  } else if (cachedContext.dateISO) {
    const parsed = new Date(cachedContext.dateISO);
    if (!Number.isNaN(parsed.getTime())) {
      observationDate = parsed;
    }
  }
  if (!(observationDate instanceof Date)) {
    return;
  }
  if (!Array.isArray(cachedSourceObjects) || cachedSourceObjects.length === 0) {
    cachedContext = {
      ...cachedContext,
      bortle: value,
      bortleSummary: summary ?? cachedContext.bortleSummary ?? ''
    };
    return;
  }
  try {
    const evaluated = evaluateTargets(cachedSourceObjects, {
      lat,
      lon,
      bortle: value,
      date: observationDate,
      durationHours: duration,
      moonIllumination: cachedMoon?.illumination ?? 0
    });
    const scored = applyWeather(evaluated, cachedWeather || {}, {
      context: {
        latitude: lat,
        longitude: lon,
        durationHours: duration,
        date: observationDate
      }
    });
    const weighted = applyObservationWeights(scored, cachedContext.observationMode);
    cachedResults = weighted;
    cachedContext = {
      ...cachedContext,
      bortle: value,
      bortleSummary: summary ?? cachedContext.bortleSummary ?? ''
    };
    const { display } = renderResultsView(weighted);
    prepareSkyMap(cachedContext, display);
    refreshDecisionSupport();
  } catch (error) {
    console.warn('Impossible de recalculer les scores après mise à jour de la pollution lumineuse :', error);
  }
}

function initDefaults() {
  const snapshot = readLastSessionSnapshot();
  const now = new Date();
  const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const fallbackDate = localISO.toISOString().slice(0, 10);
  const fallbackTime = localISO.toISOString().slice(11, 16);
  const context = snapshot?.context ?? {};

  const storedLat = Number.isFinite(context.latitude) ? formatCoordinate(context.latitude) : null;
  const storedLon = Number.isFinite(context.longitude) ? formatCoordinate(context.longitude) : null;
  const storedDate = typeof context.localDate === 'string' && context.localDate ? context.localDate : null;
  const storedTime = typeof context.localTime === 'string' && context.localTime ? context.localTime : null;
  const storedDuration = Number.isFinite(context.durationHours) ? String(context.durationHours) : null;
  const storedBortle = Number.isFinite(context.bortle) ? context.bortle : null;

  computedNightDurationHours = Number.isFinite(context.nightDurationHours) ? context.nightDurationHours : null;
  computedNightSessionSlots = Number.isFinite(context.nightSessionSlots) ? context.nightSessionSlots : null;
  updateSessionDurationOptions(computedNightDurationHours);

  latitudeInput.value = storedLat ?? formatCoordinate(48.856);
  longitudeInput.value = storedLon ?? formatCoordinate(2.352);
  dateInput.value = storedDate ?? fallbackDate;
  timeInput.value = storedTime ?? fallbackTime;

  updateSessionDurationOptions(computedNightDurationHours);

  if (storedDuration) {
    const hasOption = Array.from(durationSelect.options).some((option) => option.value === storedDuration);
    if (hasOption) {
      durationSelect.value = storedDuration;
    }
  }

  if (storedBortle) {
    bortleInput.value = Math.min(9, Math.max(1, Math.round(storedBortle)));
  }

  updateBortleLabel();
  if (typeof context.bortleSummary === 'string' && context.bortleSummary) {
    bortleHint.textContent = context.bortleSummary;
    lastBortleSummary = context.bortleSummary;
  }

  cachedContext = context && Object.keys(context).length > 0 ? { ...context } : null;

  const storedMode = typeof context.observationMode === 'string' ? context.observationMode : null;
  const storedCatalogueIds = Array.isArray(context.catalogueIds) ? context.catalogueIds.filter(Boolean) : [];
  activeObservationMode = resolveObservationMode(storedMode || activeObservationMode);
  if (observationModeInputs && observationModeInputs.length > 0) {
    observationModeInputs.forEach((input) => {
      input.checked = input.value === activeObservationMode;
    });
  }
  if (catalogueSelection && catalogueCheckboxMap.size > 0) {
    const selectionOverride = storedCatalogueIds.length > 0 ? storedCatalogueIds : null;
    applyObservationModeContext(activeObservationMode, { selectionOverride });
  } else {
    updateCatalogueHint(activeObservationMode);
  }

  triggerCoordinateUpdates();

  if (snapshot) {
    hydrateAstrophotoSettings(snapshot);
  } else {
    applyAstrophotoToggle();
  }
  astrophotoSettings = readAstrophotoSettings();
}

function updateBortleLabel() {
  const value = Number(bortleInput.value);
  bortleValue.textContent = `${value} - ${bortleDescriptions[value]}`;
}

function renderWeather(data) {
  if (!weatherPanel || !weatherSummary || !weatherDetails) return;
  weatherSummary.textContent = buildWeatherSummary(data);

  const formatPercent = (value) => (Number.isFinite(value) ? `${Math.round(value)} %` : '—');
  const formatPercentFactor = (value) => (Number.isFinite(value) ? `${Math.round(value * 100)} %` : '—');
  const formatTemperature = (value) => (Number.isFinite(value) ? `${value.toFixed(1)} °C` : '—');
  const formatDistance = (value) => (Number.isFinite(value) ? `${Math.round(value)} km` : '—');
  const formatPressure = (value) => (Number.isFinite(value) ? `${Math.round(value)} hPa` : '—');
  const formatWind = (value) => (Number.isFinite(value) ? `${Math.round(value)} km/h` : '—');
  const formatConcentration = (value) => (Number.isFinite(value) ? `${Math.round(value)} µg/m³` : '—');

  const coverValue = formatPercent(data.cover);
  const lowValue = formatPercent(data.low);
  const midValue = formatPercent(data.mid);
  const highValue = formatPercent(data.high);
  const precipValue = formatPercent(data.precipProb);
  const humidityValue = formatPercent(data.humidity);
  const visibilityValue = formatDistance(data.visibilityKm);
  const pressureValue = formatPressure(data.pressure);
  const temperatureValue = formatTemperature(data.temperature);
  const windValue = formatWind(data.wind);
  const gustValue = formatWind(data.gust);
  const jetStreamValue = formatWind(data.jetStream);
  const shearValue = formatWind(data.windShear);
  const seeingPercent = formatPercentFactor(data.seeingIndex);
  const transparencyPercent = formatPercentFactor(data.transparencyIndex);
  const dewSpreadValue = formatTemperature(data.dewPointSpread);
  const dewPointValue = formatTemperature(data.dewPoint);
  const dewSafetyValue = formatPercentFactor(data.dewFactor);
  const aerosolFactorValue = formatPercentFactor(data.aerosolFactor);
  const pm10Value = formatConcentration(data.pm10);
  const pm25Value = formatConcentration(data.pm25);

  const seeingArcsec = formatArcseconds(data.seeingArcsec);
  const seeingQuality = data.seeingText ?? describeSeeingQuality(data.seeingIndex);
  const transparencyQuality = data.transparencyText ?? describeTransparencyQuality(data.transparencyIndex);
  const dewRisk = data.dewRiskText ?? describeDewRisk(data.dewPointSpread);
  const aerosolText = data.aerosolText ?? describeAerosolLoad(data.pm10, data.pm25);
  const dewSummary = Number.isFinite(data.dewPoint) && Number.isFinite(data.dewPointSpread)
    ? `Td ${data.dewPoint.toFixed(1)} °C • Δ ${data.dewPointSpread.toFixed(1)} °C`
    : 'Point de rosée à confirmer';

  if (weatherHighlights) {
    const layerSummary =
      lowValue === '—' || midValue === '—' || highValue === '—'
        ? 'Répartition à confirmer'
        : `B/M/H ${lowValue} / ${midValue} / ${highValue}`;
    const highlightCards = [
      { label: 'Nuages', value: coverValue, sub: layerSummary },
      { label: 'Température', value: temperatureValue, sub: dewSummary },
      { label: 'Seeing', value: seeingQuality, sub: `${seeingPercent} • FWHM ${seeingArcsec}` },
      { label: 'Vent', value: windValue, sub: `Rafales ${gustValue}` },
    ];
    weatherHighlights.innerHTML = highlightCards
      .map(
        (card) => `
          <article class="stat-card">
            <p class="stat-label">${card.label}</p>
            <p class="stat-value">${card.value}</p>
            <p class="stat-sub">${card.sub}</p>
          </article>
        `
      )
      .join('');
  }

  const details = [
    { label: 'Nuages par couche', value: `${lowValue} / ${midValue} / ${highValue}` },
    { label: 'Probabilité de précipitations', value: precipValue },
    { label: 'Humidité & visibilité', value: `${humidityValue} • ${visibilityValue}` },
    { label: 'Pression atmosphérique', value: pressureValue },
    { label: 'Jet stream & cisaillement', value: `${jetStreamValue} / Δ ${shearValue}` },
    { label: 'Transparence', value: `${transparencyQuality} (${transparencyPercent})` },
    { label: 'Seeing détaillé', value: `${seeingQuality} — ${seeingPercent} • FWHM ${seeingArcsec}` },
    { label: 'Aérosols', value: `${pm10Value} / ${pm25Value} — ${aerosolText} (${aerosolFactorValue})` },
    {
      label: 'Point de rosée & sécurité optique',
      value: `${dewRisk} — Δ ${dewSpreadValue} (Td ${dewPointValue}, sécurité ${dewSafetyValue})`,
    },
  ];

  weatherDetails.innerHTML = details
    .map(
      (detail) => `
        <li>
          <span class="data-label">${detail.label}</span>
          <span class="data-value">${detail.value}</span>
        </li>
      `
    )
    .join('');

  weatherPanel.classList.remove('hidden');
  setContextPanelReady('weatherBody', true);
}

function describeMoonImpactLevel(illumination) {
  if (!Number.isFinite(illumination)) return 'Impact : à confirmer';
  if (illumination <= 0.1) return 'Impact : très faible';
  if (illumination <= 0.35) return 'Impact : faible';
  if (illumination <= 0.65) return 'Impact : modéré';
  return 'Impact : fort';
}

function renderMoon(moon) {
  if (!moonPanel || !moonSummary || !moonDetails) return;
  if (!moon) {
    moonPanel.classList.add('hidden');
    setContextPanelReady('moonBody', false);
    return;
  }
  const illuminationPercent = Number.isFinite(moon.illumination)
    ? `${Math.round(moon.illumination * 100)} %`
    : 'Illumination inconnue';
  const illuminationDegrees = Number.isFinite(moon.illumination) ? Math.round(moon.illumination * 360) : 0;
  const impact = describeMoonImpactLevel(moon.illumination);
  const illuminationText = formatIllumination(moon.illumination);

  const altitude = Number.isFinite(moon.altitude) ? moon.altitude : null;
  const altitudeLabel = Number.isFinite(altitude) ? formatAltitude(altitude) : null;
  const directionText = Number.isFinite(moon.azimuth) ? describeAzimuth(moon.azimuth) : null;
  const aboveHorizon = typeof moon.aboveHorizon === 'boolean' ? moon.aboveHorizon : null;

  let summaryPosition = '';
  if (altitudeLabel) {
    if (aboveHorizon === false) {
      summaryPosition = `Sous l’horizon (${altitudeLabel})`;
      if (directionText) {
        summaryPosition += ` • ${directionText}`;
      }
    } else {
      summaryPosition = `Altitude ${altitudeLabel}`;
      if (directionText) {
        summaryPosition += ` • ${directionText}`;
      }
    }
  }

  const summaryParts = [
    `<strong>${moon.emoji ?? '🌙'} ${moon.name}</strong>`,
    `${illuminationText} éclairée`,
    impact
  ];
  if (summaryPosition) {
    summaryParts.push(summaryPosition);
  }

  moonSummary.innerHTML = summaryParts.join(' • ');

  if (moonPhaseLabel) {
    moonPhaseLabel.textContent = moon.name;
  }
  if (moonIllumination) {
    moonIllumination.textContent = Number.isFinite(moon.illumination)
      ? `${illuminationPercent} éclairée`
      : 'Illumination inconnue';
  }
  if (moonEmoji) {
    moonEmoji.textContent = moon.emoji ?? '🌙';
  }
  if (moonVisual) {
    moonVisual.style.setProperty('--illumination', `${illuminationDegrees}deg`);
    moonVisual.setAttribute('aria-label', `Phase ${moon.name}`);
  }

  const ageLabel = Number.isFinite(moon.ageDays) ? `${moon.ageDays.toFixed(1)} jours` : 'Âge inconnu';
  const description = moon.description || 'Aspect à confirmer';
  const positionParts = [];
  if (altitudeLabel) {
    positionParts.push(altitudeLabel);
  }
  if (directionText) {
    positionParts.push(directionText);
  }
  const positionValue = positionParts.length > 0 ? positionParts.join(' • ') : 'Position inconnue';

  let visibilityValue;
  if (aboveHorizon === null) {
    visibilityValue = 'Visibilité à confirmer';
  } else if (aboveHorizon) {
    visibilityValue = 'Au-dessus de l’horizon';
  } else {
    visibilityValue = 'Sous l’horizon';
    if (altitudeLabel) {
      visibilityValue += ` (${altitudeLabel})`;
    }
  }

  const observationTime = typeof moon.observationDate === 'string' ? formatLocalTime(moon.observationDate) : null;
  if (observationTime) {
    visibilityValue += ` • ${observationTime}`;
  }

  moonDetails.innerHTML = `
    <li>
      <span class="data-label">Âge lunaire</span>
      <span class="data-value">${ageLabel}</span>
    </li>
    <li>
      <span class="data-label">Aspect du soir</span>
      <span class="data-value">${description}</span>
    </li>
    <li>
      <span class="data-label">Position instantanée</span>
      <span class="data-value">${positionValue}</span>
    </li>
    <li>
      <span class="data-label">Visibilité</span>
      <span class="data-value">${visibilityValue}</span>
    </li>
    <li>
      <span class="data-label">Impact sur le ciel</span>
      <span class="data-value">${impact}</span>
    </li>
  `;
  moonPanel.classList.remove('hidden');
  setContextPanelReady('moonBody', true);
}

function renderEvents(events) {
  if (!eventsPanel || !eventsList) return;
  eventsList.innerHTML = '';
  if (!events || events.length === 0) {
    if (eventsHint) {
      eventsHint.textContent = 'Aucun événement particulier détecté pour cette période.';
    }
    eventsPanel.classList.add('hidden');
    setContextPanelReady('eventsBody', false);
    return;
  }
  events.forEach((event) => {
    const item = document.createElement('li');
    item.className = 'event-item';
    const icon = document.createElement('div');
    icon.className = 'event-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = event.icon ?? '✨';

    const content = document.createElement('div');
    content.className = 'event-content';

    const name = document.createElement('p');
    name.className = 'event-name';
    name.textContent = event.name;

    const meta = document.createElement('p');
    meta.className = 'event-meta';
    const when = event.occursAt ? formatLocalDateTime(event.occursAt) : null;
    const metaParts = [event.type];
    if (when) {
      metaParts.push(when);
    } else {
      metaParts.push('Consulte les ressources dédiées');
    }
    meta.textContent = metaParts.join(' — ');

    const description = document.createElement('p');
    description.className = 'event-description';
    description.textContent = event.description;

    content.append(name, meta, description);
    item.append(icon, content);
    eventsList.appendChild(item);
  });
  if (eventsHint) {
    eventsHint.textContent = `Les événements sont triés par date et mis à jour selon ta session.`;
  }
  eventsPanel.classList.remove('hidden');
  setContextPanelReady('eventsBody', true);
}

function loadSkyMapLibrary() {
  if (window.A && typeof window.A.aladin === 'function') {
    return Promise.resolve(window.A);
  }
  if (skyMapLoaderPromise) {
    return skyMapLoaderPromise;
  }
  skyMapLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://aladin.u-strasbg.fr/AladinLite/api/v3/latest/aladinLite.min.js';
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => {
      if (window.A && typeof window.A.aladin === 'function') {
        resolve(window.A);
      } else {
        reject(new Error('Aladin Lite indisponible'));
      }
    };
    script.onerror = () => reject(new Error('Impossible de charger Aladin Lite'));
    document.head.appendChild(script);
  })
    .catch((error) => {
      skyMapLoaderPromise = null;
      throw error;
    });
  return skyMapLoaderPromise;
}

function resetSkyMapPanel() {
  skyMapState.context = null;
  skyMapState.targets = [];
  skyMapState.selectedISO = null;
  skyMapState.ready = false;
  if (skyMapSummary) {
    skyMapSummary.textContent = 'Lance une analyse pour afficher la carte du ciel de ta session.';
  }
  if (skyMapLocationHint) {
    skyMapLocationHint.textContent = '';
  }
  if (skyMapPanel) {
    skyMapPanel.classList.add('hidden');
  }
  setContextPanelReady('skyMapBody', false);
  if (skyMapOverlay && skyMapInstance) {
    try {
      skyMapInstance.removeOverlay(skyMapOverlay);
    } catch (error) {
      console.warn('Impossible de retirer la couche de cibles :', error);
    }
  }
  skyMapOverlay = null;
}

function updateSkyMapSummary() {
  if (!skyMapSummary || !skyMapState.context) return;
  const lat = Number(skyMapState.context.latitude);
  const lon = Number(skyMapState.context.longitude);
  const timeISO = skyMapState.selectedISO;
  const timeLabel = timeISO
    ? formatLocalDateTime(timeISO)
    : `${skyMapState.context.localTime ?? ''} ${skyMapState.context.localDate ?? ''}`;
  const latText = Number.isFinite(lat) ? `${formatCoordinate(lat)}°` : 'lat inconnue';
  const lonText = Number.isFinite(lon) ? `${formatCoordinate(lon)}°` : 'lon inconnue';
  skyMapSummary.textContent = `Zenith local ${timeLabel} — Lat ${latText} • Lon ${lonText}`;
  if (skyMapLocationHint) {
    skyMapLocationHint.textContent =
      "Les cibles les mieux notées apparaissent en surbrillance. Ajuste l'heure pour voir le ciel évoluer.";
  }
}

function updateSkyMapView(date) {
  if (!skyMapInstance || !skyMapState.context) return;
  const lat = Number(skyMapState.context.latitude);
  const lon = Number(skyMapState.context.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const raHours = localSiderealTime(date, lon);
  const raDeg = ((raHours % 24) + 24) % 24 * 15;
  const decDeg = Math.max(-90, Math.min(90, lat));
  try {
    skyMapInstance.gotoRaDec(raDeg, decDeg);
  } catch (error) {
    console.warn('Impossible de positionner la carte du ciel :', error);
  }
}

function updateSkyMapTargets(entries = []) {
  skyMapState.targets = Array.isArray(entries) ? entries : [];
  if (!skyMapInstance || !skyMapState.ready) return;
  const overlayColor = document.body.classList.contains('night-mode') ? '#ff7d7d' : '#ffd86b';
  if (skyMapOverlay) {
    try {
      skyMapInstance.removeOverlay(skyMapOverlay);
    } catch (error) {
      console.warn('Impossible de nettoyer la couche existante :', error);
    }
    skyMapOverlay = null;
  }
  if (!window.A || typeof window.A.graphicOverlay !== 'function') {
    return;
  }
  const overlay = window.A.graphicOverlay({ name: 'Cibles recommandées', color: overlayColor });
  skyMapState.targets.slice(0, 5).forEach((entry) => {
    const raHours = entry?.object?.raHours;
    const decDeg = entry?.object?.decDeg;
    if (!Number.isFinite(raHours) || !Number.isFinite(decDeg)) return;
    const popupParts = [];
    popupParts.push(`Hauteur max ${formatAltitude(entry.altitude)}`);
    const bestMoment = formatLocalTime(entry.bestTime);
    if (bestMoment !== '—') {
      popupParts.push(`Moment idéal ${bestMoment}`);
    }
    overlay.add(
      window.A.marker(raHours * 15, decDeg, {
        popupTitle: entry.object?.name ?? 'Cible',
        popupDesc: popupParts.join(' • ')
      })
    );
  });
  try {
    skyMapInstance.addOverlay(overlay);
    skyMapOverlay = overlay;
  } catch (error) {
    console.warn("Impossible d'afficher les marqueurs de cibles :", error);
  }
}

async function prepareSkyMap(context, targets = []) {
  if (!skyMapPanel || !skyMapContainer) return;
  if (!context) {
    resetSkyMapPanel();
    return;
  }
  const latitude = Number(context.latitude ?? context.lat);
  const longitude = Number(context.longitude ?? context.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    resetSkyMapPanel();
    return;
  }
  skyMapState.context = {
    ...context,
    latitude,
    longitude
  };
  if (skyMapTimeInput) {
    const baseTime = typeof context.localTime === 'string' && context.localTime ? context.localTime : skyMapTimeInput.value;
    if (baseTime) {
      skyMapTimeInput.value = baseTime;
    }
  }
  let observationDate;
  try {
    const dateValue = context.localDate || dateInput.value;
    const timeValue = skyMapTimeInput?.value || context.localTime;
    if (dateValue && timeValue) {
      observationDate = buildObservationDate(dateValue, timeValue);
    } else if (context.dateISO) {
      observationDate = new Date(context.dateISO);
    } else {
      observationDate = new Date();
    }
  } catch (error) {
    observationDate = new Date();
  }
  skyMapState.selectedISO = observationDate.toISOString();
  if (skyMapSummary) {
    skyMapSummary.textContent = 'Chargement de la carte du ciel…';
  }
  try {
    const A = await loadSkyMapLibrary();
    if (!skyMapInstance) {
      skyMapInstance = A.aladin('#skyMapContainer', {
        survey: 'P/DSS2/color',
        fov: 100,
        showReticle: false,
        showProjectionControl: false,
        showCoordinateGrid: true,
        showZoomControl: true,
        showFullscreenControl: false
      });
    }
    skyMapState.ready = true;
    updateSkyMapView(observationDate);
    updateSkyMapSummary();
    skyMapPanel.classList.remove('hidden');
    setContextPanelReady('skyMapBody', true);
    updateSkyMapTargets(targets);
  } catch (error) {
    console.warn('Carte du ciel indisponible :', error);
    if (skyMapSummary) {
      skyMapSummary.textContent =
        "Impossible de charger la carte du ciel dynamique (vérifie ta connexion internet ou réessaie plus tard).";
    }
    skyMapState.ready = false;
    setContextPanelReady('skyMapBody', false);
  }
}

function handleSkyMapTimeChange() {
  if (!skyMapTimeInput || !skyMapState.context) return;
  const value = skyMapTimeInput.value;
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return;
  const dateValue = skyMapState.context.localDate;
  let nextDate = null;
  if (dateValue) {
    try {
      nextDate = buildObservationDate(dateValue, value);
    } catch (error) {
      console.warn('Heure invalide pour la carte du ciel :', error);
    }
  }
  if (!nextDate && skyMapState.selectedISO) {
    nextDate = new Date(skyMapState.selectedISO);
    nextDate.setHours(Number(value.slice(0, 2)), Number(value.slice(3, 5)));
  }
  if (!nextDate) return;
  skyMapState.selectedISO = nextDate.toISOString();
  updateSkyMapSummary();
  updateSkyMapView(nextDate);
}

function renderVisibilityChart(card, entry) {
  const container = card.querySelector('.visibility-chart');
  if (!container) return;
  const objectName = entry?.object?.name ?? 'la cible';
  container.setAttribute('aria-label', `Évolution de l'altitude de ${objectName} durant la session`);
  loadChartsModule()
    .then(({ renderAltitudeSparkline }) => {
      if (typeof renderAltitudeSparkline === 'function') {
        renderAltitudeSparkline(container, entry?.track, { objectName });
      }
    })
    .catch((error) => {
      console.warn("Impossible d'afficher la courbe d'altitude :", error);
    });
}

function renderTargets(targets, stats = {}) {
  targetsList.innerHTML = '';
  const selectedTypes = getActiveTypeFilters();
  const total = stats.total ?? targets.length;
  const matchCount = stats.matchCount ?? targets.length;

  if (targets.length === 0) {
    if (selectedTypes.length > 0 && matchCount === 0 && total > 0) {
      resultsHint.textContent =
        "Aucun objet ne correspond aux types sélectionnés pour cette fenêtre. Retire un filtre ou élargis la durée.";
    } else {
      resultsHint.textContent =
        "Aucune cible satisfaisante pour cette fenêtre : tente de changer l'heure, la date ou vise un ciel plus dégagé.";
    }
  } else {
    const base = `Top ${targets.length} cibles optimisées selon la météo, la hauteur moyenne, la saison et la Lune.`;
    const filterNote = selectedTypes.length > 0 ? ` Filtre type : ${selectedTypes.join(', ')}.` : '';
    const matchNote = matchCount > targets.length ? ` (${targets.length} sur ${matchCount} correspondances)` : '';
    resultsHint.textContent = `${base}${filterNote}${matchNote}`;
  }

  targets.forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'target-card tone-frame';
    card.setAttribute('role', 'listitem');
    const rawScore = Number.isFinite(entry.score) ? Math.round(entry.score * 100) : null;
    const scoreValue = rawScore !== null ? Math.max(0, Math.min(100, rawScore)) : null;
    const scoreTone = scoreValue !== null ? resolveScoreTone(scoreValue, { scale: 100 }) : 'neutral';
    const toneAttr = scoreTone === 'neutral' ? '' : ` data-tone="${scoreTone}"`;
    const bestMoment = formatLocalTime(entry.bestTime);
    const direction = describeAzimuth(entry.azimuth);
    const startDirection = describeAzimuth(entry.startAzimuth);
    const endDirection = describeAzimuth(entry.endAzimuth);
    const typeLabel = entry.object.category || entry.object.type || 'Objet céleste';
    const magnitudeText = Number.isFinite(entry.object.magnitude) ? entry.object.magnitude.toFixed(1) : '—';
    const averageAltitudeText = formatAltitude(entry.averageAltitude);
    const minAltitudeText = formatAltitude(entry.minAltitude);
    const endAltitudeText = formatAltitude(entry.endAltitude);
    const coveragePercent = Number.isFinite(entry.visibilityRatio) ? Math.round(entry.visibilityRatio * 100) : null;
    const visibleSamples = Number.isFinite(entry.visibleSamples) ? entry.visibleSamples : null;
    const sampleLabel = visibleSamples === 1 ? 'point' : 'points';
    const coverageText =
      coveragePercent === null ? '—' : `${coveragePercent}%${visibleSamples !== null ? ` (${visibleSamples} ${sampleLabel})` : ''}`;
    const weightFactor = Number.isFinite(entry.weightFactor) ? entry.weightFactor : 1;
    const weightPercent = Math.round(Math.max(0, weightFactor) * 100);
    const weightedCatalogues =
      Array.isArray(entry.weightCatalogueRefs) && entry.weightCatalogueRefs.length > 0
        ? entry.weightCatalogueRefs
        : entry.object?.catalogueRefs;
    const uniqueCatalogues = Array.isArray(weightedCatalogues)
      ? Array.from(new Set(weightedCatalogues))
      : [];
    const catalogueLabel = formatCatalogueList(uniqueCatalogues);
    const scoreLabel = scoreValue !== null ? `${scoreValue}/100` : '—';
    const barWidth = scoreValue !== null ? scoreValue : 0;
    if (scoreTone !== 'neutral') {
      card.dataset.tone = scoreTone;
    } else {
      delete card.dataset.tone;
    }
    card.innerHTML = `
      <header class="target-card__header">
        <div>
          <h3>${entry.object.name}</h3>
          <div class="meta">${typeLabel} • ${entry.object.constellation} • Mag ${magnitudeText}</div>
        </div>
        <span class="score-chip"${toneAttr}>${scoreLabel}</span>
      </header>
      <p class="target-summary">${entry.object.description}</p>
      <div class="target-glance">
        <div>
          <span class="target-glance__label">Moment idéal</span>
          <strong class="target-glance__value">${bestMoment}</strong>
        </div>
        <div>
          <span class="target-glance__label">Direction</span>
          <strong class="target-glance__value">${formatAltitude(entry.altitude)} • ${direction}</strong>
        </div>
      </div>
      <details class="card-fold">
        <summary>Analyse détaillée</summary>
        <div class="card-fold__content">
          <div class="score-bar" aria-hidden="true"${toneAttr}><span style="width:${barWidth}%"></span></div>
          <dl class="target-metrics">
            <div><dt>Altitude moyenne</dt><dd>${averageAltitudeText}</dd></div>
            <div><dt>Altitude minimale</dt><dd>${minAltitudeText}</dd></div>
            <div><dt>Fin de fenêtre</dt><dd>${endAltitudeText} • ${endDirection}</dd></div>
          </dl>
          <div class="visibility-chart" role="img" aria-label="Evolution de l'altitude durant la session"></div>
          <ul class="target-insights">
            <li>Catalogues pondérés : ${catalogueLabel} (${weightPercent}%)</li>
            <li>Type : ${typeLabel}</li>
            <li>Magnitude apparente : Mag ${magnitudeText}</li>
            <li>Début de session : ${formatAltitude(entry.startAltitude)} • ${startDirection}</li>
            <li>Temps visible &gt; 30° : ${coverageText}</li>
          </ul>
        </div>
      </details>
    `;
    renderVisibilityChart(card, entry);
    targetsList.appendChild(card);
  });

  updateSkyMapTargets(targets);
  resultsPanel.classList.remove('hidden');
}

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
  if (skyMapState.ready) {
    updateSkyMapTargets(skyMapState.targets);
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

function renderDecisionSupport(decision) {
  if (!decisionPanel) return;
  cachedDecision = decision;
  if (!decision || !Number.isFinite(decision.globalScore)) {
    decisionPanel.classList.add('hidden');
    return;
  }
  decisionPanel.classList.remove('hidden');
  if (decisionSummary) {
    decisionSummary.textContent = decision.globalSummary;
  }
  const scoreValue = Math.max(0, Math.min(100, Math.round((decision.globalScore ?? 0) * 100)));
  if (globalScoreValue) {
    globalScoreValue.textContent = `${scoreValue}/100`;
  }
  if (globalScoreGauge) {
    globalScoreGauge.style.width = `${scoreValue}%`;
  }
  applyGlobalScoreTone(scoreValue);
  const aggregates = decision.aggregates ?? {};
  const avgAltitude = Number.isFinite(aggregates.avgAltitude) ? Math.round(aggregates.avgAltitude) : null;
  const avgVisibility = Number.isFinite(aggregates.avgVisibility) ? Math.round(aggregates.avgVisibility * 100) : null;
  const weather = aggregates.weather ?? {};
  const skyWindow = Number.isFinite(weather.skyWindow) ? Math.round(weather.skyWindow * 100) : null;
  const atmosphere = Number.isFinite(weather.atmosphere) ? Math.round(weather.atmosphere * 100) : null;
  const moonPercent = Number.isFinite(aggregates.moonIllumination)
    ? Math.round(aggregates.moonIllumination * 100)
    : null;
  if (globalScoreDetails) {
    const parts = [];
    if (avgAltitude !== null) parts.push(`🧭 Altitude ${avgAltitude}°`);
    if (avgVisibility !== null) parts.push(`🛰️ Couverture ${avgVisibility}%`);
    if (skyWindow !== null) parts.push(`🌤️ Fenêtre ciel ${skyWindow}%`);
    if (atmosphere !== null) parts.push(`💨 Atmosphère ${atmosphere}%`);
    if (moonPercent !== null) parts.push(`🌙 Lune ${moonPercent}%`);
    globalScoreDetails.textContent = parts.join(' • ');
  }

  if (decisionCalendarList) {
    decisionCalendarList.innerHTML = '';
    const calendarEntries = Array.isArray(decision.calendar) ? decision.calendar.slice(0, 3) : [];
    if (calendarEntries.length === 0) {
      const { item, content } = createDecisionItem({ icon: 'ℹ️' });
      item.classList.add('empty');
      const body = document.createElement('span');
      body.textContent = 'Lance une analyse pour générer des fenêtres optimales.';
      content.appendChild(body);
      decisionCalendarList.appendChild(item);
    } else {
      calendarEntries.forEach((entry) => {
        const bestWindow = entry.windows?.[0];
        const windowScore = Number.isFinite(bestWindow?.score ?? bestWindow?.baseScore)
          ? Math.round((bestWindow.score ?? bestWindow.baseScore) * 100)
          : null;
        const tone = Number.isFinite(windowScore) ? resolveScoreTone(windowScore, { scale: 100 }) : 'neutral';
        const { item, content, badge } = createDecisionItem({ tone, icon: '📅' });
        const title = document.createElement('strong');
        title.textContent = entry.object?.name ?? 'Objet céleste';
        const span = document.createElement('span');
        const lines = (entry.windows || [])
          .slice(0, 3)
          .map((window) => {
            const whenDate = window.dateISO ? new Date(window.dateISO) : null;
            const dayLabel = whenDate
              ? whenDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric' })
              : '—';
            const timeLabel = formatLocalTime(window.bestTime);
            const altitudeLabel = formatAltitude(window.altitude);
            const scoreLabel = Number.isFinite(window.score ?? window.baseScore)
              ? `${Math.round((window.score ?? window.baseScore) * 100)}/100`
              : '—';
            const moonLabel = window.moonPhase?.emoji
              ? `${window.moonPhase.emoji} ${window.moonPhase.name}`
              : '';
            return `${dayLabel} • ${timeLabel} • ${altitudeLabel} • ${scoreLabel}${moonLabel ? ` • ${moonLabel}` : ''}`;
          });
        span.innerHTML = lines.join('<br>');
        content.appendChild(title);
        content.appendChild(span);
        if (lines.length === 0) {
          badge.textContent = 'ℹ️';
          item.classList.add('empty');
        }
        decisionCalendarList.appendChild(item);
      });
    }
  }

  if (decisionAlertsList) {
    decisionAlertsList.innerHTML = '';
    const alerts = Array.isArray(decision.alerts) ? decision.alerts : [];
    if (alerts.length === 0) {
      const { item, content } = createDecisionItem({ icon: 'ℹ️' });
      item.classList.add('empty');
      const body = document.createElement('span');
      body.textContent = 'Aucune alerte particulière pour ce créneau.';
      content.appendChild(body);
      decisionAlertsList.appendChild(item);
    } else {
      alerts.forEach((alert) => {
        const scoreLabel = Number.isFinite(alert.score) ? Math.round(alert.score * 100) : null;
        const tone = Number.isFinite(scoreLabel) ? resolveScoreTone(scoreLabel, { scale: 100 }) : 'neutral';
        const { item, content } = createDecisionItem({ tone });
        const title = document.createElement('strong');
        title.textContent = alert.object?.name ?? 'Cible recommandée';
        const span = document.createElement('span');
        const start = alert.windowStart ? formatLocalTime(alert.windowStart) : null;
        const end = alert.windowEnd ? formatLocalTime(alert.windowEnd) : null;
        const peak = formatLocalTime(alert.peak);
        const altitudeLabel = formatAltitude(alert.altitude);
        const direction = alert.direction || describeAzimuth(alert.object?.azimuth);
        const windowText = start && end ? `${start} → ${end}` : `vers ${peak}`;
        const scoreText = Number.isFinite(alert.score) ? `${Math.round(alert.score * 100)}/100` : '—';
        span.textContent = `🕒 ${windowText} • ⛰️ ${altitudeLabel} • 🧭 ${direction} • 🎯 ${scoreText}`;
        content.appendChild(title);
        content.appendChild(span);
        decisionAlertsList.appendChild(item);
      });
    }
  }

  if (decisionAstrophotoList && astrophotoSummary) {
    decisionAstrophotoList.innerHTML = '';
    const astro = decision.astrophoto || {};
    const nightHours = Number.isFinite(cachedContext?.nightDurationHours)
      ? cachedContext.nightDurationHours
      : null;
    const nightSlots = Number.isFinite(cachedContext?.nightSessionSlots)
      ? cachedContext.nightSessionSlots
      : null;
    const nightLabel = Number.isFinite(nightHours)
      ? `Nuit noire ≈ ${formatHourDuration(nightHours)} h`
      : null;
    const sessionsLabel = Number.isFinite(nightSlots) ? describeNightSessions(nightSlots) : '';
    const nightSummaryParts = [];
    if (nightLabel) nightSummaryParts.push(nightLabel);
    if (sessionsLabel) nightSummaryParts.push(sessionsLabel);
    const nightSummary = nightSummaryParts.join(' • ');
    if (astro.active) {
      const profileLabel = astro.profileLabel ?? 'Profil photo';
      const description = typeof astro.profileDescription === 'string' ? astro.profileDescription.trim() : '';
      const guidance = astro.guidance || {};
      const summaryParts = [];
      summaryParts.push(description ? `${profileLabel} — ${description}` : profileLabel);
      const planSummary = astro.planSummary || null;
      const exposureLabel = Number.isFinite(planSummary?.exposureSeconds)
        ? formatExposureSeconds(planSummary.exposureSeconds)
        : null;
      const integrationLabel = Number.isFinite(planSummary?.integrationMinutes)
        ? formatMinutesDuration(planSummary.integrationMinutes)
        : null;
      if (exposureLabel) {
        summaryParts.push(`Pose ${exposureLabel}`);
      } else if (guidance.exposure) {
        summaryParts.push(`Pose ${guidance.exposure}`);
      }
      if (integrationLabel) {
        summaryParts.push(`Intégration ${integrationLabel}`);
      } else if (guidance.integration) {
        summaryParts.push(guidance.integration);
      }
      const sensitivitySummary = [];
      if (planSummary?.isoText) sensitivitySummary.push(planSummary.isoText);
      if (planSummary?.gainText) sensitivitySummary.push(planSummary.gainText);
      if (sensitivitySummary.length > 0) {
        summaryParts.push(sensitivitySummary.join(' • '));
      }
      if (planSummary?.filter) {
        summaryParts.push(planSummary.filter);
      } else if (guidance.filters) {
        summaryParts.push(guidance.filters);
      }
      if (nightSummary) {
        summaryParts.push(nightSummary);
      }
      astrophotoSummary.textContent = summaryParts.join(' • ');
    } else {
      const base =
        'Active le mode photo pour obtenir des réglages recommandés, la check-list et un export PDF.';
      astrophotoSummary.textContent = nightSummary ? `${base} • ${nightSummary}` : base;
    }
    if (astro.active && Array.isArray(astro.recommendations) && astro.recommendations.length > 0) {
      astro.recommendations.slice(0, 4).forEach((entry) => {
        const astroScoreValue = Number.isFinite(entry.astroScore) ? Math.round(entry.astroScore * 100) : null;
        const tone = Number.isFinite(astroScoreValue) ? resolveScoreTone(astroScoreValue, { scale: 100 }) : 'neutral';
        const { item, content } = createDecisionItem({ tone, icon: '📷' });
        const title = document.createElement('strong');
        title.textContent = entry.object?.name ?? 'Cible photo';
        const span = document.createElement('span');
        const scoreLabel = Number.isFinite(entry.astroScore) ? `${Math.round(entry.astroScore * 100)}/100` : '—';
        const baseScore = Number.isFinite(entry.score ?? entry.baseScore)
          ? `${Math.round((entry.score ?? entry.baseScore) * 100)}/100`
          : '—';
        const directionLabel = entry.direction || describeAzimuth(entry.azimuth);
        const baseLine = `🕒 ${formatLocalTime(entry.bestTime)} • ⛰️ ${formatAltitude(entry.altitude)} • 🧭 ${directionLabel} • 📸 ${scoreLabel} • 🎯 ${baseScore}`;
        const settingsParts = [];
        if (Number.isFinite(entry.capturePlan?.exposureSeconds)) {
          settingsParts.push(`Pose ${formatExposureSeconds(entry.capturePlan.exposureSeconds)}`);
        }
        if (Number.isFinite(entry.capturePlan?.integrationMinutes)) {
          settingsParts.push(`Intégration ${formatMinutesDuration(entry.capturePlan.integrationMinutes)}`);
        }
        if (entry.capturePlan?.isoText) {
          settingsParts.push(entry.capturePlan.isoText);
        }
        if (entry.capturePlan?.gainText) {
          settingsParts.push(entry.capturePlan.gainText);
        }
        if (entry.capturePlan?.filter) {
          settingsParts.push(entry.capturePlan.filter);
        }
        const calibrationParts = (entry.capturePlan?.calibrationFiles || []).map(
          (file) => `${escapeHtml(file.type)} : ${file.count}× <code>${escapeHtml(file.filename)}</code>`
        );
        const warningLine = Array.isArray(entry.capturePlan?.warnings) && entry.capturePlan.warnings.length > 0
          ? entry.capturePlan.warnings.map((warn) => `⚠️ ${escapeHtml(warn)}`).join(' • ')
          : null;
        const htmlLines = [escapeHtml(baseLine)];
        if (settingsParts.length > 0) {
          htmlLines.push(`⚙️ ${settingsParts.map((part) => escapeHtml(part)).join(' • ')}`);
        }
        if (calibrationParts.length > 0) {
          htmlLines.push(`🧪 ${calibrationParts.join(' • ')}`);
        }
        if (warningLine) {
          htmlLines.push(warningLine);
        }
        span.innerHTML = htmlLines.join('<br>');
        content.appendChild(title);
        content.appendChild(span);
        decisionAstrophotoList.appendChild(item);
      });
    } else if (astro.active) {
      const { item, content } = createDecisionItem({ icon: 'ℹ️' });
      item.classList.add('empty');
      const body = document.createElement('span');
      body.textContent = 'Aucune cible photo ne dépasse le seuil pour cet équipement.';
      content.appendChild(body);
      decisionAstrophotoList.appendChild(item);
    }
  }

  renderAstrophotoGuidance();
}

function refreshDecisionSupport() {
  if (!cachedResults || cachedResults.length === 0) return;
  const decision = computeDecisionInsights(cachedResults, {
    weather: cachedWeather ?? {},
    moon: cachedMoon ?? null,
    context: cachedContext ?? {},
    objects: objectsCatalog,
    equipment: astrophotoSettings,
    nights: 4
  });
  renderDecisionSupport(decision);
}

function findHourIndex(times, targetISO) {
  const index = times.indexOf(targetISO);
  if (index !== -1) return index;
  return times.findIndex((time) => Math.abs(new Date(time).getTime() - new Date(targetISO).getTime()) < 60 * 60 * 1000);
}

async function fetchWeather(lat, lon, localDate, localTime, durationHours) {
  const queryDate = localDate;
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly:
      'cloudcover,cloudcover_low,cloudcover_mid,cloudcover_high,precipitation_probability,weathercode,temperature_2m,dewpoint_2m,relativehumidity_2m,visibility,windspeed_10m,windgusts_10m,pressure_msl,windspeed_80m,windspeed_120m',
    timezone: 'auto',
    start_date: queryDate,
    end_date: queryDate
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Impossible de récupérer la météo.');
  }
  const data = await response.json();

  let airData = null;
  try {
    const airParams = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      hourly: 'pm10,pm2_5',
      start_date: queryDate,
      end_date: queryDate,
      timezone: 'auto'
    });
    const airResponse = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${airParams.toString()}`);
    if (airResponse.ok) {
      airData = await airResponse.json();
    }
  } catch (error) {
    console.warn('Impossible de récupérer la qualité de l’air :', error);
  }

  const times = data.hourly.time;
  const targetISO = `${localDate}T${localTime}`;
  const startIndex = findHourIndex(times, targetISO);
  const safeStart = startIndex >= 0 ? startIndex : 0;
  const samples = Math.max(1, Math.round(durationHours));
  const indices = Array.from({ length: samples }, (_, i) => Math.min(times.length - 1, safeStart + i));

  const average = (series) => {
    const values = indices.map((idx) => series?.[idx]).filter((v) => typeof v === 'number');
    if (values.length === 0) return null;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  };

  const targetTimes = indices.map((idx) => times[idx]);
  const averageAir = (seriesName) => {
    if (!airData?.hourly?.[seriesName]) return null;
    const series = airData.hourly[seriesName];
    const airTimes = airData.hourly.time || [];
    const timeMap = new Map(airTimes.map((iso, index) => [iso, index]));
    const values = targetTimes
      .map((iso) => {
        let index = timeMap.get(iso);
        if (index === undefined) {
          index = airTimes.findIndex((time) => Math.abs(new Date(time).getTime() - new Date(iso).getTime()) <= 60 * 60 * 1000);
        }
        if (index === -1 || index === undefined) return null;
        const value = series[index];
        return typeof value === 'number' ? value : null;
      })
      .filter((value) => value !== null);
    if (values.length === 0) return null;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  };

  const pick = (value, fallback) => (Number.isFinite(value) ? value : fallback);

  const cover = pick(average(data.hourly.cloudcover), 100);
  const weatherCode = Math.round(pick(average(data.hourly.weathercode), 0));
  const windowEnd = indices[indices.length - 1];
  const endTime = times[windowEnd]?.slice(11, 16) ?? localTime;
  const periodLabel = `${localTime} → ${endTime}`;
  const wind = pick(average(data.hourly.windspeed_10m ?? data.hourly.wind_speed_10m), 0);
  const gust = pick(average(data.hourly.windgusts_10m ?? data.hourly.wind_gusts_10m), wind);
  const jetStream = pick(average(data.hourly.windspeed_120m ?? data.hourly.wind_speed_120m), null);
  const upperWind = pick(average(data.hourly.windspeed_80m ?? data.hourly.wind_speed_80m), jetStream);
  const low = pick(average(data.hourly.cloudcover_low), cover);
  const mid = pick(average(data.hourly.cloudcover_mid), cover);
  const high = pick(average(data.hourly.cloudcover_high), cover);
  const humidity = pick(average(data.hourly.relativehumidity_2m), null);
  const dewPoint = average(data.hourly.dewpoint_2m);
  const temperature = pick(average(data.hourly.temperature_2m), 0);
  const dewPointSpread = Number.isFinite(dewPoint) ? temperature - dewPoint : null;
  const visibility = pick(average(data.hourly.visibility), null);
  const visibilityKm = Number.isFinite(visibility) ? visibility / 1000 : null;
  const visibilityFactor = Number.isFinite(visibility) ? Math.min(1, Math.max(0, visibility / 20000)) : null;
  const pressure = pick(average(data.hourly.pressure_msl), null);
  const pm10 = averageAir('pm10');
  const pm25 = averageAir('pm2_5');

  const shearSource = Number.isFinite(jetStream) ? jetStream : upperWind;
  const windShear = Number.isFinite(shearSource) ? Math.abs(shearSource - wind) : null;

  const clamp = (value, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    if (numeric <= 0) return 0;
    if (numeric >= 1) return 1;
    return numeric;
  };

  const aerosolPenalties = [];
  if (Number.isFinite(pm10)) aerosolPenalties.push(Math.min(1, Math.max(0, pm10 / 80)));
  if (Number.isFinite(pm25)) aerosolPenalties.push(Math.min(1, Math.max(0, pm25 / 35)));
  const aerosolPenalty = aerosolPenalties.length > 0 ? aerosolPenalties.reduce((sum, value) => sum + value, 0) / aerosolPenalties.length : null;
  const aerosolFactor = clamp(1 - (aerosolPenalty ?? 0), 1);

  const windPenalty = clamp(wind / 45);
  const gustPenalty = clamp(gust / 70);
  const shearPenalty = clamp((windShear ?? 0) / 70);
  const highTurbulence = clamp(high / 95);
  const thermalPenalty = clamp(Number.isFinite(dewPointSpread) ? Math.max(0, (5 - dewPointSpread) / 10) : 0);
  const seeingIndex = clamp(
    1 - (windPenalty * 0.35 + gustPenalty * 0.15 + highTurbulence * 0.2 + shearPenalty * 0.2 + thermalPenalty * 0.1),
    0.15
  );
  const seeingArcsec = Number.isFinite(seeingIndex) ? 0.5 + (1 - seeingIndex) * 2.5 : null;

  const humidityPenalty = clamp((humidity ?? 70) / 100);
  const midPenalty = clamp(mid / 100);
  const highPenalty = clamp(high / 100);
  const visibilityPenalty = clamp(1 - (visibilityFactor ?? 1));
  const aerosolContribution = clamp(aerosolPenalty ?? 0);
  const transparencyIndex = clamp(
    1 - (humidityPenalty * 0.3 + midPenalty * 0.2 + highPenalty * 0.15 + visibilityPenalty * 0.15 + aerosolContribution * 0.2)
  );

  const dewFactor = clamp(Number.isFinite(dewPointSpread) ? (dewPointSpread - 1) / 7 : 1, 1);
  const dewRiskText = describeDewRisk(dewPointSpread);
  const seeingText = describeSeeingQuality(seeingIndex);
  const transparencyText = describeTransparencyQuality(transparencyIndex);
  const aerosolText = describeAerosolLoad(pm10, pm25);

  return {
    cover,
    low,
    mid,
    high,
    precipProb: pick(average(data.hourly.precipitation_probability), 0),
    weatherCode,
    temperature,
    wind,
    gust,
    humidity,
    dewPoint,
    dewPointSpread,
    dewFactor,
    dewRiskText,
    visibility,
    visibilityKm,
    visibilityFactor,
    pressure,
    jetStream,
    windShear,
    pm10,
    pm25,
    aerosolFactor,
    aerosolText,
    seeingIndex,
    seeingArcsec,
    seeingText,
    transparencyIndex,
    transparencyText,
    periodLabel
  };
}

async function handleSessionSubmit(event) {
  event.preventDefault();
  if (resultsPanel) resultsPanel.classList.add('hidden');
  if (weatherPanel) weatherPanel.classList.add('hidden');
  setContextPanelReady('weatherBody', false);
  if (moonPanel) moonPanel.classList.add('hidden');
  setContextPanelReady('moonBody', false);
  if (eventsPanel) eventsPanel.classList.add('hidden');
  setContextPanelReady('eventsBody', false);
  if (decisionPanel) {
    decisionPanel.classList.add('hidden');
    if (decisionSummary) {
      decisionSummary.textContent = 'Analyse en attente…';
    }
  }
  resetSkyMapPanel();
  resultsHint.textContent = 'Analyse en cours...';
  targetsList.innerHTML = '';
  cachedResults = [];
  cachedWeather = null;
  cachedMoon = null;
  cachedEvents = [];
  cachedContext = null;
  cachedDecision = null;
  cachedSourceObjects = [];
  lastBortleSummary = bortleHint?.textContent ?? '';
  updateFilterSummary();

  const lat = parseCoordinate(latitudeInput.value);
  const lon = parseCoordinate(longitudeInput.value);
  const bortle = Number(bortleInput.value);
  const dateValue = dateInput.value;
  const timeValue = timeInput.value;
  const duration = Number(durationSelect.value);

  astrophotoSettings = readAstrophotoSettings();

  const observationMode = getActiveObservationMode();
  const selectedCatalogues = getSelectedCatalogueIds();
  if (!selectedCatalogues || selectedCatalogues.length === 0) {
    resultsHint.textContent = 'Sélectionne au moins un catalogue avant de lancer une analyse.';
    resultsPanel.classList.remove('hidden');
    return;
  }
  await ensureCatalogueData(selectedCatalogues);
  const filteredObjects = filterObjectsByCatalogue(objectsCatalog, selectedCatalogues);
  if (!filteredObjects || filteredObjects.length === 0) {
    resultsHint.textContent =
      "Aucun objet n'est disponible dans les catalogues choisis. Active un catalogue supplémentaire pour continuer.";
    resultsPanel.classList.remove('hidden');
    return;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    resultsHint.textContent = 'Merci de renseigner une latitude et une longitude valides.';
    return;
  }

  const observationDateUTC = buildObservationDate(dateValue, timeValue);

  try {
    const moon = computeMoonSession(observationDateUTC, lat, lon) || computeMoonPhase(observationDateUTC);
    const events = getUpcomingEvents(observationDateUTC, moon);
    const weather = await fetchWeather(lat, lon, dateValue, timeValue, duration);
    renderWeather(weather);
    renderMoon(moon);
    renderEvents(events);
    const evaluated = evaluateTargets(filteredObjects, {
      lat,
      lon,
      bortle,
      date: observationDateUTC,
      durationHours: duration,
      moonIllumination: moon.illumination
    });
    const scoredEntries = applyWeather(evaluated, weather, {
      context: {
        latitude: lat,
        longitude: lon,
        durationHours: duration,
        date: observationDateUTC
      }
    });
    const weightedEntries = applyObservationWeights(scoredEntries, observationMode);
    const catalogueWeightSnapshot = buildCatalogueWeightSnapshot(selectedCatalogues, observationMode);
    cachedSourceObjects = filteredObjects;
    cachedResults = weightedEntries;
    cachedWeather = weather;
    cachedMoon = moon;
    cachedEvents = events;
    cachedContext = {
      latitude: lat,
      longitude: lon,
      bortle,
      localDate: dateValue,
      localTime: timeValue,
      durationHours: duration,
      dateISO: observationDateUTC.toISOString(),
      date: observationDateUTC,
      bortleSummary: lastBortleSummary || bortleHint?.textContent || '',
      observationMode,
      catalogueIds: selectedCatalogues,
      catalogueWeights: catalogueWeightSnapshot,
      nightDurationHours: computedNightDurationHours,
      nightSessionSlots: computedNightSessionSlots
    };
    const { display } = renderResultsView(weightedEntries);
    prepareSkyMap(cachedContext, display);
    const decision = computeDecisionInsights(weightedEntries, {
      weather,
      moon,
      context: cachedContext,
      objects: filteredObjects,
      equipment: astrophotoSettings,
      nights: 4
    });
    renderDecisionSupport(decision);
    storeSessionSnapshot({
      lat,
      lon,
      bortle,
      dateValue,
      timeValue,
      duration,
      observationDateUTC,
      weather,
      moon,
      events,
      entries: weightedEntries,
      decisionSupport: decision,
      astroSettings: astrophotoSettings,
      bortleSummary: lastBortleSummary || bortleHint?.textContent || '',
      observationMode,
      catalogueIds: selectedCatalogues,
      catalogueWeights: catalogueWeightSnapshot
    });
  } catch (error) {
    console.error(error);
    resultsHint.textContent = "Une erreur est survenue lors de l'analyse. Vérifie ta connexion internet et réessaie.";
  }
}

function fillCoordinates(lat, lon) {
  latitudeInput.value = formatCoordinate(lat);
  longitudeInput.value = formatCoordinate(lon);
  triggerCoordinateUpdates();
}

async function attemptAutoGeolocation() {
  if (autoGeolocAttempted) return;
  if (!navigator.geolocation) {
    autoGeolocAttempted = true;
    return;
  }

  const fallbackLat = formatCoordinate(48.856);
  const fallbackLon = formatCoordinate(2.352);
  const hasStoredLatitude = Number.isFinite(cachedContext?.latitude);
  const hasStoredLongitude = Number.isFinite(cachedContext?.longitude);
  const hasStoredLocation = hasStoredLatitude && hasStoredLongitude;
  const isUsingFallback = latitudeInput.value === fallbackLat && longitudeInput.value === fallbackLon;

  if (hasStoredLocation && !isUsingFallback) {
    autoGeolocAttempted = true;
    return;
  }

  autoGeolocAttempted = true;

  if (navigator.permissions && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state === 'denied') {
        return;
      }
    } catch (error) {
      console.warn('Permission de géolocalisation inconnue, tentative quand même :', error);
    }
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      fillCoordinates(position.coords.latitude, position.coords.longitude);
      autoFetchBortle();
      try {
        if (typeof sessionForm.requestSubmit === 'function') {
          sessionForm.requestSubmit();
        } else {
          const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
          sessionForm.dispatchEvent(submitEvent);
        }
      } catch (error) {
        console.warn('Impossible de lancer automatiquement une analyse après géolocalisation :', error);
      }
    },
    (error) => {
      console.warn('Géolocalisation automatique indisponible :', error);
    },
    { enableHighAccuracy: true, maximumAge: 120000 }
  );
}

useGeolocBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('La géolocalisation n\'est pas supportée dans ce navigateur.');
    return;
  }
  autoGeolocAttempted = true;
  useGeolocBtn.disabled = true;
  useGeolocBtn.textContent = '…';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      fillCoordinates(position.coords.latitude, position.coords.longitude);
      autoFetchBortle();
      useGeolocBtn.disabled = false;
      useGeolocBtn.textContent = '📍';
    },
    () => {
      alert('Impossible de récupérer la position.');
      useGeolocBtn.disabled = false;
      useGeolocBtn.textContent = '📍';
    },
    { enableHighAccuracy: true, maximumAge: 120000 }
  );
});

bortleInput.addEventListener('input', updateBortleLabel);
latitudeInput.addEventListener('blur', handleCoordinateBlur);
longitudeInput.addEventListener('blur', handleCoordinateBlur);
latitudeInput.addEventListener('input', triggerCoordinateUpdates);
longitudeInput.addEventListener('input', triggerCoordinateUpdates);
dateInput.addEventListener('change', () => {
  triggerCoordinateUpdates();
  updateSessionDurationOptions(computedNightDurationHours);
});
const handleSessionTimeChange = () => {
  updateSessionDurationOptions(computedNightDurationHours);
  scheduleBortleRefresh();
};
timeInput.addEventListener('change', handleSessionTimeChange);
timeInput.addEventListener('input', handleSessionTimeChange);
resolveAddressBtn.addEventListener('click', resolveAddress);
addressInput.addEventListener('input', (event) => {
  scheduleAddressSuggestions(event.target.value);
});
addressInput.addEventListener('change', handleAddressSuggestionSelection);
addressInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleAddressSuggestionSelection();
    resolveAddress();
  }
});

if (observationModeInputs && observationModeInputs.length > 0) {
  observationModeInputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      const previousMode = activeObservationMode;
      if (catalogueSelection && catalogueCheckboxMap.size > 0) {
        catalogueSelectionByMode.set(previousMode, getSelectedCatalogueIds());
      }
      activeObservationMode = input.value;
      applyObservationModeContext(activeObservationMode);
    });
  });
}

if (selectAllCataloguesButton) {
  selectAllCataloguesButton.addEventListener('click', async () => {
    if (selectAllCataloguesButton.disabled) return;
    const mode = getActiveObservationMode();
    const applied = setSelectedCatalogueIds(null);
    catalogueSelectionByMode.set(mode, applied);
    updateRecommendedStyles(mode);
    if (catalogueHint) {
      catalogueHint.textContent = 'Chargement des catalogues sélectionnés…';
    }
    try {
      await ensureCatalogueData(applied);
    } catch (error) {
      console.error('Chargement de tous les catalogues impossible :', error);
    } finally {
      updateCatalogueHint(mode);
    }
  });
}

if (clearCatalogueSelectionButton) {
  clearCatalogueSelectionButton.addEventListener('click', () => {
    if (clearCatalogueSelectionButton.disabled) return;
    setSelectedCatalogueIds([]);
    const mode = getActiveObservationMode();
    catalogueSelectionByMode.set(mode, []);
    updateCatalogueHint(mode);
  });
}

spinnerButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const targetId = button.dataset.target;
    const step = Number(button.dataset.step);
    const direction = button.dataset.direction === 'down' ? -1 : 1;
    const targetInput = document.getElementById(targetId);
    if (!targetInput || !Number.isFinite(step)) return;
    updateCoordinateInput(targetInput, step * direction);
  });
});

if (enableAstrophotoInput) {
  enableAstrophotoInput.addEventListener('change', () => {
    applyAstrophotoToggle();
    astrophotoSettings = readAstrophotoSettings();
    refreshDecisionSupport();
  });
}

if (equipmentSelect) {
  equipmentSelect.addEventListener('change', () => {
    astrophotoSettings = readAstrophotoSettings();
    persistAstrophotoPreferences(astrophotoSettings);
    renderAstrophotoGuidance();
    refreshDecisionSupport();
  });
}

if (astrophotoChecklistExportBtn) {
  astrophotoChecklistExportBtn.addEventListener('click', exportAstrophotoChecklist);
}

useSunsetBtn.addEventListener('click', () => {
  if (!cachedNightStartTime) return;
  timeInput.value = cachedNightStartTime.slice(0, 5);
  updateSessionDurationOptions(computedNightDurationHours);
  scheduleBortleRefresh();
});
refreshBortleBtn.addEventListener('click', autoFetchBortle);
sessionForm.addEventListener('submit', handleSessionSubmit);

if (skyMapTimeInput) {
  skyMapTimeInput.addEventListener('change', handleSkyMapTimeChange);
  skyMapTimeInput.addEventListener('input', () => {
    if (skyMapState.ready) {
      handleSkyMapTimeChange();
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

(async function bootstrap() {
  try {
    const { catalogues, objects, sources } = await loadCatalog();
    const filteredCatalogues = filterCataloguesForPreferences(catalogues, storedCataloguePreferences);
    catalogueDefinitions = Array.isArray(filteredCatalogues) ? filteredCatalogues : [];
    const knownCatalogues = new Set(catalogueDefinitions.map((catalogue) => catalogue.id));
    catalogueSources = new Map();
    if (sources instanceof Map) {
      sources.forEach((value, key) => {
        let id = '';
        if (typeof key === 'string' && key.trim()) {
          id = key.trim().toLowerCase();
        } else if (value?.catalogueId) {
          id = String(value.catalogueId).trim().toLowerCase();
        }
        if (id && knownCatalogues.has(id) && isCatalogueAllowed(id)) {
          catalogueSources.set(id, { ...value, catalogueId: id });
        }
      });
    }
    catalogueMetaMap.clear();
    catalogueDefinitions.forEach((catalogue) => {
      catalogueMetaMap.set(catalogue.id, catalogue);
    });
    catalogueSelectionByMode.clear();
    catalogueAvailability.forEach((selection, mode) => {
      const filtered = selection.filter((id) => knownCatalogues.has(id));
      catalogueAvailability.set(mode, filtered);
      catalogueSelectionByMode.set(mode, [...filtered]);
      if (OBSERVATION_MODES[mode]) {
        OBSERVATION_MODES[mode].recommended = [...filtered];
      }
    });
    allowedCatalogueSet.clear();
    catalogueAvailability.forEach((selection) => {
      selection.forEach((id) => allowedCatalogueSet.add(id));
    });
    const filteredObjects = filterObjectsForPreferences(objects, storedCataloguePreferences);
    registerCatalogueData(filteredObjects);
    populateTypeFilter();
    const initialMode = getActiveObservationMode();
    const initialAllowed = new Set((catalogueAvailability.get(initialMode) || []).filter((id) => knownCatalogues.has(id)));
    const initialCatalogues = initialAllowed.size > 0
      ? catalogueDefinitions.filter((catalogue) => initialAllowed.has(catalogue.id))
      : [];
    populateCatalogueSelection(initialCatalogues, objectsCatalog, { mode: initialMode });
    initDefaults();
    await ensureCatalogueData(getSelectedCatalogueIds());
    prefetchRemainingCatalogueData();
    await attemptAutoGeolocation();
  } catch (error) {
    console.error(error);
    resultsHint.textContent = 'Erreur de chargement : impossible de récupérer les objets célestes.';
    resultsPanel.classList.remove('hidden');
  }
})();

const ADDRESS_SUGGESTION_MIN_LENGTH = 3;
const ADDRESS_SUGGESTION_LIMIT = 5;
const ADDRESS_SUGGESTION_DEBOUNCE = 220;

function clearAddressSuggestions() {
  addressSuggestionsData = [];
  if (addressSuggestionList) {
    addressSuggestionList.innerHTML = '';
  }
}

function findAddressSuggestionByLabel(label) {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  return addressSuggestionsData.find((feature) => {
    const candidate = feature?.properties?.label;
    return typeof candidate === 'string' && candidate.trim().toLowerCase() === normalized;
  }) || null;
}

function applyAddressSuggestion(feature) {
  if (!feature) return false;
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return false;
  }
  const [lon, lat] = coordinates;
  fillCoordinates(lat, lon);
  autoFetchBortle();
  return true;
}

async function requestAddressSuggestions(query) {
  if (!addressSuggestionList) return;
  if (addressSuggestionAbortController) {
    addressSuggestionAbortController.abort();
  }
  addressSuggestionAbortController = new AbortController();
  try {
    const response = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=${ADDRESS_SUGGESTION_LIMIT}&autocomplete=1`,
      { signal: addressSuggestionAbortController.signal }
    );
    if (!response.ok) {
      throw new Error('Adresse introuvable');
    }
    const data = await response.json();
    const features = Array.isArray(data?.features) ? data.features.slice(0, ADDRESS_SUGGESTION_LIMIT) : [];
    addressSuggestionsData = features;
    addressSuggestionList.innerHTML = '';
    features.forEach((feature) => {
      const option = document.createElement('option');
      const label = feature?.properties?.label || feature?.properties?.name;
      if (!label) return;
      option.value = label;
      addressSuggestionList.appendChild(option);
    });
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.error('Impossible de proposer des adresses :', error);
    clearAddressSuggestions();
  } finally {
    addressSuggestionAbortController = null;
  }
}

function scheduleAddressSuggestions(query) {
  if (!addressSuggestionList) return;
  if (addressSuggestionFetchTimeout) {
    clearTimeout(addressSuggestionFetchTimeout);
  }
  if (!query || query.trim().length < ADDRESS_SUGGESTION_MIN_LENGTH) {
    clearAddressSuggestions();
    return;
  }
  addressSuggestionFetchTimeout = setTimeout(() => {
    requestAddressSuggestions(query.trim());
  }, ADDRESS_SUGGESTION_DEBOUNCE);
}

function handleAddressSuggestionSelection() {
  const value = addressInput ? addressInput.value.trim() : '';
  if (!value) return;
  const suggestion = findAddressSuggestionByLabel(value);
  if (applyAddressSuggestion(suggestion)) {
    clearAddressSuggestions();
  }
}

async function resolveAddress() {
  const query = addressInput.value.trim();
  if (!query) {
    addressInput.focus();
    return;
  }
  resolveAddressBtn.disabled = true;
  resolveAddressBtn.textContent = '…';
  try {
    const suggestion = findAddressSuggestionByLabel(query);
    if (applyAddressSuggestion(suggestion)) {
      return;
    }
    const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`);
    if (!response.ok) {
      throw new Error('Adresse introuvable');
    }
    const data = await response.json();
    const feature = data.features?.[0];
    if (!feature) {
      alert('Adresse introuvable. Essaie une autre formulation.');
      return;
    }
    const [lon, lat] = feature.geometry.coordinates;
    fillCoordinates(lat, lon);
    autoFetchBortle();
  } catch (error) {
    console.error(error);
    alert("Impossible de résoudre l'adresse pour le moment.");
  } finally {
    resolveAddressBtn.disabled = false;
    resolveAddressBtn.textContent = '🔎';
  }
}

async function updateSunsetFromInputs() {
  const lat = parseCoordinate(latitudeInput.value);
  const lon = parseCoordinate(longitudeInput.value);
  const dateValue = dateInput.value;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !dateValue) {
    sunsetHint.textContent = 'Renseigne des coordonnées pour proposer la nuit astronomique.';
    cachedNightStartTime = null;
    computedNightDurationHours = null;
    computedNightSessionSlots = null;
    computedNightStartDate = null;
    computedNightEndDate = null;
    updateSessionDurationOptions(null);
    return;
  }
  sunsetHint.textContent = 'Calcul du début de la nuit astronomique…';
  try {
    const sunTimes = await requestSunTimes(lat, lon, dateValue);
    const nightStartISO = sunTimes?.astronomicalDusk ?? sunTimes?.sunset;
    if (!nightStartISO) throw new Error('sunset');
    const nightStartDate = new Date(nightStartISO);
    const hours = nightStartDate.getHours().toString().padStart(2, '0');
    const minutes = nightStartDate.getMinutes().toString().padStart(2, '0');
    cachedNightStartTime = `${hours}:${minutes}`;
    computedNightStartDate = nightStartDate;
    const hasAstronomical = Boolean(sunTimes?.astronomicalDusk);
    const hintLabel = hasAstronomical
      ? 'début de la nuit astronomique'
      : 'début de la nuit astronomique estimé';

    computedNightDurationHours = null;
    computedNightSessionSlots = null;
    computedNightEndDate = null;
    let nightSessionsText = '';
    try {
      const tomorrowDate = shiftDateValue(dateValue, 1);
      const tomorrowSun = tomorrowDate ? await requestSunTimes(lat, lon, tomorrowDate) : null;
      const dawnISO = tomorrowSun?.astronomicalDawn ?? tomorrowSun?.sunrise ?? null;
      if (dawnISO) {
        const dawnDate = new Date(dawnISO);
        computedNightEndDate = dawnDate;
        const diffMs = dawnDate.getTime() - nightStartDate.getTime();
        const diffHours = diffMs / (60 * 60 * 1000);
        if (Number.isFinite(diffHours) && diffHours > 0.25) {
          computedNightDurationHours = diffHours;
          computedNightSessionSlots = Math.max(1, Math.floor(diffHours));
          nightSessionsText = describeNightSessions(computedNightSessionSlots);
        }
      }
    } catch (error) {
      console.warn('Impossible de calculer la durée totale de la nuit :', error);
      computedNightDurationHours = null;
      computedNightSessionSlots = null;
      computedNightEndDate = null;
    }

    updateSessionDurationOptions(computedNightDurationHours);

    const hintParts = [`Suggestion : commencer à ${cachedNightStartTime} (${hintLabel}).`];
    if (Number.isFinite(computedNightDurationHours)) {
      const durationLabel = formatHourDuration(computedNightDurationHours);
      const sessionLabel = nightSessionsText ? ` • ${nightSessionsText}` : '';
      hintParts.push(`Nuit noire ≈ ${durationLabel} h${sessionLabel}`);
    }
    if (!hasAstronomical) {
      hintParts.push('Crépuscule astronomique indisponible : estimation basée sur la fin du jour.');
    }
    sunsetHint.textContent = hintParts.join(' — ');
  } catch (error) {
    console.error(error);
    cachedNightStartTime = null;
    computedNightDurationHours = null;
    computedNightSessionSlots = null;
    computedNightStartDate = null;
    computedNightEndDate = null;
    updateSessionDurationOptions(null);
    sunsetHint.textContent = 'Impossible de calculer la nuit astronomique pour le moment.';
  }
}

async function autoFetchBortle() {
  const lat = parseCoordinate(latitudeInput.value);
  const lon = parseCoordinate(longitudeInput.value);
  const dateValue = dateInput.value;
  const timeValue = timeInput.value;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    bortleHint.textContent = 'Coordonnées invalides : impossible de récupérer Bortle.';
    return;
  }
  if (!dateValue || !timeValue) {
    bortleHint.textContent = 'Indique une date et une heure pour estimer la classe de Bortle.';
    return;
  }
  bortleHint.textContent = 'Recherche de la classe de Bortle…';
  const observationDateUTC = buildObservationDate(dateValue, timeValue);
  const requestISO = observationDateUTC.toISOString();
  const target = `https://www.lightpollutionmap.info/LPMS/app/external/getBortle.php?lat=${lat}&lon=${lon}&time=${encodeURIComponent(
    requestISO
  )}`;
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;

  const classifyBortleFromSqm = (sqm) => {
    if (!Number.isFinite(sqm)) return NaN;
    if (sqm >= 21.9) return 1;
    if (sqm >= 21.6) return 2;
    if (sqm >= 21.2) return 3;
    if (sqm >= 20.8) return 4;
    if (sqm >= 20.0) return 5;
    if (sqm >= 19.1) return 6;
    if (sqm >= 18.6) return 7;
    if (sqm >= 18.0) return 8;
    return 9;
  };

  const visitedNodes = new WeakSet();
  const extractBortleFromPayload = (raw) => {
    const result = { value: NaN, sourceLabel: null, details: null };
    if (typeof raw !== 'string') return result;
    const trimmed = raw.trim();
    if (!trimmed) return result;
    const direct = Number(trimmed);
    if (Number.isFinite(direct) && direct > 0) {
      return { value: direct, sourceLabel: 'LightPollutionMap.info', details: null };
    }
    const extractFromObject = (data) => {
      if (!data || typeof data !== 'object') return null;
      if (visitedNodes.has(data)) return null;
      visitedNodes.add(data);
      const entries = Object.entries(data);
      for (const [key, rawValue] of entries) {
        const lowerKey = String(key).toLowerCase();
        const numeric = Number(rawValue);
        if (Number.isFinite(numeric) && numeric > 0) {
          if (
            lowerKey === 'bortle' ||
            lowerKey === 'bortle_class' ||
            lowerKey === 'bortleclass' ||
            lowerKey === 'class_bortle' ||
            lowerKey === 'class' ||
            lowerKey === 'value' ||
            lowerKey === 'bortlescale'
          ) {
            return { value: numeric, sourceLabel: 'LightPollutionMap.info', details: null };
          }
          if (
            lowerKey === 'sqm' ||
            lowerKey === 'mag' ||
            lowerKey === 'sqmvalue' ||
            lowerKey === 'nsb' ||
            lowerKey === 'skyquality'
          ) {
            const converted = classifyBortleFromSqm(numeric);
            if (Number.isFinite(converted)) {
              return {
                value: converted,
                sourceLabel: 'LightPollutionMap.info',
                details: `SQM ${numeric.toFixed(2)}`
              };
            }
          }
        }
      }
      for (const [, value] of entries) {
        if (value && typeof value === 'object') {
          const nested = extractFromObject(value);
          if (nested) return nested;
        }
      }
      return null;
    };
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          const extracted = extractFromObject(entry);
          if (extracted) return extracted;
        }
      } else if (parsed && typeof parsed === 'object') {
        const extracted = extractFromObject(parsed);
        if (extracted) return extracted;
      }
    } catch (error) {
      const match = trimmed.match(/([-+]?\d*\.?\d+)/);
      if (match) {
        const numeric = Number(match[1]);
        if (Number.isFinite(numeric) && numeric > 0) {
          return { value: numeric, sourceLabel: 'LightPollutionMap.info', details: null };
        }
      }
      return result;
    }
    return result;
  };

  let baseBortleValue = Number(bortleInput.value);
  if (!Number.isFinite(baseBortleValue)) {
    baseBortleValue = 6;
  }
  let fetched = false;
  let baseSourceLabel = 'valeur conservée';
  let baseSourceDetails = '';

  try {
    const response = await fetch(proxied);
    if (!response.ok) throw new Error('bortle');
    const text = await response.text();
    const extracted = extractBortleFromPayload(text);
    if (!Number.isFinite(extracted.value)) throw new Error('bortle');
    baseBortleValue = extracted.value;
    baseSourceLabel = extracted.sourceLabel || 'LightPollutionMap.info';
    baseSourceDetails = extracted.details || '';
    fetched = true;
  } catch (error) {
    console.error('Impossible de récupérer la valeur brute de Bortle :', error);
  }

  let adjustedValue = baseBortleValue;
  const adjustments = [];

  try {
    const moon = computeMoonPhase(observationDateUTC);
    if (Number.isFinite(moon.illumination)) {
      const illuminationLabel = formatIllumination(moon.illumination);
      if (moon.illumination >= 0.75) {
        adjustedValue += 2;
        adjustments.push(`+2 Lune très lumineuse (${illuminationLabel})`);
      } else if (moon.illumination >= 0.5) {
        adjustedValue += 1;
        adjustments.push(`+1 Lune brillante (${illuminationLabel})`);
      } else if (moon.illumination <= 0.1) {
        adjustedValue -= 0.5;
        adjustments.push('−0,5 Lune quasi absente');
      }
    }
  } catch (error) {
    console.warn('Impossible de calculer la correction lunaire :', error);
  }

  try {
    const todaySun = await requestSunTimes(lat, lon, dateValue);
    const tomorrowDate = shiftDateValue(dateValue, 1);
    const tomorrowSun = tomorrowDate ? await requestSunTimes(lat, lon, tomorrowDate) : null;
    const observationTime = observationDateUTC.getTime();
    const duskTime = todaySun?.astronomicalDusk ? new Date(todaySun.astronomicalDusk).getTime() : null;
    const dawnTime = tomorrowSun?.astronomicalDawn ? new Date(tomorrowSun.astronomicalDawn).getTime() : null;
    if (duskTime && observationTime < duskTime) {
      adjustedValue += 1;
      adjustments.push('+1 Crépuscule astronomique non terminé');
    }
    if (dawnTime && observationTime > dawnTime) {
      adjustedValue += 1;
      adjustments.push('+1 Aube astronomique entamée');
    }
  } catch (error) {
    console.warn("Impossible d'ajuster selon le crépuscule :", error);
  }

  const adjustedClamped = Math.min(9, Math.max(1, Math.round(adjustedValue)));
  bortleInput.value = adjustedClamped;
  updateBortleLabel();

  const baseRounded = Math.min(9, Math.max(1, Math.round(baseBortleValue)));
  const sourceLabel = fetched
    ? baseSourceDetails
      ? `${baseSourceLabel} — ${baseSourceDetails}`
      : baseSourceLabel
    : baseSourceLabel;
  const parts = [`Classe estimée : Bortle ${adjustedClamped}`];
  parts.push(`base ${baseRounded} (${sourceLabel})`);
  if (adjustments.length > 0) {
    parts.push(`ajustements ${adjustments.join(', ')}`);
  }
  parts.push(`créneau ${dateValue} à ${timeValue}`);
  const summary = `${parts.join(' — ')}.`;
  bortleHint.textContent = summary;
  lastBortleSummary = summary;

  if (cachedContext) {
    const previousBortle = Number(cachedContext.bortle);
    const summaryChanged = summary !== (cachedContext.bortleSummary || '');
    if (!Number.isFinite(previousBortle) || previousBortle !== adjustedClamped || summaryChanged) {
      refreshScoresAfterBortle(adjustedClamped, summary);
    } else {
      cachedContext = {
        ...cachedContext,
        bortle: adjustedClamped,
        bortleSummary: summary
      };
    }
  }
}



function storeSessionSnapshot({
  lat,
  lon,
  bortle,
  dateValue,
  timeValue,
  duration,
  observationDateUTC,
  weather,
  moon,
  events,
  entries,
  decisionSupport,
  astroSettings,
  bortleSummary,
  observationMode,
  catalogueIds,
  catalogueWeights
}) {
  try {
    const snapshot = {
      version: SESSION_SNAPSHOT_VERSION,
      generatedAt: new Date().toISOString(),
      context: {
        latitude: lat,
        longitude: lon,
        bortle,
        localDate: dateValue,
        localTime: timeValue,
        durationHours: duration,
        dateISO: observationDateUTC.toISOString(),
        nightDurationHours: computedNightDurationHours,
        nightSessionSlots: computedNightSessionSlots,
        bortleSummary: typeof bortleSummary === 'string' ? bortleSummary : '',
        observationMode: observationMode || getActiveObservationMode(),
        catalogueIds: Array.isArray(catalogueIds) ? catalogueIds : [],
        catalogueWeights: catalogueWeights && typeof catalogueWeights === 'object' ? catalogueWeights : {}
      },
      weather,
      moon,
      events: Array.isArray(events) ? events.slice(0, 6) : [],
      entries: entries.map((entry) => ({
        object: entry.object,
        altitude: entry.altitude,
        azimuth: entry.azimuth,
        startAltitude: entry.startAltitude,
        startAzimuth: entry.startAzimuth,
        endAltitude: entry.endAltitude,
        endAzimuth: entry.endAzimuth,
        bestTime: entry.bestTime,
        averageAltitude: entry.averageAltitude,
        minAltitude: entry.minAltitude,
        visibilityRatio: entry.visibilityRatio,
        visibleSamples: entry.visibleSamples,
        altitudeDrift: entry.altitudeDrift,
        monthFactor: entry.monthFactor,
        bortleFactor: entry.bortleFactor,
        moonFactor: entry.moonFactor,
        baseScore: entry.baseScore,
        rawBaseScore: entry.rawBaseScore,
        weatherFactor: entry.weatherFactor,
        seeingFactor: entry.seeingFactor,
        transparencyFactor: entry.transparencyFactor,
        dewFactor: entry.dewFactor,
        aerosolFactor: entry.aerosolFactor,
        seeingArcsec: entry.seeingArcsec,
        seeingText: entry.seeingText,
        transparencyText: entry.transparencyText,
        dewRiskText: entry.dewRiskText,
        aerosolText: entry.aerosolText,
        score: entry.score,
        rawScore: entry.rawScore,
        weightFactor: entry.weightFactor,
        weightMode: entry.weightMode,
        weightCatalogueRefs: entry.weightCatalogueRefs,
        weatherWindow: entry.weatherWindow,
        atmosphereFactor: entry.atmosphereFactor,
        weatherConditionFactor: entry.weatherConditionFactor,
        track: entry.track,
        sessionStart: entry.sessionStart,
        sessionDurationHours: entry.sessionDurationHours
      })),
      decisionSupport: decisionSupport || null,
      astroSettings: astroSettings || null
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.error('Impossible de sauvegarder la session :', error);
  }
}
