import {
  SESSION_STORAGE_KEY,
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
  computeDecisionInsights
} from './astro-core.js';

const sessionForm = document.getElementById('sessionForm');
const addressInput = document.getElementById('addressLookup');
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
const decisionCalendarList = document.getElementById('decisionCalendarList');
const decisionAlertsList = document.getElementById('decisionAlertsList');
const decisionAstrophotoList = document.getElementById('decisionAstrophotoList');
const astrophotoSummary = document.getElementById('astrophotoSummary');
const enableAstrophotoInput = document.getElementById('enableAstrophoto');
const equipmentSelect = document.getElementById('equipmentProfile');
const panelToggleButtons = document.querySelectorAll('[data-panel-toggle]');
const nightModeToggle = document.getElementById('nightModeToggle');
const skyMapPanel = document.getElementById('skyMapPanel');
const skyMapSummary = document.getElementById('skyMapSummary');
const skyMapBody = document.getElementById('skyMapBody');
const skyMapContainer = document.getElementById('skyMapContainer');
const skyMapTimeInput = document.getElementById('skyMapTime');
const skyMapLocationHint = document.getElementById('skyMapLocationHint');

const contextPanels = new Map();

const SESSION_SNAPSHOT_VERSION = 7;
const NIGHT_MODE_STORAGE_KEY = 'astroSoir:nightMode';
let objectsCatalog = [];
let cachedSunsetTime = null;
let sunsetDebounce = null;
let cachedResults = [];
let cachedWeather = null;
let cachedMoon = null;
let cachedEvents = [];
let cachedContext = null;
let cachedDecision = null;
let astrophotoSettings = { enabled: false, profileId: 'visual' };
let bortleDebounce = null;
let lastBortleSummary = '';
let skyMapLoaderPromise = null;
let skyMapInstance = null;
let skyMapOverlay = null;
const skyMapState = { context: null, targets: [], selectedISO: null, ready: false };

const sunTimesCache = new Map();

