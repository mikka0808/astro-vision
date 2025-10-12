import {
  SESSION_STORAGE_KEY,
  applyWeather,
  buildObservationDate,
  buildWeatherSummary,
  bortleDescriptions,
  computeMoonPhase,
  describeAzimuth,
  describeDewRisk,
  describeSeeingQuality,
  describeTransparencyQuality,
  enrichCatalogueData,
  evaluateTargets,
  formatAltitude,
  formatIllumination,
  formatLocalDateTime,
  formatLocalTime,
  formatCoordinate,
  getUpcomingEvents,
  parseCoordinate,
  selectTopTargets
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
const weatherDetails = document.getElementById('weatherDetails');
const moonPanel = document.getElementById('moonPanel');
const moonSummary = document.getElementById('moonSummary');
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

const SESSION_SNAPSHOT_VERSION = 3;
let objectsCatalog = [];
let cachedSunsetTime = null;
let sunsetDebounce = null;
let cachedResults = [];
let cachedWeather = null;
let cachedMoon = null;
let cachedEvents = [];
let cachedContext = null;

async function loadCatalog() {
  const response = await fetch('objects.json');
  if (!response.ok) {
    throw new Error('Impossible de charger la base de cibles.');
  }
  const data = await response.json();
  objectsCatalog = enrichCatalogueData(data);
  populateTypeFilter();
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
  const now = new Date();
  const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  dateInput.value = localISO.toISOString().slice(0, 10);
  timeInput.value = localISO.toISOString().slice(11, 16);
  if (!latitudeInput.value) {
    latitudeInput.value = formatCoordinate(48.856);
  }
  if (!longitudeInput.value) {
    longitudeInput.value = formatCoordinate(2.352);
  }
  updateBortleLabel();
  triggerCoordinateUpdates();
  autoFetchBortle();
}

function updateBortleLabel() {
  const value = Number(bortleInput.value);
  bortleValue.textContent = `${value} - ${bortleDescriptions[value]}`;
}

function renderWeather(data) {
  weatherSummary.textContent = buildWeatherSummary(data);
  const humidity = Number.isFinite(data.humidity) ? `${Math.round(data.humidity)} %` : '—';
  const visibility = Number.isFinite(data.visibilityKm) ? `${Math.round(data.visibilityKm)} km` : '—';
  const seeing = Number.isFinite(data.seeingIndex) ? `${Math.round(data.seeingIndex * 100)} %` : '—';
  const transparency = Number.isFinite(data.transparencyIndex) ? `${Math.round(data.transparencyIndex * 100)} %` : '—';
  const dewSpread = Number.isFinite(data.dewPointSpread) ? `${data.dewPointSpread.toFixed(1)} °C` : '—';
  const dewSafety = Number.isFinite(data.dewFactor) ? `${Math.round(data.dewFactor * 100)} %` : '—';
  const dewPoint = Number.isFinite(data.dewPoint) ? `${data.dewPoint.toFixed(1)} °C` : '—';
  weatherDetails.innerHTML = `
    <li>Couverture nuageuse totale : ${Math.round(data.cover)} %</li>
    <li>Nébulosité basse / moyenne / haute : ${Math.round(data.low)} % / ${Math.round(data.mid)} % / ${Math.round(data.high)} %</li>
    <li>Probabilité de précipitations : ${Math.round(data.precipProb)} %</li>
    <li>Température : ${data.temperature.toFixed(1)} °C</li>
    <li>Vent moyen : ${Math.round(data.wind)} km/h</li>
    <li>Humidité : ${humidity} • Visibilité : ${visibility}</li>
    <li>Seeing : ${data.seeingText ?? describeSeeingQuality(data.seeingIndex)} (${seeing})</li>
    <li>Transparence : ${data.transparencyText ?? describeTransparencyQuality(data.transparencyIndex)} (${transparency})</li>
    <li>Écart T/Td : ${dewSpread} — ${data.dewRiskText ?? describeDewRisk(data.dewPointSpread)} (Td ${dewPoint}, sécurité optique ${dewSafety})</li>
  `;
  weatherPanel.classList.remove('hidden');
}

function describeMoonImpactLevel(illumination) {
  if (!Number.isFinite(illumination)) return "Impact lunaire inconnu.";
  if (illumination <= 0.1) return "Luminosité négligeable : ciel très sombre.";
  if (illumination <= 0.35) return "Impact faible : quelques objets diffus peuvent pâlir.";
  if (illumination <= 0.65) return "Impact modéré : privilégie les objets brillants.";
  return "Impact fort : concentre-toi sur la Lune, les planètes ou les amas ouverts.";
}

function renderMoon(moon) {
  if (!moonPanel || !moonSummary || !moonDetails) return;
  if (!moon) {
    moonPanel.classList.add('hidden');
    return;
  }
  moonSummary.textContent = `${moon.emoji ?? '🌙'} ${moon.name} — ${formatIllumination(moon.illumination)} éclairée.`;
  moonDetails.innerHTML = `
    <li>Âge : ${moon.ageDays.toFixed(1)} jours</li>
    <li>${moon.description}</li>
    <li>${describeMoonImpactLevel(moon.illumination)}</li>
  `;
  moonPanel.classList.remove('hidden');
}

function renderEvents(events) {
  if (!eventsPanel || !eventsList) return;
  eventsList.innerHTML = '';
  if (!events || events.length === 0) {
    if (eventsHint) {
      eventsHint.textContent = 'Aucun événement particulier détecté pour cette période.';
    }
    eventsPanel.classList.add('hidden');
    return;
  }
  events.forEach((event) => {
    const item = document.createElement('li');
    item.className = 'event-item';
    const when = event.occursAt ? formatLocalDateTime(event.occursAt) : 'Consulte les ressources dédiées';
    item.innerHTML = `
      <h3>${event.icon ?? '✨'} ${event.name}</h3>
      <p class="meta">${event.type}${event.occursAt ? ` — ${when}` : ''}</p>
      <p>${event.description}</p>
    `;
    eventsList.appendChild(item);
  });
  if (eventsHint) {
    eventsHint.textContent = `Les événements sont triés par date et mis à jour selon ta session.`;
  }
  eventsPanel.classList.remove('hidden');
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
    const base = `Top ${targets.length} cibles optimisées selon la météo, la hauteur, la saison et la Lune.`;
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
    const monthValue = Math.round((entry.monthFactor ?? 0) * 100);
    const bortleValuePct = Math.round((entry.bortleFactor ?? 0) * 100);
    const bestMoment = formatLocalTime(entry.bestTime);
    const direction = describeAzimuth(entry.azimuth);
    const startDirection = describeAzimuth(entry.startAzimuth);
    card.innerHTML = `
      <header class="target-card__header">
        <div>
          <h3>${entry.object.name}</h3>
          <div class="meta">${entry.object.category || entry.object.type} • ${entry.object.constellation} • Mag ${entry.object.magnitude}</div>
        </div>
        <span class="score-chip">${Math.max(0, Math.min(100, scoreValue))}/100</span>
      </header>
      <p>${entry.object.description}</p>
      <dl class="target-metrics">
        <div><dt>Hauteur max</dt><dd>${formatAltitude(entry.altitude)}</dd></div>
        <div><dt>Direction</dt><dd>${direction}</dd></div>
        <div><dt>Moment idéal</dt><dd>${bestMoment}</dd></div>
      </dl>
      <div class="score-bar" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, scoreValue))}%"></span></div>
      <details class="target-details">
        <summary>Détails visibilité</summary>
        <ul>
          <li>Début de session : ${formatAltitude(entry.startAltitude)} • ${startDirection}</li>
          <li>Saison : ${monthValue}%</li>
          <li>Pollution lumineuse : ${bortleValuePct}%</li>
          <li>Influence lunaire : ${moonValue}%</li>
          <li>Météo : ${weatherValue}%</li>
          <li>Seeing : ${Math.max(0, Math.min(100, seeingValue))}%</li>
          <li>Transparence : ${Math.max(0, Math.min(100, transparencyValue))}%</li>
          <li>Sécurité anti-buée : ${Math.max(0, Math.min(100, dewValue))}%</li>
        </ul>
      </details>
    `;
    targetsList.appendChild(card);
  });

  resultsPanel.classList.remove('hidden');
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
      'cloudcover,cloudcover_low,cloudcover_mid,cloudcover_high,precipitation_probability,weathercode,temperature_2m,dewpoint_2m,relativehumidity_2m,visibility,windspeed_10m,windgusts_10m',
    timezone: 'auto',
    start_date: queryDate,
    end_date: queryDate
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Impossible de récupérer la météo.');
  }
  const data = await response.json();
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

  const pick = (value, fallback) => (Number.isFinite(value) ? value : fallback);

  const cover = pick(average(data.hourly.cloudcover), 100);
  const weatherCode = Math.round(pick(average(data.hourly.weathercode), 0));
  const windowEnd = indices[indices.length - 1];
  const endTime = times[windowEnd]?.slice(11, 16) ?? localTime;
  const periodLabel = `${localTime} → ${endTime}`;
  const wind = pick(average(data.hourly.windspeed_10m ?? data.hourly.wind_speed_10m), 0);
  const gust = pick(average(data.hourly.windgusts_10m ?? data.hourly.wind_gusts_10m), wind);
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

  const clamp = (value, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    if (numeric <= 0) return 0;
    if (numeric >= 1) return 1;
    return numeric;
  };

  const windPenalty = clamp((wind + gust * 0.3) / 50);
  const highPenalty = clamp(high / 90);
  const seeingIndex = clamp(1 - (windPenalty * 0.6 + highPenalty * 0.4), 0.2);

  const humidityPenalty = clamp((humidity ?? 70) / 100);
  const midPenalty = clamp(mid / 100);
  const visibilityPenalty = clamp(1 - (visibilityFactor ?? 1));
  const transparencyIndex = clamp(1 - (humidityPenalty * 0.5 + midPenalty * 0.3 + visibilityPenalty * 0.2));

  const dewFactor = clamp(Number.isFinite(dewPointSpread) ? (dewPointSpread - 1) / 7 : 1, 1);
  const dewRiskText = describeDewRisk(dewPointSpread);
  const seeingText = describeSeeingQuality(seeingIndex);
  const transparencyText = describeTransparencyQuality(transparencyIndex);

  return {
    cover,
    low,
    mid,
    high,
    precipProb: pick(average(data.hourly.precipitation_probability), 0),
    weatherCode,
    temperature,
    wind,
    humidity,
    dewPoint,
    dewPointSpread,
    dewFactor,
    dewRiskText,
    visibility,
    visibilityKm,
    visibilityFactor,
    seeingIndex,
    seeingText,
    transparencyIndex,
    transparencyText,
    periodLabel
  };
}

