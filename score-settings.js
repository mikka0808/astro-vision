import { NIGHT_MODE_STORAGE_KEY, getDefaultScoreWeights, setScoreWeightOverrides } from './astro-core.js';
import {
  loadScorePreferencesFromCookie,
  persistScorePreferences,
  resetScorePreferences
} from './score-preferences.js';

const CRITERIA_LABELS = {
  altitude: {
    label: 'Altitude instantanée',
    description: "Hauteur de l'objet au moment optimal d'observation."
  },
  averageAltitude: {
    label: 'Altitude moyenne',
    description: 'Évalue la hauteur sur l’ensemble de la plage de visibilité.'
  },
  startAltitude: {
    label: 'Altitude au début',
    description: 'Prend en compte la hauteur lors du démarrage de la session.'
  },
  stability: {
    label: 'Stabilité de l’altitude',
    description: 'Récompense les trajectoires qui dérivent peu pendant la séance.'
  },
  coverage: {
    label: 'Fenêtre de visibilité',
    description: 'Mesure la proportion de la séance où l’objet reste observable.'
  },
  duration: {
    label: 'Durée utile',
    description: "Valorise les objets visibles longtemps pendant la session."
  },
  brightness: {
    label: 'Luminosité perçue',
    description: 'Favorise les cibles brillantes adaptées au matériel indiqué.'
  },
  seasonal: {
    label: 'Saisonnalité',
    description: 'Pondère selon la période idéale de l’année.'
  },
  bortle: {
    label: 'Adaptation à la pollution lumineuse',
    description: 'Ajuste le score aux conditions de ciel selon la classe de Bortle.'
  },
  weather: {
    label: 'Conditions météo',
    description: 'Combine la transparence, le seeing et l’absence de nuages.'
  },
  moon: {
    label: 'Impact de la Lune',
    description: 'Corrige la note selon la phase et la hauteur de la Lune.'
  },
  context: {
    label: 'Contexte session',
    description: 'Prend en compte les données de localisation et d’alignement horaire.'
  }
};

const sliders = [];
const weightsContainer = document.getElementById('scoreWeightControls');
const totalOutput = document.getElementById('scoreWeightsTotal');
const resetButton = document.getElementById('resetScoreWeights');
const summaryList = document.getElementById('scoreWeightsSummary');
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

function renderSummary(weights) {
  if (!summaryList) return;
  summaryList.innerHTML = '';
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  Object.entries(weights)
    .map(([key, value]) => ({ key, percent: (value / total) * 100 }))
    .sort((a, b) => b.percent - a.percent)
    .forEach(({ key, percent }) => {
      const meta = CRITERIA_LABELS[key];
      const item = document.createElement('li');
      item.className = 'score-summary__item';
      item.innerHTML = `
        <span class="score-summary__label">${meta ? meta.label : key}</span>
        <span class="score-summary__value">${percent.toFixed(1)} %</span>
      `;
      summaryList.appendChild(item);
    });
}

function updateWeightsFromSliders() {
  if (!weightsContainer) return;
  const rawValues = {};
  let totalRaw = 0;
  sliders.forEach(({ key, input }) => {
    const raw = Math.max(0, Number(input.value));
    rawValues[key] = raw;
    totalRaw += raw;
  });

  if (totalRaw <= 0) {
    const defaults = getDefaultScoreWeights();
    setScoreWeightOverrides(defaults);
    persistScorePreferences(defaults);
    sliders.forEach(({ key, input, output }) => {
      const weight = Number(defaults[key] ?? 0);
      input.value = Math.round(weight * 100);
      output.textContent = `${(weight * 100).toFixed(1)} %`;
    });
    if (totalOutput) {
      totalOutput.textContent = 'Total brut : 0 — réinitialisation sur les valeurs recommandées (100 %).';
    }
    renderSummary(defaults);
    return;
  }

  const weights = {};
  sliders.forEach(({ key, input, output }) => {
    const normalized = rawValues[key] / totalRaw;
    weights[key] = normalized;
    output.textContent = `${(normalized * 100).toFixed(1)} %`;
  });
  if (totalOutput) {
    totalOutput.textContent = `Total brut : ${totalRaw.toFixed(1)} — répartition normalisée à 100 %.`;
  }
  setScoreWeightOverrides(weights);
  persistScorePreferences(weights);
  renderSummary(weights);
}

function buildSlider(key, { label, description }) {
  const field = document.createElement('div');
  field.className = 'score-weight';

  const header = document.createElement('div');
  header.className = 'score-weight__header';
  const title = document.createElement('h3');
  title.className = 'score-weight__title';
  title.textContent = label;
  header.appendChild(title);
  const output = document.createElement('output');
  output.className = 'score-weight__value';
  output.setAttribute('for', `score-${key}`);
  header.appendChild(output);
  field.appendChild(header);

  const input = document.createElement('input');
  input.type = 'range';
  input.id = `score-${key}`;
  input.className = 'score-weight__slider';
  input.min = '0';
  input.max = '200';
  input.step = '1';
  input.dataset.key = key;
  field.appendChild(input);

  if (description) {
    const hint = document.createElement('p');
    hint.className = 'score-weight__hint';
    hint.textContent = description;
    field.appendChild(hint);
  }

  input.addEventListener('input', updateWeightsFromSliders);
  sliders.push({ key, input, output });
  weightsContainer.appendChild(field);
}

function initialiseSliders() {
  if (!weightsContainer) return;
  const weights = loadScorePreferencesFromCookie();
  const defaults = getDefaultScoreWeights();
  Object.entries(CRITERIA_LABELS).forEach(([key, meta]) => {
    buildSlider(key, meta);
  });
  sliders.forEach(({ key, input }) => {
    const weight = Number((weights && weights[key]) ?? defaults[key] ?? 0);
    input.value = Math.round(weight * 100);
  });
  updateWeightsFromSliders();
}

if (weightsContainer) {
  initialiseSliders();
}

if (resetButton) {
  resetButton.addEventListener('click', (event) => {
    event.preventDefault();
    const defaults = resetScorePreferences();
    sliders.forEach(({ key, input }) => {
      const weight = Number(defaults[key] ?? 0);
      input.value = Math.round(weight * 100);
    });
    updateWeightsFromSliders();
  });
}

if (nightModeToggle) {
  nightModeToggle.addEventListener('click', () => {
    const next = !document.body.classList.contains('night-mode');
    applyNightMode(next);
  });
}

initNightMode();

