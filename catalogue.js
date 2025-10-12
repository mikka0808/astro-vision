import {
  SESSION_STORAGE_KEY,
  NIGHT_MODE_STORAGE_KEY,
  applyWeather,
  buildWeatherSummary,
  computeMoonPhase,
  describeAzimuth,
  describeAerosolLoad,
  describeDewRisk,
  describeSeeingQuality,
  describeTransparencyQuality,
  enrichCatalogueData,
  evaluateTargets,
  formatAltitude,
  formatCoordinate,
  formatArcseconds,
  formatIllumination,
  formatLocalDateTime,
  formatLocalTime
} from './astro-core.js';
import { createObservationPreview } from './catalogue-media.js';
import { renderAltitudeSparkline } from './charts.js';

const catalogueGrid = document.getElementById('catalogueGrid');
const catalogueHint = document.getElementById('catalogueHint');
const sessionSummary = document.getElementById('sessionSummary');
const sessionWeather = document.getElementById('sessionWeather');
const sessionMoon = document.getElementById('sessionMoon');
const sessionEvents = document.getElementById('sessionEvents');
const sessionDecision = document.getElementById('sessionDecision');
const sessionPanel = document.getElementById('sessionPanel');
const sortSelect = document.getElementById('catalogueSort');
const catalogueFilterSummary = document.getElementById('catalogueFilterSummary');
const catalogueTypeOptions = document.getElementById('catalogueTypeOptions');
const nightModeToggle = document.getElementById('nightModeToggle');

const SORT_BY = {
  number: 'number',
  score: 'score'
};

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

initNightMode();
if (nightModeToggle) {
  nightModeToggle.addEventListener('click', () => {
    const next = !document.body.classList.contains('night-mode');
    applyNightMode(next);
  });
}

const SCORE_CLASSES = {
  high: 'score-good',
  medium: 'score-medium',
  low: 'score-low',
  none: 'score-none'
};

let catalogueEntries = [];
let currentSort = SORT_BY.score;
let activeTypeFilters = [];

function normaliseScore(value) {
  return Number.isFinite(value) ? value : -1;
}

function sortEntries(entries, sortMode) {
  const sorted = [...entries];
  if (sortMode === SORT_BY.score) {
    sorted.sort((a, b) => {
      const scoreDiff = normaliseScore(b.metrics?.score) - normaliseScore(a.metrics?.score);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return (a.object.number ?? 0) - (b.object.number ?? 0);
    });
    return sorted;
  }
  sorted.sort((a, b) => (a.object.number ?? 0) - (b.object.number ?? 0));
  return sorted;
}

