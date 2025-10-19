import {
  SESSION_STORAGE_KEY,
  NIGHT_MODE_STORAGE_KEY,
  buildWeatherSummary,
  computeDecisionInsights,
  evaluateTargets,
  applyWeather,
  formatAltitude,
  formatCoordinate,
  formatIllumination,
  formatLocalDateTime,
  formatLocalTime,
  describeAzimuth,
  resolveScoreTone
} from './astro-core.js';
import { renderAltitudeSparkline } from './charts.js';
import { loadScorePreferencesFromCookie } from './score-preferences.js';
import { filterSnapshotForPreferences, loadCataloguePreferences } from './catalogue-preferences.js';

loadScorePreferencesFromCookie();

const storedCataloguePreferences = loadCataloguePreferences();

const summaryEl = document.getElementById('dashboardSummary');
const scoreEl = document.getElementById('dashboardScore');
const gaugeEl = document.getElementById('dashboardGauge');
const scoreCard = document.querySelector('.metric-card--score');
const scoreMeter = document.querySelector('.score-meter');
const detailsEl = document.getElementById('dashboardDetails');
const metricsList = document.getElementById('dashboardMetrics');
const updatedEl = document.getElementById('dashboardUpdated');
const contextSummaryEl = document.getElementById('dashboardContextSummary');
const contextEl = document.getElementById('dashboardContext');
const weatherSummaryEl = document.getElementById('dashboardWeatherSummary');
const weatherEl = document.getElementById('dashboardWeather');
const moonSummaryEl = document.getElementById('dashboardMoonSummary');
const moonEl = document.getElementById('dashboardMoon');
const alertsList = document.getElementById('dashboardAlerts');
const calendarList = document.getElementById('dashboardCalendar');
const astroSummaryEl = document.getElementById('dashboardAstroSummary');
const astroList = document.getElementById('dashboardAstroList');
const timelineContainer = document.getElementById('dashboardTimeline');
const targetsGrid = document.getElementById('dashboardTargetsGrid');
const nightModeToggle = document.getElementById('nightModeToggle');

function classifyMetric(value, { good, warn, invert = false }) {
  if (!Number.isFinite(value)) return 'neutral';
  const adjusted = invert ? 100 - value : value;
  if (adjusted >= good) return 'good';
  if (adjusted >= warn) return 'warn';
  return 'bad';
}

function applyScoreTone(scoreValue) {
  const tone = resolveScoreTone(scoreValue, { scale: 100 });
  if (scoreCard) {
    if (tone === 'neutral') {
      delete scoreCard.dataset.level;
    } else {
      scoreCard.dataset.level = tone;
    }
  }
  if (scoreMeter) {
    if (tone === 'neutral') {
      delete scoreMeter.dataset.level;
    } else {
      scoreMeter.dataset.level = tone;
    }
  }
  if (gaugeEl) {
    if (tone === 'neutral') {
      delete gaugeEl.dataset.level;
    } else {
      gaugeEl.dataset.level = tone;
    }
  }
  return tone;
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
  item.classList.add('tone-frame');
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

function clampDateInRange(date, minDate, maxDate) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const time = date.getTime();
  const min = minDate instanceof Date && !Number.isNaN(minDate.getTime()) ? minDate.getTime() : null;
  const max = maxDate instanceof Date && !Number.isNaN(maxDate.getTime()) ? maxDate.getTime() : null;
  const clamped = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, time));
  return new Date(clamped);
}

function resolveSessionBounds(entry = {}) {
  const start = entry.sessionStart ? new Date(entry.sessionStart) : null;
  const hasStart = start instanceof Date && !Number.isNaN(start.getTime());
  if (!hasStart) {
    return { start: null, end: null };
  }
  const duration = Number(entry.sessionDurationHours);
  const end = Number.isFinite(duration)
    ? new Date(start.getTime() + Math.max(0, duration) * 60 * 60 * 1000)
    : null;
  return { start, end: end instanceof Date && !Number.isNaN(end.getTime()) ? end : null };
}

