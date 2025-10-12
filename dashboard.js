import {
  SESSION_STORAGE_KEY,
  NIGHT_MODE_STORAGE_KEY,
  buildWeatherSummary,
  computeDecisionInsights,
  formatAltitude,
  formatCoordinate,
  formatIllumination,
  formatLocalDateTime,
  formatLocalTime,
  describeAzimuth
} from './astro-core.js';
import { renderAltitudeSparkline } from './charts.js';

const summaryEl = document.getElementById('dashboardSummary');
const scoreEl = document.getElementById('dashboardScore');
const gaugeEl = document.getElementById('dashboardGauge');
const detailsEl = document.getElementById('dashboardDetails');
const metricsList = document.getElementById('dashboardMetrics');
const updatedEl = document.getElementById('dashboardUpdated');
const contextEl = document.getElementById('dashboardContext');
const weatherEl = document.getElementById('dashboardWeather');
const moonEl = document.getElementById('dashboardMoon');
const alertsList = document.getElementById('dashboardAlerts');
const calendarList = document.getElementById('dashboardCalendar');
const astroSummaryEl = document.getElementById('dashboardAstroSummary');
const astroList = document.getElementById('dashboardAstroList');
const timelineContainer = document.getElementById('dashboardTimeline');
const targetsGrid = document.getElementById('dashboardTargetsGrid');
const nightModeToggle = document.getElementById('nightModeToggle');

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
    return JSON.parse(raw);
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