async function loadCatalog() {
  const response = await fetch('objects.json');
  if (!response.ok) {
    throw new Error('Impossible de charger la base de cibles.');
  }
  const data = await response.json();
  objectsCatalog = enrichCatalogueData(data);
  populateTypeFilter();
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

function shiftDateValue(dateValue, offsetDays) {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split('-').map(Number);
  if (![year, month, day].every((part) => Number.isFinite(part))) return null;
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
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

function applyAstrophotoToggle() {
  if (!enableAstrophotoInput || !equipmentSelect) return;
  const enabled = enableAstrophotoInput.checked;
  equipmentSelect.disabled = !enabled;
  if (!enabled) {
    equipmentSelect.value = 'visual';
  }
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
  const stored = snapshot?.astroSettings || {
    enabled: snapshot?.decisionSupport?.astrophoto?.active,
    profileId: snapshot?.decisionSupport?.astrophoto?.profileId
  };
  if (!stored) return;
  enableAstrophotoInput.checked = Boolean(stored.enabled);
  if (stored.profileId) {
    equipmentSelect.value = stored.profileId;
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

function updateFilteredTargets() {
  updateFilterSummary();
  if (!cachedResults || cachedResults.length === 0) return;
  const selected = getActiveTypeFilters();
  const matches = selectTopTargets(cachedResults, { limit: cachedResults.length, typeFilter: selected });
  const display = matches.slice(0, 8);
  renderTargets(display, { total: cachedResults.length, matchCount: matches.length });
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

  latitudeInput.value = storedLat ?? formatCoordinate(48.856);
  longitudeInput.value = storedLon ?? formatCoordinate(2.352);
  dateInput.value = storedDate ?? fallbackDate;
  timeInput.value = storedTime ?? fallbackTime;

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
    const highlightCards = [
      { label: 'Nuages', value: coverValue, sub: 'Couverture totale' },
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

  moonSummary.innerHTML = `<strong>${moon.emoji ?? '🌙'} ${moon.name}</strong> • ${illuminationText} éclairée • ${impact}`;

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

  moonDetails.innerHTML = `
    <li>
      <span class="data-label">Âge lunaire</span>
      <span class="data-value">${moon.ageDays.toFixed(1)} jours</span>
    </li>
    <li>
      <span class="data-label">Aspect du soir</span>
      <span class="data-value">${moon.description}</span>
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
  container.innerHTML = '';
  const track = Array.isArray(entry.track)
    ? entry.track
        .map((point) => {
          if (!point || !point.timeISO) return null;
          const date = new Date(point.timeISO);
          const altitude = Number(point.altitude);
          if (Number.isNaN(date.getTime()) || !Number.isFinite(altitude)) return null;
          return { date, altitude };
        })
        .filter(Boolean)
    : [];
  if (track.length === 0) {
    container.classList.add('visibility-chart--empty');
    const fallback = document.createElement('p');
    fallback.className = 'visibility-chart__empty';
    fallback.textContent = 'Courbe de visibilité indisponible pour cet objet.';
    container.appendChild(fallback);
    return;
  }
  container.classList.remove('visibility-chart--empty');
  track.sort((a, b) => a.date.getTime() - b.date.getTime());
  const minTime = track[0].date.getTime();
  const maxTime = track[track.length - 1].date.getTime();
  const span = Math.max(1, maxTime - minTime);
  const viewWidth = 280;
  const viewHeight = 140;
  const margin = { top: 12, right: 12, bottom: 26, left: 32 };
  const chartWidth = viewWidth - margin.left - margin.right;
  const chartHeight = viewHeight - margin.top - margin.bottom;
  const clampAltitude = (value) => Math.max(0, Math.min(90, value));
  const scaleX = (time) => margin.left + ((time - minTime) / span) * chartWidth;
  const scaleY = (altitude) => margin.top + chartHeight - (clampAltitude(altitude) / 90) * chartHeight;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`);
  svg.setAttribute('aria-hidden', 'true');
  const desc = document.createElementNS('http://www.w3.org/2000/svg', 'desc');
  const intervalMinutes =
    track.length > 1 ? Math.round((track[1].date.getTime() - track[0].date.getTime()) / 60000) : null;
  desc.textContent = `Hauteur horaire de ${objectName}${
    intervalMinutes ? ` toutes les ${intervalMinutes} minutes` : ''
  }.`;
  svg.appendChild(desc);

  const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  baseline.setAttribute('x1', margin.left);
  baseline.setAttribute('x2', margin.left + chartWidth);
  baseline.setAttribute('y1', margin.top + chartHeight);
  baseline.setAttribute('y2', margin.top + chartHeight);
  baseline.setAttribute('class', 'visibility-chart__axis');
  svg.appendChild(baseline);

  const thresholdY = scaleY(15);
  const threshold = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  threshold.setAttribute('x1', margin.left);
  threshold.setAttribute('x2', margin.left + chartWidth);
  threshold.setAttribute('y1', thresholdY);
  threshold.setAttribute('y2', thresholdY);
  threshold.setAttribute('class', 'visibility-chart__threshold');
  svg.appendChild(threshold);

  const firstX = scaleX(track[0].date.getTime());
  const lastX = scaleX(track[track.length - 1].date.getTime());
  const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  areaPath.setAttribute(
    'd',
    `M ${firstX} ${margin.top + chartHeight} ` +
      track
        .map((point) => `L ${scaleX(point.date.getTime())} ${scaleY(point.altitude)}`)
        .join(' ') +
      ` L ${lastX} ${margin.top + chartHeight} Z`
  );
  areaPath.setAttribute('class', 'visibility-chart__area');
  svg.appendChild(areaPath);

  const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  linePath.setAttribute(
    'd',
    track
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.date.getTime())} ${scaleY(point.altitude)}`)
      .join(' ')
  );
  linePath.setAttribute('class', 'visibility-chart__line');
  svg.appendChild(linePath);

  track.forEach((point, index) => {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', scaleX(point.date.getTime()));
    dot.setAttribute('cy', scaleY(point.altitude));
    dot.setAttribute('r', index === 0 || index === track.length - 1 ? 3.5 : 2.5);
    dot.setAttribute('class', 'visibility-chart__dot');
    svg.appendChild(dot);
  });

  const altLabels = [15, 45, 75];
  altLabels.forEach((alt) => {
    const y = scaleY(alt);
    if (y <= margin.top || y >= margin.top + chartHeight) return;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', 6);
    text.setAttribute('y', y + 4);
    text.setAttribute('class', 'visibility-chart__label');
    text.textContent = `${alt}°`;
    svg.appendChild(text);
  });

  container.appendChild(svg);
  const times = document.createElement('div');
  times.className = 'visibility-chart__times';
  const firstLabel = formatLocalTime(track[0].date.toISOString());
  const middleLabel = formatLocalTime(track[Math.floor(track.length / 2)].date.toISOString());
  const lastLabel = formatLocalTime(track[track.length - 1].date.toISOString());
  times.innerHTML = `<span>${firstLabel}</span><span>${middleLabel}</span><span>${lastLabel}</span>`;
  container.appendChild(times);
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
    card.className = 'target-card';
    card.setAttribute('role', 'listitem');
    const scoreValue = Math.round((entry.score ?? 0) * 100);
    const moonValue = Math.round((entry.moonFactor ?? 0) * 100);
    const weatherValue = Math.round((entry.weatherFactor ?? 0) * 100);
    const seeingValue = Math.round((entry.seeingFactor ?? entry.seeingIndex ?? 1) * 100);
    const transparencyValue = Math.round((entry.transparencyFactor ?? entry.transparencyIndex ?? 1) * 100);
    const dewValue = Math.round((entry.dewFactor ?? entry.dewIndex ?? 1) * 100);
    const aerosolValue = Math.round((entry.aerosolFactor ?? cachedWeather?.aerosolFactor ?? 1) * 100);
    const seeingQuality = entry.seeingText ?? describeSeeingQuality(entry.seeingFactor);
    const transparencyQuality = entry.transparencyText ?? describeTransparencyQuality(entry.transparencyFactor);
    const aerosolQuality =
      entry.aerosolText ?? (cachedWeather ? describeAerosolLoad(cachedWeather.pm10, cachedWeather.pm25) : 'charge particulaire inconnue');
    const dewRiskQuality = entry.dewRiskText ?? describeDewRisk(cachedWeather?.dewPointSpread);
    const seeingArcsecText = formatArcseconds(entry.seeingArcsec);
    const monthValue = Math.round((entry.monthFactor ?? 0) * 100);
    const bortleValuePct = Math.round((entry.bortleFactor ?? 0) * 100);
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
    const drift = Number.isFinite(entry.altitudeDrift) ? entry.altitudeDrift : null;
    const driftText = drift === null ? '—' : `${drift >= 0 ? '+' : ''}${drift.toFixed(0)}°`;
    card.innerHTML = `
      <header class="target-card__header">
        <div>
          <h3>${entry.object.name}</h3>
          <div class="meta">${typeLabel} • ${entry.object.constellation} • Mag ${magnitudeText}</div>
        </div>
        <span class="score-chip">${Math.max(0, Math.min(100, scoreValue))}/100</span>
      </header>
      <p>${entry.object.description}</p>
      <dl class="target-metrics">
        <div><dt>Hauteur max</dt><dd>${formatAltitude(entry.altitude)}</dd></div>
        <div><dt>Altitude moyenne</dt><dd>${averageAltitudeText}</dd></div>
        <div><dt>Moment idéal</dt><dd>${bestMoment}</dd></div>
      </dl>
      <div class="visibility-chart" role="img" aria-label="Evolution de l'altitude durant la session"></div>
      <div class="score-bar" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, scoreValue))}%"></span></div>
      <details class="target-details">
        <summary>Détails visibilité</summary>
        <ul>
          <li>Type : ${typeLabel}</li>
          <li>Magnitude apparente : Mag ${magnitudeText}</li>
          <li>Direction optimale : ${direction}</li>
          <li>Début de session : ${formatAltitude(entry.startAltitude)} • ${startDirection}</li>
          <li>Fin de session : ${endAltitudeText} • ${endDirection}</li>
          <li>Altitude moyenne : ${averageAltitudeText} (min ${minAltitudeText})</li>
          <li>Variation sur la fenêtre : ${driftText}</li>
          <li>Temps au-dessus de 15° : ${coverageText}</li>
          <li>Saison : ${monthValue}%</li>
          <li>Pollution lumineuse : ${bortleValuePct}%</li>
          <li>Influence lunaire : ${moonValue}%</li>
          <li>Météo : ${weatherValue}%</li>
          <li>Seeing : ${seeingQuality} (${Math.max(0, Math.min(100, seeingValue))}%, ${seeingArcsecText})</li>
          <li>Transparence : ${transparencyQuality} (${Math.max(0, Math.min(100, transparencyValue))}%)</li>
          <li>Aérosols : ${aerosolQuality} (${Math.max(0, Math.min(100, aerosolValue))}%)</li>
          <li>Sécurité anti-buée : ${dewRiskQuality} (${Math.max(0, Math.min(100, dewValue))}%)</li>
        </ul>
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
    if (avgAltitude !== null) parts.push(`Altitude moyenne ${avgAltitude}°`);
    if (avgVisibility !== null) parts.push(`Couverture ${avgVisibility}% du créneau`);
    if (skyWindow !== null) parts.push(`Fenêtre ciel ${skyWindow}%`);
    if (atmosphere !== null) parts.push(`Atmosphère ${atmosphere}%`);
    if (moonPercent !== null) parts.push(`Lune ${moonPercent}%`);
    globalScoreDetails.textContent = parts.join(' • ');
  }

  if (decisionCalendarList) {
    decisionCalendarList.innerHTML = '';
    const calendarEntries = Array.isArray(decision.calendar) ? decision.calendar.slice(0, 3) : [];
    if (calendarEntries.length === 0) {
      const item = document.createElement('li');
      item.textContent = 'Lance une analyse pour générer des fenêtres optimales.';
      decisionCalendarList.appendChild(item);
    } else {
      calendarEntries.forEach((entry) => {
        const item = document.createElement('li');
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
        item.appendChild(title);
        item.appendChild(span);
        decisionCalendarList.appendChild(item);
      });
    }
  }

  if (decisionAlertsList) {
    decisionAlertsList.innerHTML = '';
    const alerts = Array.isArray(decision.alerts) ? decision.alerts : [];
    if (alerts.length === 0) {
      const item = document.createElement('li');
      item.textContent = 'Aucune alerte particulière pour ce créneau.';
      decisionAlertsList.appendChild(item);
    } else {
      alerts.forEach((alert) => {
        const item = document.createElement('li');
        const title = document.createElement('strong');
        title.textContent = alert.object?.name ?? 'Cible recommandée';
        const span = document.createElement('span');
        const start = alert.windowStart ? formatLocalTime(alert.windowStart) : null;
        const end = alert.windowEnd ? formatLocalTime(alert.windowEnd) : null;
        const peak = formatLocalTime(alert.peak);
        const altitudeLabel = formatAltitude(alert.altitude);
        const direction = alert.direction || 'Direction inconnue';
        const windowText = start && end ? `entre ${start} et ${end}` : `vers ${peak}`;
        span.textContent = `${windowText} • ${altitudeLabel} • ${direction}`;
        item.appendChild(title);
        item.appendChild(span);
        decisionAlertsList.appendChild(item);
      });
    }
  }

  if (decisionAstrophotoList && astrophotoSummary) {
    decisionAstrophotoList.innerHTML = '';
    const astro = decision.astrophoto || {};
    astrophotoSummary.textContent = astro.active
      ? `${astro.profileLabel ?? 'Profil photo'} — ${astro.profileDescription ?? ''}`
      : 'Active le mode photo pour obtenir des recommandations dédiées.';
    if (astro.active && Array.isArray(astro.recommendations) && astro.recommendations.length > 0) {
      astro.recommendations.slice(0, 4).forEach((entry) => {
        const item = document.createElement('li');
        const title = document.createElement('strong');
        title.textContent = entry.object?.name ?? 'Cible photo';
        const span = document.createElement('span');
        const scoreLabel = Number.isFinite(entry.astroScore) ? `${Math.round(entry.astroScore * 100)}/100` : '—';
        const baseScore = Number.isFinite(entry.score ?? entry.baseScore)
          ? `${Math.round((entry.score ?? entry.baseScore) * 100)}/100`
          : '—';
        span.textContent = `${formatLocalTime(entry.bestTime)} • ${formatAltitude(entry.altitude)} • ${entry.direction || describeAzimuth(entry.azimuth)} • Photo ${scoreLabel} • Score global ${baseScore}`;
        item.appendChild(title);
        item.appendChild(span);
        decisionAstrophotoList.appendChild(item);
      });
    } else if (astro.active) {
      const item = document.createElement('li');
      item.textContent = 'Aucune cible photo ne dépasse le seuil pour cet équipement.';
      decisionAstrophotoList.appendChild(item);
    }
  }
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
  lastBortleSummary = bortleHint?.textContent ?? '';
  updateFilterSummary();

  const lat = parseCoordinate(latitudeInput.value);
  const lon = parseCoordinate(longitudeInput.value);
  const bortle = Number(bortleInput.value);
  const dateValue = dateInput.value;
  const timeValue = timeInput.value;
  const duration = Number(durationSelect.value);

  astrophotoSettings = readAstrophotoSettings();

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    resultsHint.textContent = 'Merci de renseigner une latitude et une longitude valides.';
    return;
  }

  const observationDateUTC = buildObservationDate(dateValue, timeValue);

  try {
    const moon = computeMoonPhase(observationDateUTC);
    const events = getUpcomingEvents(observationDateUTC, moon);
    const weather = await fetchWeather(lat, lon, dateValue, timeValue, duration);
    renderWeather(weather);
    renderMoon(moon);
    renderEvents(events);
    const evaluated = evaluateTargets(objectsCatalog, {
      lat,
      lon,
      bortle,
      date: observationDateUTC,
      durationHours: duration,
      moonIllumination: moon.illumination
    });
    const scoredEntries = applyWeather(evaluated, weather);
    cachedResults = scoredEntries;
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
      bortleSummary: lastBortleSummary || bortleHint?.textContent || ''
    };
    updateFilterSummary();
    const selected = getActiveTypeFilters();
    const matches = selectTopTargets(scoredEntries, { limit: scoredEntries.length, typeFilter: selected });
    const display = matches.slice(0, 8);
    renderTargets(display, { total: scoredEntries.length, matchCount: matches.length });
    prepareSkyMap(cachedContext, display);
    const decision = computeDecisionInsights(scoredEntries, {
      weather,
      moon,
      context: cachedContext,
      objects: objectsCatalog,
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
      entries: scoredEntries,
      decisionSupport: decision,
      astroSettings: astrophotoSettings,
      bortleSummary: lastBortleSummary || bortleHint?.textContent || ''
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

useGeolocBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('La géolocalisation n\'est pas supportée dans ce navigateur.');
    return;
  }
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
dateInput.addEventListener('change', triggerCoordinateUpdates);
timeInput.addEventListener('change', scheduleBortleRefresh);
timeInput.addEventListener('input', scheduleBortleRefresh);
resolveAddressBtn.addEventListener('click', resolveAddress);
addressInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    resolveAddress();
  }
});
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
    refreshDecisionSupport();
  });
}