function computeVisibilityWindow(entry = {}) {
  const peak = entry.bestTime ? new Date(entry.bestTime) : null;
  if (!(peak instanceof Date) || Number.isNaN(peak.getTime())) {
    return { start: null, end: null };
  }
  const { start: sessionStart, end: sessionEnd } = resolveSessionBounds(entry);
  const windowWidthMinutes = Math.max(30, Math.min(90, Math.round((entry.visibilityRatio ?? 0.6) * 90)));
  const halfWindowMs = (windowWidthMinutes / 2) * 60000;
  const rawStart = new Date(peak.getTime() - halfWindowMs);
  const rawEnd = new Date(peak.getTime() + halfWindowMs);
  const start = clampDateInRange(rawStart, sessionStart, sessionEnd);
  const end = clampDateInRange(rawEnd, sessionStart, sessionEnd);
  return {
    start: start ? start.toISOString() : null,
    end: end ? end.toISOString() : null
  };
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

function readSnapshot() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return filterSnapshotForPreferences(parsed, storedCataloguePreferences);
  } catch (error) {
    console.error('Impossible de relire la dernière session :', error);
    return null;
  }
}

function ensureDecision(snapshot) {
  if (!snapshot) return null;
  if (snapshot.decisionSupport && Number.isFinite(snapshot.decisionSupport.globalScore)) {
    return snapshot.decisionSupport;
  }
  if (Array.isArray(snapshot.entries) && snapshot.entries.length > 0) {
    try {
      return computeDecisionInsights(snapshot.entries, {
        weather: snapshot.weather,
        moon: snapshot.moon,
        context: snapshot.context,
        objects: snapshot.entries.map((entry) => entry.object),
        equipment: snapshot.astroSettings,
        nights: 4
      });
    } catch (error) {
      console.warn('Impossible de reconstruire la décision :', error);
    }
  }
  return null;
}

function getEntryScore(entry) {
  if (entry && Number.isFinite(entry.score)) return entry.score;
  if (entry && Number.isFinite(entry.baseScore)) return entry.baseScore;
  return 0;
}

function pickTopEntries(snapshot, limit = 4) {
  if (!snapshot || !Array.isArray(snapshot.entries)) return [];
  const sorted = [...snapshot.entries].sort((a, b) => getEntryScore(b) - getEntryScore(a));
  return sorted.filter((entry) => Array.isArray(entry.track) && entry.track.length > 0).slice(0, limit);
}

function parseContextDate(context = {}) {
  if (!context) return null;
  if (context.dateISO) {
    const isoDate = new Date(context.dateISO);
    if (!Number.isNaN(isoDate.getTime())) {
      return isoDate;
    }
  }
  if (context.localDate && context.localTime) {
    try {
      const local = new Date(`${context.localDate}T${context.localTime}`);
      if (!Number.isNaN(local.getTime())) {
        return new Date(local.getTime() - local.getTimezoneOffset() * 60000);
      }
    } catch (error) {
      console.warn('Impossible de reconstruire la date locale :', error);
    }
  }
  return null;
}

function enrichEntriesWithTrack(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.entries) || snapshot.entries.length === 0) {
    return snapshot;
  }

  const hasCompleteTrack = snapshot.entries.every(
    (entry) => Array.isArray(entry.track) && entry.track.length > 0 && entry.bestTime
  );
  if (hasCompleteTrack) {
    return snapshot;
  }

  const context = snapshot.context || {};
  const lat = Number(context.latitude ?? context.lat);
  const lon = Number(context.longitude ?? context.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return snapshot;
  }

  const duration = Number(context.durationHours ?? context.duration ?? 2);
  const date = parseContextDate(context);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return snapshot;
  }

  const objects = snapshot.entries
    .map((entry) => entry.object)
    .filter((object) => object && object.name);
  if (objects.length === 0) {
    return snapshot;
  }

  try {
    const evaluated = evaluateTargets(objects, {
      lat,
      lon,
      bortle: Number(context.bortle),
      date,
      durationHours: duration,
      moonIllumination: snapshot?.moon?.illumination ?? 0
    });
    const weatherContext = {
      latitude: lat,
      longitude: lon,
      durationHours: duration,
      date
    };
    const enriched = snapshot.weather
      ? applyWeather(evaluated, snapshot.weather, { context: weatherContext })
      : evaluated;
    const byName = new Map(enriched.map((entry) => [entry.object?.name, entry]));
    const mergedEntries = snapshot.entries.map((entry) => {
      const update = byName.get(entry.object?.name);
      if (!update) {
        return entry;
      }
      return { ...entry, ...update };
    });
    const hydrated = { ...snapshot, entries: mergedEntries };
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(hydrated));
    } catch (error) {
      console.warn('Impossible de ré-enregistrer la session enrichie :', error);
    }
    return hydrated;
  } catch (error) {
    console.warn('Impossible de reconstruire les courbes de visibilité :', error);
    return snapshot;
  }
}