async function handleSessionSubmit(event) {
  event.preventDefault();
  resultsPanel.classList.add('hidden');
  weatherPanel.classList.add('hidden');
  if (moonPanel) moonPanel.classList.add('hidden');
  if (eventsPanel) eventsPanel.classList.add('hidden');
  resultsHint.textContent = 'Analyse en cours...';
  targetsList.innerHTML = '';
  cachedResults = [];
  cachedWeather = null;
  cachedMoon = null;
  cachedEvents = [];
  cachedContext = null;
  updateFilterSummary();

  const lat = parseCoordinate(latitudeInput.value);
  const lon = parseCoordinate(longitudeInput.value);
  const bortle = Number(bortleInput.value);
  const dateValue = dateInput.value;
  const timeValue = timeInput.value;
  const duration = Number(durationSelect.value);

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
      dateISO: observationDateUTC.toISOString()
    };
    updateFilterSummary();
    const selected = getActiveTypeFilters();
    const matches = selectTopTargets(scoredEntries, { limit: scoredEntries.length, typeFilter: selected });
    const display = matches.slice(0, 8);
    renderTargets(display, { total: scoredEntries.length, matchCount: matches.length });
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
      entries: scoredEntries
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
useSunsetBtn.addEventListener('click', () => {
  if (cachedSunsetTime) {
    timeInput.value = cachedSunsetTime.slice(0, 5);
  }
});
refreshBortleBtn.addEventListener('click', autoFetchBortle);
sessionForm.addEventListener('submit', handleSessionSubmit);

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
    const response = await fetch(
      `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=${dateValue}&formatted=0`
    );
    if (!response.ok) throw new Error('sunset');
    const data = await response.json();
    const sunsetISO = data?.results?.sunset;
    if (!sunsetISO) throw new Error('sunset');
    const sunsetDate = new Date(sunsetISO);
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
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    bortleHint.textContent = 'Coordonnées invalides : impossible de récupérer Bortle.';
    return;
  }
  bortleHint.textContent = 'Recherche de la classe de Bortle…';
  const target = `https://www.lightpollutionmap.info/LPMS/app/external/getBortle.php?lat=${lat}&lon=${lon}`;
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;
  try {
    const response = await fetch(proxied);
    if (!response.ok) throw new Error('bortle');
    const text = await response.text();
    const value = Number(text.trim());
    if (!Number.isFinite(value)) throw new Error('bortle');
    const clamped = Math.min(9, Math.max(1, Math.round(value)));
    bortleInput.value = clamped;
    updateBortleLabel();
    bortleHint.textContent = `Classe estimée : Bortle ${clamped} (source LightPollutionMap.info).`;
  } catch (error) {
    console.error(error);
    bortleHint.textContent = 'Impossible de récupérer automatiquement la classe de Bortle.';
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
  entries
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
        dateISO: observationDateUTC.toISOString()
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
        bestTime: entry.bestTime,
        monthFactor: entry.monthFactor,
        bortleFactor: entry.bortleFactor,
        moonFactor: entry.moonFactor,
        baseScore: entry.baseScore,
        weatherFactor: entry.weatherFactor,
        seeingFactor: entry.seeingFactor,
        transparencyFactor: entry.transparencyFactor,
        dewFactor: entry.dewFactor,
        score: entry.score
      }))
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.error('Impossible de sauvegarder la session :', error);
  }
}
