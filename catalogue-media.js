export const DEFAULT_IMAGE_CREDIT = 'ESO / ESA / Hubble';

export const IMAGE_OVERRIDES = {
  31: {
    sources: [
      'https://cdn.eso.org/images/wallpaper1/m31.jpg',
      'https://cdn.eso.org/images/screen/messier31.jpg'
    ],
    credit: 'ESO'
  },
  42: {
    sources: [
      'https://cdn.eso.org/images/wallpaper1/m42.jpg',
      'https://cdn.eso.org/images/screen/messier42.jpg'
    ],
    credit: 'ESO / DSS2'
  },
  45: {
    sources: [
      'https://cdn.eso.org/images/wallpaper1/m45.jpg',
      'https://cdn.eso.org/images/screen/messier45.jpg'
    ],
    credit: 'ESO / Pleïades'
  },
  51: {
    sources: [
      'https://cdn.eso.org/images/wallpaper1/m51.jpg',
      'https://cdn.eso.org/images/screen/messier51.jpg'
    ],
    credit: 'ESO / NASA'
  },
  57: {
    sources: [
      'https://cdn.eso.org/images/wallpaper1/m57.jpg',
      'https://cdn.eso.org/images/screen/messier57.jpg'
    ],
    credit: 'ESO / NASA'
  }
};

function buildImageCandidates(id) {
  const padded = String(id).padStart(3, '0');
  const base = String(id);
  return [
    // ESO diffuse plusieurs formats sans numéro à trois chiffres : on tente ces
    // déclinaisons en priorité.
    `https://cdn.eso.org/images/large/messier${base}.jpg`,
    `https://cdn.eso.org/images/screen/messier${base}.jpg`,
    // Certaines ressources plus anciennes conservent l'identifiant sur trois chiffres.
    `https://cdn.eso.org/images/large/messier${padded}.jpg`,
    `https://cdn.eso.org/images/screen/messier${padded}.jpg`,
    // NASA met à disposition des vignettes Messier via son portail science.
    `https://science.nasa.gov/wp-content/uploads/2023/06/messier-${base}.jpg`,
    `https://www.nasa.gov/wp-content/uploads/2023/06/messier-${base}.jpg`,
    // Messier Objects fournit un catalogue photo librement accessible.
    `https://www.messier-objects.com/wp-content/uploads/2012/01/messier-${base}.jpg`,
    // Astronexus maintient un dépôt GitHub avec des rendus monocanal.
    `https://raw.githubusercontent.com/astronexus/Messier/master/PNG/m${padded}.png`,
    `https://raw.githubusercontent.com/astronexus/Messier/master/JPG/m${padded}.jpg`
  ];
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = seed + 0x6d2b79f5;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawGalaxy(ctx, random) {
  const cx = ctx.canvas.width / 2;
  const cy = ctx.canvas.height / 2;
  const angle = random() * Math.PI;
  const major = 40 + random() * 40;
  const minor = major * (0.35 + random() * 0.15);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const steps = 40;
  for (let i = steps; i >= 1; i -= 1) {
    const t = i / steps;
    ctx.globalAlpha = 0.06 + 0.6 * Math.pow(1 - t, 1.5);
    ctx.fillStyle = `rgb(${Math.round(20 + t * 220)}, ${Math.round(20 + t * 220)}, ${Math.round(20 + t * 220)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, major * t, minor * t, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 4 + random() * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawNebula(ctx, random) {
  const cx = ctx.canvas.width / 2;
  const cy = ctx.canvas.height / 2;
  const blobs = 6 + Math.floor(random() * 6);
  for (let i = 0; i < blobs; i += 1) {
    const size = 25 + random() * 40;
    const x = cx + (random() - 0.5) * 60;
    const y = cy + (random() - 0.5) * 60;
    ctx.globalAlpha = 0.08 + random() * 0.15;
    const grey = Math.round(100 + random() * 120);
    ctx.fillStyle = `rgb(${grey}, ${grey}, ${grey})`;
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * (0.6 + random() * 0.6), random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawCluster(ctx, random) {
  const count = 90;
  for (let i = 0; i < count; i += 1) {
    const x = random() * ctx.canvas.width;
    const y = random() * ctx.canvas.height;
    const size = random() * 2.4;
    const light = Math.round(180 + random() * 75);
    ctx.globalAlpha = 0.4 + random() * 0.6;
    ctx.fillStyle = `rgb(${light}, ${light}, ${light})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOther(ctx, random) {
  const arms = 4 + Math.floor(random() * 3);
  const length = 50 + random() * 50;
  const cx = ctx.canvas.width / 2;
  const cy = ctx.canvas.height / 2;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#f0f0f0';
  ctx.beginPath();
  ctx.arc(cx, cy, 8 + random() * 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#cfd3dc';
  ctx.lineWidth = 2.4;
  for (let arm = 0; arm < arms; arm += 1) {
    const angle = (arm / arms) * Math.PI * 2 + random() * 0.2;
    const x = cx + Math.cos(angle) * length;
    const y = cy + Math.sin(angle) * length;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}

export function resolveImageSources(object) {
  const number = Number(object?.number);
  if (!Number.isFinite(number)) {
    return null;
  }
  const override = IMAGE_OVERRIDES[number];
  if (override) {
    return {
      sources: [...override.sources],
      credit: override.credit || DEFAULT_IMAGE_CREDIT
    };
  }
  return {
    sources: buildImageCandidates(number),
    credit: DEFAULT_IMAGE_CREDIT
  };
}

export function createCanvasPreview(object) {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  canvas.className = 'preview-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#030303';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const random = createRandom(hashString(object.name));
  const type = (object.type || '').toLowerCase();
  if (type.includes('galaxie')) {
    drawGalaxy(ctx, random);
  } else if (type.includes('nébuleuse')) {
    drawNebula(ctx, random);
  } else if (type.includes('amas')) {
    drawCluster(ctx, random);
  } else {
    drawOther(ctx, random);
  }
  return canvas;
}

export function createObservationPreview(object) {
  const sources = resolveImageSources(object);
  if (!sources || !Array.isArray(sources.sources) || sources.sources.length === 0) {
    return createCanvasPreview(object);
  }

  const figure = document.createElement('figure');
  figure.className = 'preview-figure';

  const img = document.createElement('img');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.className = 'preview-image';
  img.alt = `Observation télescopique monochrome de ${object.name}`;
  img.referrerPolicy = 'no-referrer';

  const credit = document.createElement('figcaption');
  credit.className = 'preview-credit';
  credit.textContent = sources.credit ? `Crédit : ${sources.credit}` : 'Crédit : Source télescopique';

  figure.appendChild(img);
  figure.appendChild(credit);

  const candidates = Array.from(new Set(sources.sources.filter(Boolean)));
  let index = 0;

  const loadNextCandidate = () => {
    if (index >= candidates.length) {
      img.removeEventListener('error', loadNextCandidate);
      img.remove();
      const fallback = createCanvasPreview(object);
      figure.insertBefore(fallback, credit);
      credit.textContent = 'Visualisation générée par Astro Soir';
      return;
    }
    const candidate = candidates[index];
    index += 1;
    if (candidate) {
      img.src = candidate;
    } else {
      loadNextCandidate();
    }
  };

  img.addEventListener('error', loadNextCandidate);
  img.addEventListener('load', () => {
    img.removeEventListener('error', loadNextCandidate);
  });

  loadNextCandidate();

  return figure;
}