function readTypeSelection() {
  if (!catalogueTypeOptions) return [];
  return Array.from(catalogueTypeOptions.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
}

function updateCatalogueFilterSummary(count = 0, total = 0) {
  if (!catalogueFilterSummary) return;
  if (total === 0) {
    catalogueFilterSummary.textContent = 'Catalogue en cours de préparation.';
    return;
  }
  if (count === total && activeTypeFilters.length === 0) {
    catalogueFilterSummary.textContent = 'Tous les types sont affichés.';
  } else {
    catalogueFilterSummary.textContent = `${count} objets sur ${total} correspondent au filtre.`;
  }
}

function applyTypeFilter(entries) {
  if (!Array.isArray(entries)) return [];
  if (!activeTypeFilters || activeTypeFilters.length === 0) return entries;
  return entries.filter(({ object }) => activeTypeFilters.includes(object.category || object.type));
}

function populateCatalogueTypeFilter(objects) {
  if (!catalogueTypeOptions) return;
  catalogueTypeOptions.innerHTML = '';
  const categories = Array.from(new Set(objects.map((object) => object.category))).sort((a, b) =>
    a.localeCompare(b, 'fr', { sensitivity: 'base' })
  );
  activeTypeFilters = activeTypeFilters.filter((category) => categories.includes(category));
  if (categories.length === 0) {
    const info = document.createElement('p');
    info.className = 'help-text';
    info.textContent = 'Aucun type détecté dans le catalogue.';
    catalogueTypeOptions.appendChild(info);
    return;
  }
  categories.forEach((category) => {
    const label = document.createElement('label');
    label.className = 'filter-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = category;
    checkbox.checked = activeTypeFilters.includes(category);
    checkbox.addEventListener('change', () => {
      activeTypeFilters = readTypeSelection();
      updateCatalogue();
    });
    const span = document.createElement('span');
    span.textContent = category;
    label.appendChild(checkbox);
    label.appendChild(span);
    catalogueTypeOptions.appendChild(label);
  });
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'link-button';
  resetBtn.textContent = 'Réinitialiser';
  resetBtn.addEventListener('click', () => {
    catalogueTypeOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
    activeTypeFilters = [];
    updateCatalogue();
  });
  catalogueTypeOptions.appendChild(resetBtn);
  updateCatalogueFilterSummary(objects.length, objects.length);
}

function renderCatalogue(entries) {
  catalogueGrid.innerHTML = '';
  entries.forEach(({ object, metrics }) => {
    catalogueGrid.appendChild(buildCard(object, metrics));
  });
}

function updateCatalogue() {
  if (!Array.isArray(catalogueEntries) || catalogueEntries.length === 0) {
    catalogueGrid.innerHTML = '';
    updateCatalogueFilterSummary(0, 0);
    return;
  }
  const filtered = applyTypeFilter(catalogueEntries);
  const sorted = sortEntries(filtered, currentSort);
  renderCatalogue(sorted);
  updateCatalogueFilterSummary(filtered.length, catalogueEntries.length);
}

function readSessionSnapshot() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('Impossible de lire la dernière session :', error);
    return null;
  }
}

async function loadCatalog() {
  const response = await fetch('objects.json');
  if (!response.ok) {
    throw new Error('Impossible de charger les objets Messier.');
  }
  const data = await response.json();
  return enrichCatalogueData(data);
}

function formatSessionContext(snapshot) {
  if (!snapshot) {
    return "Aucune analyse récente trouvée. Retourne sur la page principale pour lancer un calcul.";
  }
  const { context } = snapshot;
  if (!context) {
    return "Contexte incomplet. Relance une analyse depuis la page principale.";
  }
  const latitude = Number.isFinite(context.latitude) ? formatCoordinate(context.latitude) : '—';
  const longitude = Number.isFinite(context.longitude) ? formatCoordinate(context.longitude) : '—';
  const latitudeText = latitude === '—' ? '—' : `${latitude}°`;
  const longitudeText = longitude === '—' ? '—' : `${longitude}°`;
  const bortle = Number.isFinite(context.bortle) ? context.bortle : '—';
  const when = context.localDate && context.localTime ? `${context.localDate} à ${context.localTime}` : 'date/heure inconnues';
  const duration = Number.isFinite(context.durationHours) ? context.durationHours : '—';
  const bortleSummary = context.bortleSummary ? ` ${context.bortleSummary}` : '';
  return `Session du ${when}, durée ${duration} h — latitude ${latitudeText}, longitude ${longitudeText}, Bortle ${bortle}.${bortleSummary}`;
}

function renderSessionWeather(weather) {
  if (!sessionWeather) return;
  sessionWeather.textContent = buildWeatherSummary(weather);
}

function renderSessionDecision(decision) {
  if (!sessionDecision) return;
  if (!decision || !Number.isFinite(decision.globalScore)) {
    sessionDecision.textContent =
      'Score global indisponible. Lance une nouvelle analyse pour obtenir l’aide à la décision.';
    return;
  }
  const score = Math.max(0, Math.min(100, Math.round((decision.globalScore ?? 0) * 100)));
  const label = decision.globalLabel ?? '';
  let astroSuffix = '';
  if (decision.astrophoto?.active && Array.isArray(decision.astrophoto.recommendations)) {
    const names = decision.astrophoto.recommendations
      .slice(0, 2)
      .map((entry) => entry.object?.name)
      .filter(Boolean);
    if (names.length > 0) {
      astroSuffix = ` — Photo : ${names.join(', ')}`;
    }
  }
  sessionDecision.textContent = `Score global ${score}/100 — ${label}.${astroSuffix}`;
}