function renderContext(snapshot) {
  if (!contextEl || !contextSummaryEl) return;
  if (!snapshot?.context) {
    contextSummaryEl.innerHTML = '<p>Aucune session enregistrée.</p>';
    contextEl.textContent = 'Aucune session enregistrée. Retourne sur la page principale pour lancer une analyse.';
    return;
  }
  const { latitude, longitude, localDate, localTime, durationHours, bortle } = snapshot.context;
  const bortleSummary = snapshot.context?.bortleSummary;
  const latText = Number.isFinite(latitude) ? `${formatCoordinate(latitude)}°` : '—';
  const lonText = Number.isFinite(longitude) ? `${formatCoordinate(longitude)}°` : '—';
  const when = localDate && localTime ? `${localDate} à ${localTime}` : 'date inconnue';
  const duration = Number.isFinite(durationHours) ? `${durationHours} h` : 'durée inconnue';
  const bortleText = Number.isFinite(bortle) ? `Bortle ${bortle}` : 'Bortle ?';
  const summarySuffix = bortleSummary ? ` ${bortleSummary}` : '';
  contextSummaryEl.innerHTML = `
    <p>🗓️ ${when}</p>
    <p>⏱️ ${duration}</p>
    <p>💡 ${bortleText}${summarySuffix ? ` — ${summarySuffix.trim()}` : ''}</p>
  `;
  const lines = [
    `<strong>Session :</strong> ${when} (${duration})`,
    `<strong>Coordonnées :</strong> lat ${latText}, lon ${lonText}`,
    `<strong>Pollution :</strong> ${bortleText}${summarySuffix ? ` — ${summarySuffix.trim()}` : ''}`
  ];
  contextEl.innerHTML = lines.join('<br>');
}

function renderWeather(snapshot) {
  if (!weatherEl || !weatherSummaryEl) return;
  if (!snapshot?.weather) {
    weatherSummaryEl.innerHTML = '<p>Résumé météo indisponible.</p>';
    weatherEl.textContent = 'Résumé météo indisponible.';
    return;
  }
  const weatherText = buildWeatherSummary(snapshot.weather);
  weatherEl.textContent = weatherText;
  weatherSummaryEl.innerHTML = `<p>${headlineFrom(weatherText)}</p>`;
}

function renderMoon(snapshot) {
  if (!moonEl || !moonSummaryEl) return;
  const moon = snapshot?.moon;
  if (!moon) {
    moonSummaryEl.innerHTML = '<p>Phase lunaire non calculée.</p>';
    moonEl.textContent = 'Phase lunaire non calculée.';
    return;
  }
  moonSummaryEl.innerHTML = `
    <p>${moon.emoji ?? '🌙'} ${moon.name}</p>
    <p>${formatIllumination(moon.illumination)}</p>
  `;
  moonEl.textContent = `${moon.emoji ?? '🌙'} ${moon.name} — ${formatIllumination(moon.illumination)} éclairée.`;
}

function renderAlerts(decision) {
  if (!alertsList) return;
  alertsList.innerHTML = '';
  if (!decision || !Array.isArray(decision.alerts) || decision.alerts.length === 0) {
    const { item, content } = createDecisionItem({ icon: 'ℹ️' });
    item.classList.add('empty');
    const body = document.createElement('span');
    body.textContent = 'Aucune alerte détectée pour la dernière session.';
    content.appendChild(body);
    alertsList.appendChild(item);
    return;
  }
  decision.alerts.forEach((alert) => {
    const scoreValue = Number.isFinite(alert.score) ? Math.round(alert.score * 100) : null;
    const tone = Number.isFinite(scoreValue) ? resolveScoreTone(scoreValue, { scale: 100 }) : 'neutral';
    const { item, content } = createDecisionItem({ tone });
    const title = document.createElement('strong');
    title.textContent = alert.object?.name ?? 'Cible recommandée';
    const span = document.createElement('span');
    const start = alert.windowStart ? formatLocalTime(alert.windowStart) : null;
    const end = alert.windowEnd ? formatLocalTime(alert.windowEnd) : null;
    const peak = formatLocalTime(alert.peak);
    const altitude = formatAltitude(alert.altitude);
    const direction = alert.direction || describeAzimuth(alert.object?.azimuth);
    const windowText = start && end ? `Fenêtre ${start} → ${end}` : `Moment idéal ${peak}`;
    const scoreText = Number.isFinite(alert.score) ? `${Math.round(alert.score * 100)}/100` : '—';
    span.textContent = `${windowText} • ${altitude} • ${direction} • Score ${scoreText}`;
    content.appendChild(title);
    content.appendChild(span);
    alertsList.appendChild(item);
  });
}