function renderContext(snapshot) {
  if (!contextEl) return;
  if (!snapshot?.context) {
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
  const lines = [
    `<strong>Session :</strong> ${when} (${duration})`,
    `<strong>Coordonnées :</strong> lat ${latText}, lon ${lonText}`,
    `<strong>Pollution :</strong> ${bortleText}${summarySuffix ? ` — ${summarySuffix.trim()}` : ''}`
  ];
  contextEl.innerHTML = lines.join('<br>');
}

function renderWeather(snapshot) {
  if (!weatherEl) return;
  if (!snapshot?.weather) {
    weatherEl.textContent = 'Résumé météo indisponible.';
    return;
  }
  weatherEl.textContent = buildWeatherSummary(snapshot.weather);
}

function renderMoon(snapshot) {
  if (!moonEl) return;
  const moon = snapshot?.moon;
  if (!moon) {
    moonEl.textContent = 'Phase lunaire non calculée.';
    return;
  }
  moonEl.textContent = `${moon.emoji ?? '🌙'} ${moon.name} — ${formatIllumination(moon.illumination)} éclairée.`;
}

function renderAlerts(decision) {
  if (!alertsList) return;
  alertsList.innerHTML = '';
  if (!decision || !Array.isArray(decision.alerts) || decision.alerts.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'Aucune alerte détectée pour la dernière session.';
    alertsList.appendChild(item);
    return;
  }
  decision.alerts.forEach((alert) => {
    const item = document.createElement('li');
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
    item.appendChild(title);
    item.appendChild(span);
    alertsList.appendChild(item);
  });
}

function renderCalendar(decision) {
  if (!calendarList) return;
  calendarList.innerHTML = '';
  if (!decision || !Array.isArray(decision.calendar) || decision.calendar.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'Relance une analyse pour générer le calendrier des fenêtres.';
    calendarList.appendChild(item);
    return;
  }
  decision.calendar.forEach((entry) => {
    const item = document.createElement('li');
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
    item.appendChild(title);
    item.appendChild(span);
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
    const item = document.createElement('li');
    item.textContent = 'Aucune cible photo prioritaire avec les conditions actuelles.';
    astroList.appendChild(item);
    return;
  }
  astro.recommendations.forEach((entry) => {
    const item = document.createElement('li');
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
    item.appendChild(title);
    item.appendChild(span);
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
    card.className = 'mini-target';
    const header = document.createElement('header');
    header.className = 'mini-target__header';
    const title = document.createElement('h3');
    title.textContent = entry.object?.name ?? `Objet ${index + 1}`;
    const scoreValue = Math.max(0, Math.min(100, Math.round(getEntryScore(entry) * 100)));
    const scoreChip = document.createElement('span');
    scoreChip.className = 'score-chip';
    scoreChip.textContent = `${scoreValue}/100`;
    header.appendChild(title);
    header.appendChild(scoreChip);
    card.appendChild(header);

    const meta = document.createElement('p');
    meta.className = 'mini-target__meta';
    const bestTime = formatLocalTime(entry.bestTime);
    const altitude = formatAltitude(entry.altitude);
    const direction = describeAzimuth(entry.azimuth);
    meta.textContent = `${bestTime} • ${altitude} • ${direction}`;
    card.appendChild(meta);

    const metrics = document.createElement('dl');
    metrics.className = 'mini-target__metrics';
    const startDirection = describeAzimuth(entry.startAzimuth);
    const endDirection = describeAzimuth(entry.endAzimuth);
    const coveragePercent = Number.isFinite(entry.visibilityRatio)
      ? `${Math.round(entry.visibilityRatio * 100)}%`
      : '—';
    metrics.innerHTML = `
      <div><dt>Début</dt><dd>${formatAltitude(entry.startAltitude)} • ${startDirection}</dd></div>
      <div><dt>Fin</dt><dd>${formatAltitude(entry.endAltitude)} • ${endDirection}</dd></div>
      <div><dt>Temps &gt; 15°</dt><dd>${coveragePercent}</dd></div>
    `;
    card.appendChild(metrics);

    const chart = document.createElement('div');
    chart.className = 'visibility-chart';
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', `Altitude de ${entry.object?.name ?? 'la cible'} durant la session`);
    card.appendChild(chart);
    renderAltitudeSparkline(chart, entry.track, { objectName: entry.object?.name, width: 300, height: 150 });

    targetsGrid.appendChild(card);
  });
}

function renderScore(decision, snapshot) {
  if (!scoreEl || !gaugeEl || !detailsEl) return;
  if (!decision || !Number.isFinite(decision.globalScore)) {
    scoreEl.textContent = '—';
    gaugeEl.style.width = '0%';
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
  const aggregates = decision.aggregates ?? {};
  const moonPercent = Number.isFinite(aggregates.moonIllumination)
    ? `${Math.round(aggregates.moonIllumination * 100)}%`
    : '—';
  const avgAltitude = Number.isFinite(aggregates.avgAltitude) ? `${Math.round(aggregates.avgAltitude)}°` : '—';
  const avgVisibility = Number.isFinite(aggregates.avgVisibility)
    ? `${Math.round(aggregates.avgVisibility * 100)}%`
    : '—';
  const skyWindow = Number.isFinite(aggregates.weather?.skyWindow)
    ? `${Math.round(aggregates.weather.skyWindow * 100)}%`
    : '—';
  const atmosphere = Number.isFinite(aggregates.weather?.atmosphere)
    ? `${Math.round(aggregates.weather.atmosphere * 100)}%`
    : '—';
  const generated = snapshot?.generatedAt ? formatLocalDateTime(snapshot.generatedAt) : null;
  if (metricsList) {
    metricsList.innerHTML = '';
    const metrics = [
      { label: 'Altitude moyenne', value: avgAltitude },
      { label: 'Couverture', value: avgVisibility },
      { label: 'Fenêtre ciel', value: skyWindow },
      { label: 'Atmosphère', value: atmosphere },
      { label: 'Influence lune', value: moonPercent }
    ];
    metrics.forEach(({ label, value }) => {
      const item = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value;
      item.appendChild(span);
      item.appendChild(strong);
      metricsList.appendChild(item);
    });
  }
  if (updatedEl) {
    updatedEl.textContent = generated ? `Synthèse générée le ${generated}` : '';
  }
  const parts = [];
  if (skyWindow !== '—') parts.push(`Fenêtre ciel ${skyWindow}`);
  if (atmosphere !== '—') parts.push(`Atmosphère ${atmosphere}`);
  if (moonPercent !== '—') parts.push(`Lune ${moonPercent}`);
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
  const snapshot = readSnapshot();
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