function resolveMoon(snapshot) {
  if (snapshot?.moon && Number.isFinite(snapshot.moon.illumination)) {
    return snapshot.moon;
  }
  const iso = snapshot?.context?.dateISO;
  if (iso) {
    try {
      return computeMoonPhase(new Date(iso));
    } catch (error) {
      console.warn('Impossible de recalculer la phase lunaire :', error);
    }
  }
  return null;
}

function renderSessionMoon(moon) {
  if (!sessionMoon) return;
  if (!moon) {
    sessionMoon.textContent = 'Phase lunaire indisponible. Relance une analyse pour l\'actualiser.';
    return;
  }
  sessionMoon.textContent = `${moon.emoji ?? '🌙'} ${moon.name} — ${formatIllumination(moon.illumination)} éclairée. ${moon.description}`;
}

function renderSessionEvents(events) {
  if (!sessionEvents) return;
  sessionEvents.innerHTML = '';
  if (!events || events.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'event-item';
    empty.innerHTML = '<p>Aucun événement enregistré. Lance une nouvelle analyse pour obtenir les prochains phénomènes.</p>';
    sessionEvents.appendChild(empty);
    return;
  }
  events.forEach((event) => {
    const item = document.createElement('li');
    item.className = 'event-item';
    const when = event.occursAt ? formatLocalDateTime(event.occursAt) : 'À vérifier manuellement';
    item.innerHTML = `
      <h3>${event.icon ?? '✨'} ${event.name}</h3>
      <p class="meta">${event.type}${event.occursAt ? ` — ${when}` : ''}</p>
      <p>${event.description}</p>
    `;
    sessionEvents.appendChild(item);
  });
}

function renderSessionDetails(snapshot) {
  renderSessionDecision(snapshot?.decisionSupport);
  renderSessionWeather(snapshot?.weather);
  renderSessionMoon(resolveMoon(snapshot));
  renderSessionEvents(snapshot?.events);
}

function classifyScore(score) {
  if (!Number.isFinite(score) || score <= 0) return SCORE_CLASSES.none;
  if (score >= 0.66) return SCORE_CLASSES.high;
  if (score >= 0.4) return SCORE_CLASSES.medium;
  return SCORE_CLASSES.low;
}