function renderCalendar(decision) {
  if (!calendarList) return;
  calendarList.innerHTML = '';
  if (!decision || !Array.isArray(decision.calendar) || decision.calendar.length === 0) {
    const { item, content } = createDecisionItem({ icon: 'ℹ️' });
    item.classList.add('empty');
    const body = document.createElement('span');
    body.textContent = 'Relance une analyse pour générer le calendrier des fenêtres.';
    content.appendChild(body);
    calendarList.appendChild(item);
    return;
  }
  decision.calendar.forEach((entry) => {
    const bestWindow = entry.windows?.[0];
    const windowScore = Number.isFinite(bestWindow?.score ?? bestWindow?.baseScore)
      ? Math.round((bestWindow.score ?? bestWindow.baseScore) * 100)
      : null;
    const tone = Number.isFinite(windowScore) ? resolveScoreTone(windowScore, { scale: 100 }) : 'neutral';
    const { item, content, badge } = createDecisionItem({ tone, icon: '📅' });
    const title = document.createElement('strong');
    title.textContent = entry.object?.name ?? 'Objet céleste';
    const span = document.createElement('span');
    const rows = entry.windows
      .slice(0, 4)
      .map((window) => {
        const date = window.dateISO ? new Date(window.dateISO) : null;
        const day = date
          ? date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric' })
          : '—';
        const time = formatLocalTime(window.bestTime);
        const altitude = formatAltitude(window.altitude);
        const score = Number.isFinite(window.score ?? window.baseScore)
          ? `${Math.round((window.score ?? window.baseScore) * 100)}/100`
          : '—';
        const moonLabel = window.moonPhase?.emoji ? `${window.moonPhase.emoji} ${window.moonPhase.name}` : '';
        return `${day} • ${time} • ${altitude} • ${score}${moonLabel ? ` • ${moonLabel}` : ''}`;
      });
    span.innerHTML = rows.join('<br>');
    content.appendChild(title);
    content.appendChild(span);
    if (!rows.length) {
      badge.textContent = 'ℹ️';
      item.classList.add('empty');
    }
    calendarList.appendChild(item);
  });
}

function renderAstrophoto(decision) {
  if (!astroSummaryEl || !astroList) return;
  astroList.innerHTML = '';
  const astro = decision?.astrophoto;
  if (!astro || !astro.active) {
    astroSummaryEl.textContent =
      'Active le mode astrophotographie sur la page principale pour obtenir des recommandations personnalisées.';
    return;
  }
  astroSummaryEl.textContent = `${astro.profileLabel ?? 'Mode photo'} — ${astro.profileDescription ?? ''}`;
  if (!Array.isArray(astro.recommendations) || astro.recommendations.length === 0) {
    const { item, content } = createDecisionItem({ icon: 'ℹ️' });
    item.classList.add('empty');
    const body = document.createElement('span');
    body.textContent = 'Aucune cible photo prioritaire avec les conditions actuelles.';
    content.appendChild(body);
    astroList.appendChild(item);
    return;
  }
  astro.recommendations.forEach((entry) => {
    const astroScoreValue = Number.isFinite(entry.astroScore) ? Math.round(entry.astroScore * 100) : null;
    const tone = Number.isFinite(astroScoreValue) ? resolveScoreTone(astroScoreValue, { scale: 100 }) : 'neutral';
    const { item, content } = createDecisionItem({ tone, icon: '📷' });
    const title = document.createElement('strong');
    title.textContent = entry.object?.name ?? 'Cible photo';
    const span = document.createElement('span');
    const astroScore = Number.isFinite(entry.astroScore) ? `${Math.round(entry.astroScore * 100)}/100` : '—';
    const globalScore = Number.isFinite(entry.score ?? entry.baseScore)
      ? `${Math.round((entry.score ?? entry.baseScore) * 100)}/100`
      : '—';
    span.textContent = `${formatLocalTime(entry.bestTime)} • ${formatAltitude(entry.altitude)} • ${describeAzimuth(
      entry.azimuth
    )} • Photo ${astroScore} • Global ${globalScore}`;
    content.appendChild(title);
    content.appendChild(span);
    astroList.appendChild(item);
  });
}