useSunsetBtn.addEventListener('click', () => {
  if (cachedSunsetTime) {
    timeInput.value = cachedSunsetTime.slice(0, 5);
  }
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
    await loadCatalog();
    initDefaults();
  } catch (error) {
    console.error(error);
    resultsHint.textContent = 'Erreur de chargement : impossible de récupérer les objets célestes.';
    resultsPanel.classList.remove('hidden');
  }
})();

async function resolveAddress() {
  const query = addressInput.value.trim();
  if (!query) {
    addressInput.focus();
    return;
  }
  resolveAddressBtn.disabled = true;
  resolveAddressBtn.textContent = '…';
  try {
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
    sunsetHint.textContent = 'Renseigne des coordonnées pour proposer le créneau.';
    cachedSunsetTime = null;
    return;
  }
  sunsetHint.textContent = 'Calcul du coucher du soleil…';
  try {
    const sunTimes = await requestSunTimes(lat, lon, dateValue);
    if (!sunTimes?.sunset) throw new Error('sunset');
    const sunsetDate = new Date(sunTimes.sunset);
    const hours = sunsetDate.getHours().toString().padStart(2, '0');
    const minutes = sunsetDate.getMinutes().toString().padStart(2, '0');
    cachedSunsetTime = `${hours}:${minutes}`;
    sunsetHint.textContent = `Suggestion : commencer à ${cachedSunsetTime} (coucher du soleil).`;
  } catch (error) {
    console.error(error);
    cachedSunsetTime = null;
    sunsetHint.textContent = 'Impossible de calculer le coucher du soleil pour le moment.';
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

  let baseBortleValue = Number(bortleInput.value);
  if (!Number.isFinite(baseBortleValue)) {
    baseBortleValue = 6;
  }
  let fetched = false;

  try {
    const response = await fetch(proxied);
    if (!response.ok) throw new Error('bortle');
    const text = await response.text();
    const value = Number(text.trim());
    if (!Number.isFinite(value)) throw new Error('bortle');
    baseBortleValue = value;
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
  const parts = [`Classe estimée : Bortle ${adjustedClamped}`];
  parts.push(
    fetched
      ? `base ${baseRounded} (LightPollutionMap.info)`
      : `base ${baseRounded} (valeur conservée)`
  );
  if (adjustments.length > 0) {
    parts.push(`ajustements ${adjustments.join(', ')}`);
  }
  parts.push(`créneau ${dateValue} à ${timeValue}`);
  const summary = `${parts.join(' — ')}.`;
  bortleHint.textContent = summary;
  lastBortleSummary = summary;
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
  bortleSummary
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
        bortleSummary: typeof bortleSummary === 'string' ? bortleSummary : ''
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
