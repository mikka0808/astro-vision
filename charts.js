import { formatLocalTime } from './astro-core.js';

const NOW_MARKER_SYMBOL = Symbol('visibilityChartNowMarker');

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
  const previousMarker = container[NOW_MARKER_SYMBOL];
  if (previousMarker && typeof previousMarker.stop === 'function') {
    previousMarker.stop();
  }
  const {
    objectName = 'la cible',
    width = 280,
    height = 140,
    threshold = 30,
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

  const thresholdAltitude = Number.isFinite(threshold) ? threshold : null;

  if (thresholdAltitude !== null) {
    const thresholdY = scaleY(thresholdAltitude);
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

  const altitudeAt = (time) => {
    if (track.length === 0) return null;
    if (track.length === 1) return track[0].altitude;
    if (time <= minTime) return track[0].altitude;
    if (time >= maxTime) return track[track.length - 1].altitude;
    for (let i = 0; i < track.length - 1; i += 1) {
      const current = track[i];
      const next = track[i + 1];
      const start = current.date.getTime();
      const end = next.date.getTime();
      if (time >= start && time <= end) {
        if (end === start) {
          return next.altitude;
        }
        const ratio = (time - start) / (end - start);
        return current.altitude + (next.altitude - current.altitude) * ratio;
      }
    }
    return null;
  };

  const nowLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  nowLine.setAttribute('y1', margin.top);
  nowLine.setAttribute('y2', margin.top + chartHeight);
  nowLine.setAttribute('class', 'visibility-chart__now-line');
  nowLine.setAttribute('display', 'none');

  const nowDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  nowDot.setAttribute('r', 4.2);
  nowDot.setAttribute('class', 'visibility-chart__now-dot');
  nowDot.setAttribute('display', 'none');

  const updateNowMarker = () => {
    const now = Date.now();
    if (now < minTime || now > maxTime) {
      nowLine.setAttribute('display', 'none');
      nowDot.setAttribute('display', 'none');
      return;
    }

    const x = scaleX(now);
    nowLine.setAttribute('x1', x);
    nowLine.setAttribute('x2', x);
    nowLine.removeAttribute('display');

    const nowAltitude = altitudeAt(now);
    if (Number.isFinite(nowAltitude)) {
      nowDot.setAttribute('cx', x);
      nowDot.setAttribute('cy', scaleY(nowAltitude));
      nowDot.removeAttribute('display');
    } else {
      nowDot.setAttribute('display', 'none');
    }
  };

  const markerState = { stop: null };
  container[NOW_MARKER_SYMBOL] = markerState;

  const hasRAF = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function';
  if (hasRAF) {
    const raf = window.requestAnimationFrame.bind(window);
    const caf = typeof window.cancelAnimationFrame === 'function'
      ? window.cancelAnimationFrame.bind(window)
      : null;
    let frameId = null;
    const step = () => {
      updateNowMarker();
      frameId = raf(step);
    };
    frameId = raf(step);
    updateNowMarker();
    markerState.stop = () => {
      if (frameId !== null && caf) {
        caf(frameId);
        frameId = null;
      }
      if (container[NOW_MARKER_SYMBOL] === markerState) {
        delete container[NOW_MARKER_SYMBOL];
      }
    };
  } else {
    updateNowMarker();
    const intervalId = setInterval(updateNowMarker, 60000);
    markerState.stop = () => {
      clearInterval(intervalId);
      if (container[NOW_MARKER_SYMBOL] === markerState) {
        delete container[NOW_MARKER_SYMBOL];
      }
    };
  }

  track.forEach((point, index) => {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', scaleX(point.date.getTime()));
    dot.setAttribute('cy', scaleY(point.altitude));
    dot.setAttribute('r', index === 0 || index === track.length - 1 ? 3.5 : 2.5);
    dot.setAttribute('class', 'visibility-chart__dot');
    svg.appendChild(dot);
  });

  svg.appendChild(nowLine);
  svg.appendChild(nowDot);

  const labelCandidates = [];
  if (thresholdAltitude !== null) {
    labelCandidates.push(thresholdAltitude);
  }
  [30, 60, 45, 75].forEach((alt) => {
    if (!labelCandidates.some((value) => Math.abs(value - alt) < 0.1)) {
      labelCandidates.push(alt);
    }
  });
  labelCandidates.forEach((alt) => {
    if (!Number.isFinite(alt)) return;
    const y = scaleY(alt);
    if (y <= margin.top || y >= margin.top + chartHeight) return;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', 6);
    text.setAttribute('y', y + 4);
    const classes = ['visibility-chart__label'];
    if (thresholdAltitude !== null && Math.abs(alt - thresholdAltitude) < 0.1) {
      classes.push('visibility-chart__label--threshold');
    }
    text.setAttribute('class', classes.join(' '));
    text.textContent = `${Math.round(alt)}°`;
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