function renderTimeline(entries) {
  if (!timelineContainer) return;
  timelineContainer.innerHTML = '';
  if (!entries || entries.length === 0) {
    const info = document.createElement('p');
    info.className = 'help-text';
    info.textContent = 'Lance une analyse pour afficher la courbe de visibilité des meilleures cibles.';
    timelineContainer.appendChild(info);
    return;
  }
  const labels = entries.map((entry, index) => entry.object?.name ?? `Cible ${index + 1}`);
  const timeBuckets = new Map();
  entries.forEach((entry, entryIndex) => {
    const label = labels[entryIndex];
    const track = Array.isArray(entry.track) ? entry.track : [];
    track.forEach((point) => {
      const iso = point?.timeISO;
      const altitude = Number(point?.altitude);
      if (!iso || !Number.isFinite(altitude)) return;
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return;
      const key = date.getTime();
      let bucket = timeBuckets.get(key);
      if (!bucket) {
        bucket = { time: date, values: new Map() };
        timeBuckets.set(key, bucket);
      }
      bucket.values.set(label, altitude);
    });
  });
  const buckets = Array.from(timeBuckets.values()).sort((a, b) => a.time.getTime() - b.time.getTime());
  if (buckets.length === 0) {
    const info = document.createElement('p');
    info.className = 'help-text';
    info.textContent = 'Courbe de visibilité indisponible pour les cibles sélectionnées.';
    timelineContainer.appendChild(info);
    return;
  }
  const aggregated = buckets.map((bucket) => {
    const altitudes = Array.from(bucket.values.values());
    return { time: bucket.time, altitude: Math.max(...altitudes) };
  });
  const width = 680;
  const height = 260;
  const margin = { top: 24, right: 28, bottom: 48, left: 58 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const minTime = aggregated[0].time.getTime();
  const maxTime = aggregated[aggregated.length - 1].time.getTime();
  const span = Math.max(1, maxTime - minTime);
  const clampAltitude = (value) => Math.max(0, Math.min(90, value));
  const scaleX = (time) => margin.left + ((time - minTime) / span) * chartWidth;
  const scaleY = (altitude) => margin.top + chartHeight - (clampAltitude(altitude) / 90) * chartHeight;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-hidden', 'true');

  const firstIso = aggregated[0].time.toISOString();
  const lastIso = aggregated[aggregated.length - 1].time.toISOString();
  const desc = document.createElementNS('http://www.w3.org/2000/svg', 'desc');
  desc.textContent = `Altitude maximale des meilleures cibles entre ${formatLocalTime(firstIso)} et ${formatLocalTime(lastIso)}.`;
  svg.appendChild(desc);

  const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  baseline.setAttribute('x1', margin.left);
  baseline.setAttribute('x2', margin.left + chartWidth);
  baseline.setAttribute('y1', margin.top + chartHeight);
  baseline.setAttribute('y2', margin.top + chartHeight);
  baseline.setAttribute('class', 'timeline-chart__axis');
  svg.appendChild(baseline);

  const thresholdLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  thresholdLine.setAttribute('x1', margin.left);
  thresholdLine.setAttribute('x2', margin.left + chartWidth);
  thresholdLine.setAttribute('y1', scaleY(15));
  thresholdLine.setAttribute('y2', scaleY(15));
  thresholdLine.setAttribute('class', 'timeline-chart__threshold');
  svg.appendChild(thresholdLine);

  [15, 30, 45, 60, 75].forEach((altitude) => {
    const y = scaleY(altitude);
    if (y <= margin.top || y >= margin.top + chartHeight) return;
    const grid = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    grid.setAttribute('x1', margin.left);
    grid.setAttribute('x2', margin.left + chartWidth);
    grid.setAttribute('y1', y);
    grid.setAttribute('y2', y);
    grid.setAttribute('class', 'timeline-chart__grid');
    svg.appendChild(grid);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', margin.left - 36);
    label.setAttribute('y', y + 4);
    label.setAttribute('class', 'timeline-chart__label');
    label.textContent = `${altitude}°`;
    svg.appendChild(label);
  });

  const firstX = scaleX(aggregated[0].time.getTime());
  const lastX = scaleX(aggregated[aggregated.length - 1].time.getTime());
  const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const areaSegments = aggregated
    .map((point) => `L ${scaleX(point.time.getTime())} ${scaleY(point.altitude)}`)
    .join(' ');
  areaPath.setAttribute(
    'd',
    `M ${firstX} ${margin.top + chartHeight} ${areaSegments} L ${lastX} ${margin.top + chartHeight} Z`
  );
  areaPath.setAttribute('class', 'timeline-chart__area');
  svg.appendChild(areaPath);

  const aggregateLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const aggregatePath = aggregated
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.time.getTime())} ${scaleY(point.altitude)}`)
    .join(' ');
  aggregateLine.setAttribute('d', aggregatePath);
  aggregateLine.setAttribute('class', 'timeline-chart__aggregate-line');
  svg.appendChild(aggregateLine);

  const series = labels
    .map((label) => ({
      label,
      points: buckets
        .filter((bucket) => bucket.values.has(label))
        .map((bucket) => ({ time: bucket.time, altitude: bucket.values.get(label) }))
    }))
    .filter((serie) => serie.points.length > 0);

  series.forEach((serie, index) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const pathData = serie.points
      .map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'} ${scaleX(point.time.getTime())} ${scaleY(point.altitude)}`)
      .join(' ');
    path.setAttribute('d', pathData);
    path.setAttribute('class', `timeline-chart__series timeline-chart__series--${index + 1}`);
    svg.appendChild(path);
  });

  timelineContainer.appendChild(svg);

  const legend = document.createElement('ul');
  legend.className = 'timeline-chart__legend';
  series.forEach((serie, index) => {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = `timeline-chart__swatch timeline-chart__swatch--${index + 1}`;
    const text = document.createElement('span');
    text.textContent = serie.label;
    item.appendChild(swatch);
    item.appendChild(text);
    legend.appendChild(item);
  });
  timelineContainer.appendChild(legend);

  const timeLabels = document.createElement('div');
  timeLabels.className = 'timeline-chart__times';
  const middleIso = aggregated[Math.floor(aggregated.length / 2)].time.toISOString();
  timeLabels.innerHTML = `<span>${formatLocalTime(firstIso)}</span><span>${formatLocalTime(middleIso)}</span><span>${formatLocalTime(lastIso)}</span>`;
  timelineContainer.appendChild(timeLabels);

  timelineContainer.setAttribute(
    'aria-label',
    `Altitude maximale des meilleures cibles entre ${formatLocalTime(firstIso)} et ${formatLocalTime(lastIso)}.`
  );
}