function formatFactor(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

function buildCard(object, metrics) {
  const score = metrics?.score ?? 0;
  const destination = Number.isFinite(object.number) ? `messier.html?m=${object.number}` : 'messier.html';
  const card = document.createElement('a');
  card.className = `catalogue-card ${classifyScore(score)}`;
  card.href = destination;
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-label', `Voir la fiche détaillée de ${object.name}`);
  card.title = 'Ouvrir la fiche détaillée';
  if (Number.isFinite(object.number)) {
    card.dataset.messier = `M${object.number}`;
  }

  const previewWrapper = document.createElement('div');
  previewWrapper.className = 'preview-wrapper';
  previewWrapper.appendChild(createObservationPreview(object));

  const text = document.createElement('div');
  text.className = 'catalogue-text';
  const scoreValue = Math.round(score * 100);
  const scoreDisplay = Math.max(0, Math.min(100, scoreValue));
  const barWidth = scoreDisplay;
  const bestTime = formatLocalTime(metrics?.bestTime);
  const direction = describeAzimuth(metrics?.azimuth);
  const startDirection = describeAzimuth(metrics?.startAzimuth);
  const endDirection = describeAzimuth(metrics?.endAzimuth);
  const typeLabel = object.category || object.type || 'Objet céleste';
  const magnitudeText = Number.isFinite(object.magnitude) ? object.magnitude.toFixed(1) : '—';
  const altitudeText = formatAltitude(metrics?.altitude);
  const averageAltitudeText = formatAltitude(metrics?.averageAltitude);
  const minAltitudeText = formatAltitude(metrics?.minAltitude);
  const endAltitudeText = formatAltitude(metrics?.endAltitude);
  const coveragePercent = Number.isFinite(metrics?.visibilityRatio) ? Math.round(metrics.visibilityRatio * 100) : null;
  const visibleSamples = Number.isFinite(metrics?.visibleSamples) ? metrics.visibleSamples : null;
  const sampleLabel = visibleSamples === 1 ? 'point' : 'points';
  const coverageText =
    coveragePercent === null ? '—' : `${coveragePercent}%${visibleSamples !== null ? ` (${visibleSamples} ${sampleLabel})` : ''}`;
  const drift = Number.isFinite(metrics?.altitudeDrift) ? metrics.altitudeDrift : null;
  const driftText = drift === null ? '—' : `${drift >= 0 ? '+' : ''}${drift.toFixed(0)}°`;
  const seeingQuality = metrics?.seeingText ?? describeSeeingQuality(metrics?.seeingFactor ?? metrics?.seeingIndex);
  const seeingPercent = formatFactor(metrics?.seeingFactor ?? metrics?.seeingIndex ?? 1);
  const seeingArcsec = formatArcseconds(metrics?.seeingArcsec);
  const transparencyQuality =
    metrics?.transparencyText ?? describeTransparencyQuality(metrics?.transparencyFactor ?? metrics?.transparencyIndex);
  const transparencyPercent = formatFactor(metrics?.transparencyFactor ?? metrics?.transparencyIndex ?? 1);
  const aerosolQuality = metrics?.aerosolText ?? describeAerosolLoad();
  const aerosolPercent = formatFactor(metrics?.aerosolFactor ?? metrics?.transparencyFactor ?? 1);
  const dewQuality = metrics?.dewRiskText ?? describeDewRisk();
  const dewPercent = formatFactor(metrics?.dewFactor ?? metrics?.dewIndex ?? 1);
  text.innerHTML = `
    <header class="catalogue-card__header">
      <div>
        <h3>${object.name}</h3>
        <div class="meta">${typeLabel} • ${object.constellation} • Mag ${magnitudeText}</div>
      </div>
      <span class="score-chip">${scoreDisplay}/100</span>
    </header>
    <p>${object.description}</p>
    <div class="catalogue-visibility">
      <div>
        <span class="catalogue-visibility__label">Moment idéal</span>
        <span class="catalogue-visibility__value">${bestTime}</span>
      </div>
      <div>
        <span class="catalogue-visibility__label">Direction</span>
        <span class="catalogue-visibility__value">${altitudeText} • ${direction}</span>
      </div>
    </div>
    <dl class="target-metrics">
      <div><dt>Hauteur max</dt><dd>${altitudeText}</dd></div>
      <div><dt>Altitude moyenne</dt><dd>${averageAltitudeText}</dd></div>
      <div><dt>Moment idéal</dt><dd>${bestTime}</dd></div>
    </dl>
    <div class="visibility-chart" role="img" aria-label="Évolution de l'altitude de ${object.name} durant la session"></div>
    <div class="score-bar" aria-hidden="true"><span style="width:${barWidth}%"></span></div>
  `;

  const chartContainer = text.querySelector('.visibility-chart');
  if (chartContainer) {
    renderAltitudeSparkline(chartContainer, metrics?.track, {
      objectName: object.name,
      width: 320,
      height: 160
    });
  }

  const factors = document.createElement('ul');
  factors.className = 'factor-list';
  factors.innerHTML = `
    <li>Type : <strong>${typeLabel}</strong></li>
    <li>Magnitude : <strong>Mag ${magnitudeText}</strong></li>
    <li>Direction optimale : <strong>${direction}</strong></li>
    <li>Début de session : <strong>${formatAltitude(metrics?.startAltitude)} • ${startDirection}</strong></li>
    <li>Fin de session : <strong>${endAltitudeText} • ${endDirection}</strong></li>
    <li>Altitude moyenne : <strong>${averageAltitudeText} (min ${minAltitudeText})</strong></li>
    <li>Variation sur la fenêtre : <strong>${driftText}</strong></li>
    <li>Temps au-dessus de 15° : <strong>${coverageText}</strong></li>
    <li>Saison : <strong>${formatFactor(metrics?.monthFactor)}</strong></li>
    <li>Pollution lumineuse : <strong>${formatFactor(metrics?.bortleFactor)}</strong></li>
    <li>Influence lunaire : <strong>${formatFactor(metrics?.moonFactor)}</strong></li>
    <li>Météo : <strong>${formatFactor(metrics?.weatherFactor)}</strong></li>
    <li>Seeing : <strong>${seeingQuality} (${seeingPercent} • ${seeingArcsec})</strong></li>
    <li>Transparence : <strong>${transparencyQuality} (${transparencyPercent})</strong></li>
    <li>Aérosols : <strong>${aerosolQuality} (${aerosolPercent})</strong></li>
    <li>Sécurité anti-buée : <strong>${dewQuality} (${dewPercent})</strong></li>
  `;
  text.appendChild(factors);

  card.appendChild(previewWrapper);
  card.appendChild(text);
  return card;
}

function mergeMetrics(objects, snapshot) {
  const results = [];
  const map = new Map();
  if (snapshot?.entries) {
    snapshot.entries.forEach((entry) => {
      map.set(entry.object.name, entry);
    });
  }
  const context = snapshot?.context;
  const weather = snapshot?.weather;
  const lat = Number(context?.latitude ?? context?.lat);
  const lon = Number(context?.longitude ?? context?.lon);
  const bortle = Number(context?.bortle);
  const durationHours = Number(context?.durationHours ?? context?.duration ?? 2);
  const observationDate = context?.dateISO ? new Date(context.dateISO) : null;
  const moonIllumination = snapshot?.moon?.illumination ?? (observationDate ? computeMoonPhase(observationDate).illumination : 0);
  objects.forEach((object) => {
    let metrics = map.get(object.name);
    const needsRebuild =
      !metrics ||
      !Array.isArray(metrics.track) ||
      metrics.track.length === 0 ||
      !metrics.bestTime ||
      !Number.isFinite(metrics.altitude);

    if (
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      observationDate instanceof Date &&
      !Number.isNaN(observationDate.getTime()) &&
      needsRebuild
    ) {
      const evaluated = evaluateTargets([object], {
        lat,
        lon,
        bortle,
        date: observationDate,
        durationHours,
        moonIllumination
      });
      const scored = weather ? applyWeather(evaluated, weather) : evaluated;
      const rebuilt = scored[0];
      if (rebuilt) {
        metrics = metrics ? { ...metrics, ...rebuilt } : rebuilt;
      }
    }

    results.push({ object, metrics });
  });
  return results;
}

async function bootstrap() {
  try {
    const [objects, snapshot] = await Promise.all([loadCatalog(), Promise.resolve(readSessionSnapshot())]);
    sessionSummary.textContent = formatSessionContext(snapshot);
    renderSessionDetails(snapshot);
    const merged = mergeMetrics(objects, snapshot);
    catalogueEntries = merged;
    populateCatalogueTypeFilter(merged.map(({ object }) => object));
    updateCatalogue();
    if (snapshot) {
      catalogueHint.textContent =
        `${objects.length} objets listés — triés automatiquement par score décroissant. Clique sur une vignette pour ouvrir la fiche détaillée.`;
    } else {
      catalogueHint.textContent = `${objects.length} objets listés. `
        + 'Lance une analyse depuis la page principale pour obtenir les scores de visibilité et clique sur une vignette pour consulter la fiche.';
    }
    if (!snapshot && sessionPanel) {
      sessionPanel.classList.add('warning');
    }
  } catch (error) {
    console.error(error);
    catalogueHint.textContent = "Impossible de charger le catalogue pour le moment.";
  }
}

if (catalogueGrid) {
  catalogueGrid.addEventListener('click', (event) => {
    const card = event.target.closest('a.catalogue-card');
    if (!card) return;
    const href = card.getAttribute('href');
    if (!href) return;
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    window.location.assign(href);
  });
}

if (sortSelect) {
  sortSelect.value = SORT_BY.score;
  sortSelect.addEventListener('change', (event) => {
    const selected = event.target.value;
    if (selected === currentSort) {
      return;
    }
    currentSort = Object.values(SORT_BY).includes(selected) ? selected : SORT_BY.score;
    updateCatalogue();
  });
}

bootstrap();
