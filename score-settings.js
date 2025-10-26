import { NIGHT_MODE_STORAGE_KEY, getDefaultScoreWeights, setScoreWeightOverrides } from './src/core/astro.js';
import {
  loadScorePreferencesFromCookie,
  persistScorePreferences,
  resetScorePreferences
} from './score-preferences.js';

const CRITERIA_LABELS = {
  position: {
    label: 'Position angulaire',
    description:
      "Synthèse de l'altitude instantanée, moyenne et minimale pour juger la hauteur générale de l'objet durant la session."
  },
  airmass: {
    label: "Masse d'air",
    description:
      "Réduit la note lorsque l'objet reste proche de l'horizon et traverse une grande épaisseur d'atmosphère."
  },
  window: {
    label: 'Fenêtre de visibilité',
    description: "Part de la session durant laquelle l'objet dépasse le seuil d'altitude utile."
  },
  usefulDuration: {
    label: 'Durée utile',
    description: "Heures cumulées réellement exploitables au-dessus du seuil de visibilité pendant la session."
  },
  trackStability: {
    label: 'Stabilité de trajectoire',
    description: 'Mesure la variation d’altitude au fil du temps pour privilégier les passages réguliers.'
  },
  brightness: {
    label: 'Luminosité apparente',
    description: 'Privilégie les cibles brillantes ou à magnitude accessible pour le matériel indiqué.'
  },
  contrast: {
    label: 'Contraste objet/ciel',
    description:
      'Combine magnitude, pollution lumineuse, éclairement lunaire, transparence et niveau de crépuscule pour refléter le contraste perçu.'
  },
  seasonal: {
    label: 'Saisonnalité',
    description:
      'Pondère selon la période de l’année, la durée de nuit et la hauteur du Soleil autour de la fenêtre d’observation.'
  },
  lightPollution: {
    label: 'Compatibilité ciel local',
    description: 'Compare la qualité de ciel disponible (Bortle) aux besoins de la cible pour ajuster sa lisibilité.'
  },
  transparency: {
    label: 'Transparence atmosphérique',
    description: 'Évalue brume, humidité et particules fines pour juger la clarté du ciel indépendamment des nuages.'
  },
  seeing: {
    label: 'Turbulence (seeing)',
    description: 'Évalue la stabilité des images pour les détails fins (planètes, étoiles doubles, amas serrés).'
  },
  clouds: {
    label: 'Fenêtre météo (nuages/pluie)',
    description: 'Mesure la portion exploitable en écartant les créneaux couverts ou pluvieux — complémentaire à la transparence.'
  },
  moon: {
    label: 'Éclairement lunaire & séparation',
    description: 'Mesure l’impact de la phase, de la hauteur et de la distance angulaire de la Lune vis-à-vis de la cible.'
  },
  planning: {
    label: 'Optimisation de session',
    description:
      'Prend en compte localisation, horaire choisi et synchronisation du créneau avec la meilleure fenêtre de passage.'
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