function renderTopTargets(entries) {
  if (!targetsGrid) return;
  targetsGrid.innerHTML = '';
  if (!entries || entries.length === 0) {
    const info = document.createElement('p');
    info.className = 'help-text';
    info.textContent = 'Aucune cible prioritaire à afficher. Relance une analyse pour obtenir des recommandations.';
    targetsGrid.appendChild(info);
    return;
  }
  entries.forEach((entry, index) => {
    const card = document.createElement('article');
    card.className = 'mini-target tone-frame';
    const header = document.createElement('header');
    header.className = 'mini-target__header';
    const rawScore = getEntryScore(entry);
    const scoreValue = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore * 100))) : null;
    const tone = scoreValue !== null ? resolveScoreTone(scoreValue, { scale: 100 }) : 'neutral';
    if (tone !== 'neutral') {
      card.dataset.tone = tone;
    } else {
      delete card.dataset.tone;
    }
    const heading = document.createElement('div');
    heading.className = 'mini-target__heading';
    const rank = document.createElement('span');
    rank.className = 'mini-target__rank';
    rank.setAttribute('aria-hidden', 'true');
    rank.textContent = `#${index + 1}`;
    const title = document.createElement('h3');
    title.textContent = entry.object?.name ?? `Objet ${index + 1}`;
    heading.appendChild(rank);
    heading.appendChild(title);
    const scoreChip = document.createElement('span');
    scoreChip.className = 'score-chip';
    scoreChip.textContent = scoreValue !== null ? `${scoreValue}/100` : '—';
    if (tone !== 'neutral') {
      scoreChip.dataset.tone = tone;
    } else {
      delete scoreChip.dataset.tone;
    }
    header.appendChild(heading);
    header.appendChild(scoreChip);
    card.appendChild(header);

    const meta = document.createElement('div');
    meta.className = 'mini-target__glance';
    const { start: windowStart, end: windowEnd } = computeVisibilityWindow(entry);
    const bestTime = entry.bestTime ? formatLocalTime(entry.bestTime) : '—';
    const windowLabel = windowStart && windowEnd
      ? `${formatLocalTime(windowStart)} → ${formatLocalTime(windowEnd)}`
      : windowStart
        ? `Dès ${formatLocalTime(windowStart)}`
        : windowEnd
          ? `Jusqu'à ${formatLocalTime(windowEnd)}`
          : '—';
    const altitude = Number.isFinite(entry.altitude) ? formatAltitude(entry.altitude) : '—';
    const direction = describeAzimuth(entry.azimuth);
    meta.innerHTML = `
      <div><span>Fenêtre</span><strong>${windowLabel}</strong></div>
      <div><span>Moment idéal</span><strong>${bestTime}</strong></div>
      <div><span>Direction</span><strong>${altitude} • ${direction}</strong></div>
    `;
    card.appendChild(meta);

    const fold = document.createElement('details');
    fold.className = 'card-fold';
    const summary = document.createElement('summary');
    summary.textContent = 'Détails visibilité';
    fold.appendChild(summary);

    const foldContent = document.createElement('div');
    foldContent.className = 'card-fold__content';

    const metrics = document.createElement('dl');
    metrics.className = 'mini-target__metrics';
    const startDirection = describeAzimuth(entry.startAzimuth);
    const endDirection = describeAzimuth(entry.endAzimuth);
    const coveragePercent = Number.isFinite(entry.visibilityRatio)
      ? `${Math.round(entry.visibilityRatio * 100)}%`
      : '—';
    metrics.innerHTML = `
      <div><dt>🌅 Début</dt><dd>${formatAltitude(entry.startAltitude)} • ${startDirection}</dd></div>
      <div><dt>🌇 Fin</dt><dd>${formatAltitude(entry.endAltitude)} • ${endDirection}</dd></div>
      <div><dt>🕓 Temps &gt; 30°</dt><dd>${coveragePercent}</dd></div>
    `;
    foldContent.appendChild(metrics);

    const chart = document.createElement('div');
    chart.className = 'visibility-chart';
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', `Altitude de ${entry.object?.name ?? 'la cible'} durant la session`);
    foldContent.appendChild(chart);

    const infoList = document.createElement('ul');
    infoList.className = 'target-insights';
    infoList.innerHTML = `
      <li>Altitude moyenne : ${formatAltitude(entry.averageAltitude)}</li>
      <li>Altitude minimale : ${formatAltitude(entry.minAltitude)}</li>
      <li>Poids catalogue : ${weightDisplay(entry)}</li>
    `;
    foldContent.appendChild(infoList);

    fold.appendChild(foldContent);
    card.appendChild(fold);

    renderAltitudeSparkline(chart, entry.track, { objectName: entry.object?.name, width: 300, height: 150 });

    targetsGrid.appendChild(card);
  });
}

