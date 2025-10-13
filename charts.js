import { formatLocalTime } from './astro-core.js';

function normaliseTrack(trackSource = []) {
  if (!Array.isArray(trackSource)) {
    return [];
  }
  return trackSource
    .map((point) => {
      if (!point) return null;
      const iso = point.timeISO || point.time || point.iso;
      const altitude = Number(point.altitude);
      if (!iso || !Number.isFinite(altitude)) return null;
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return null;
      return { date, altitude };
    })
    .filter(Boolean);
}

export function renderAltitudeSparkline(container, trackSource, options = {}) {
  if (!container) return;
  const {
    objectName = 'la cible',
    width = 280,
    height = 140,
    threshold = 15,
    showTimes = true,
    palette = null
  } = options;

  const track = normaliseTrack(trackSource);
  container.innerHTML = '';
  container.classList.remove('visibility-chart--empty');
  if (palette) {
    container.classList.add(`visibility-chart--${palette}`);
  }

  if (track.length === 0) {
    container.classList.add('visibility-chart--empty');
    const fallback = document.createElement('p');
    fallback.className = 'visibility-chart__empty';
    fallback.textContent = "Courbe de visibilité indisponible pour cet objet.";
    container.appendChild(fallback);
    return;
  }

  track.sort((a, b) => a.date.getTime() - b.date.getTime());
  const minTime = track[0].date.getTime();
  const maxTime = track[track.length - 1].date.getTime();
  const span = Math.max(1, maxTime - minTime);

  const margin = { top: 12, right: 12, bottom: showTimes ? 26 : 18, left: 32 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const clampAltitude = (value) => Math.max(0, Math.min(90, value));
  const scaleX = (time) => margin.left + ((time - minTime) / span) * chartWidth;
  const scaleY = (altitude) => margin.top + chartHeight - (clampAltitude(altitude) / 90) * chartHeight;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-hidden', 'true');

  const desc = document.createElementNS('http://www.w3.org/2000/svg', 'desc');
  const stepMinutes =
    track.length > 1 ? Math.round((track[1].date.getTime() - track[0].date.getTime()) / 60000) : null;
  desc.textContent = `Altitude de ${objectName}${stepMinutes ? ` toutes les ${stepMinutes} minutes` : ''}.`;
  svg.appendChild(desc);

  const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  baseline.setAttribute('x1', margin.left);
  baseline.setAttribute('x2', margin.left + chartWidth);
  baseline.setAttribute('y1', margin.top + chartHeight);
  baseline.setAttribute('y2', margin.top + chartHeight);
  baseline.setAttribute('class', 'visibility-chart__axis');
  svg.appendChild(baseline);

  if (Number.isFinite(threshold)) {
    const thresholdY = scaleY(threshold);
    const thresholdLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    thresholdLine.setAttribute('x1', margin.left);
    thresholdLine.setAttribute('x2', margin.left + chartWidth);
    thresholdLine.setAttribute('y1', thresholdY);
    thresholdLine.setAttribute('y2', thresholdY);
    thresholdLine.setAttribute('class', 'visibility-chart__threshold');
    svg.appendChild(thresholdLine);
  }

  const firstX = scaleX(track[0].date.getTime());
  const lastX = scaleX(track[track.length - 1].date.getTime());

  if (track.length > 1) {
    const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const areaSegments = track
      .map((point) => `L ${scaleX(point.date.getTime())} ${scaleY(point.altitude)}`)
      .join(' ');
    areaPath.setAttribute('d', `M ${firstX} ${margin.top + chartHeight} ${areaSegments} L ${lastX} ${margin.top + chartHeight} Z`);
    areaPath.setAttribute('class', 'visibility-chart__area');
    svg.appendChild(areaPath);
  }

  const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const pathData = track
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.date.getTime())} ${scaleY(point.altitude)}`)
    .join(' ');
  linePath.setAttribute('d', pathData);
  linePath.setAttribute('class', 'visibility-chart__line');
  svg.appendChild(linePath);

  const now = Date.now();
  if (now >= minTime && now <= maxTime) {
    const nowLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const x = scaleX(now);
    nowLine.setAttribute('x1', x);
    nowLine.setAttribute('x2', x);
    nowLine.setAttribute('y1', margin.top);
    nowLine.setAttribute('y2', margin.top + chartHeight);
    nowLine.setAttribute('class', 'visibility-chart__now-line');
    svg.appendChild(nowLine);
  }

  track.forEach((point, index) => {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', scaleX(point.date.getTime()));
    dot.setAttribute('cy', scaleY(point.altitude));
    dot.setAttribute('r', index === 0 || index === track.length - 1 ? 3.5 : 2.5);
    dot.setAttribute('class', 'visibility-chart__dot');
    svg.appendChild(dot);
  });

  [15, 45, 75].forEach((alt) => {
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

  if (showTimes) {
    const times = document.createElement('div');
    times.className = 'visibility-chart__times';
    const first = track[0].date.toISOString();
    const middle = track[Math.floor(track.length / 2)].date.toISOString();
    const last = track[track.length - 1].date.toISOString();
    times.innerHTML = `<span>${formatLocalTime(first)}</span><span>${formatLocalTime(middle)}</span><span>${formatLocalTime(last)}</span>`;
    container.appendChild(times);
  }
}