function weightDisplay(entry) {
  if (!Number.isFinite(entry.weightFactor)) return '—';
  const weightPercent = Math.round(Math.max(0, entry.weightFactor) * 100);
  const weightedCatalogues = Array.isArray(entry.weightCatalogueRefs) && entry.weightCatalogueRefs.length > 0
    ? entry.weightCatalogueRefs
    : entry.object?.catalogueRefs;
  const uniqueCatalogues = Array.isArray(weightedCatalogues) ? Array.from(new Set(weightedCatalogues)) : [];
  if (uniqueCatalogues.length === 0) return `${weightPercent}%`;
  return `${weightPercent}% (${uniqueCatalogues.join(', ')})`;
}

function headlineFrom(text) {
  if (!text) return '—';
  const parts = text.split(/(?<=[.!?])\s+/);
  const first = parts.find((part) => part.trim().length > 0);
  return first ? first.trim() : text;
}

function renderScore(decision, snapshot) {
  if (!scoreEl || !gaugeEl || !detailsEl) return;
  if (!decision || !Number.isFinite(decision.globalScore)) {
    scoreEl.textContent = '—';
    gaugeEl.style.width = '0%';
    applyScoreTone(null);
    detailsEl.textContent = 'Score indisponible.';
    if (metricsList) {
      metricsList.innerHTML = '';
    }
    if (updatedEl) {
      updatedEl.textContent = '';
    }
    return;
  }
  const score = Math.max(0, Math.min(100, Math.round(decision.globalScore * 100)));
  scoreEl.textContent = `${score}/100`;
  gaugeEl.style.width = `${score}%`;
  applyScoreTone(score);
  const aggregates = decision.aggregates ?? {};
  const moonValue = Number.isFinite(aggregates.moonIllumination)
    ? Math.round(aggregates.moonIllumination * 100)
    : null;
  const avgAltitudeValue = Number.isFinite(aggregates.avgAltitude) ? Math.round(aggregates.avgAltitude) : null;
  const avgVisibilityValue = Number.isFinite(aggregates.avgVisibility)
    ? Math.round(aggregates.avgVisibility * 100)
    : null;
  const skyWindowValue = Number.isFinite(aggregates.weather?.skyWindow)
    ? Math.round(aggregates.weather.skyWindow * 100)
    : null;
  const atmosphereValue = Number.isFinite(aggregates.weather?.atmosphere)
    ? Math.round(aggregates.weather.atmosphere * 100)
    : null;
  const generated = snapshot?.generatedAt ? formatLocalDateTime(snapshot.generatedAt) : null;
  if (metricsList) {
    metricsList.innerHTML = '';
    const metrics = [
      {
        key: 'altitude',
        label: 'Altitude moyenne',
        value: avgAltitudeValue != null ? `${avgAltitudeValue}°` : '—',
        icon: '🧭',
        tone: classifyMetric(avgAltitudeValue, { good: 55, warn: 35 })
      },
      {
        key: 'visibility',
        label: 'Couverture',
        value: avgVisibilityValue != null ? `${avgVisibilityValue}%` : '—',
        icon: '🛰️',
        tone: classifyMetric(avgVisibilityValue, { good: 70, warn: 40 })
      },
      {
        key: 'sky',
        label: 'Fenêtre ciel',
        value: skyWindowValue != null ? `${skyWindowValue}%` : '—',
        icon: '🌤️',
        tone: classifyMetric(skyWindowValue, { good: 65, warn: 40 })
      },
      {
        key: 'atmosphere',
        label: 'Atmosphère',
        value: atmosphereValue != null ? `${atmosphereValue}%` : '—',
        icon: '💨',
        tone: classifyMetric(atmosphereValue, { good: 65, warn: 40 })
      },
      {
        key: 'moon',
        label: 'Influence lune',
        value: moonValue != null ? `${moonValue}%` : '—',
        icon: '🌙',
        tone: classifyMetric(moonValue, { good: 70, warn: 40, invert: true })
      }
    ];
    metrics.forEach((metric) => {
      const item = document.createElement('li');
      item.dataset.metric = metric.key;
      if (metric.tone !== 'neutral') {
        item.dataset.tone = metric.tone;
      }
      const labelWrap = document.createElement('span');
      labelWrap.className = 'metric-label';
      const icon = document.createElement('span');
      icon.className = 'metric-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = metric.icon;
      const text = document.createElement('span');
      text.textContent = metric.label;
      labelWrap.appendChild(icon);
      labelWrap.appendChild(text);
      const strong = document.createElement('strong');
      strong.textContent = metric.value;
      item.appendChild(labelWrap);
      item.appendChild(strong);
      metricsList.appendChild(item);
    });
  }
  if (updatedEl) {
    updatedEl.textContent = generated ? `Synthèse générée le ${generated}` : '';
  }
  const parts = [];
  if (skyWindowValue != null) parts.push(`🌤️ Fenêtre ciel ${skyWindowValue}%`);
  if (atmosphereValue != null) parts.push(`💨 Atmosphère ${atmosphereValue}%`);
  if (moonValue != null) parts.push(`🌙 Lune ${moonValue}%`);
  detailsEl.textContent = parts.length > 0 ? parts.join(' • ') : decision.globalLabel ?? 'Conditions en attente.';
}

function renderSummary(decision, snapshot) {
  if (!summaryEl) return;
  if (!decision || !Number.isFinite(decision.globalScore)) {
    summaryEl.textContent = 'Aucune analyse récente. Retourne sur la page principale pour lancer un calcul.';
    return;
  }
  summaryEl.textContent = decision.globalSummary;
}

function bootstrap() {
  const snapshot = enrichEntriesWithTrack(readSnapshot());
  const decision = ensureDecision(snapshot);
  renderSummary(decision, snapshot);
  renderScore(decision, snapshot);
  renderContext(snapshot);
  renderWeather(snapshot);
  renderMoon(snapshot);
  const topEntries = pickTopEntries(snapshot);
  renderTimeline(topEntries);
  renderTopTargets(topEntries);
  renderAlerts(decision);
  renderCalendar(decision);
  renderAstrophoto(decision);
}

bootstrap();
